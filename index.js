// index.js (FULL) — Key system + one-key-per-placeId + your promote/ranker routes

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

/* =====================================================
   LICENSE SYSTEM (VALID KEYS STORED HERE)
   - Empty key => invalid
   - Key must exist in VALID_KEYS
   - Key can only be used by ONE placeId
   ===================================================== */
const VALID_KEYS = new Set([
  "Admin",
  // "Key2Here",
  // "Key3Here",
]);

// In-memory bindings: key -> placeId
// NOTE: On Render redeploy/restart, bindings reset (fine for basic usage).
const KEY_BINDINGS = new Map();

function validateKeyForPlace(key, placeId) {
  // placeId required
  if (!placeId || Number.isNaN(placeId)) {
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
  if (!bound) {
    KEY_BINDINGS.set(key, placeId);
    console.log(`🔐 Key "${key}" bound to PlaceId ${placeId}`);
    return { ok: true };
  }

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

rbx.setCookie(cookie)
  .then(() => {
    console.log("✅ Logged in to Roblox");

    app.get("/", (req, res) => {
      res.send("Roblox Ranker is alive!");
    });

    // ✅ Roblox calls this once when the server boots
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

    // Manual rank set route (optional) - now protected by key+placeid
    app.get("/ranker", async (req, res) => {
      if (!requireLicense(req, res)) return;

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

    // Promote route - now protected by key+placeid
    app.get("/promote", async (req, res) => {
      if (!requireLicense(req, res)) return;

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
