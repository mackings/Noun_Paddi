const mongoose = require('mongoose');

const BroadcastScheduleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  url: {
    type: String,
    default: '/',
  },
  imageUrl: {
    type: String,
    default: '',
  },
  channels: {
    type: [String],
    default: ['push'],
  },
  emailTarget: {
    type: String,
    enum: ['all', 'single'],
    default: 'all',
  },
  emails: {
    type: [String],
    default: [],
  },
  sendAt: {
    type: Date,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'failed'],
    default: 'pending',
    index: true,
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  lastError: {
    type: String,
    default: '',
  },
  processedAt: {
    type: Date,
    default: null,
  },
  sentAt: {
    type: Date,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('BroadcastSchedule', BroadcastScheduleSchema);
