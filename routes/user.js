const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const githubRequestConfig = {
  headers: {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'DSA-Tracker'
  }
};

if (process.env.GITHUB_TOKEN) {
  githubRequestConfig.headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

const getLeetCodeProfile = async (username) => {
  const response = await axios.post('https://leetcode.com/graphql', {
    query: `
      query userPublicProfile($username: String!) {
        matchedUser(username: $username) {
          username
          submitStats {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }
    `,
    variables: { username }
  }, {
    headers: { 'Content-Type': 'application/json' }
  });

  return response.data?.data?.matchedUser || null;
};

const validatePlatformUsernames = async ({ github, leetcode, codeforces }) => {
  const validationResults = {};

  if (github) {
    try {
      await axios.get(
        `https://api.github.com/users/${encodeURIComponent(github)}`,
        githubRequestConfig
      );
      validationResults.github = { valid: true };
    } catch (err) {
      if (err.response?.status === 404) {
        validationResults.github = { valid: false, error: 'GitHub username not found' };
      } else {
        console.error('GitHub validation unavailable:', err.response?.data?.message || err.message);
        validationResults.github = {
          valid: true,
          warning: 'GitHub validation is temporarily unavailable; stats may load after the rate limit resets'
        };
      }
    }
  }

  if (leetcode) {
    try {
      validationResults.leetcode = await getLeetCodeProfile(leetcode)
        ? { valid: true }
        : { valid: false, error: 'LeetCode username not found' };
    } catch (err) {
      validationResults.leetcode = { valid: false, error: 'LeetCode username not found' };
    }
  }

  if (codeforces) {
    try {
      const response = await axios.get(
        `https://codeforces.com/api/user.info?handles=${encodeURIComponent(codeforces)}`
      );
      validationResults.codeforces = response.data.status === 'OK'
        ? { valid: true }
        : { valid: false, error: 'Codeforces username not found' };
    } catch (err) {
      validationResults.codeforces = { valid: false, error: 'Codeforces username not found' };
    }
  }

  return validationResults;
};

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

    const validationResults = await validatePlatformUsernames({ github, leetcode, codeforces });

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

    const platformUsernames = {
      github: github !== undefined ? github : req.user.platformUsernames?.github || null,
      leetcode: leetcode !== undefined ? leetcode : req.user.platformUsernames?.leetcode || null,
      codeforces: codeforces !== undefined ? codeforces : req.user.platformUsernames?.codeforces || null
    };

    if (!platformUsernames.github && !platformUsernames.leetcode && !platformUsernames.codeforces) {
      return res.status(400).json({
        message: 'At least one platform username is required'
      });
    }

    const validationResults = await validatePlatformUsernames(platformUsernames);
    if (Object.values(validationResults).some((result) => !result.valid)) {
      return res.status(400).json({
        message: 'Some usernames are invalid',
        validationResults
      });
    }

    const updateData = {
      platformUsernames,
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
          axios.get(
            `https://api.github.com/users/${encodeURIComponent(platformUsernames.github)}`,
            githubRequestConfig
          ),
          axios.get(
            `https://api.github.com/users/${encodeURIComponent(platformUsernames.github)}/repos?per_page=100`,
            githubRequestConfig
          )
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
        const profile = await getLeetCodeProfile(platformUsernames.leetcode);
        if (profile) {
          const solved = Object.fromEntries(
            profile.submitStats.acSubmissionNum.map(({ difficulty, count }) => [difficulty, count])
          );
          stats.leetcode = {
            username: profile.username,
            totalSolved: solved.All || 0,
            easySolved: solved.Easy || 0,
            mediumSolved: solved.Medium || 0,
            hardSolved: solved.Hard || 0
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
        const response = await axios.get(
          `https://codeforces.com/api/user.info?handles=${encodeURIComponent(platformUsernames.codeforces)}`
        );
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
