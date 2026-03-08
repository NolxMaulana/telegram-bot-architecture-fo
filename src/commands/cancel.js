import { denyIfUnauthorized } from "../lib/auth.js";
import { cancelOrderByActivationId } from "../services/orderService.js";

export default function register(bot) {
  bot.command("cancel", async (ctx) => {
    const denied = await denyIfUnauthorized(ctx);
    if (denied) return;
    const activationId = String(ctx.match || "").trim();
    if (!activationId) {
      await ctx.reply("Usage: /cancel <activationId>");
      return;
    }
    const result = await cancelOrderByActivationId(activationId);
    await ctx.reply(result.ok ? `Canceled ${activationId}` : `Cancel failed: ${result.message || result.errorCode || "unknown"}`);
  });
}
