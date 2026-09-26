const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getFileExtension,
  isAllowedUpload,
  extractTextFromFile,
  normalizeLevel,
  normalizeLength,
  buildAssignmentPrompt,
  splitAssignmentResult,
  slugify,
  normalizeExportFormat,
  buildTxtBuffer,
  buildPdfBuffer,
  buildDocxBuffer,
} = require('../utils/documents');
const { BANNED_PHRASES } = require('../utils/humanTone');
const { fileFilter, handleUploadError } = require('../middleware/upload');

// ---------- documents utils ----------

test('upload extension whitelist accepts pdf/docx/txt and rejects the rest', () => {
  assert.equal(isAllowedUpload('notes.txt'), true);
  assert.equal(isAllowedUpload('report.PDF'), true);
  assert.equal(isAllowedUpload('essay.Docx'), true);
  assert.equal(isAllowedUpload('script.exe'), false);
  assert.equal(isAllowedUpload('archive.zip'), false);
  assert.equal(isAllowedUpload('noextension'), false);
  assert.equal(getFileExtension('a/b/c.PDF'), '.pdf');
});

test('slugify produces safe filenames and falls back to docmind-export', () => {
  assert.equal(slugify('My Assignment Title!'), 'my-assignment-title');
  assert.equal(slugify('  spaces  & symbols?? '), 'spaces-symbols');
  assert.equal(slugify(''), 'docmind-export');
  assert.equal(slugify('!!!'), 'docmind-export');
});

test('normalizeLevel/normalizeLength default and enforce whitelists', () => {
  assert.equal(normalizeLevel(undefined), 'college');
  assert.equal(normalizeLevel('university'), 'university');
  assert.throws(() => normalizeLevel('phd'), /Invalid level/);
  assert.equal(normalizeLength(''), 'medium');
  assert.equal(normalizeLength('long'), 'long');
  assert.throws(() => normalizeLength('huge'), /Invalid length/);
});

test('normalizeExportFormat only allows pdf, docx, txt', () => {
  assert.equal(normalizeExportFormat('pdf'), 'pdf');
  assert.equal(normalizeExportFormat('docx'), 'docx');
  assert.equal(normalizeExportFormat('txt'), 'txt');
  assert.throws(() => normalizeExportFormat('xlsx'), /Invalid format/);
  assert.throws(() => normalizeExportFormat(undefined), /Invalid format/);
});

test('buildAssignmentPrompt carries topic, level note and word targets', () => {
  const short = buildAssignmentPrompt({ topic: 'Photosynthesis', level: 'school', length: 'short' });
  assert.match(short, /Photosynthesis/);
  assert.match(short, /about 400 words/);
  assert.match(short, /school student/);
  const long = buildAssignmentPrompt({ topic: 'Photosynthesis', level: 'university', length: 'long' });
  assert.match(long, /about 1600 words/);
  assert.match(long, /university student/);
  const medium = buildAssignmentPrompt({ topic: 'X', level: 'college', length: 'medium' });
  assert.match(medium, /about 900 words/);
  // human-tone rules are embedded and every banned phrase is named
  for (const phrase of BANNED_PHRASES) {
    assert.match(medium, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  }
  // optional student instructions are included
  const withInstr = buildAssignmentPrompt({
    topic: 'X', level: 'college', length: 'medium', instructions: 'Use bullet points',
  });
  assert.match(withInstr, /Use bullet points/);
});

test('splitAssignmentResult takes the title from the first line', () => {
  const { title, result } = splitAssignmentResult('My Title\n\nBody line one.\nBody line two.');
  assert.equal(title, 'My Title');
  assert.equal(result, 'Body line one.\nBody line two.');
});

test('extractTextFromFile reads txt, rejects bad extensions and empty files', async () => {
  const { text, ext } = await extractTextFromFile(Buffer.from('hello world', 'utf8'), 'notes.txt');
  assert.equal(text, 'hello world');
  assert.equal(ext, '.txt');
  await assert.rejects(
    extractTextFromFile(Buffer.from('x'), 'evil.exe'),
    /Unsupported file type/
  );
  await assert.rejects(
    extractTextFromFile(Buffer.from('   ', 'utf8'), 'empty.txt'),
    /No readable text/
  );
});

test('buildTxtBuffer returns title + content', () => {
  const buf = buildTxtBuffer('My Title', 'Some content');
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.toString('utf8'), 'My Title\n\nSome content');
});

test('buildPdfBuffer produces a real PDF', async () => {
  const buf = await buildPdfBuffer('My Title', 'Some content here');
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.slice(0, 4).toString(), '%PDF');
});

test('buildDocxBuffer produces a real docx (zip)', async () => {
  const buf = await buildDocxBuffer('My Title', 'Para one.\n\nPara two.');
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.slice(0, 2).toString(), 'PK');
});

// ---------- upload middleware ----------

