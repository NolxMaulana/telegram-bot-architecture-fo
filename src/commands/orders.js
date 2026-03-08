import { denyIfUnauthorized } from "../lib/auth.js";
import { formatOrderLine } from "../lib/format.js";
import { listUserOrders } from "../services/orderService.js";

export default function register(bot) {
  bot.command("orders", async (ctx) => {
    const denied = await denyIfUnauthorized(ctx);
    if (denied) return;
    const rows = await listUserOrders(ctx.from.id, false);
    await ctx.reply(rows.length ? rows.map(formatOrderLine).join("\n") : "No recent orders.");
  });
}
