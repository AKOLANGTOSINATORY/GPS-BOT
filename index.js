const express = require("express");
const rbx = require("noblox.js");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const cookie = process.env.COOKIE; // keep cookie in Render env (safe!)

if (!cookie) {
  console.error("❌ Missing COOKIE in .env file");
  process.exit(1);
}

rbx.setCookie(cookie)
  .then(() => {
    console.log("✅ Logged in to Roblox");

    app.get("/", (req, res) => {
      res.send("Roblox Ranker is alive!");
    });

    // Manual rank set route (optional)
    app.get("/ranker", async (req, res) => {
      const userId = parseInt(req.query.userid);
      const rank = parseInt(req.query.rank);
      const groupId = parseInt(req.query.groupid);

      if (!userId || !rank || !groupId) {
        return res.status(400).json({ error: "Missing userid, rank, or groupid" });
      }

      try {
        await rbx.setRank(groupId, userId, rank);
        res.json({ success: true, message: `Ranked user ${userId} in group ${groupId}` });
      } catch (err) {
        console.error("❌ Failed to rank:", err);
        res.status(500).json({ error: err.message });
      }
    });

    // Updated promote route
    app.get("/promote", async (req, res) => {
      const userId = parseInt(req.query.userid);
      const groupId = parseInt(req.query.groupid);

      if (!userId || !groupId) {
        return res.status(400).json({ error: "Missing userid or groupid" });
      }

      try {
        await rbx.promote(groupId, userId);
        res.json({ success: true, message: `Promoted user ${userId} in group ${groupId}` });
      } catch (err) {
        console.error("❌ Failed to promote:", err);
        res.status(500).json({ error: err.message });
      }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to log in with cookie:", err);
  });
