import { denyIfUnauthorized } from "../lib/auth.js";
import { finishOrderByActivationId } from "../services/orderService.js";

export default function register(bot) {
  bot.command("finish", async (ctx) => {
    const denied = await denyIfUnauthorized(ctx);
    if (denied) return;
    const activationId = String(ctx.match || "").trim();
    if (!activationId) {
      await ctx.reply("Usage: /finish <activationId>");
      return;
    }
    const result = await finishOrderByActivationId(activationId);
    await ctx.reply(result.ok ? `Finished ${activationId}` : `Finish failed: ${result.message || result.errorCode || "unknown"}`);
  });
}
