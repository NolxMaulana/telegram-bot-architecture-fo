import { Bot, InlineKeyboard } from "grammy";
import { run } from "@grammyjs/runner";
import { cfg } from "./lib/config.js";
import { safeErr, logInfo, logWarn, logError } from "./lib/logger.js";
import { registerCommands } from "./commands/loader.js";
import { handleActivationCallback } from "./features/callbacks.js";

let runner = null;
let restarting = false;

export async function createBot({ botProfile }) {
  const bot = new Bot(cfg.TELEGRAM_BOT_TOKEN);
  bot.botConfig = { botProfile };

  bot.catch((err) => {
    logError("telegram.bot.catch", { err: safeErr(err.error) });
  });

  await registerCommands(bot);

  bot.on("callback_query:data", async (ctx) => {
    try {
      await handleActivationCallback(ctx);
    } catch (err) {
      logError("telegram.callback.failed", { err: safeErr(err) });
      await ctx.answerCallbackQuery({ text: "Action failed", show_alert: false }).catch(() => {});
    }
  });

  await bot.api.setMyCommands([
    { command: "start", description: "Welcome and access info" },
    { command: "help", description: "Show commands and examples" },
    { command: "balance", description: "Show HeroSMS balance" },
    { command: "countries", description: "List countries" },
    { command: "services", description: "List services" },
    { command: "prices", description: "Check prices" },
    { command: "order", description: "Create activation order" },
    { command: "active", description: "Show active orders" },
    { command: "orders", description: "Show recent orders" },
    { command: "cancel", description: "Cancel activation" },
    { command: "retry", description: "Request another SMS" },
    { command: "finish", description: "Finish activation" },
    { command: "env", description: "Owner runtime config" },
    { command: "status", description: "Owner status" }
  ]).catch((err) => {
    logWarn("telegram.setMyCommands.failed", { err: safeErr(err) });
  });

  return bot;
}

export async function startBotPolling(bot) {
  let backoffMs = 2000;

  async function loop() {
    while (true) {
      try {
        if (runner) {
          runner.stop();
          runner = null;
        }

        logInfo("telegram.polling.start", { concurrency: 1 });
        await bot.api.deleteWebhook({ drop_pending_updates: true });
        runner = run(bot, { runner: { fetch: { allowed_updates: ["message", "callback_query"] } }, sink: { concurrency: 1 } });
        return;
      } catch (err) {
        const message = safeErr(err);
        const isConflict = String(message).includes("409") || String(message).toLowerCase().includes("conflict");
        logWarn("telegram.polling.failed", { err: message, isConflict, backoffMs });
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        backoffMs = Math.min(backoffMs === 2000 ? 5000 : backoffMs * 2, 20000);
      }
    }
  }

  if (restarting) return;
  restarting = true;
  try {
    await loop();
  } finally {
    restarting = false;
  }
}

export function buildActivationKeyboard(activationId) {
  return new InlineKeyboard()
    .text("Refresh", `act:refresh:${activationId}`)
    .text("Retry SMS", `act:retry:${activationId}`)
    .row()
    .text("Finish", `act:finish:${activationId}`)
    .text("Cancel", `act:cancel:${activationId}`);
}
