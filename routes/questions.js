const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Question = require('../models/Question');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/questions
// @desc    Add a new question
// @access  Private
router.post('/', [
  auth,
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must be less than 200 characters'),
  body('link')
    .isURL()
    .withMessage('Please enter a valid URL'),
  body('platform')
    .isIn(['LeetCode', 'Codeforces', 'GeeksforGeeks', 'HackerRank', 'CodeChef', 'AtCoder', 'Other'])
    .withMessage('Invalid platform'),
  body('topic')
    .isArray({ min: 1 }) // Ensure topic is an array with at least one element
    .withMessage('Topic must be an array with at least one topic')
    .custom((topics) => {
      const validTopics = [
        'Array', 'String', 'Hash Table', 'Dynamic Programming', 'Math', 'Sorting',
        'Greedy', 'Depth-First Search', 'Breadth-First Search', 'Tree', 'Binary Search',
        'Matrix', 'Two Pointers', 'Bit Manipulation', 'Stack', 'Heap', 'Graph',
        'Design', 'Backtracking', 'Sliding Window', 'Union Find', 'Trie', 'Recursion',
        'Binary Tree', 'Binary Search Tree', 'Linked List', 'Queue', 'Other'
      ];
      // Check if every topic in the array is valid
      const invalidTopics = topics.filter(topic => !validTopics.includes(topic));
      if (invalidTopics.length > 0) {
        throw new Error(`Invalid topics: ${invalidTopics.join(', ')}`);
      }
      return true;
    }),
  body('difficulty')
    .isIn(['Easy', 'Medium', 'Hard'])
    .withMessage('Invalid difficulty'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  body('notes')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Notes must be less than 2000 characters'),
  body('timeSpent')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Time spent must be a positive number'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const questionData = {
      ...req.body,
      user: req.user._id
    };

    const question = new Question(questionData);
    await question.save();

    res.status(201).json({
      message: 'Question added successfully',
      question
    });
  } catch (error) {
    console.error('Add question error:', error);
    res.status(500).json({ message: 'Server error while adding question' });
  }
});

// @route   GET /api/questions
// @desc    Get all questions for the user with filtering and pagination
// @access  Private
router.get('/', [
  auth,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('topic').optional().isString().withMessage('Topic must be a string'),
  query('platform').optional().isString().withMessage('Platform must be a string'),
  query('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']).withMessage('Invalid difficulty'),
  query('needsRevision').optional().isBoolean().withMessage('needsRevision must be a boolean'),
  query('search').optional().isString().withMessage('Search must be a string'),
  query('sortBy').optional().isIn(['solvedDate', 'title', 'difficulty', 'topic']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const {
      page = 1,
      limit = 20,
      topic,
      platform,
      difficulty,
      needsRevision,
      search,
      sortBy = 'solvedDate',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { user: req.user._id };
    
    if (topic) filter.topic = topic;
    if (platform) filter.platform = platform;
    if (difficulty) filter.difficulty = difficulty;
    if (needsRevision !== undefined) filter.needsRevision = needsRevision === 'true';
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const questions = await Question.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Question.countDocuments(filter);

    res.json({
      questions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalQuestions: total,
        hasNext: skip + questions.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ message: 'Server error while fetching questions' });
  }
});

// @route   GET /api/questions/stats
// @desc    Get statistics for the user's questions
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get total count
    const totalQuestions = await Question.countDocuments({ user: userId });

    // Get count by topic
    const topicStats = await Question.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$topic', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get count by difficulty
    const difficultyStats = await Question.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get count by platform
    const platformStats = await Question.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$platform', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Get revision count
    const revisionCount = await Question.countDocuments({ 
      user: userId, 
      needsRevision: true 
    });

    // Get questions solved in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentQuestions = await Question.countDocuments({
      user: userId,
      solvedDate: { $gte: thirtyDaysAgo }
    });

    res.json({
      totalQuestions,
      revisionCount,
      recentQuestions,
      topicStats,
      difficultyStats,
      platformStats
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error while fetching statistics' });
  }
});

// @route   GET /api/questions/:id
// @desc    Get a specific question
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const question = await Question.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({ question });
  } catch (error) {
    console.error('Get question error:', error);
    res.status(500).json({ message: 'Server error while fetching question' });
  }
});

// @route   PUT /api/questions/:id
// @desc    Update a question
// @access  Private
router.put('/:id', [
  auth,
  body('title').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Title must be less than 200 characters'),
  body('link').optional().isURL().withMessage('Please enter a valid URL'),
  body('platform').optional().isIn(['LeetCode', 'Codeforces', 'GeeksforGeeks', 'HackerRank', 'CodeChef', 'AtCoder', 'Other']).withMessage('Invalid platform'),
  body('topic').optional().isIn([
    'Array', 'String', 'Hash Table', 'Dynamic Programming', 'Math', 'Sorting',
    'Greedy', 'Depth-First Search', 'Breadth-First Search', 'Tree', 'Binary Search',
    'Matrix', 'Two Pointers', 'Bit Manipulation', 'Stack', 'Heap', 'Graph',
    'Design', 'Backtracking', 'Sliding Window', 'Union Find', 'Trie', 'Recursion',
    'Binary Tree', 'Binary Search Tree', 'Linked List', 'Queue', 'Other'
  ]).withMessage('Invalid topic'),
  body('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']).withMessage('Invalid difficulty'),
  body('description').optional().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
  body('notes').optional().isLength({ max: 2000 }).withMessage('Notes must be less than 2000 characters'),
  body('timeSpent').optional().isInt({ min: 0 }).withMessage('Time spent must be a positive number'),
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('needsRevision').optional().isBoolean().withMessage('needsRevision must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const question = await Question.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({
      message: 'Question updated successfully',
      question
    });
  } catch (error) {
    console.error('Update question error:', error);
    res.status(500).json({ message: 'Server error while updating question' });
  }
});

// @route   DELETE /api/questions/:id
// @desc    Delete a question
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const question = await Question.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({ message: 'Question deleted successfully' });
  } catch (error) {
    console.error('Delete question error:', error);
    res.status(500).json({ message: 'Server error while deleting question' });
  }
});

// @route   PATCH /api/questions/:id/toggle-revision
// @desc    Toggle revision status of a question
// @access  Private
router.patch('/:id/toggle-revision', auth, async (req, res) => {
  try {
    const question = await Question.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { needsRevision: req.body.needsRevision } },
      { new: true }
    );

    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    res.json({
      message: 'Revision status updated successfully',
      question
    });
  } catch (error) {
    console.error('Toggle revision error:', error);
    res.status(500).json({ message: 'Server error while updating revision status' });
  }
});

module.exports = router;
