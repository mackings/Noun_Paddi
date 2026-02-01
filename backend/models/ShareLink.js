const mongoose = require('mongoose');

const shareLinkSchema = new mongoose.Schema(
  {
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Material',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  { timestamps: true }
);

shareLinkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ShareLink', shareLinkSchema);
