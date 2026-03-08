import { denyIfUnauthorized } from "../lib/auth.js";
import { retryOrderByActivationId } from "../services/orderService.js";

export default function register(bot) {
  bot.command("retry", async (ctx) => {
    const denied = await denyIfUnauthorized(ctx);
    if (denied) return;
    const activationId = String(ctx.match || "").trim();
    if (!activationId) {
      await ctx.reply("Usage: /retry <activationId>");
      return;
    }
    const result = await retryOrderByActivationId(activationId);
    await ctx.reply(result.ok ? `Retry requested for ${activationId}` : `Retry failed: ${result.message || result.errorCode || "unknown"}`);
  });
}
