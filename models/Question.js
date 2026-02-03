const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Question title is required'],
    trim: true,
    maxlength: [200, 'Title cannot be more than 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  link: {
    type: String,
    required: [true, 'Problem link is required'],
    match: [/^https?:\/\/.+/, 'Please enter a valid URL']
  },
  platform: {
    type: String,
    required: [true, 'Platform is required'],
    enum: ['LeetCode', 'Codeforces', 'GeeksforGeeks', 'HackerRank', 'CodeChef', 'AtCoder', 'Other'],
    default: 'LeetCode'
  },
  topic: [{
    type: String,
    enum: [
      'Array', 'String', 'Hash Table', 'Dynamic Programming', 'Math', 'Sorting',
      'Greedy', 'Depth-First Search', 'Breadth-First Search', 'Tree', 'Binary Search',
      'Matrix', 'Two Pointers', 'Bit Manipulation', 'Stack', 'Heap', 'Graph',
      'Design', 'Backtracking', 'Sliding Window', 'Union Find', 'Trie', 'Recursion',
      'Binary Tree', 'Binary Search Tree', 'Linked List', 'Queue', 'Other'
    ],
    required: true,
    default: ['Array']
}],
  difficulty: {
    type: String,
    required: [true, 'Difficulty is required'],
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [20, 'Tag cannot be more than 20 characters']
  }],
  notes: {
    type: String,
    trim: true,
    maxlength: [2000, 'Notes cannot be more than 2000 characters']
  },
  needsRevision: {
    type: Boolean,
    default: false
  },
  // Spaced Repetition / Scheduled Revision Fields
  revisionSchedule: {
    enabled: {
      type: Boolean,
      default: false
    },
    intervalDays: {
      type: Number,
      default: 3,
      min: [1, 'Interval must be at least 1 day'],
      max: [365, 'Interval cannot be more than 365 days']
    },
    nextRevisionDate: {
      type: Date,
      default: null
    },
    lastRevisedDate: {
      type: Date,
      default: null
    },
    timesRevised: {
      type: Number,
      default: 0
    }
  },
  solvedDate: {
    type: Date,
    default: Date.now
  },
  timeSpent: {
    type: Number, // in minutes
    min: [0, 'Time spent cannot be negative']
  },
  rating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot be more than 5']
  },
  // Saved Solution for Code Playground
  savedSolution: {
    code: {
      type: String,
      default: '',
      maxlength: [50000, 'Code cannot be more than 50000 characters']
    },
    language: {
      type: String,
      enum: ['cpp', 'python', 'java', 'javascript'],
      default: 'cpp'
    },
    lastUpdated: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true
});

// Index for better query performance
questionSchema.index({ user: 1, solvedDate: -1 });
questionSchema.index({ user: 1, topic: 1 });
questionSchema.index({ user: 1, needsRevision: 1 });
questionSchema.index({ user: 1, platform: 1 });
questionSchema.index({ user: 1, 'revisionSchedule.nextRevisionDate': 1 });

module.exports = mongoose.model('Question', questionSchema);
