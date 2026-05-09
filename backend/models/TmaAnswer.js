const mongoose = require('mongoose');

const tmaAnswerSchema = new mongoose.Schema({
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null,
  },
  question: {
    type: String,
    required: true,
    trim: true,
  },
  options: [{
    type: String,
    trim: true,
  }],
  questionType: {
    type: String,
    enum: ['fill_gap', 'true_false', 'multiple_choice', 'short_answer'],
    default: 'short_answer',
  },
  answer: {
    type: String,
    required: true,
  },
  explanation: {
    type: String,
    default: '',
  },
  confidence: {
    type: Number,
    default: 0,
  },
  evidence: [{
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TmaSource',
    },
    title: String,
    sourceType: String,
    sourceQuality: Number,
    moduleTitle: String,
    unitTitle: String,
    pageNumber: Number,
    excerpt: String,
  }],
  verification: {
    isSupported: {
      type: Boolean,
      default: false,
    },
    conflictNotes: {
      type: String,
      default: '',
    },
    needsReview: {
      type: Boolean,
      default: true,
    },
  },
  model: {
    type: String,
    default: 'gemini-2.5-pro',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

tmaAnswerSchema.index({ courseId: 1, createdAt: -1 });

module.exports = mongoose.model('TmaAnswer', tmaAnswerSchema);
