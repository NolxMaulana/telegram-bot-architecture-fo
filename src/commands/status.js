import { isOwner } from "../lib/auth.js";
import { countOrderStats } from "../services/orderStore.js";
import { describeEditableEnvKeys, isRuntimeConfigPersistenceAvailable } from "../lib/configRuntime.js";

export default function register(bot) {
  bot.command("status", async (ctx) => {
    if (!isOwner(ctx.from)) {
      await ctx.reply("Access denied.");
      return;
    }
    const stats = await countOrderStats();
    const editable = describeEditableEnvKeys()
      .slice(0, 8)
      .map((row) => `${row.key}: ${row.maskedValue}`)
      .join("\n");

    await ctx.reply([
      `Active orders: ${stats.active}`,
      `Total orders: ${stats.total}`,
      `Mongo config overrides: ${isRuntimeConfigPersistenceAvailable() ? "enabled" : "disabled"}`,
      "Effective defaults:",
      editable || "No editable defaults found.",
      "Runtime status:",
      `Polling enabled: yes`,
      `Order actions scoped to requester: yes`,
      `Owner-only admin actions: /env, /status`,
    ].join("\n"));
  });
}
