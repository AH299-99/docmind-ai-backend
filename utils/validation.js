// Shared input-validation helpers (pure functions — unit tested in tests/).
const ALLOWED_TASKS = ['summarize', 'explain', 'analyze'];
const DEFAULT_MAX_TEXT_LENGTH = 20000;

const isValidEmail = (email) =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// Strict whitelist: undefined/empty falls back to 'analyze', anything else throws.
const normalizeTask = (task) => {
  if (task === undefined || task === null || task === '') return 'analyze';
  if (!ALLOWED_TASKS.includes(task)) {
    throw new Error(`Invalid task. Allowed values: ${ALLOWED_TASKS.join(', ')}`);
  }
  return task;
};

const isTextLengthOk = (text, max = DEFAULT_MAX_TEXT_LENGTH) =>
  typeof text === 'string' && text.trim().length > 0 && text.length <= max;

module.exports = {
  ALLOWED_TASKS,
  DEFAULT_MAX_TEXT_LENGTH,
  isValidEmail,
  normalizeTask,
  isTextLengthOk,
};
