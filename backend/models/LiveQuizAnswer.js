const mongoose = require('mongoose');

const liveQuizAnswerSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveQuiz',
    required: true,
    index: true,
  },
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveQuizQuestion',
    required: true,
    index: true,
  },
  participantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveQuizParticipant',
    required: true,
    index: true,
  },
  answer: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500,
  },
  normalizedAnswer: {
    type: String,
    required: true,
  },
  isCorrect: {
    type: Boolean,
    required: true,
  },
  awardedPoints: {
    type: Number,
    default: 0,
  },
  moderationStatus: {
    type: String,
    enum: ['auto', 'overridden'],
    default: 'auto',
  },
}, {
  timestamps: true,
});

liveQuizAnswerSchema.index({ participantId: 1, questionId: 1 }, { unique: true });
liveQuizAnswerSchema.index({ quizId: 1, createdAt: -1 });

module.exports = mongoose.model('LiveQuizAnswer', liveQuizAnswerSchema);
