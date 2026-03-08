import { denyIfUnauthorized } from "../lib/auth.js";
import { getBalanceSummary } from "../services/orderService.js";

export default function register(bot) {
  bot.command("balance", async (ctx) => {
    const denied = await denyIfUnauthorized(ctx);
    if (denied) return;
    const result = await getBalanceSummary();
    if (!result.ok) {
      await ctx.reply(`Balance check failed: ${result.message || result.errorCode || "unknown"}`);
      return;
    }
    const value = result.data?.balance || result.parts?.[1] || result.raw || "ok";
    await ctx.reply(`Balance: ${value}`);
  });
}
