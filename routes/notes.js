const express = require('express');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const Note = require('../models/Note');
const Folder = require('../models/Folder');
const auth = require('../middleware/auth');
const questionData = require('../data/questions.json');

const router = express.Router();
router.use(auth);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Invalid note data', errors: errors.array() });
  }
  next();
};

const validId = (id) => mongoose.Types.ObjectId.isValid(id);

const getFolder = (userId, folderId) =>
  Folder.findOne({ _id: folderId, user: userId, isDeleted: false });

router.get('/folders', async (req, res) => {
  try {
    const folders = await Folder.find({ user: req.user._id, isDeleted: false })
      .sort({ name: 1 })
      .lean();
    res.json({ folders });
  } catch (error) {
    console.error('List folders error:', error);
    res.status(500).json({ message: 'Unable to load folders' });
  }
});

router.post('/folders', [
  body('name').trim().isLength({ min: 1, max: 100 }),
  body('parent').optional({ nullable: true }).custom((value) => !value || validId(value))
], validate, async (req, res) => {
  try {
    if (req.body.parent && !(await getFolder(req.user._id, req.body.parent))) {
      return res.status(400).json({ message: 'Parent folder not found' });
    }
    const folder = await Folder.create({
      user: req.user._id,
      name: req.body.name,
      parent: req.body.parent || null
    });
    res.status(201).json({ folder });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ message: 'Unable to create folder' });
  }
});

router.patch('/folders/:folderId', [
  body('name').trim().isLength({ min: 1, max: 100 })
], validate, async (req, res) => {
  try {
    const folder = await Folder.findOneAndUpdate(
      { _id: req.params.folderId, user: req.user._id, isDeleted: false },
      { name: req.body.name },
      { new: true, runValidators: true }
    );
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    res.json({ folder });
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ message: 'Unable to update folder' });
  }
});

router.delete('/folders/:folderId', async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.folderId, user: req.user._id, isDeleted: false });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    const childFolder = await Folder.exists({ user: req.user._id, parent: folder._id, isDeleted: false });
    const notes = await Note.exists({ user: req.user._id, folder: folder._id, isDeleted: false });
    if (childFolder || notes) {
      return res.status(409).json({ message: 'Move or delete folder contents before deleting it' });
    }
    folder.isDeleted = true;
    await folder.save();
    res.json({ message: 'Folder deleted' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ message: 'Unable to delete folder' });
  }
});

router.get('/', [
  query('folderId').optional().custom((value) => !value || validId(value)),
  query('search').optional().isString(),
  query('favorite').optional().isBoolean(),
  query('archived').optional().isBoolean(),
  query('trash').optional().isBoolean()
], validate, async (req, res) => {
  try {
    const filter = { user: req.user._id };
    const trash = req.query.trash === 'true';
    filter.isDeleted = trash;
    if (!trash) filter.isArchived = req.query.archived === 'true';
    if (req.query.folderId) filter.folder = req.query.folderId;
    if (req.query.favorite === 'true') filter.isFavorite = true;
    if (req.query.search?.trim()) {
      const search = req.query.search.trim();
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { plainText: { $regex: search, $options: 'i' } }
      ];
    }
    const notes = await Note.find(filter)
      .select('-content')
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ notes });
  } catch (error) {
    console.error('List notes error:', error);
    res.status(500).json({ message: 'Unable to load notes' });
  }
});

router.post('/', [
  body('title').optional().trim().isLength({ max: 200 }),
  body('folder').optional({ nullable: true }).custom((value) => !value || validId(value)),
  body('content').optional().isObject(),
  body('plainText').optional().isString().isLength({ max: 200000 })
], validate, async (req, res) => {
  try {
    if (req.body.folder && !(await getFolder(req.user._id, req.body.folder))) {
      return res.status(400).json({ message: 'Folder not found' });
    }
    const note = await Note.create({
      user: req.user._id,
      title: req.body.title || 'Untitled note',
      folder: req.body.folder || null,
      content: req.body.content,
      plainText: req.body.plainText || ''
    });
    res.status(201).json({ note });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ message: 'Unable to create note' });
  }
});

