const test = require('node:test');
const assert = require('node:assert/strict');

const {
  detectQuestionType,
  getSourceQuality,
  inferChunkMetadata,
} = require('../utils/tmaHelper');

test('detects fill-gap questions', () => {
  assert.equal(
    detectQuestionType('__________ is a connector at the back of the computer where you plug in an external device', []),
    'fill_gap'
  );
});

test('detects true or false questions', () => {
  assert.equal(
    detectQuestionType('A port is used to connect external devices. True or False?', []),
    'true_false'
  );
  assert.equal(
    detectQuestionType('A port is used to connect external devices.', ['True', 'False']),
    'true_false'
  );
});

test('detects multiple choice and short answer questions', () => {
  assert.equal(detectQuestionType('Which device stores data?', ['RAM', 'Mouse']), 'multiple_choice');
  assert.equal(detectQuestionType('Explain the function of a port.', []), 'short_answer');
});

test('course material outranks support sources', () => {
  assert.ok(getSourceQuality('course_material') > getSourceQuality('past_question'));
  assert.ok(getSourceQuality('course_material') > getSourceQuality('tma_1'));
});

test('infers module and unit metadata from chunk text', () => {
  const metadata = inferChunkMetadata('Module 2: Computer Hardware. Unit 3: Input and Output Devices. Ports are connectors.', 3);
  assert.match(metadata.moduleTitle, /Module 2/i);
  assert.match(metadata.unitTitle, /Unit 3/i);
  assert.equal(typeof metadata.pageNumber, 'number');
});
