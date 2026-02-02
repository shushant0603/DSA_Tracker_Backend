const express = require("express");
const axios = require("axios");

const router = express.Router();

// GET /api/codeforces/:username
router.get("/:username", async (req, res) => {
  const { username } = req.params;

  try {
    // Get user info
    const userInfo = await axios.get(
      `https://codeforces.com/api/user.info?handles=${username}`
    );

    if (
      !userInfo.data ||
      userInfo.data.status !== "OK" ||
      !userInfo.data.result
    ) {
      return res.status(404).json({ message: "User not found on Codeforces" });
    }

    const user = userInfo.data.result[0];

    // Format full profile for frontend card
    const profile = {
      handle: user.handle,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      country: user.country || "",
      city: user.city || "",
      organization: user.organization || "",
      friendOfCount: user.friendOfCount || 0,
      avatar: user.avatar || "",
      titlePhoto: user.titlePhoto || "",
      registrationTime: new Date((user.registrationTimeSeconds || 0) * 1000),
      lastOnlineTime: new Date((user.lastOnlineTimeSeconds || 0) * 1000),
      rating: user.rating || 0,
      maxRating: user.maxRating || 0,
      rank: user.rank || "unrated",
      maxRank: user.maxRank || "unrated",
      contribution: user.contribution || 0,
    };

    res.json(profile);
  } catch (error) {
    console.error("❌ Codeforces API Error:", error.message);
    res.status(500).json({ message: "Error fetching Codeforces data" });
  }
});

module.exports = router;
