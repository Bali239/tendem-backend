import { createHash, randomBytes } from "node:crypto";
import Session from "../models/Session.js";

const configuredTtlDays = Number(process.env.SESSION_TTL_DAYS);
const sessionTtlDays = Number.isFinite(configuredTtlDays) && configuredTtlDays > 0
  ? configuredTtlDays
  : 7;
const SESSION_TTL_MS = sessionTtlDays * 24 * 60 * 60 * 1000;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

async function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await Session.create({ tokenHash: hashToken(token), user: userId, expiresAt });
  return { token, expiresAt };
}

async function findSession(token) {
  if (!token || typeof token !== "string" || token.length > 256) return null;
  return Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
}

async function deleteSession(token) {
  if (!token || typeof token !== "string" || token.length > 256) return;
  await Session.deleteOne({ tokenHash: hashToken(token) });
}

function getBearerToken(request) {
  const authorization = request.get("authorization") || "";
  const match = /^Bearer\s+([A-Za-z0-9_-]+)$/i.exec(authorization);
  return match?.[1] || null;
}

export { createSession, findSession, deleteSession, getBearerToken };
