import { denyIfUnauthorized } from "../lib/auth.js";
import { parseKeyValueArgs } from "../lib/format.js";
import { cfg } from "../lib/config.js";
import { createConcurrentOrders } from "../services/orderService.js";

export default function register(bot) {
  bot.command("order", async (ctx) => {
    const denied = await denyIfUnauthorized(ctx);
    if (denied) return;

    const args = parseKeyValueArgs(ctx.match || "");
    const serviceCode = args.service || cfg.DEFAULT_SERVICE_CODE || "wa";
    const country = args.country || "Philippines";
    const quantity = args.qty || args.quantity || "1";
    const operator = args.operator || "";
    const maxPrice = args.maxPrice || cfg.DEFAULT_MAX_PRICE || "";
    const fixedPrice = args.fixed === "1" || args.fixed === "true";

    const results = await createConcurrentOrders({
      requester: {
        id: ctx.from.id,
        username: ctx.from.username || "",
        chatId: ctx.chat.id,
      },
      serviceCode,
      countryInput: country,
      operator,
      maxPrice,
      fixedPrice,
      quantity,
    });

    const lines = results.map((item, idx) => {
      if (item.ok) {
        return `${idx + 1}) ok | order ${item.orderId} | activation ${item.activationId} | ${item.phoneNumber || "n/a"}`;
      }
      const min = item.error?.minPrice ? ` | min ${item.error.minPrice}` : "";
      return `${idx + 1}) failed | order ${item.orderId} | ${item.error?.code || "ORDER_FAILED"} | ${item.error?.message || "unknown"}${min}`;
    });

    await ctx.reply(lines.join("\n"));
  });
}
