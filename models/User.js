const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const solvedQuestionSchema = new mongoose.Schema({
  questionKey: { type: String, required: true, trim: true },
  bookId: { type: String, required: true, trim: true },
  serial: { type: Number, required: true },
  questionId: { type: mongoose.Schema.Types.Mixed, default: null },
  title: { type: String, required: true, trim: true },
  url: { type: String, default: null },
  difficulty: { type: String, default: null },
  chapter: { type: String, default: '' },
  section: { type: String, default: '' },
  note: { type: String, default: '' },
  solvedAt: { type: Date, required: true, default: Date.now },
  solvedDate: { type: String, required: true },
  dayOfWeek: {
    type: String,
    required: true,
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true
  },
  picture: {
    type: String,
    default: null
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId;
    },
    minlength: [6, 'Password must be at least 6 characters']
  },
  // Email verification fields
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationOTP: {
    type: String,
    default: null
  },
  otpExpiry: {
    type: Date,
    default: null
  },
  // Platform usernames - submitted once by user
  platformUsernames: {
    github: {
      type: String,
      trim: true,
      default: null
    },
    leetcode: {
      type: String,
      trim: true,
      default: null
    },
    codeforces: {
      type: String,
      trim: true,
      default: null
    }
  },
  // Flag to track if platform data has been submitted
  hasPlatformData: {
    type: Boolean,
    default: false
  },
  preferences: {
    darkMode: {
      type: Boolean,
      default: false
    },
    notifications: {
      type: Boolean,
      default: true
    }
  },
  solvedQuestions: {
    type: [solvedQuestionSchema],
    default: []
  }
}, {
  timestamps: true
});

userSchema.index({ 'solvedQuestions.questionKey': 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
