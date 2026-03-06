const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeText,
  hasDangerousPattern,
  normalizeEmail,
  isValidEmailWithAllowlist,
  isValidName,
  isValidProfileText,
  isValidStudyCenter,
  normalizeMatricNumber,
  isValidMatricNumber,
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

test('profile validators reject placeholder text and weak matric numbers', () => {
  assert.equal(isValidProfileText('Computer Science'), true);
  assert.equal(isValidProfileText('N/A'), false);
  assert.equal(isValidStudyCenter('Bauchi'), true);
  assert.equal(isValidStudyCenter('Mars'), false);
  assert.equal(isValidMatricNumber(normalizeMatricNumber('NOUN/CSC/23/123456')), true);
  assert.equal(isValidMatricNumber(normalizeMatricNumber('ABC70')), false);
});

test('signup middleware normalizes body and accepts complete profile data', () => {
  const req = {
    body: {
      name: '  Jane   Doe ',
      email: 'JANE@EXAMPLE.COM ',
      password: 'Password1!',
      faculty: 'Faculty of Science',
      department: 'Computer Science',
      studyCenter: 'Bauchi',
      matricNumber: 'noun/csc/23/123456',
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
  assert.equal(req.body.matricNumber, 'NOUN/CSC/23/123456');
});

test('signup middleware blocks incomplete or placeholder profile data', () => {
  const req = {
    body: {
      name: 'Jane Doe',
      email: 'jane@example.com',
      password: 'Password1!',
      faculty: '',
      department: 'Ctc',
      studyCenter: 'Bauchi',
      matricNumber: 'ABC70',
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
  assert.equal(statusCode, 400);
  assert.equal(calledNext, false);
});
