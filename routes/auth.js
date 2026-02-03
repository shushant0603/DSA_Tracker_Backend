const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { generateOTP, sendOTPEmail, sendWelcomeEmail } = require('../utils/emailService');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @route   POST /api/auth/register
// @desc    Register a new user (sends OTP for verification)
// @access  Public
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {
  console.log('📝 REGISTER: Request received', { name: req.body.name, email: req.body.email });
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ REGISTER: Validation failed', errors.array());
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }
    console.log('✅ REGISTER: Validation passed');

    const { name, email, password } = req.body;

    // Check if user already exists
    console.log('🔍 REGISTER: Checking existing user...');
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      console.log('👤 REGISTER: User exists, isVerified:', existingUser.isVerified);
      // If user exists but not verified, allow re-registration
      if (!existingUser.isVerified) {
        // Generate new OTP
        const otp = generateOTP();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        console.log('🔢 REGISTER: Generated OTP for existing unverified user');

        existingUser.name = name;
        existingUser.password = password;
        existingUser.verificationOTP = otp;
        existingUser.otpExpiry = otpExpiry;
        await existingUser.save();
        console.log('💾 REGISTER: User updated');

        // Send OTP email
        console.log('📧 REGISTER: Sending OTP email...');
        const emailResult = await sendOTPEmail(email, otp, name);
        console.log('📧 REGISTER: Email result:', emailResult);
        
        if (!emailResult.success) {
          console.log('❌ REGISTER: Email failed', emailResult.error);
          return res.status(500).json({ message: 'Failed to send verification email' });
        }

        console.log('✅ REGISTER: Success - OTP sent to existing unverified user');
        return res.status(200).json({
          message: 'OTP sent to your email',
          requiresVerification: true,
          email: email
        });
      }
      console.log('❌ REGISTER: User already verified');
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    console.log('🔢 REGISTER: Generated OTP for new user');

    // Create new user (unverified)
    const user = new User({ 
      name, 
      email, 
      password,
      isVerified: false,
      verificationOTP: otp,
      otpExpiry: otpExpiry
    });
    await user.save();
    console.log('💾 REGISTER: New user saved to DB');

    // Send OTP email
    console.log('📧 REGISTER: Sending OTP email to new user...');
    console.log('📧 REGISTER: EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
    console.log('📧 REGISTER: EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET');
    
    const emailResult = await sendOTPEmail(email, otp, name);
    console.log('📧 REGISTER: Email result:', emailResult);
    
    if (!emailResult.success) {
      console.log('❌ REGISTER: Email failed, deleting user...', emailResult.error);
      // Delete user if email fails
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({ message: 'Failed to send verification email. Please try again.' });
    }

    console.log('✅ REGISTER: Success - New user registered and OTP sent');
    res.status(201).json({
      message: 'OTP sent to your email',
      requiresVerification: true,
      email: email
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and complete registration
// @access  Public
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, otp } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Account already verified' });
    }

    // Check OTP
    if (user.verificationOTP !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Check OTP expiry
    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ message: 'OTP has expired. Please request a new one.' });
    }

    // Verify user
    user.isVerified = true;
    user.verificationOTP = null;
    user.otpExpiry = null;
    await user.save();

    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, user.name);

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Account verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Server error during verification' });
  }
});

// @route   POST /api/auth/resend-otp
// @desc    Resend OTP
// @access  Public
router.post('/resend-otp', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Account already verified' });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.verificationOTP = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, user.name);
    if (!emailResult.success) {
      return res.status(500).json({ message: 'Failed to send verification email' });
    }

    res.json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
  body('password').exists().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check if user is verified
    if (!user.isVerified) {
      // Generate new OTP and send
      const otp = generateOTP();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
      user.verificationOTP = otp;
      user.otpExpiry = otpExpiry;
      await user.save();
      
      await sendOTPEmail(email, otp, user.name);
      
      return res.status(403).json({ 
        message: 'Please verify your email first. OTP sent to your email.',
        requiresVerification: true,
        email: email
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        preferences: req.user.preferences
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