router.get('/questions/search', [
  query('q').trim().isLength({ min: 1, max: 100 })
], validate, async (req, res) => {
  const search = req.query.q.toLowerCase();
  const questions = questionData
    .filter((question) =>
      question.title.toLowerCase().includes(search) ||
      String(question.id).includes(search) ||
      question.chapter?.toLowerCase().includes(search)
    )
    .slice(0, 20)
    .map((question) => ({
      questionKey: String(question._serial),
      title: question.title,
      difficulty: question.difficulty || 'Medium',
      platform: question.platform || 'LeetCode',
      link: question.leetcodeUrl
    }));
  res.json({ questions });
});

router.get('/revision/due', async (req, res) => {
  try {
    const notes = await Note.find({
      user: req.user._id,
      isDeleted: false,
      'revision.enabled': true,
      'revision.nextReviewAt': { $lte: new Date() }
    }).select('-content').sort({ 'revision.nextReviewAt': 1 });
    res.json({ notes });
  } catch (error) {
    console.error('Get note revisions error:', error);
    res.status(500).json({ message: 'Unable to load note revisions' });
  }
});

router.post('/revision/:noteId/review', [
  body('result').isIn(['again', 'hard', 'good', 'easy'])
], validate, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.noteId, user: req.user._id, isDeleted: false });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    const multipliers = { again: 1, hard: 2, good: 3, easy: 7 };
    note.revision.intervalDays = Math.min(365, Math.max(1,
      note.revision.intervalDays * multipliers[req.body.result]));
    note.revision.reviewCount += 1;
    note.revision.lastResult = req.body.result;
    note.revision.nextReviewAt = new Date(Date.now() + note.revision.intervalDays * 86400000);
    await note.save();
    res.json({ note });
  } catch (error) {
    console.error('Review note error:', error);
    res.status(500).json({ message: 'Unable to save note review' });
  }
});

router.get('/:noteId', async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.noteId, user: req.user._id });
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ note });
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({ message: 'Unable to load note' });
  }
});

router.patch('/:noteId', [
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('folder').optional({ nullable: true }).custom((value) => !value || validId(value)),
  body('content').optional().isObject(),
  body('plainText').optional().isString().isLength({ max: 200000 }),
  body('isFavorite').optional().isBoolean(),
  body('isArchived').optional().isBoolean()
  ,body('tags').optional().isArray(),
  body('linkedQuestions').optional().isArray(),
  body('relatedNotes').optional().isArray(),
  body('whiteboard').optional({ nullable: true }).isObject(),
  body('codeBlocks').optional().isArray(),
  body('revision').optional().isObject()
], validate, async (req, res) => {
  try {
    if (req.body.folder && !(await getFolder(req.user._id, req.body.folder))) {
      return res.status(400).json({ message: 'Folder not found' });
    }
    const updates = {};
    ['title', 'folder', 'content', 'plainText', 'isFavorite', 'isArchived',
      'tags', 'linkedQuestions', 'relatedNotes', 'whiteboard', 'codeBlocks', 'revision'].forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });
    const note = await Note.findOneAndUpdate(
      { _id: req.params.noteId, user: req.user._id, isDeleted: false },
      updates,
      { new: true, runValidators: true }
    );
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ note });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ message: 'Unable to update note' });
  }
});

router.delete('/:noteId', async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.noteId, user: req.user._id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
      { new: true }
    );
    if (!note) return res.status(404).json({ message: 'Note not found' });
    res.json({ message: 'Note moved to trash' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ message: 'Unable to delete note' });
  }
});

router.post('/:noteId/restore', async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.noteId, user: req.user._id, isDeleted: true },
      { isDeleted: false, deletedAt: null },
      { new: true }
    );
    if (!note) return res.status(404).json({ message: 'Note not found in trash' });
    res.json({ note });
  } catch (error) {
    console.error('Restore note error:', error);
    res.status(500).json({ message: 'Unable to restore note' });
  }
});

module.exports = router;
