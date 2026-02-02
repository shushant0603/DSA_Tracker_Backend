const express = require("express");
const axios = require("axios");

const router = express.Router();

// GET /api/leetcode/:username
router.get("/:username", async (req, res) => {
  const { username } = req.params;
  console.log("LeetCode username:", username);

  try {
    const response = await axios.get(`https://leetcode-stats-api.herokuapp.com/${username}`);

    if (response.data.status !== "success") {
      return res.status(404).json({ message: "User not found on LeetCode" });
    }

    const { easySolved, mediumSolved, hardSolved } = response.data;

    res.json({
      Easy: easySolved,
      Medium: mediumSolved,
      Hard: hardSolved,
    });
  } catch (error) {
    console.error("❌ LeetCode API Error:", error.message);
    res.status(500).json({ message: "Error fetching LeetCode data" });
  }
});

module.exports = router;
