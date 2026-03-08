import crypto from "node:crypto";
import { getDb } from "../lib/db.js";
import { logError, safeErr } from "../lib/logger.js";

const ACTIVE_STATUSES = ["requested", "active", "waiting_code", "otp_received", "waiting_retry", "waiting_resend"];

export function generateOrderId() {
  return `ord_${crypto.randomBytes(4).toString("hex")}`;
}

export async function createOrder(doc) {
  const db = await getDb();
  const now = new Date();
  const record = { ...doc, createdAt: now, updatedAt: now };
  await db.collection("orders").insertOne(record);
  return record;
}

export async function updateOrder(filter, mutableFields) {
  const db = await getDb();
  const patch = { ...mutableFields };
  delete patch._id;
  delete patch.createdAt;
  try {
    await db.collection("orders").updateOne(filter, {
      $set: { ...patch, updatedAt: new Date() }
    });
  } catch (err) {
    logError("db.write.failed", { collection: "orders", operation: "updateOne", err: safeErr(err) });
    throw err;
  }
}

export async function findOrderByActivationId(activationId) {
  const db = await getDb();
  return db.collection("orders").findOne({ activationId: String(activationId) });
}

export async function findRecentOrdersByUser(requesterId, limit = 10, activeOnly = false) {
  const db = await getDb();
  const query = { requesterId: String(requesterId) };
  if (activeOnly) query.localStatus = { $in: ACTIVE_STATUSES };
  return db.collection("orders").find(query).sort({ }).limit(limit).toArray();
}

export async function findOrdersDueForPolling(limit, now = new Date()) {
  const db = await getDb();
  return db.collection("orders")
    .find({ localStatus: { $in: ACTIVE_STATUSES }, pollAfter: { $lte: now } })
    .sort({ pollAfter: 1 })
    .limit(limit)
    .toArray();
}

export async function upsertTelegramUser(user, authorized = false) {
  const db = await getDb();
  const mutableFields = {
    telegramUserId: String(user?.id || ""),
    username: user?.username || "",
    firstName: user?.first_name || "",
    lastName: user?.last_name || "",
    isAuthorized: !!authorized,
  };
  await db.collection("telegram_users").updateOne(
    { telegramUserId: mutableFields.telegramUserId },
    {
      $setOnInsert: { createdAt: new Date() },
      $set: { ...mutableFields, updatedAt: new Date() }
    },
    { upsert: true }
  );
}

export async function insertEvent(event) {
  const db = await getDb();
  await db.collection("events").insertOne({ ...event, });
}

export async function saveWebhookEvent(event) {
  const db = await getDb();
  try {
    await db.collection("webhook_events").updateOne(
      { dedupeKey: event.dedupeKey },
      {
        $setOnInsert: { ...event, createdAt: new Date() },
        $set: { updatedAt: new Date() }
      },
      { upsert: true }
    );
    return true;
  } catch (err) {
    if (String(err?.code) === "11000") return false;
    logError("db.write.failed", { collection: "webhook_events", operation: "updateOne", err: safeErr(err) });
    throw err;
  }
}

export async function countOrderStats() {
  const db = await getDb();
  const active = await db.collection("orders").countDocuments({ localStatus: { $in: ACTIVE_STATUSES } });
  const total = await db.collection("orders").countDocuments({});
  return { active, total };
}
