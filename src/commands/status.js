import { cfg } from "../lib/config.js";
import { isOwner } from "../lib/auth.js";
import { countOrderStats } from "../services/orderStore.js";

export default function register(bot) {
  bot.command("status", async (ctx) => {
    if (!isOwner(ctx.from)) {
      await ctx.reply("Access denied.");
      return;
    }
    const stats = await countOrderStats();
    await ctx.reply([
      `Active orders: ${stats.active}`,
      `Total orders: ${stats.total}`,
      `Default country priority: ${cfg.DEFAULT_COUNTRY_PRIORITY}`,
      `Default service code: ${cfg.DEFAULT_SERVICE_CODE || "not set"}`,
      `Default max price: ${cfg.DEFAULT_MAX_PRICE || "not set"}`,
      `Polling: ${cfg.POLL_INTERVAL_MS}ms, batch ${cfg.POLL_BATCH_LIMIT}`,
      `Webhook enabled: ${cfg.HERO_SMS_WEBHOOK_SECRET ? "yes" : "no"}`,
      cfg.PUBLIC_BASE_URL ? `Webhook URL: ${cfg.PUBLIC_BASE_URL.replace(/\/+$/, "")}/webhooks/herosms` : "Webhook URL: PUBLIC_BASE_URL not set"
    ].join("\n"));
  });
}
