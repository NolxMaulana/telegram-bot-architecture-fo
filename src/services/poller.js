import { cfg } from "../lib/config.js";
import { logInfo, logWarn, logError, safeErr } from "../lib/logger.js";
import { findOrdersDueForPolling, updateOrder } from "./orderStore.js";
import { getStatusV2, getStatus, getAllSms } from "./herosms.js";
import { notifyOtpIfNew } from "./notifier.js";

let running = false;
const locks = new Set();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractOtp(statusResult, smsResult) {
  const code = statusResult?.data?.code || statusResult?.data?.smsCode || statusResult?.parts?.[1] || smsResult?.data?.code || "";
  const text = statusResult?.data?.text || statusResult?.data?.sms || smsResult?.data?.text || smsResult?.raw || "";
  return { code: String(code || ""), text: String(text || "") };
}

function normalizeStatus(result) {
  const code = result?.code || result?.errorCode || "";
  if (["STATUS_OK", "OTP_RECEIVED", "NEW_OTP_RECEIVED"].includes(code)) return "otp_received";
  if (["STATUS_WAIT_CODE", "STATUS_WAIT_RETRY", "STATUS_WAIT_RESEND"].includes(code)) return "waiting_code";
  if (["STATUS_CANCEL"].includes(code)) return "canceled";
  if (["STATUS_FINISH"].includes(code)) return "finished";
  if (["NO_ACTIVATION", "WRONG_ACTIVATION_ID", "ACTIVATION_NOT_ACTIVE"].includes(code)) return "failed";
  return "active";
}

async function processOrder(bot, order) {
  const lockKey = String(order.activationId || order.orderId);
  if (locks.has(lockKey)) return;
  locks.add(lockKey);
  try {
    const statusV2 = await getStatusV2(order.activationId);
    const status = statusV2.ok ? statusV2 : await getStatus(order.activationId);
    const sms = await getAllSms(order.activationId);
    const localStatus = normalizeStatus(status);
    const otp = extractOtp(status, sms);

    await updateOrder({ orderId: order.orderId }, {
      localStatus,
      lastHeroStatus: status.code || status.errorCode || "",
      pollAfter: new Date(Date.now() + cfg.POLL_INTERVAL_MS),
      otpCode: otp.code || order.otpCode || "",
      otpText: otp.text || order.otpText || "",
    });

    if (otp.code || otp.text) {
      await notifyOtpIfNew(bot, order, otp);
    }
  } catch (err) {
    logError("poll.cycle.item.failed", { activationId: order.activationId, err: safeErr(err) });
    await updateOrder({ orderId: order.orderId }, { pollAfter: new Date(Date.now() + cfg.POLL_INTERVAL_MS * 2) });
  } finally {
    locks.delete(lockKey);
  }
}

export function startPollingService({ bot }) {
  if (running) return;
  running = true;
  logInfo("poll.start", { intervalMs: cfg.POLL_INTERVAL_MS, batchLimit: cfg.POLL_BATCH_LIMIT });

  void (async function loop() {
    let cycle = 0;
    let lastMemLog = 0;
    while (running) {
      cycle += 1;
      try {
        const due = await findOrdersDueForPolling(cfg.POLL_BATCH_LIMIT, new Date());
        logInfo("poll.cycle", { cycle, due: due.length });
        for (const order of due) {
          await processOrder(bot, order);
        }
      } catch (err) {
        logWarn("poll.failure", { err: safeErr(err) });
      }

      const now = Date.now();
      if (now - lastMemLog > 60000) {
        lastMemLog = now;
        const m = process.memoryUsage();
        console.log("[mem]", { rssMB: Math.round(m.rss / 1e6), heapUsedMB: Math.round(m.heapUsed / 1e6) });
      }
      await sleep(cfg.POLL_INTERVAL_MS);
    }
  })();
}
