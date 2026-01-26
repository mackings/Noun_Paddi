const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a faculty name'],
    unique: true,
    trim: true,
  },
  code: {
    type: String,
    trim: true,
    uppercase: true,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  isArchived: {
    type: Boolean,
    default: false,
  },
  archivedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Faculty', facultySchema);
