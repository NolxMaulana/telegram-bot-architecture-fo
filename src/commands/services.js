import { denyIfUnauthorized } from "../lib/auth.js";
import { getServicesSummary } from "../services/orderService.js";

export default function register(bot) {
  bot.command("services", async (ctx) => {
    const denied = await denyIfUnauthorized(ctx);
    if (denied) return;
    const input = ctx.match || "";
    const result = await getServicesSummary(String(input || "").trim());
    if (!result.ok) {
      await ctx.reply(`Services lookup failed: ${result.message || result.errorCode || "unknown"}`);
      return;
    }
    const data = result.data;
    let lines = [];
    if (Array.isArray(data)) {
      lines = data.slice(0, 20).map((item) => `${item.code || item.id || "?"} - ${item.name || item.title || "service"}`);
    } else if (data && typeof data === "object") {
      lines = Object.entries(data).slice(0, 20).map(([code, item]) => `${code} - ${item?.name || item?.title || "service"}`);
    }
    await ctx.reply(lines.join("\n") || "No services found.");
  });
}
