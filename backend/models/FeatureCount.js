const mongoose = require('mongoose');

const featureCountSchema = new mongoose.Schema({
  feature: {
    type: String,
    required: true,
    trim: true,
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  count: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

featureCountSchema.index({ feature: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('FeatureCount', featureCountSchema);
