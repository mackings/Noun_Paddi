const mongoose = require('mongoose');

const APIUsageSchema = new mongoose.Schema({
  operationType: {
    type: String,
    enum: ['summarize', 'generate_questions', 'summarize_groq', 'generate_questions_groq'],
    required: true,
  },
  model: {
    type: String,
    default: 'gemini-2.5-flash',
  },
  materialId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Material',
    required: false,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  inputTokens: {
    type: Number,
    default: 0,
  },
  outputTokens: {
    type: Number,
    default: 0,
  },
  totalTokens: {
    type: Number,
    default: 0,
  },
  success: {
    type: Boolean,
    default: true,
  },
  errorMessage: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for analytics queries
APIUsageSchema.index({ createdAt: -1 });
APIUsageSchema.index({ operationType: 1 });

module.exports = mongoose.model('APIUsage', APIUsageSchema);
