const mongoose = require('mongoose');

const revisionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  questionKey: {
    type: String,
    required: true
  },
  question: {
    id: Number,
    serial: Number,
    title: String,
    book: String,
    bookId: String,
    chapter: String,
    section: String,
    topic: [String],
    difficulty: String,
    platform: String,
    link: String
  },
  status: {
    type: String,
    enum: ['active', 'completed'],
    default: 'active'
  },
  intervalDays: {
    type: Number,
    min: 1,
    max: 365,
    default: 3
  },
  preferredTime: {
    type: String,
    match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm format'],
    default: '18:00'
  },
  repeatEnabled: {
    type: Boolean,
    default: true
  },
  repeatCount: {
    type: Number,
    min: [1, 'Repeat count must be at least 1'],
    max: [365, 'Repeat count cannot be more than 365'],
    default: null
  },
  completedRepeats: {
    type: Number,
    default: 0
  },
  nextRevisionDate: {
    type: Date,
    default: null
  },
  lastReviewedAt: {
    type: Date,
    default: null
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  lastResult: {
    type: String,
    enum: ['again', 'hard', 'good', 'easy', null],
    default: null
  }
}, { timestamps: true });

revisionSchema.index({ user: 1, questionKey: 1 }, { unique: true });
revisionSchema.index({ user: 1, status: 1, nextRevisionDate: 1 });

module.exports = mongoose.model('Revision', revisionSchema);
