const mongoose = require('mongoose');

const liveQuizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  courseCode: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['draft', 'live', 'ended'],
    default: 'draft',
    index: true,
  },
  sourceFileName: {
    type: String,
    default: '',
  },
  questionCount: {
    type: Number,
    default: 0,
  },
  questionDurationSeconds: {
    type: Number,
    default: 40,
    min: 5,
    max: 300,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  endedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

liveQuizSchema.index({ createdAt: -1 });

module.exports = mongoose.model('LiveQuiz', liveQuizSchema);
