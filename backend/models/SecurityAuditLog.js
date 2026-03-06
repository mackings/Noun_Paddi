const mongoose = require('mongoose');

const securityAuditLogSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    index: true,
  },
  success: {
    type: Boolean,
    default: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  email: {
    type: String,
    default: '',
    index: true,
  },
  ip: {
    type: String,
    default: '',
  },
  userAgent: {
    type: String,
    default: '',
  },
  message: {
    type: String,
    default: '',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

securityAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SecurityAuditLog', securityAuditLogSchema);
