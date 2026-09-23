const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ALLOWED_TASKS,
  DEFAULT_MAX_TEXT_LENGTH,
  isValidEmail,
  normalizeTask,
  isTextLengthOk,
} = require('../utils/validation');

test('isValidEmail accepts valid emails and rejects bad/non-string input', () => {
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail(' user@example.com '), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail(''), false);
  assert.equal(isValidEmail(undefined), false);
  assert.equal(isValidEmail({}), false);
  // object payloads (e.g. NoSQL-injection style {"$gt": ""}) must not pass
  assert.equal(isValidEmail({ $gt: '' }), false);
});

test('normalizeTask enforces the strict whitelist', () => {
  assert.deepEqual(ALLOWED_TASKS, ['summarize', 'explain', 'analyze']);
  assert.equal(normalizeTask(undefined), 'analyze');
  assert.equal(normalizeTask(null), 'analyze');
  assert.equal(normalizeTask(''), 'analyze');
  assert.equal(normalizeTask('summarize'), 'summarize');
  assert.equal(normalizeTask('explain'), 'explain');
  assert.equal(normalizeTask('analyze'), 'analyze');
  assert.throws(() => normalizeTask('delete'), /Invalid task/);
  assert.throws(() => normalizeTask('SUMMARIZE'), /Invalid task/);
  assert.throws(() => normalizeTask('summarize; DROP TABLE'), /Invalid task/);
});

test('isTextLengthOk enforces non-empty text within the max length', () => {
  assert.equal(isTextLengthOk('hello'), true);
  assert.equal(isTextLengthOk('   '), false);
  assert.equal(isTextLengthOk(''), false);
  assert.equal(isTextLengthOk(undefined), false);
  assert.equal(isTextLengthOk('x'.repeat(DEFAULT_MAX_TEXT_LENGTH)), true);
  assert.equal(isTextLengthOk('x'.repeat(DEFAULT_MAX_TEXT_LENGTH + 1)), false);
  assert.equal(isTextLengthOk('x'.repeat(11), 10), false);
});
