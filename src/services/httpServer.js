import { cfg } from "../lib/config.js";
import { handleWebhook } from "./webhook.js";

export function createHttpHandler({ bot }) {
  return async function httpHandler(req, res) {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        service: "Hero SMS Bot",
        webhookPath: "/webhooks/herosms",
        publicBaseUrlConfigured: !!cfg.PUBLIC_BASE_URL,
        webhookEnabled: !!cfg.HERO_SMS_WEBHOOK_SECRET,
      }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/webhooks/herosms") {
      await handleWebhook(req, res, bot);
      return;
    }

    res.statusCode = 404;
    res.end("Not found");
  };
}
