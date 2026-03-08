import { denyIfUnauthorized } from "../lib/auth.js";
import { parseKeyValueArgs } from "../lib/format.js";
import { getPricesSummary } from "../services/orderService.js";

export default function register(bot) {
  bot.command("prices", async (ctx) => {
    const denied = await denyIfUnauthorized(ctx);
    if (denied) return;
    const args = parseKeyValueArgs(ctx.match || "");
    const service = args.service || args.s || "";
    const country = args.country || args.c || "";
    if (!service) {
      await ctx.reply("Usage: /prices service=wa country=philippines");
      return;
    }
    const result = await getPricesSummary(service, country);
    if (!result.ok) {
      await ctx.reply(`Price lookup failed: ${result.message || result.errorCode || "unknown"}`);
      return;
    }
    const data = result.data;
    let body = result.raw || "No pricing data.";
    if (data && typeof data === "object") {
      body = JSON.stringify(data).slice(0, 3000);
    }
    await ctx.reply(`Prices for ${service}${country ? ` in ${country}` : ""}:\n${body}`);
  });
}
