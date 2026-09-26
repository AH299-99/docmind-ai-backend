const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CHUNK_BYTES,
  MAX_CHUNKS,
  validateInitParams,
  validateChunkParams,
  assembleChunks,
} = require('../utils/chunkedUpload');
const { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } = require('../utils/documents');

// ---------- validateInitParams ----------

test('init accepts a valid small upload', () => {
  const out = validateInitParams({ filename: 'notes.txt', fileSize: 100, totalChunks: 1 });
  assert.equal(out.filename, 'notes.txt');
  assert.equal(out.fileSize, 100);
});

test('init rejects bad filenames and types', () => {
  assert.throws(() => validateInitParams({ filename: '', fileSize: 10, totalChunks: 1 }), /Filename is required/);
  assert.throws(() => validateInitParams({ filename: 'evil.exe', fileSize: 10, totalChunks: 1 }), /Unsupported file type/);
  assert.doesNotThrow(() => validateInitParams({ filename: 'a.PDF', fileSize: 10, totalChunks: 1 }));
});

test('init rejects oversize files with the configured MB message', () => {
  assert.throws(
    () => validateInitParams({ filename: 'big.pdf', fileSize: MAX_UPLOAD_BYTES + 1, totalChunks: MAX_CHUNKS }),
    new RegExp(`${MAX_UPLOAD_MB}MB`)
  );
});

test('init rejects bad chunk counts', () => {
  assert.throws(() => validateInitParams({ filename: 'a.txt', fileSize: 10, totalChunks: 0 }), /totalChunks/);
  assert.throws(() => validateInitParams({ filename: 'a.txt', fileSize: 10, totalChunks: MAX_CHUNKS + 1 }), /totalChunks/);
  // 10MB file needs at least ceil(10MB / CHUNK_BYTES) chunks
  const need = Math.ceil(MAX_UPLOAD_BYTES / CHUNK_BYTES);
  assert.throws(
    () => validateInitParams({ filename: 'a.txt', fileSize: MAX_UPLOAD_BYTES, totalChunks: need - 1 }),
    /too small/
  );
  assert.doesNotThrow(() =>
    validateInitParams({ filename: 'a.txt', fileSize: MAX_UPLOAD_BYTES, totalChunks: need })
  );
});

// ---------- validateChunkParams ----------

const fakeSession = { totalChunks: 3 };

test('chunk accepts valid base64 within the byte cap', () => {
  const buf = validateChunkParams(
    { uploadId: 'u1', index: 0, data: Buffer.from('hello').toString('base64') },
    fakeSession
  );
  assert.equal(buf.toString(), 'hello');
});

test('chunk rejects bad index, missing data and oversize chunks', () => {
  const good = Buffer.from('x').toString('base64');
  assert.throws(() => validateChunkParams({ uploadId: 'u1', index: 3, data: good }, fakeSession), /Invalid chunk index/);
  assert.throws(() => validateChunkParams({ uploadId: 'u1', index: -1, data: good }, fakeSession), /Invalid chunk index/);
  assert.throws(() => validateChunkParams({ uploadId: '', index: 0, data: good }, fakeSession), /uploadId is required/);
  assert.throws(() => validateChunkParams({ uploadId: 'u1', index: 0, data: 'not base64!!!' }, fakeSession), /base64/);
  const big = Buffer.alloc(CHUNK_BYTES + 1).toString('base64');
  assert.throws(() => validateChunkParams({ uploadId: 'u1', index: 0, data: big }, fakeSession), /too large/);
});

// ---------- assembleChunks ----------

test('assemble concatenates chunks in index order and checks size', () => {
  const session = { totalChunks: 3, fileSize: 12 };
  const chunks = [
    { index: 2, data: Buffer.from('d!') },
    { index: 0, data: Buffer.from('hello') },
    { index: 1, data: Buffer.from(' worl') },
  ];
  assert.equal(assembleChunks(chunks, session).toString(), 'hello world!');
});

test('assemble rejects missing, duplicate or size-mismatched chunks', () => {
  const session = { totalChunks: 2, fileSize: 10 };
  assert.throws(() => assembleChunks([{ index: 0, data: Buffer.from('hello') }], session), /missing/);
  assert.throws(
    () => assembleChunks([{ index: 0, data: Buffer.from('hello') }, { index: 0, data: Buffer.from('world') }], session),
    /missing/
  );
  assert.throws(
    () => assembleChunks([{ index: 0, data: Buffer.from('hello') }, { index: 1, data: Buffer.from('!') }], session),
    /size does not match/
  );
});
