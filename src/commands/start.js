import { denyIfUnauthorized, isOwner } from "../lib/auth.js";
import { upsertTelegramUser } from "../services/orderStore.js";

export default function register(bot) {
  bot.command("start", async (ctx) => {
    const owner = isOwner(ctx.from);
    await upsertTelegramUser(ctx.from, owner);
    const denied = await denyIfUnauthorized(ctx);
    if (denied) return;

    const lines = [
      "HeroSMS OTP bot for authorized users.",
      "Focus: Philippines and Vietnam first, with other countries available too.",
      "Main commands: /balance /countries /services /prices /order /active /orders /cancel /retry /finish",
      owner ? "You also have owner access to /env and /status." : ""
    ].filter(Boolean);

    await ctx.reply(lines.join("\n"));
  });
}
