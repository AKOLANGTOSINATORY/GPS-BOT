const express = require("express");
const rbx = require("noblox.js");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const cookie = process.env.COOKIE;
const groupId = parseInt(process.env.GROUP_ID || "0");

if (!cookie || !groupId) {
  console.error("❌ Missing COOKIE or GROUP_ID in .env file");
  process.exit(1);
}

rbx.setCookie(cookie).then(() => {
  console.log("✅ Logged in to Roblox");

  app.get("/", (req, res) => {
    res.send("Roblox Ranker is alive!");
  });

  // Keep your existing /ranker for manual setRank
  app.get("/ranker", async (req, res) => {
    const userId = parseInt(req.query.userid);
    const rank = parseInt(req.query.rank);
    if (!userId || !rank) {
      return res.status(400).json({ error: "Missing userid or rank" });
    }
    try {
      await rbx.setRank(groupId, userId, rank);
      res.json({ success: true, message: "Ranked successfully" });
    } catch (err) {
      console.error("❌ Failed to rank:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // New promote route
  app.get("/promote", async (req, res) => {
    const userId = parseInt(req.query.userid);
    if (!userId) {
      return res.status(400).json({ error: "Missing userid" });
    }
    try {
      await rbx.promote(groupId, userId);
      res.json({ success: true, message: `Promoted user ${userId}` });
    } catch (err) {
      console.error("❌ Failed to promote:", err);
      res.status(500).json({ error: err.message });
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error("❌ Failed to log in with cookie:", err);
});
