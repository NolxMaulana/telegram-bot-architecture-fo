import { cancelOrderByActivationId, finishOrderByActivationId, retryOrderByActivationId, refreshActivation, getOrderByActivationId } from "../services/orderService.js";
import { safeErr } from "../lib/logger.js";

export async function handleActivationCallback(ctx) {
  const data = String(ctx.callbackQuery?.data || "");
  if (!data.startsWith("act:")) return ctx.answerCallbackQuery();

  const [, action, activationId] = data.split(":");
  let result = null;
  if (action === "cancel") result = await cancelOrderByActivationId(activationId);
  if (action === "finish") result = await finishOrderByActivationId(activationId);
  if (action === "retry") result = await retryOrderByActivationId(activationId);
  if (action === "refresh") result = await refreshActivation(activationId);

  const order = await getOrderByActivationId(activationId);
  const message = result?.ok
    ? `${action} ok for ${activationId}`
    : `${action} failed: ${result?.message || result?.errorCode || "unknown"}`;

  await ctx.answerCallbackQuery({ text: message.slice(0, 180) });
  if (order) {
    await ctx.reply([
      `Activation: ${activationId}`,
      `Order: ${order.orderId}`,
      `Status: ${order.localStatus}`,
      result?.ok ? `Upstream: ${result.code || "ok"}` : `Error: ${result?.message || result?.errorCode || "unknown"}`
    ].join("\n")).catch(() => {});
  }
}
