const mongoose = require('mongoose');

const liveQuizQuestionSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveQuiz',
    required: true,
    index: true,
  },
  order: {
    type: Number,
    required: true,
  },
  questionType: {
    type: String,
    enum: ['fill_blank', 'single_answer'],
    required: true,
  },
  prompt: {
    type: String,
    required: true,
    trim: true,
  },
  options: [{
    type: String,
    trim: true,
  }],
  acceptedAnswers: [{
    type: String,
    required: true,
    trim: true,
  }],
  explanation: {
    type: String,
    default: '',
    trim: true,
  },
  points: {
    type: Number,
    default: 1,
    min: 1,
  },
}, {
  timestamps: true,
});

liveQuizQuestionSchema.index({ quizId: 1, order: 1 }, { unique: true });

module.exports = mongoose.model('LiveQuizQuestion', liveQuizQuestionSchema);
