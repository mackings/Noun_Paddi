const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  questionText: {
    type: String,
    required: true,
  },
  questionType: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'multi-select'],
    default: 'multiple-choice',
  },
  options: [{
    type: String,
    required: true,
  }],
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed, // Can be Number (single) or Array (multi-select)
    required: true,
  },
  explanation: {
    type: String,
    default: '',
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', 'extremely-hard'],
    default: 'medium',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Question', questionSchema);
