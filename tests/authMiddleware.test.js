const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-only';
const protect = require('../middleware/authMiddleware');

const response = () => {
  const state = { statusCode: null, body: null };
  return {
    state,
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(body) {
      state.body = body;
      return this;
    },
  };
};

test('rejects requests without a bearer token', () => {
  const res = response();
  let called = false;
  protect({ headers: {} }, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.state.statusCode, 401);
});

test('accepts a valid JWT and attaches the user id', () => {
  const req = {
    headers: { authorization: `Bearer ${jwt.sign({ userId: 'user-123' }, process.env.JWT_SECRET)}` },
  };
  const res = response();
  let called = false;
  protect(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.userId, 'user-123');
});

test('rejects an invalid JWT', () => {
  const res = response();
  let called = false;
  protect({ headers: { authorization: 'Bearer invalid-token' } }, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.state.statusCode, 401);
});
