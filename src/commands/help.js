import { denyIfUnauthorized, isOwner } from "../lib/auth.js";

export default function register(bot) {
  bot.command("help", async (ctx) => {
    const denied = await denyIfUnauthorized(ctx);
    if (denied) return;

    const lines = [
      "/start - welcome and access info",
      "/help - this help",
      "/balance - show current HeroSMS balance",
      "/countries - list countries with Philippines and Vietnam first",
      "/services [country] - list services for a country",
      "/prices service=wa country=philippines - check pricing",
      "/order service=wa country=philippines qty=2 maxPrice=20 fixed=1 - create orders",
      "/active - show active activations",
      "/orders - show recent order history",
      "/cancel 12345 - cancel activation",
      "/retry 12345 - request another SMS",
      "/finish 12345 - finish activation",
      isOwner(ctx.from) ? "/env - owner-only runtime config editing" : "",
      isOwner(ctx.from) ? "/status - show defaults and basic admin status" : ""
    ].filter(Boolean);

    await ctx.reply(lines.join("\n"));
  });
}
