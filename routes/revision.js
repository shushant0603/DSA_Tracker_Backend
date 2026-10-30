const express = require('express');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const Revision = require('../models/Revision');
const auth = require('../middleware/auth');

const router = express.Router();

const getQuestion = (questionKey) => {
  const filePath = path.join(__dirname, '../data/questions.json');
  const questions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return questions.find((question) =>
    String(question._serial) === String(questionKey)
    || `${question.bookId}-${question.id}` === String(questionKey)
  );
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const applyTime = (date, preferredTime) => {
  const [hours, minutes] = (preferredTime || '18:00').split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

const nextDate = (date, intervalDays, preferredTime) =>
  applyTime(addDays(date, intervalDays), preferredTime);

const serializeRevision = (revision) => {
  const sourceQuestion = getQuestion(revision.questionKey);
  const question = {
    ...(revision.question.toObject?.() || revision.question),
    topic: revision.question.topic?.length
      ? revision.question.topic
      : [sourceQuestion?.chapter || sourceQuestion?.section || 'Other'],
    difficulty: revision.question.difficulty || sourceQuestion?.difficulty || null,
    platform: revision.question.platform || sourceQuestion?.platform || 'LeetCode'
  };

  return {
  id: revision._id,
  questionKey: revision.questionKey,
  question,
  status: revision.status,
  intervalDays: revision.intervalDays,
  preferredTime: revision.preferredTime,
  repeatEnabled: revision.repeatEnabled,
  repeatCount: revision.repeatCount,
  completedRepeats: revision.completedRepeats,
  nextRevisionDate: revision.nextRevisionDate,
  lastReviewedAt: revision.lastReviewedAt,
  reviewCount: revision.reviewCount,
  lastResult: revision.lastResult
  };
};

router.use(auth);

router.get('/due', async (req, res) => {
  try {
    const due = await Revision.find({
      user: req.user._id,
      status: 'active',
      nextRevisionDate: { $lte: new Date() }
    }).sort({ nextRevisionDate: 1 });
    res.json({ revisions: due.map(serializeRevision), total: due.length });
  } catch (error) {
    console.error('Get due revisions error:', error);
    res.status(500).json({ message: 'Server error while loading due revisions' });
  }
});

router.get('/upcoming', async (req, res) => {
  try {
    const upcoming = await Revision.find({
      user: req.user._id,
      status: 'active',
      nextRevisionDate: { $gt: new Date() }
    }).sort({ nextRevisionDate: 1 }).limit(50);
    res.json({ revisions: upcoming.map(serializeRevision), total: upcoming.length });
  } catch (error) {
    console.error('Get upcoming revisions error:', error);
    res.status(500).json({ message: 'Server error while loading upcoming revisions' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const today = startOfToday();
    const tomorrow = addDays(today, 1);
    const [active, due, overdue] = await Promise.all([
      Revision.countDocuments({ user: req.user._id, status: 'active' }),
      Revision.countDocuments({
        user: req.user._id,
        status: 'active',
        nextRevisionDate: { $gte: today, $lt: tomorrow }
      }),
      Revision.countDocuments({
        user: req.user._id,
        status: 'active',
        nextRevisionDate: { $lt: today }
      })
    ]);
    res.json({ active, due, overdue, totalDue: due + overdue });
  } catch (error) {
    console.error('Get revision summary error:', error);
    res.status(500).json({ message: 'Server error while loading revision summary' });
  }
});

router.post('/:questionKey', [
  body('intervalDays').optional().isInt({ min: 1, max: 365 }),
  body('preferredTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('repeatEnabled').optional().isBoolean(),
  body('repeatCount').optional({ nullable: true }).isInt({ min: 1, max: 365 }),
  body('nextRevisionDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid revision interval', errors: errors.array() });

    const question = getQuestion(req.params.questionKey);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    const intervalDays = Number(req.body.intervalDays || 3);
    const preferredTime = req.body.preferredTime || '18:00';
    const repeatEnabled = req.body.repeatEnabled !== false;
    const repeatCount = req.body.repeatCount ? Number(req.body.repeatCount) : null;
    const requestedDate = req.body.nextRevisionDate
      ? new Date(req.body.nextRevisionDate)
      : nextDate(new Date(), intervalDays, preferredTime);
    const revision = await Revision.findOneAndUpdate(
      { user: req.user._id, questionKey: String(req.params.questionKey) },
      {
        user: req.user._id,
        questionKey: String(req.params.questionKey),
        question: {
          id: question.id,
          serial: question._serial,
          title: question.title,
          book: question.book,
          bookId: question.bookId,
          chapter: question.chapter,
          section: question.section,
          topic: question.topic?.length
            ? question.topic
            : [question.chapter || question.section || 'Other'],
          difficulty: question.difficulty || null,
          platform: question.platform || 'LeetCode',
          link: question.leetcodeUrl || question.link
        },
        status: 'active',
        intervalDays,
        preferredTime,
        repeatEnabled,
        repeatCount,
        completedRepeats: 0,
        nextRevisionDate: requestedDate
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    res.status(201).json({ revision: serializeRevision(revision) });
  } catch (error) {
    console.error('Create revision error:', error);
    res.status(500).json({ message: 'Server error while saving revision' });
  }
});

router.patch('/:revisionId', [
  body('intervalDays').optional().isInt({ min: 1, max: 365 }),
  body('preferredTime').optional().matches(/^([01]\d|2[0-3]):[0-5]\d$/),
  body('repeatEnabled').optional().isBoolean(),
  body('repeatCount').optional({ nullable: true }).isInt({ min: 1, max: 365 }),
  body('nextRevisionDate').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid revision schedule', errors: errors.array() });

    const revision = await Revision.findOne({ _id: req.params.revisionId, user: req.user._id });
    if (!revision) return res.status(404).json({ message: 'Revision not found' });

    if (req.body.intervalDays !== undefined) revision.intervalDays = Number(req.body.intervalDays);
    if (req.body.preferredTime !== undefined) revision.preferredTime = req.body.preferredTime;
    if (req.body.repeatEnabled !== undefined) revision.repeatEnabled = req.body.repeatEnabled;
    if (req.body.repeatCount !== undefined) revision.repeatCount = req.body.repeatCount || null;
    if (req.body.nextRevisionDate !== undefined) revision.nextRevisionDate = new Date(req.body.nextRevisionDate);
    revision.nextRevisionDate = applyTime(revision.nextRevisionDate, revision.preferredTime);
    revision.status = 'active';
    await revision.save();

    res.json({ revision: serializeRevision(revision) });
  } catch (error) {
    console.error('Update revision schedule error:', error);
    res.status(500).json({ message: 'Server error while updating revision schedule' });
  }
});

router.delete('/question/:questionKey', async (req, res) => {
  try {
    await Revision.findOneAndDelete({
      user: req.user._id,
      questionKey: String(req.params.questionKey)
    });
    res.json({ message: 'Question removed from revision' });
  } catch (error) {
    console.error('Delete question revision error:', error);
    res.status(500).json({ message: 'Server error while removing revision' });
  }
});

router.post('/:revisionId/review', [
  body('result').isIn(['again', 'hard', 'good', 'easy'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid review result', errors: errors.array() });

    const revision = await Revision.findOne({ _id: req.params.revisionId, user: req.user._id });
    if (!revision) return res.status(404).json({ message: 'Revision not found' });

    const result = req.body.result;
    const multipliers = { again: 1, hard: 2, good: 2, easy: 3 };
    const intervalDays = result === 'again'
      ? 1
      : Math.min(365, Math.max(1, revision.intervalDays * multipliers[result]));

    revision.intervalDays = intervalDays;
    revision.lastReviewedAt = new Date();
    revision.reviewCount += 1;
    revision.lastResult = result;
    revision.completedRepeats += 1;

    if (!revision.repeatEnabled ||
      (revision.repeatCount && revision.completedRepeats >= revision.repeatCount)) {
      revision.status = 'completed';
      revision.nextRevisionDate = null;
    } else {
      revision.status = 'active';
      revision.nextRevisionDate = nextDate(new Date(), intervalDays, revision.preferredTime);
    }
    await revision.save();

    res.json({ revision: serializeRevision(revision) });
  } catch (error) {
    console.error('Review question error:', error);
    res.status(500).json({ message: 'Server error while recording review' });
  }
});

router.delete('/:revisionId', async (req, res) => {
  try {
    const deleted = await Revision.findOneAndDelete({ _id: req.params.revisionId, user: req.user._id });
    if (!deleted) return res.status(404).json({ message: 'Revision not found' });
    res.json({ message: 'Question removed from revision' });
  } catch (error) {
    console.error('Delete revision error:', error);
    res.status(500).json({ message: 'Server error while removing revision' });
  }
});

module.exports = router;
