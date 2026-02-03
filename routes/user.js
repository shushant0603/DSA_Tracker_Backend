const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/user/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        preferences: req.user.preferences,
        platformUsernames: req.user.platformUsernames,
        hasPlatformData: req.user.hasPlatformData,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
});

// @route   POST /api/user/platform-usernames
// @desc    Submit platform usernames (one-time only)
// @access  Private
router.post('/platform-usernames', [
  auth,
  body('github').optional().trim(),
  body('leetcode').optional().trim(),
  body('codeforces').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    // Check if user already has platform data
    if (req.user.hasPlatformData) {
      return res.status(400).json({ 
        message: 'Platform usernames already submitted. Use update endpoint to modify.',
        alreadyExists: true
      });
    }

    const { github, leetcode, codeforces } = req.body;

    // Validate at least one username is provided
    if (!github && !leetcode && !codeforces) {
      return res.status(400).json({ 
        message: 'At least one platform username is required' 
      });
    }

    // Validate usernames by making API calls
    const validationResults = {};

    if (github) {
      try {
        await axios.get(`https://api.github.com/users/${github}`);
        validationResults.github = { valid: true };
      } catch (err) {
        validationResults.github = { valid: false, error: 'GitHub username not found' };
      }
    }

    if (leetcode) {
      try {
        const lcResponse = await axios.get(`https://leetcode-stats-api.herokuapp.com/${leetcode}`);
        if (lcResponse.data.status === 'success') {
          validationResults.leetcode = { valid: true };
        } else {
          validationResults.leetcode = { valid: false, error: 'LeetCode username not found' };
        }
      } catch (err) {
        validationResults.leetcode = { valid: false, error: 'LeetCode username not found' };
      }
    }

    if (codeforces) {
      try {
        const cfResponse = await axios.get(`https://codeforces.com/api/user.info?handles=${codeforces}`);
        if (cfResponse.data.status === 'OK') {
          validationResults.codeforces = { valid: true };
        } else {
          validationResults.codeforces = { valid: false, error: 'Codeforces username not found' };
        }
      } catch (err) {
        validationResults.codeforces = { valid: false, error: 'Codeforces username not found' };
      }
    }

    // Check if any validation failed
    const hasInvalid = Object.values(validationResults).some(v => !v.valid);
    if (hasInvalid) {
      return res.status(400).json({
        message: 'Some usernames are invalid',
        validationResults
      });
    }

    // Update user with platform usernames
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        platformUsernames: {
          github: github || null,
          leetcode: leetcode || null,
          codeforces: codeforces || null
        },
        hasPlatformData: true
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Platform usernames saved successfully',
      platformUsernames: user.platformUsernames,
      hasPlatformData: user.hasPlatformData
    });
  } catch (error) {
    console.error('Save platform usernames error:', error);
    res.status(500).json({ message: 'Server error while saving platform usernames' });
  }
});

// @route   PUT /api/user/platform-usernames
// @desc    Update platform usernames
// @access  Private
router.put('/platform-usernames', [
  auth,
  body('github').optional().trim(),
  body('leetcode').optional().trim(),
  body('codeforces').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { github, leetcode, codeforces } = req.body;

    const updateData = {
      platformUsernames: {
        ...req.user.platformUsernames,
        ...(github !== undefined && { github: github || null }),
        ...(leetcode !== undefined && { leetcode: leetcode || null }),
        ...(codeforces !== undefined && { codeforces: codeforces || null })
      },
      hasPlatformData: true
    };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Platform usernames updated successfully',
      platformUsernames: user.platformUsernames,
      hasPlatformData: user.hasPlatformData
    });
  } catch (error) {
    console.error('Update platform usernames error:', error);
    res.status(500).json({ message: 'Server error while updating platform usernames' });
  }
});