test('fileFilter accepts whitelisted types and rejects others', (t, done) => {
  fileFilter({}, { originalname: 'notes.txt' }, (err, ok) => {
    assert.equal(err, null);
    assert.equal(ok, true);
    fileFilter({}, { originalname: 'script.exe' }, (err2) => {
      assert.ok(err2);
      assert.equal(err2.code, 'INVALID_FILE_TYPE');
      assert.match(err2.message, /Only \.pdf, \.docx and \.txt/);
      done();
    });
  });
});

test('handleUploadError maps oversize uploads to a clear 400', () => {
  const calls = [];
  const res = { status(c) { calls.push(['status', c]); return this; }, json(o) { calls.push(['json', o]); return this; } };
  const handled = handleUploadError({ code: 'LIMIT_FILE_SIZE' }, res);
  assert.equal(handled, true);
  assert.deepEqual(calls[0], ['status', 400]);
  assert.match(calls[1][1].message, /10MB/);
  assert.equal(handleUploadError(null, res), false);
});

// ---------- controllers (AI + DB stubbed) ----------

const aiClient = require('../utils/aiClient');
const History = require('../models/History');
const {
  analyzeText,
  uploadDocument,
  generateAssignment,
  exportDocument,
} = require('../controllers/aiController');

const mockRes = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  status(c) { this.statusCode = c; return this; },
  json(o) { this.body = o; return this; },
  setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
  send(b) { this.body = b; return this; },
});

test('controllers', async (t) => {
  const origGenerate = aiClient.generateContent;
  const origCreate = History.create;
  aiClient.generateContent = async () => 'Generated Title\n\nBody of the generated text.';
  History.create = async () => ({});
  t.after(() => {
    aiClient.generateContent = origGenerate;
    History.create = origCreate;
  });

  await t.test('analyzeText still rejects missing text with 400', async () => {
    const res = mockRes();
    await analyzeText({ body: {}, userId: 'u1' }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Text is required/);
  });

  await t.test('generateAssignment rejects a missing topic with 400', async () => {
    const res = mockRes();
    await generateAssignment({ body: { topic: '   ' }, userId: 'u1' }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Topic is required/);
  });

  await t.test('generateAssignment rejects a bad level with 400', async () => {
    const res = mockRes();
    await generateAssignment({ body: { topic: 'AI', level: 'phd' }, userId: 'u1' }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Invalid level/);
  });

  await t.test('generateAssignment rejects a bad length with 400', async () => {
    const res = mockRes();
    await generateAssignment({ body: { topic: 'AI', length: 'huge' }, userId: 'u1' }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Invalid length/);
  });

  await t.test('generateAssignment succeeds and splits title from result', async () => {
    const res = mockRes();
    await generateAssignment(
      { body: { topic: 'Photosynthesis', level: 'college', length: 'medium' }, userId: 'u1' },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.title, 'Generated Title');
    assert.equal(res.body.result, 'Body of the generated text.');
  });

  await t.test('exportDocument rejects bad format and missing content with 400', async () => {
    const res1 = mockRes();
    await exportDocument({ body: { content: 'hi', format: 'xlsx' } }, res1);
    assert.equal(res1.statusCode, 400);
    assert.match(res1.body.message, /Invalid format/);
    const res2 = mockRes();
    await exportDocument({ body: { format: 'pdf' } }, res2);
    assert.equal(res2.statusCode, 400);
    assert.match(res2.body.message, /Content is required/);
  });

  await t.test('exportDocument txt returns an attachment download', async () => {
    const res = mockRes();
    await exportDocument(
      { body: { title: 'My Doc', content: 'Hello export', format: 'txt' } },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'text/plain; charset=utf-8');
    assert.match(res.headers['content-disposition'], /attachment; filename="my-doc\.txt"/);
    assert.equal(res.body.toString('utf8'), 'My Doc\n\nHello export');
  });

  await t.test('exportDocument falls back to docmind-export filename', async () => {
    const res = mockRes();
    await exportDocument({ body: { content: 'hi', format: 'pdf' } }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-disposition'], /filename="docmind-export\.pdf"/);
    assert.equal(res.body.slice(0, 4).toString(), '%PDF');
  });

  await t.test('uploadDocument rejects a missing file with 400', async () => {
    const res = mockRes();
    await uploadDocument({ file: undefined, body: {}, userId: 'u1' }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /"document" field/);
  });

  await t.test('uploadDocument rejects a disallowed extension with 400', async () => {
    const res = mockRes();
    await uploadDocument(
      { file: { originalname: 'evil.exe', buffer: Buffer.from('x') }, body: {}, userId: 'u1' },
      res
    );
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Only \.pdf, \.docx and \.txt/);
  });

  await t.test('uploadDocument processes a valid txt through the AI pipeline', async () => {
    const res = mockRes();
    await uploadDocument(
      {
        file: { originalname: 'notes.txt', buffer: Buffer.from('some document text', 'utf8') },
        body: { task: 'summarize' },
        userId: 'u1',
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.task, 'summarize');
    assert.equal(res.body.filename, 'notes.txt');
    assert.equal(res.body.charsExtracted, 'some document text'.length);
    assert.ok(res.body.result);
  });
});
