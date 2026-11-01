const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  folder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Folder',
    default: null
  },
  title: {
    type: String,
    trim: true,
    maxlength: [200, 'Note title cannot be more than 200 characters'],
    default: 'Untitled note'
  },
  content: {
    type: mongoose.Schema.Types.Mixed,
    default: { type: 'doc', content: [{ type: 'paragraph' }] }
  },
  plainText: {
    type: String,
    default: ''
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 40
  }],
  linkedQuestions: [{
    questionKey: { type: String, required: true },
    title: String,
    difficulty: String,
    platform: String
  }],
  relatedNotes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Note'
  }],
  whiteboard: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  codeBlocks: [{
    title: { type: String, default: 'Code' },
    language: { type: String, default: 'cpp' },
    code: { type: String, default: '' }
  }],
  revision: {
    enabled: { type: Boolean, default: false },
    nextReviewAt: { type: Date, default: null },
    intervalDays: { type: Number, default: 3, min: 1, max: 365 },
    reviewCount: { type: Number, default: 0 },
    lastResult: { type: String, enum: ['again', 'hard', 'good', 'easy', null], default: null }
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  isArchived: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

noteSchema.index({ user: 1, folder: 1, isDeleted: 1, updatedAt: -1 });
noteSchema.index({ user: 1, isFavorite: 1, isDeleted: 1 });
noteSchema.index({ user: 1, title: 'text', plainText: 'text' });
noteSchema.index({ user: 1, 'revision.enabled': 1, 'revision.nextReviewAt': 1 });

module.exports = mongoose.model('Note', noteSchema);
