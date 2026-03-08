import { cfg } from "./config.js";
import { getDb } from "./db.js";
import { logError, safeErr } from "./logger.js";

export async function isAuthorizedUser(user) {
  const userId = String(user?.id || "");
  if (!userId) return false;
  if (cfg.BOT_OWNER_IDS.includes(userId)) return true;

  try {
    const db = await getDb();
    const row = await db.collection("telegram_users").findOne({ telegramUserId: userId, isAuthorized: true });
    return !!row;
  } catch (err) {
    logError("db.read.failed", { collection: "telegram_users", operation: "findOne", err: safeErr(err) });
    return false;
  }
}

export function isOwner(user) {
  const userId = String(user?.id || "");
  return !!userId && cfg.BOT_OWNER_IDS.includes(userId);
}

export async function denyIfUnauthorized(ctx) {
  const ok = await isAuthorizedUser(ctx.from);
  if (ok) return false;
  await ctx.reply("Access denied.");
  return true;
}
