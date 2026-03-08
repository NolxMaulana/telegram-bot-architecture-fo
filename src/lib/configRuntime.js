import { cfg } from "./config.js";
import { getDb } from "./db.js";
import { logError, logInfo, logWarn, safeErr } from "./logger.js";

const CONFIG_COLLECTION = "runtime_config";
const AUDIT_COLLECTION = "runtime_config_audit";

const EDITABLE_SPECS = {
  HERO_SMS_BASE_URL: {
    type: "string",
    sensitive: false,
    live: true,
    description: "HeroSMS API base URL used for provider requests.",
    defaultValue: cfg.HERO_SMS_BASE_URL || "https://hero-sms.com/stubs/handler_api.php",
    validate(value) {
      try {
        const url = new URL(String(value || ""));
        if (!/^https?:$/.test(url.protocol)) throw new Error("URL must start with http or https.");
        return { ok: true, value: url.toString() };
      } catch {
        return { ok: false, message: "Enter a valid URL." };
      }
    },
  },
  DEFAULT_COUNTRY_PRIORITY: {
    type: "list",
    sensitive: false,
    live: true,
    description: "Comma-separated country names shown first in listings and defaults.",
    defaultValue: cfg.DEFAULT_COUNTRY_PRIORITY || "Philippines,Vietnam",
    validate(value) {
      const list = String(value || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (!list.length) return { ok: false, message: "Provide at least one country name." };
      return { ok: true, value: list.join(",") };
    },
  },
  DEFAULT_SERVICE_CODE: {
    type: "string",
    sensitive: false,
    live: true,
    description: "Default HeroSMS service code used by /order when omitted.",
    defaultValue: cfg.DEFAULT_SERVICE_CODE || "",
    validate(value) {
      const v = String(value || "").trim();
      if (v && v.length > 10) return { ok: false, message: "Service code is too long." };
      return { ok: true, value: v };
    },
  },
  DEFAULT_MAX_PRICE: {
    type: "float",
    sensitive: false,
    live: true,
    description: "Optional default max price used for new orders.",
    defaultValue: cfg.DEFAULT_MAX_PRICE || "",
    validate(value) {
      const v = String(value || "").trim();
      if (!v) return { ok: true, value: "" };
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return { ok: false, message: "Enter a valid non-negative number." };
      return { ok: true, value: String(n) };
    },
  },
  POLL_INTERVAL_MS: {
    type: "integer",
    sensitive: false,
    live: true,
    description: "Polling interval in milliseconds for active HeroSMS orders.",
    defaultValue: String(cfg.POLL_INTERVAL_MS || 15000),
    validate(value) {
      const n = Number(String(value || "").trim());
      if (!Number.isInteger(n) || n < 5000) return { ok: false, message: "Enter an integer of at least 5000." };
      return { ok: true, value: String(n) };
    },
  },
  POLL_BATCH_LIMIT: {
    type: "integer",
    sensitive: false,
    live: true,
    description: "Maximum number of orders processed per polling cycle.",
    defaultValue: String(cfg.POLL_BATCH_LIMIT || 20),
    validate(value) {
      const n = Number(String(value || "").trim());
      if (!Number.isInteger(n) || n < 1 || n > 200) return { ok: false, message: "Enter an integer between 1 and 200." };
      return { ok: true, value: String(n) };
    },
  },
  ORDER_CONCURRENCY_LIMIT: {
    type: "integer",
    sensitive: false,
    live: true,
    description: "Max simultaneous order creation calls sent to HeroSMS.",
    defaultValue: String(cfg.ORDER_CONCURRENCY_LIMIT || 3),
    validate(value) {
      const n = Number(String(value || "").trim());
      if (!Number.isInteger(n) || n < 1 || n > 10) return { ok: false, message: "Enter an integer between 1 and 10." };
      return { ok: true, value: String(n) };
    },
  },
  BOT_OWNER_IDS: {
    type: "list",
    sensitive: false,
    live: true,
    description: "Comma-separated Telegram user IDs with owner access.",
    defaultValue: cfg.BOT_OWNER_IDS.join(","),
    validate(value) {
      const items = String(value || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      if (!items.length) return { ok: false, message: "At least one owner ID is required." };
      if (items.some((v) => !/^\d+$/.test(v))) return { ok: false, message: "Owner IDs must be numeric Telegram IDs." };
      return { ok: true, value: items.join(",") };
    },
  },
  PUBLIC_BASE_URL: {
    type: "string",
    sensitive: false,
    live: true,
    description: "Public base URL shown in status and webhook instructions.",
    defaultValue: cfg.PUBLIC_BASE_URL || "",
    validate(value) {
      const v = String(value || "").trim();
      if (!v) return { ok: true, value: "" };
      try {
        const url = new URL(v);
        if (!/^https?:$/.test(url.protocol)) throw new Error("bad protocol");
        return { ok: true, value: url.toString().replace(/\/+$/, "") };
      } catch {
        return { ok: false, message: "Enter a valid public URL or leave blank." };
      }
    },
  },
  HERO_SMS_WEBHOOK_SECRET: {
    type: "string",
    sensitive: true,
    live: true,
    description: "Shared secret required by the HeroSMS webhook endpoint.",
    defaultValue: cfg.HERO_SMS_WEBHOOK_SECRET || "",
    validate(value) {
      const v = String(value || "").trim();
      if (!v) return { ok: true, value: "" };
      if (v.length < 8) return { ok: false, message: "Use at least 8 characters." };
      return { ok: true, value: v };
    },
  },
};

const runtimeOverrides = new Map();
let persistenceAvailable = false;
let overridesLoaded = false;

function normalizeByType(key, rawValue) {
  const spec = EDITABLE_SPECS[key];
  const raw = rawValue ?? spec?.defaultValue ?? "";
  const text = String(raw ?? "");
  if (!spec) return text;
  if (spec.type === "integer") {
    const n = Number(text || 0);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  if (spec.type === "float") {
    const n = Number(text || 0);
    return Number.isFinite(n) ? n : 0;
  }
  if (spec.type === "boolean") {
    return ["1", "true", "yes", "on"].includes(text.trim().toLowerCase());
  }
  if (spec.type === "list") {
    return text
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return text;
}

function maskValue(key, rawValue) {
  const spec = EDITABLE_SPECS[key];
  const value = rawValue ?? "";
  const text = Array.isArray(value) ? value.join(",") : String(value || "");
  if (!text) return "not set";
  if (spec?.sensitive) {
    if (text.length <= 4) return "set (masked)";
    return `${text.slice(0, 2)}***${text.slice(-2)}`;
  }
  if (spec?.type === "list") {
    const items = text.split(",").map((v) => v.trim()).filter(Boolean);
    return `${items.length} item(s): ${items.slice(0, 3).join(", ")}${items.length > 3 ? ", ..." : ""}`;
  }
  if (text.length > 60) return `${text.slice(0, 24)}...${text.slice(-12)}`;
  return text;
}

function baseRawValue(key) {
  if (key === "BOT_OWNER_IDS") return cfg.BOT_OWNER_IDS.join(",");
  return cfg[key] ?? EDITABLE_SPECS[key]?.defaultValue ?? "";
}

export async function initializeRuntimeConfig() {
  if (overridesLoaded) return;
  overridesLoaded = true;
  if (!cfg.MONGODB_URI) {
    persistenceAvailable = false;
    logWarn("runtime_config.disabled", { mongoSet: false, reason: "MONGODB_URI missing" });
    return;
  }

  try {
    const db = await getDb();
    const rows = await db.collection(CONFIG_COLLECTION).find({}).toArray();
    for (const row of rows) {
      if (!row?.key || !(row.key in EDITABLE_SPECS)) continue;
      runtimeOverrides.set(row.key, row.value ?? "");
    }
    persistenceAvailable = true;
    logInfo("runtime_config.loaded", { count: runtimeOverrides.size, mongoSet: true });
  } catch (err) {
    persistenceAvailable = false;
    logError("db.read.failed", { collection: CONFIG_COLLECTION, operation: "find", err: safeErr(err) });
  }
}

export function getEditableEnvSpecs() {
  return EDITABLE_SPECS;
}

export function isRuntimeConfigPersistenceAvailable() {
  return persistenceAvailable;
}

export function getEffectiveConfigValue(key) {
  const raw = runtimeOverrides.has(key) ? runtimeOverrides.get(key) : baseRawValue(key);
  return normalizeByType(key, raw);
}

export function getEffectiveConfig() {
  const out = { ...cfg };
  for (const key of Object.keys(EDITABLE_SPECS)) {
    out[key] = getEffectiveConfigValue(key);
  }
  return out;
}

export function describeEditableEnvKeys() {
  return Object.entries(EDITABLE_SPECS).map(([key, spec]) => ({
    key,
    type: spec.type,
    description: spec.description,
    sensitive: !!spec.sensitive,
    live: !!spec.live,
    effectiveValue: getEffectiveConfigValue(key),
    maskedValue: maskValue(key, getEffectiveConfigValue(key)),
  }));
}

export function getEnvKeyDetails(key) {
  const spec = EDITABLE_SPECS[key];
  if (!spec) return null;
  const effectiveValue = getEffectiveConfigValue(key);
  return {
    key,
    ...spec,
    effectiveValue,
    maskedValue: maskValue(key, effectiveValue),
  };
}

export function validateEnvEdit(key, rawValue) {
  const spec = EDITABLE_SPECS[key];
  if (!spec) return { ok: false, message: "That key is not editable." };
  return spec.validate(rawValue);
}

export async function saveEnvOverride({ actorTelegramId, key, newRawValue }) {
  const spec = EDITABLE_SPECS[key];
  if (!spec) {
    return { ok: false, status: "rejected", message: "That key is not editable." };
  }
  if (!persistenceAvailable) {
    return { ok: false, status: "unavailable", message: "MongoDB-backed config persistence is unavailable." };
  }

  const validation = validateEnvEdit(key, newRawValue);
  if (!validation.ok) {
    await writeAudit({
      actorTelegramId,
      key,
      oldMaskedSummary: maskValue(key, getEffectiveConfigValue(key)),
      newMaskedSummary: maskValue(key, newRawValue),
      resultStatus: "validation_failed",
    });
    return { ok: false, status: "validation_failed", message: validation.message };
  }

  const db = await getDb();
  const oldValue = getEffectiveConfigValue(key);
  const oldMaskedSummary = maskValue(key, oldValue);
  const newMaskedSummary = maskValue(key, validation.value);

  try {
    await db.collection(CONFIG_COLLECTION).updateOne(
      { key },
      {
        $setOnInsert: { key, createdAt: new Date() },
        $set: {
          value: validation.value,
          type: spec.type,
          description: spec.description,
          sensitive: !!spec.sensitive,
          live: !!spec.live,
          updatedAt: new Date(),
          updatedBy: String(actorTelegramId || ""),
        },
      },
      { upsert: true }
    );
    runtimeOverrides.set(key, validation.value);
    logInfo("runtime_config.changed", { key, changed: true, actor: String(actorTelegramId || "") });
    await writeAudit({ actorTelegramId, key, oldMaskedSummary, newMaskedSummary, resultStatus: "saved" });
    return {
      ok: true,
      status: "saved",
      key,
      live: !!spec.live,
      oldMaskedSummary,
      newMaskedSummary,
      message: spec.live ? "Saved and applied live." : "Saved. It will apply on the next restart.",
    };
  } catch (err) {
    logError("db.write.failed", { collection: CONFIG_COLLECTION, operation: "updateOne", err: safeErr(err) });
    await writeAudit({ actorTelegramId, key, oldMaskedSummary, newMaskedSummary, resultStatus: "save_failed" });
    return { ok: false, status: "save_failed", message: "Failed to save the new value." };
  }
}

export async function writeAudit({ actorTelegramId, key, oldMaskedSummary, newMaskedSummary, resultStatus }) {
  if (!persistenceAvailable) return;
  try {
    const db = await getDb();
    await db.collection(AUDIT_COLLECTION).insertOne({
      actorTelegramId: String(actorTelegramId || ""),
      key: String(key || ""),
      oldMaskedSummary: String(oldMaskedSummary || "not set"),
      newMaskedSummary: String(newMaskedSummary || "not set"),
      resultStatus: String(resultStatus || "unknown"),
      updatedAt: new Date(),
    });
  } catch (err) {
    logError("db.write.failed", { collection: AUDIT_COLLECTION, operation: "insertOne", err: safeErr(err) });
  }
}
