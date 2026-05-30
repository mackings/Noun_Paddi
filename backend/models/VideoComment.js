const mongoose = require('mongoose');

const VideoCommentSchema = new mongoose.Schema({
  videoId: {
    type: String,
    required: true,
    trim: true,
    index: true,
    match: /^[a-zA-Z0-9_-]{6,20}$/,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  comment: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
}, {
  timestamps: true,
});

VideoCommentSchema.index({ videoId: 1, createdAt: -1 });

module.exports = mongoose.model('VideoComment', VideoCommentSchema);
