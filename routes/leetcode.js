const express = require("express");
const axios = require("axios");

const router = express.Router();

// GET /api/leetcode/:username
router.get("/:username", async (req, res) => {
  const { username } = req.params;
  console.log("LeetCode username:", username);

  try {
    const response = await axios.post("https://leetcode.com/graphql", {
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
      headers: { "Content-Type": "application/json" }
    });
    const profile = response.data?.data?.matchedUser;

    if (!profile) {
      return res.status(404).json({ message: "User not found on LeetCode" });
    }

    const solved = Object.fromEntries(
      profile.submitStats.acSubmissionNum.map(({ difficulty, count }) => [difficulty, count])
    );

    res.json({
      username: profile.username,
      Easy: solved.Easy || 0,
      Medium: solved.Medium || 0,
      Hard: solved.Hard || 0,
      totalSolved: solved.All || 0
    });
  } catch (error) {
    console.error("❌ LeetCode API Error:", error.message);
    res.status(500).json({ message: "Error fetching LeetCode data" });
  }
});

module.exports = router;
