import crypto from "node:crypto";
import { cfg } from "../lib/config.js";
import { logInfo, logWarn, safeErr } from "../lib/logger.js";
import { saveWebhookEvent, findOrderByActivationId, updateOrder } from "./orderStore.js";
import { notifyOtpIfNew } from "./notifier.js";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("body too large"));
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function isSecretValid(req, payload) {
  if (!cfg.HERO_SMS_WEBHOOK_SECRET) return false;
  const headerSecret = req.headers["x-herosms-secret"] || req.headers["x-webhook-secret"] || "";
  return String(headerSecret) === String(cfg.HERO_SMS_WEBHOOK_SECRET) || String(payload?.secret || "") === String(cfg.HERO_SMS_WEBHOOK_SECRET);
}

export async function handleWebhook(req, res, bot) {
  if (!cfg.HERO_SMS_WEBHOOK_SECRET) {
    logWarn("webhook.disabled", { reason: "missing_secret" });
    return json(res, 200, { ok: true, disabled: true });
  }

  try {
    const raw = await readBody(req);
    const payload = raw ? JSON.parse(raw) : {};
    const valid = isSecretValid(req, payload);
    if (!valid) {
      logWarn("webhook.denied", { reason: "bad_secret" });
      return json(res, 200, { ok: true });
    }

    const activationId = String(payload.activationId || payload.id || "");
    const code = String(payload.code || "");
    const text = String(payload.text || "");
    const dedupeKey = crypto.createHash("sha1").update(`${activationId}|${code}|${text}`).digest("hex");

    logInfo("webhook.received", { activationId, hasCode: !!code, hasText: !!text });
    const inserted = await saveWebhookEvent({
      dedupeKey,
      activationId,
      service: payload.service || "",
      text,
      code,
      country: payload.country || "",
      receivedAt: payload.receivedAt || new Date().toISOString(),
      raw: raw.slice(0, 500),
    });

    if (!inserted) {
      logInfo("webhook.duplicate", { activationId });
      return json(res, 200, { ok: true, duplicate: true });
    }

    const order = await findOrderByActivationId(activationId);
    if (order) {
      await updateOrder({ orderId: order.orderId }, {
        otpCode: code,
        otpText: text,
        localStatus: "otp_received",
        lastHeroStatus: "WEBHOOK_OTP_RECEIVED"
      });
      await notifyOtpIfNew(bot, order, { code, text });
      logInfo("webhook.updated_order", { activationId, orderId: order.orderId });
    }

    return json(res, 200, { ok: true });
  } catch (err) {
    logWarn("webhook.failed", { err: safeErr(err) });
    return json(res, 200, { ok: true });
  }
}
