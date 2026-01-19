// index.js (FULL FINAL) — License keys (one-key-per-placeId) + ranker/promote + ranker-gamepass (no license)

const express = require("express");
const rbx = require("noblox.js");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const cookie = process.env.COOKIE; // keep cookie in Render env (safe)

if (!cookie) {
  console.error("❌ Missing COOKIE in environment variables");
  process.exit(1);
}

/* =====================================================
   LICENSE SYSTEM (VALID KEYS STORED HERE)
   - Empty key => invalid
   - Key must exist in VALID_KEYS
   - Key can only be used by ONE placeId
   ===================================================== */
const VALID_KEYS = new Set([
  "a7f3c9e1d4b8f0e6c2a9d7b5e4f1c8a0b6d9e2f7c5a3e8d4b1",
  "c8f2a9e0d7b6e4f5a1c3d9b8e7f0a4c5d6e1b2f9a7d8",
  "f1e9a4c6d7b5f8a2e0c3d1b9a7e4f6d8c5b2a0e9f1",
  "b9c2f7a1e8d6f5c4b0a9e7d3f1c8a2b6e4d9f0a5",
  "e6f0a9b5d7c4f1e8a2d9b6c0f3a7e4d1b8c5f2",
  "d8f5a7c0e9b6f1a4d2c3e8b9f7a0d6c5e1f4b2",
  "a2d9f1c5e6b4a7f8c0d3b9e2f5a1e4d7c6b8",
  "f7b1a6c4e9d0f5b2c8a3e1d7f4a9b6c5e0",
  "c0e5f9a6d7b1c8e4f2a3d9b5f7c6a0e1b4",
  "b6f8d2a1c9e0f7a5e4b3c8d6f1a9e7c5b0",
]);

// In-memory bindings: key -> placeId
// NOTE: On Render redeploy/restart, bindings reset (fine for basic usage).
const KEY_BINDINGS = new Map();

function validateKeyForPlace(key, placeId) {
  // placeId required (must be a positive finite number)
  if (!Number.isFinite(placeId) || placeId <= 0) {
    return { ok: false, reason: "MISSING_PLACEID" };
  }

  // key required + non-empty
  if (typeof key !== "string" || key.trim() === "") {
    return { ok: false, reason: "EMPTY_KEY" };
  }

  // key must be valid
  if (!VALID_KEYS.has(key)) {
    return { ok: false, reason: "INVALID_KEY" };
  }

  // one-key-per-place binding
  const bound = KEY_BINDINGS.get(key);

  // If not bound yet, bind now
  if (!bound) {
    KEY_BINDINGS.set(key, placeId);
    console.log(`🔐 Key bound to PlaceId ${placeId}`);
    return { ok: true };
  }

  // If bound to different placeId, refuse
  if (bound !== placeId) {
    return { ok: false, reason: "KEY_ALREADY_USED" };
  }

  return { ok: true };
}

function requireLicense(req, res) {
  const key = String(req.query.key ?? "");
  const placeId = Number(req.query.placeid);

  const result = validateKeyForPlace(key, placeId);
  if (!result.ok) {
    res.status(result.reason === "MISSING_PLACEID" ? 400 : 403).json({
      ok: false,
      error: result.reason,
    });
    return null;
  }

  return { key, placeId };
}

rbx
  .setCookie(cookie)
  .then(() => {
    console.log("✅ Logged in to Roblox");

    app.get("/", (req, res) => {
      res.send("Roblox Ranker is alive!");
    });

    // ✅ Roblox calls this once when the server boots (license system)
    app.get("/validate", (req, res) => {
      const key = String(req.query.key ?? "");
      const placeId = Number(req.query.placeid);

      const result = validateKeyForPlace(key, placeId);
      if (!result.ok) {
        return res.status(result.reason === "MISSING_PLACEID" ? 400 : 403).json({
          ok: false,
          error: result.reason,
        });
      }

      return res.json({ ok: true });
    });

    // Manual rank set route (LICENSE PROTECTED)
    app.get("/ranker", async (req, res) => {
      if (!requireLicense(req, res)) return;

      const userId = parseInt(req.query.userid, 10);
      const rank = parseInt(req.query.rank, 10);
      const groupId = parseInt(req.query.groupid, 10);

      if (!Number.isFinite(userId) || !Number.isFinite(rank) || !Number.isFinite(groupId)) {
        return res.status(400).json({ error: "Missing or invalid userid, rank, or groupid" });
      }

      try {
        await rbx.setRank(groupId, userId, rank);
        res.json({ success: true, message: `Ranked user ${userId} in group ${groupId}` });
      } catch (err) {
        console.error("❌ Failed to rank:", err);
        res.status(500).json({ error: err.message });
      }
    });

    // Promote route (LICENSE PROTECTED)
    app.get("/promote", async (req, res) => {
      if (!requireLicense(req, res)) return;

      const userId = parseInt(req.query.userid, 10);
      const groupId = parseInt(req.query.groupid, 10);

      if (!Number.isFinite(userId) || !Number.isFinite(groupId)) {
        return res.status(400).json({ error: "Missing or invalid userid or groupid" });
      }

      try {
        await rbx.promote(groupId, userId);
        res.json({ success: true, message: `Promoted user ${userId} in group ${groupId}` });
      } catch (err) {
        console.error("❌ Failed to promote:", err);
        res.status(500).json({ error: err.message });
      }
    });

    // 🔓 GAMEPASS RANK BOT (NO LICENSE)
    app.get("/ranker-gamepass", async (req, res) => {
      const userId = parseInt(req.query.userid, 10);
      const rank = parseInt(req.query.rank, 10);
      const groupId = parseInt(req.query.groupid, 10);

      if (!Number.isFinite(userId) || !Number.isFinite(rank) || !Number.isFinite(groupId)) {
        return res.status(400).json({ error: "Missing or invalid userid, rank, or groupid" });
      }

      try {
        await rbx.setRank(groupId, userId, rank);
        res.json({ success: true, message: "Ranked via gamepass system" });
      } catch (err) {
        console.error("❌ Gamepass rank failed:", err);
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
