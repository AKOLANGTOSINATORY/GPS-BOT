// index.js (FULL FINAL) — License keys + ranker/promote + ranker-gamepass (OPEN CLOUD V2)
// NO COOKIES, NO NOBLOX.JS

const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
app.use(express.json());

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

if (!ROBLOX_API_KEY) {
  console.error("Missing ROBLOX_API_KEY in environment variables");
  process.exit(1);
}

// =====================================================
// LICENSE SYSTEM
// =====================================================
const VALID_KEYS = new Set([
  "9e2c7b4f1a6d0e8f5c3b9a4d7e1f2c8b6a5",
  "f3a9e1c6d7b0f5e8a2c4b9d1e6f7a3c8b5",
  "6f1e9b3a7d5c8e0f4a2b6d9c1e7f5a8b3",
  "c7b1a9f6e4d8c5f0a2b3e7d1f9a6c8e4",
  "8a5e2d9c1f6b4a7e0f3c8d5b9f1a6e4c2",
  "e4b9f0a7c6d1e8f5a3b2c9d4f7a1e6c8",
  "5c8e1f4a9d6b0c2e7f3a5b8d1c9f6e4",
  "a0f6c9e2b5d8a1f7c4e3b9d6f5a8c2",
  "d9c2f6e1a8b7d4f0c5e9a3b6c8f1e7",
  "1f8c6b9e4a0d5f7c2e3b1a9d6f8c4e"
]);

const KEY_BINDINGS = new Map();

function validateKeyForPlace(key, placeId) {
  if (!Number.isFinite(placeId) || placeId <= 0) return { ok: false, reason: "MISSING_PLACEID" };
  if (typeof key !== "string" || key.trim() === "") return { ok: false, reason: "EMPTY_KEY" };
  if (!VALID_KEYS.has(key)) return { ok: false, reason: "INVALID_KEY" };

  const bound = KEY_BINDINGS.get(key);
  if (!bound) {
    KEY_BINDINGS.set(key, placeId);
    console.log(`Key bound to PlaceId ${placeId}`);
    return { ok: true };
  }

  if (bound !== placeId) return { ok: false, reason: "KEY_ALREADY_USED" };
  return { ok: true };
}

function requireLicense(req, res) {
  const key = String(req.query.key ?? "");
  const placeId = Number(req.query.placeid);

  const result = validateKeyForPlace(key, placeId);
  if (!result.ok) {
    res.status(result.reason === "MISSING_PLACEID" ? 400 : 403).json({ ok: false, error: result.reason });
    return null;
  }
  return { key, placeId };
}

// =====================================================
// HELPERS & CACHE
// =====================================================
const ROLE_CACHE = new Map();
const ROLE_CACHE_TTL_MS = 60_000;

async function getGroupRoles(groupId) {
  const now = Date.now();
  const cached = ROLE_CACHE.get(groupId);
  if (cached && cached.expiresAt > now) return cached.roles;

  try {
    const response = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
    const roles = response.data.roles;
    ROLE_CACHE.set(groupId, { roles, expiresAt: now + ROLE_CACHE_TTL_MS });
    return roles;
  } catch (error) {
    throw new Error("FAILED_TO_FETCH_ROLES");
  }
}

