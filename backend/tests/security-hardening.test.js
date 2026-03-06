const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeText,
  hasDangerousPattern,
  normalizeEmail,
  isValidEmailWithAllowlist,
  isValidName,
  validateStrongPassword,
} = require('../utils/securityValidation');
const { validateSignupInput } = require('../middleware/requestValidation');

test('sanitizeText strips html tags and compresses whitespace', () => {
  const input = '  <script>alert("x")</script>   Jane   Doe ';
  const output = sanitizeText(input);
  assert.equal(output, 'alert("x") Jane Doe');
});

test('hasDangerousPattern detects script-like payloads', () => {
  assert.equal(hasDangerousPattern('<script>alert(1)</script>'), true);
  assert.equal(hasDangerousPattern('javascript:alert(1)'), true);
  assert.equal(hasDangerousPattern('Normal User Name'), false);
});

test('email validation rejects untrusted tlds', () => {
  assert.equal(isValidEmailWithAllowlist('a@ttt.von'), false);
  assert.equal(isValidEmailWithAllowlist('student@example.com'), true);
});

test('name validation accepts plain names and rejects script-like input', () => {
  assert.equal(isValidName('John Doe'), true);
  assert.equal(isValidName('<script>alert(1)</script>'), false);
});

test('password policy requires complexity', () => {
  assert.equal(validateStrongPassword('password').valid, false);
  assert.equal(validateStrongPassword('Password1!').valid, true);
});

test('signup middleware normalizes body and blocks malicious input', () => {
  const req = {
    body: {
      name: '  Jane   Doe ',
      email: 'JANE@EXAMPLE.COM ',
      password: 'Password1!',
      faculty: '',
      department: '',
      studyCenter: '',
      matricNumber: '',
    },
  };

  let statusCode = 200;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };

  let calledNext = false;
  const next = () => {
    calledNext = true;
  };

  validateSignupInput(req, res, next);
  assert.equal(statusCode, 200);
  assert.equal(calledNext, true);
  assert.equal(req.body.name, 'Jane Doe');
  assert.equal(req.body.email, normalizeEmail('JANE@EXAMPLE.COM '));
});
