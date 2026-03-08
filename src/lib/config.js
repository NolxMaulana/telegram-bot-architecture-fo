const ownerIdsRaw = process.env.BOT_OWNER_IDS || "";

export const cfg = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  MONGODB_URI: process.env.MONGODB_URI || "",
  HERO_SMS_API_KEY: process.env.HERO_SMS_API_KEY || "",
  HERO_SMS_BASE_URL: process.env.HERO_SMS_BASE_URL || "https://hero-sms.com/stubs/handler_api.php",
  BOT_OWNER_IDS: ownerIdsRaw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
  PORT: Number(process.env.PORT || 3000),
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || "",
  HERO_SMS_WEBHOOK_SECRET: process.env.HERO_SMS_WEBHOOK_SECRET || "",
  DEFAULT_COUNTRY_PRIORITY: process.env.DEFAULT_COUNTRY_PRIORITY || "Philippines,Vietnam",
  DEFAULT_SERVICE_CODE: process.env.DEFAULT_SERVICE_CODE || "",
  DEFAULT_MAX_PRICE: process.env.DEFAULT_MAX_PRICE || "",
  POLL_INTERVAL_MS: Math.max(5000, Number(process.env.POLL_INTERVAL_MS || 15000)),
  POLL_BATCH_LIMIT: Math.max(1, Number(process.env.POLL_BATCH_LIMIT || 20)),
  ORDER_CONCURRENCY_LIMIT: Math.max(1, Math.min(10, Number(process.env.ORDER_CONCURRENCY_LIMIT || 3))),
};
