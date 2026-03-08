import "dotenv/config";
import { createServer } from "node:http";
import { cfg } from "./lib/config.js";
import { initializeRuntimeConfig } from "./lib/configRuntime.js";
import { safeErr, logInfo, logError } from "./lib/logger.js";

process.on("unhandledRejection", (err) => {
  logError("process.unhandledRejection", { err: safeErr(err) });
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  logError("process.uncaughtException", { err: safeErr(err) });
  process.exit(1);
});

async function boot() {
  try {
    logInfo("boot.start", {
      tokenSet: !!cfg.TELEGRAM_BOT_TOKEN,
      mongoSet: !!cfg.MONGODB_URI,
      heroKeySet: !!cfg.HERO_SMS_API_KEY,
      webhookSecretSet: !!cfg.HERO_SMS_WEBHOOK_SECRET,
      publicBaseUrlSet: !!cfg.PUBLIC_BASE_URL,
      port: cfg.PORT,
    });

    if (!cfg.TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN is required. Set it in your environment and redeploy.");
      process.exit(1);
    }

    const [
      { connectDb },
      { createBot, startBotPolling },
      { createHttpHandler },
      { startPollingService },
      { buildBotProfile },
    ] = await Promise.all([
      import("./lib/db.js"),
      import("./bot.js"),
      import("./services/httpServer.js"),
      import("./services/poller.js"),
      import("./lib/botProfile.js"),
    ]);

    await connectDb();
    await initializeRuntimeConfig();
    const botProfile = buildBotProfile();
    const bot = await createBot({ botProfile });

    const httpHandler = createHttpHandler({ bot });
    const server = createServer(httpHandler);

    await new Promise((resolve) => {
      server.listen(cfg.PORT, () => resolve());
    });

    logInfo("http.started", { port: cfg.PORT });

    startPollingService({ bot });
    await startBotPolling(bot);

    logInfo("boot.ready", { polling: true, http: true });
  } catch (err) {
    logError("boot.failed", { err: safeErr(err) });
    process.exit(1);
  }
}

boot();
