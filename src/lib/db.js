import { MongoClient } from "mongodb";
import { cfg } from "./config.js";
import { logInfo, logError, logWarn, safeErr } from "./logger.js";

let client = null;
let db = null;
let warnedNoDb = false;

export async function connectDb() {
  if (db) return db;
  if (!cfg.MONGODB_URI) {
    if (!warnedNoDb) {
      warnedNoDb = true;
      logWarn("db.disabled", { mongoSet: false, reason: "MONGODB_URI missing" });
    }
    return null;
  }

  try {
    client = new MongoClient(cfg.MONGODB_URI, { maxPoolSize: 20, ignoreUndefined: true });
    await client.connect();
    db = client.db();
    await ensureIndexes(db);
    logInfo("db.connected", { ok: true });
    return db;
  } catch (err) {
    logError("db.connect.failed", { collection: "*", operation: "connect", err: safeErr(err) });
    return null;
  }
}

export async function getDb() {
  if (db) return db;
  return connectDb();
}

async function ensureIndexes(database) {
  if (!database) return;
  await database.collection("orders").createIndex({ orderId: 1 }, { unique: true });
  await database.collection("orders").createIndex({ activationId: 1 }, { sparse: true });
  await database.collection("orders").createIndex({ status: 1, pollAfter: 1 });
  await database.collection("orders").createIndex({ requesterId: 1, createdAt: -1 });
  await database.collection("webhook_events").createIndex({ dedupeKey: 1 }, { unique: true });
  await database.collection("telegram_users").createIndex({ telegramUserId: 1 }, { unique: true });
  await database.collection("events").createIndex({ createdAt: -1 });
  await database.collection("runtime_config").createIndex({ key: 1 }, { unique: true });
  await database.collection("runtime_config_audit").createIndex({ key: 1, createdAt: -1 });
}
