import crypto from "node:crypto";
import { buildActivationKeyboard } from "../bot.js";
import { updateOrder } from "./orderStore.js";
import { logInfo, logWarn, safeErr } from "../lib/logger.js";

export async function notifyOtpIfNew(bot, order, otp) {
  const hash = crypto.createHash("sha1").update(`${otp.code || ""}|${otp.text || ""}`).digest("hex");
  if (order.notifiedOtpHash && order.notifiedOtpHash === hash) {
    return false;
  }

  const text = [
    `OTP received`,
    `Activation: ${order.activationId}`,
    `Service: ${order.serviceCode}`,
    `Country: ${order.countryName || order.countryCode}`,
    `Phone: ${order.phoneNumber || "n/a"}`,
    `Code: ${otp.code || "n/a"}`,
    `SMS: ${otp.text || "n/a"}`,
  ].join("\n");

  try {
    await bot.api.sendMessage(order.requesterChatId, text, {
      reply_markup: buildActivationKeyboard(order.activationId),
    });
    await updateOrder({ orderId: order.orderId }, { notifiedOtpHash: hash, otpCode: otp.code || "", otpText: otp.text || "", localStatus: "otp_received" });
    logInfo("notify.otp.sent", { activationId: order.activationId, orderId: order.orderId });
    return true;
  } catch (err) {
    logWarn("telegram.message.send.failed", { err: safeErr(err), activationId: order.activationId, fallback: "none" });
    return false;
  }
}
