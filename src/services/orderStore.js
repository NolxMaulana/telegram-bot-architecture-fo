import crypto from "node:crypto";
import { getDb } from "../lib/db.js";
import { logError, safeErr } from "../lib/logger.js";

const ACTIVE_STATUSES = ["requested", "active", "waiting_code", "otp_received", "waiting_retry", "waiting_resend"];
const memoryOrders = [];
const memoryUsers = new Map();
const memoryEvents = [];
const memoryWebhookEvents = new Set();

export function generateOrderId() {
  return `ord_${crypto.randomBytes(4).toString("hex")}`;
}

export async function createOrder(doc) {
  const db = await getDb();
  const now = new Date();
  const record = { ...doc, createdAt: now, updatedAt: now };
  if (!db) {
    memoryOrders.unshift(record);
    if (memoryOrders.length > 5000) memoryOrders.pop();
    return record;
  }
  await db.collection("orders").insertOne(record);
  return record;
}

export async function updateOrder(filter, mutableFields) {
  const db = await getDb();
  const patch = { ...mutableFields };
  delete patch._id;
  delete patch.createdAt;
  if (!db) {
    const item = memoryOrders.find((row) => Object.entries(filter).every(([k, v]) => row[k] === v));
    if (item) Object.assign(item, patch, { updatedAt: new Date() });
    return;
  }
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
  if (!db) return memoryOrders.find((row) => row.activationId === String(activationId)) || null;
  return db.collection("orders").findOne({ activationId: String(activationId) });
}

export async function findRecentOrdersByUser(requesterId, limit = 10, activeOnly = false) {
  const db = await getDb();
  if (!db) {
    return memoryOrders
      .filter((row) => row.requesterId === String(requesterId) && (!activeOnly || ACTIVE_STATUSES.includes(row.localStatus)))
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .slice(0, limit);
  }
  const query = { requesterId: String(requesterId) };
  if (activeOnly) query.localStatus = { $in: ACTIVE_STATUSES };
  return db.collection("orders").find(query).sort({ updatedAt: -1 }).limit(limit).toArray();
}

export async function findOrdersDueForPolling(limit, now = new Date()) {
  const db = await getDb();
  if (!db) {
    return memoryOrders
      .filter((row) => ACTIVE_STATUSES.includes(row.localStatus) && new Date(row.pollAfter || 0) <= now)
      .sort((a, b) => new Date(a.pollAfter || 0) - new Date(b.pollAfter || 0))
      .slice(0, limit);
  }
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
  if (!db) {
    memoryUsers.set(mutableFields.telegramUserId, { ...mutableFields, updatedAt: new Date() });
    return;
  }
  await db.collection("telegram_users").updateOne(
    { telegramUserId: mutableFields.telegramUserId },
    {
      $setOnInsert: { },
      $set: { ...mutableFields, updatedAt: new Date() }
    },
    { upsert: true }
  );
}

export async function insertEvent(event) {
  const db = await getDb();
  const doc = { ...event, updatedAt: new Date() };
  if (!db) {
    memoryEvents.unshift(doc);
    if (memoryEvents.length > 5000) memoryEvents.pop();
    return;
  }
  await db.collection("events").insertOne(doc);
}

export async function saveWebhookEvent(event) {
  const db = await getDb();
  if (!db) {
    if (memoryWebhookEvents.has(event.dedupeKey)) return false;
    memoryWebhookEvents.add(event.dedupeKey);
    if (memoryWebhookEvents.size > 5000) {
      const first = memoryWebhookEvents.values().next().value;
      memoryWebhookEvents.delete(first);
    }
    return true;
  }
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
  if (!db) {
    const active = memoryOrders.filter((row) => ACTIVE_STATUSES.includes(row.localStatus)).length;
    const total = memoryOrders.length;
    return { active, total };
  }
  const active = await db.collection("orders").countDocuments({ localStatus: { $in: ACTIVE_STATUSES } });
  const total = await db.collection("orders").countDocuments({});
  return { active, total };
}