// @route   GET /api/user/platform-stats
// @desc    Get all platform stats (GitHub, LeetCode, Codeforces)
// @access  Private
router.get('/platform-stats', auth, async (req, res) => {
  try {
    const { platformUsernames } = req.user;
    const stats = {};

    // Fetch GitHub stats
    if (platformUsernames?.github) {
      try {
        const [userResponse, reposResponse] = await Promise.all([
          axios.get(`https://api.github.com/users/${platformUsernames.github}`),
          axios.get(`https://api.github.com/users/${platformUsernames.github}/repos?per_page=100`)
        ]);

        const repos = reposResponse.data;
        const totalStars = repos.reduce((acc, repo) => acc + repo.stargazers_count, 0);
        const totalForks = repos.reduce((acc, repo) => acc + repo.forks_count, 0);

        stats.github = {
          username: platformUsernames.github,
          name: userResponse.data.name,
          avatar: userResponse.data.avatar_url,
          bio: userResponse.data.bio,
          publicRepos: userResponse.data.public_repos,
          followers: userResponse.data.followers,
          following: userResponse.data.following,
          totalStars,
          totalForks,
          profileUrl: userResponse.data.html_url,
          createdAt: userResponse.data.created_at
        };
      } catch (err) {
        stats.github = { error: 'Failed to fetch GitHub stats' };
      }
    }

    // Fetch LeetCode stats
    if (platformUsernames?.leetcode) {
      try {
        const response = await axios.get(`https://leetcode-stats-api.herokuapp.com/${platformUsernames.leetcode}`);
        if (response.data.status === 'success') {
          stats.leetcode = {
            username: platformUsernames.leetcode,
            totalSolved: response.data.totalSolved,
            totalQuestions: response.data.totalQuestions,
            easySolved: response.data.easySolved,
            easyTotal: response.data.totalEasy,
            mediumSolved: response.data.mediumSolved,
            mediumTotal: response.data.totalMedium,
            hardSolved: response.data.hardSolved,
            hardTotal: response.data.totalHard,
            acceptanceRate: response.data.acceptanceRate,
            ranking: response.data.ranking
          };
        } else {
          stats.leetcode = { error: 'LeetCode user not found' };
        }
      } catch (err) {
        stats.leetcode = { error: 'Failed to fetch LeetCode stats' };
      }
    }

    // Fetch Codeforces stats
    if (platformUsernames?.codeforces) {
      try {
        const response = await axios.get(`https://codeforces.com/api/user.info?handles=${platformUsernames.codeforces}`);
        if (response.data.status === 'OK') {
          const user = response.data.result[0];
          stats.codeforces = {
            username: user.handle,
            rating: user.rating || 0,
            maxRating: user.maxRating || 0,
            rank: user.rank || 'unrated',
            maxRank: user.maxRank || 'unrated',
            avatar: user.avatar,
            titlePhoto: user.titlePhoto,
            contribution: user.contribution || 0,
            friendOfCount: user.friendOfCount || 0
          };
        } else {
          stats.codeforces = { error: 'Codeforces user not found' };
        }
      } catch (err) {
        stats.codeforces = { error: 'Failed to fetch Codeforces stats' };
      }
    }

    res.json({
      hasPlatformData: req.user.hasPlatformData,
      platformUsernames,
      stats
    });
  } catch (error) {
    console.error('Get platform stats error:', error);
    res.status(500).json({ message: 'Server error while fetching platform stats' });
  }
});

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  auth,
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('preferences.darkMode').optional().isBoolean().withMessage('darkMode must be a boolean'),
  body('preferences.notifications').optional().isBoolean().withMessage('notifications must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const updateData = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.preferences) {
      updateData.preferences = {
        ...req.user.preferences,
        ...req.body.preferences
      };
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
});

// @route   PUT /api/user/password
// @desc    Update user password
// @access  Private
router.put('/password', [
  auth,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id);
    
    // Check current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ message: 'Server error while updating password' });
  }
});

// @route   DELETE /api/user/account
// @desc    Delete user account
// @access  Private
router.delete('/account', [
  auth,
  body('password').notEmpty().withMessage('Password is required to delete account')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { password } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id);
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Password is incorrect' });
    }

    // Delete user (this will also delete all associated questions due to cascade)
    await User.findByIdAndDelete(req.user._id);

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error while deleting account' });
  }
});

module.exports = router;
