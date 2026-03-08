import { getDb } from "./db.js";
import { getEffectiveConfigValue } from "./configRuntime.js";
import { logError, safeErr } from "./logger.js";

function ownerIds() {
  return getEffectiveConfigValue("BOT_OWNER_IDS");
}

export async function isAuthorizedUser(user) {
  const userId = String(user?.id || "");
  if (!userId) return false;
  if (ownerIds().includes(userId)) return true;

  try {
    const db = await getDb();
    if (!db) return false;
    const row = await db.collection("telegram_users").findOne({ telegramUserId: userId, isAuthorized: true });
    return !!row;
  } catch (err) {
    logError("db.read.failed", { collection: "telegram_users", operation: "findOne", err: safeErr(err) });
    return false;
  }
}

export function isOwner(user) {
  const userId = String(user?.id || "");
  return !!userId && ownerIds().includes(userId);
}

export async function denyIfUnauthorized(ctx) {
  const ok = await isAuthorizedUser(ctx.from);
  if (ok) return false;
  await ctx.reply("Access denied.");
  return true;
}
