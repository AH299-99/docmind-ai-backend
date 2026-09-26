// Pure helpers for the document upload / assignment / export features.
// No Express or DB access here — everything is unit tested in tests/.
const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, HeadingLevel, TextRun } = require('docx');
const { withHumanTone } = require('./humanTone');

const ALLOWED_UPLOAD_EXTS = ['.pdf', '.docx', '.txt'];
// Env-configurable so serverless hosts with small payload caps (e.g. Vercel's
// 4.5MB Hobby limit) can lower it via MAX_UPLOAD_MB without a code change.
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '10', 10) || 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const ALLOWED_LEVELS = ['school', 'college', 'university'];
const ALLOWED_LENGTHS = ['short', 'medium', 'long'];
const LENGTH_WORD_TARGETS = { short: 400, medium: 900, long: 1600 };

const getFileExtension = (filename) =>
  path.extname(String(filename || '')).toLowerCase();

const isAllowedUpload = (filename) =>
  ALLOWED_UPLOAD_EXTS.includes(getFileExtension(filename));

// Extract raw text from an uploaded file buffer based on its extension.
// Returns { text, ext }. Throws on unsupported types or empty results.
const extractTextFromFile = async (buffer, filename) => {
  const ext = getFileExtension(filename);
  if (!ALLOWED_UPLOAD_EXTS.includes(ext)) {
    throw new Error(
      `Unsupported file type "${ext || '(none)'}". Only .pdf, .docx and .txt files are allowed.`
    );
  }

  let text;
  if (ext === '.pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      text = result.text;
    } finally {
      if (typeof parser.destroy === 'function') await parser.destroy();
    }
  } else if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  } else {
    text = buffer.toString('utf8');
  }

  text = String(text || '').trim();
  if (!text) {
    throw new Error('No readable text found in the uploaded file.');
  }
  return { text, ext };
};

// Strict whitelists for the assignment endpoint — throw on anything else.
const normalizeLevel = (level) => {
  if (level === undefined || level === null || level === '') return 'college';
  if (!ALLOWED_LEVELS.includes(level)) {
    throw new Error(`Invalid level. Allowed values: ${ALLOWED_LEVELS.join(', ')}`);
  }
  return level;
};

const normalizeLength = (length) => {
  if (length === undefined || length === null || length === '') return 'medium';
  if (!ALLOWED_LENGTHS.includes(length)) {
    throw new Error(`Invalid length. Allowed values: ${ALLOWED_LENGTHS.join(', ')}`);
  }
  return length;
};

// Build the assignment prompt: original, human-toned, with a title,
// introduction, headed sections and a conclusion at the target length.
const buildAssignmentPrompt = ({ topic, instructions, level, length }) => {
  const words = LENGTH_WORD_TARGETS[length];
  const levelNote = {
    school: 'Write for a school student: keep ideas concrete and easy to follow.',
    college: 'Write for a college student: clear and reasonably detailed.',
    university: 'Write for a university student: deeper treatment with more nuance.',
  }[level];

  const extra = instructions && instructions.trim()
    ? `Extra instructions from the student: ${instructions.trim()}\n\n`
    : '';

  return withHumanTone(
    `Write a complete, original assignment on this topic: "${topic}"\n\n` +
      `${levelNote}\n` +
      extra +
      `Structure it exactly like this:\n` +
      `- The assignment title on the very first line (plain text, no "Title:" label)\n` +
      `- A blank line\n` +
      `- An introduction\n` +
      `- Several headed sections (use clear headings)\n` +
      `- A conclusion\n\n` +
      `Aim for about ${words} words. Write everything in fresh, natural wording — ` +
      `it must not read like copied or pasted text.`
  );
};

// Split the model's assignment output into a title (first line) and the rest.
const splitAssignmentResult = (fullText) => {
  const lines = String(fullText || '').split('\n');
  const title = (lines.shift() || '').trim();
  return { title, result: lines.join('\n').trim() };
};

// Turn a title into a safe download filename (no extension).
const slugify = (text) => {
  const slug = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'docmind-export';
};

const splitParagraphs = (content) =>
  String(content || '')
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

// PDF: title heading + body text (pdfkit wraps long lines automatically).
const buildPdfBuffer = (title, content) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    if (title) {
      doc.fontSize(20).text(title, { align: 'left' });
      doc.moveDown();
    }
    doc.fontSize(12).text(content || '', { align: 'left' });
    doc.end();
  });

// DOCX: title as a heading + one paragraph per blank-line-separated block.
const buildDocxBuffer = async (title, content) => {
  const children = [];
  if (title) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun({ text: title, bold: true })],
      })
    );
  }
  for (const para of splitParagraphs(content)) {
    children.push(new Paragraph({ children: [new TextRun(para)] }));
  }
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
};

// TXT: title, blank line, content.
const buildTxtBuffer = (title, content) =>
  Buffer.from(title ? `${title}\n\n${content || ''}` : content || '', 'utf8');

const EXPORT_FORMATS = {
  pdf: {
    ext: '.pdf',
    contentType: 'application/pdf',
    build: buildPdfBuffer,
  },
  docx: {
    ext: '.docx',
    contentType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    build: buildDocxBuffer,
  },
  txt: {
    ext: '.txt',
    contentType: 'text/plain; charset=utf-8',
    build: buildTxtBuffer,
  },
};

const normalizeExportFormat = (format) => {
  if (!Object.prototype.hasOwnProperty.call(EXPORT_FORMATS, format)) {
    throw new Error('Invalid format. Allowed values: pdf, docx, txt');
  }
  return format;
};

module.exports = {
  ALLOWED_UPLOAD_EXTS,
  MAX_UPLOAD_MB,
  MAX_UPLOAD_BYTES,
  ALLOWED_LEVELS,
  ALLOWED_LENGTHS,
  LENGTH_WORD_TARGETS,
  getFileExtension,
  isAllowedUpload,
  extractTextFromFile,
  normalizeLevel,
  normalizeLength,
  buildAssignmentPrompt,
  splitAssignmentResult,
  slugify,
  splitParagraphs,
  buildPdfBuffer,
  buildDocxBuffer,
  buildTxtBuffer,
  EXPORT_FORMATS,
  normalizeExportFormat,
};