// Core Rank Function used by both /ranker and /ranker-gamepass
async function executeRankChange(groupId, userId, targetRankValue) {
  const roles = await getGroupRoles(groupId);
  const targetRole = roles.find(r => r.rank === targetRankValue);

  if (!targetRole) throw { status: 400, message: "ROLE_NOT_FOUND" };

  const rolePath = `groups/${groupId}/roles/${targetRole.id}`;
  const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${userId}`;

  // Pre-Check
  try {
    const currentMembership = await axios.get(url, { headers: { "x-api-key": ROBLOX_API_KEY } });
    if (currentMembership.data && currentMembership.data.role === rolePath) {
      return { success: true, ignored: "SAME_ROLE" };
    }
  } catch (e) {}

  // Execute
  await axios.patch(url, { role: rolePath }, {
    headers: { "x-api-key": ROBLOX_API_KEY, "Content-Type": "application/json" }
  });

  return { success: true, targetRole: targetRole.name };
}

// =====================================================
// ENDPOINTS
// =====================================================

app.get("/", (req, res) => res.send("Roblox Ranker (Open Cloud) is alive!"));

app.get("/validate", (req, res) => {
  const key = String(req.query.key ?? "");
  const placeId = Number(req.query.placeid);
  const result = validateKeyForPlace(key, placeId);
  if (!result.ok) return res.status(result.reason === "MISSING_PLACEID" ? 400 : 403).json({ ok: false, error: result.reason });
  return res.json({ ok: true });
});

// MANUAL RANK SET (LICENSE)
app.get("/ranker", async (req, res) => {
  if (!requireLicense(req, res)) return;
  const userId = parseInt(req.query.userid, 10);
  const rank = parseInt(req.query.rank, 10);
  const groupId = parseInt(req.query.groupid, 10);

  if (!Number.isFinite(userId) || !Number.isFinite(rank) || !Number.isFinite(groupId)) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const result = await executeRankChange(groupId, userId, rank);
    res.json({ success: true, message: `Ranked user ${userId} in group ${groupId}`, ...result });
  } catch (err) {
    if (err.status === 400) return res.json({ success: true, ignored: "ROBLOX_400_HANDLED" });
    res.status(err.status || 500).json({ error: err.message || "Failed" });
  }
});

// GAMEPASS BOT (NO LICENSE)
app.get("/ranker-gamepass", async (req, res) => {
  const userId = parseInt(req.query.userid, 10);
  const rank = parseInt(req.query.rank, 10);
  const groupId = parseInt(req.query.groupid, 10);

  if (!Number.isFinite(userId) || !Number.isFinite(rank) || !Number.isFinite(groupId)) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const result = await executeRankChange(groupId, userId, rank);
    res.json({ success: true, message: "Ranked via gamepass system", ...result });
  } catch (err) {
    if (err.status === 400) return res.json({ success: true, ignored: "ROBLOX_400_HANDLED" });
    res.status(err.status || 500).json({ error: err.message || "Failed" });
  }
});

// PROMOTE BUTTON (LICENSE) - Custom built for Open Cloud
app.get("/promote", async (req, res) => {
  if (!requireLicense(req, res)) return;
  const userId = parseInt(req.query.userid, 10);
  const groupId = parseInt(req.query.groupid, 10);

  if (!Number.isFinite(userId) || !Number.isFinite(groupId)) return res.status(400).json({ error: "Missing parameters" });

  try {
    // 1. Get current role
    const membershipUrl = `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${userId}`;
    const memRes = await axios.get(membershipUrl, { headers: { "x-api-key": ROBLOX_API_KEY } });
    const currentRolePath = memRes.data.role; // "groups/123/roles/456"
    const currentRoleId = Number(currentRolePath.split('/').pop());

    // 2. Find current rank value (0-255)
    const roles = await getGroupRoles(groupId);
    const currentRoleObj = roles.find(r => r.id === currentRoleId);
    
    if (!currentRoleObj) return res.status(400).json({ error: "User not in group" });
    if (currentRoleObj.rank === 255) return res.status(400).json({ error: "Cannot promote group owner/max rank" });

    // 3. Find the NEXT highest rank
    const sortedRoles = [...roles].sort((a, b) => a.rank - b.rank);
    const nextRole = sortedRoles.find(r => r.rank > currentRoleObj.rank);

    if (!nextRole) return res.status(400).json({ error: "No higher rank available" });

    // 4. Execute Promotion
    await axios.patch(membershipUrl, { role: `groups/${groupId}/roles/${nextRole.id}` }, {
      headers: { "x-api-key": ROBLOX_API_KEY, "Content-Type": "application/json" }
    });

    res.json({ success: true, message: `Promoted user ${userId} to ${nextRole.name}` });

  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message || "Promotion Failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
