const mongoose = require('mongoose');

const liveQuizParticipantSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveQuiz',
    required: true,
    index: true,
  },
  username: {
    type: String,
    required: true,
    trim: true,
    maxlength: 40,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  tokenHash: {
    type: String,
    required: true,
    select: false,
  },
  score: {
    type: Number,
    default: 0,
  },
  correctCount: {
    type: Number,
    default: 0,
  },
  answeredCount: {
    type: Number,
    default: 0,
  },
  lastAnsweredAt: {
    type: Date,
    default: null,
  },
  currentQuestionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveQuizQuestion',
    default: null,
  },
  questionStartedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

liveQuizParticipantSchema.index({ quizId: 1, email: 1 }, { unique: true });
liveQuizParticipantSchema.index({ quizId: 1, username: 1 }, { unique: true });
liveQuizParticipantSchema.index({ quizId: 1, score: -1, lastAnsweredAt: 1 });

module.exports = mongoose.model('LiveQuizParticipant', liveQuizParticipantSchema);
