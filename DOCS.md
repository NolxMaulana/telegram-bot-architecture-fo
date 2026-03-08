This bot lets authorized Telegram users order and manage HeroSMS OTP activations. It is optimized for Philippines and Vietnam by prioritizing those countries in selection lists and defaults, while still allowing other countries.

Setup
1) Install dependencies with npm install
2) Copy .env.sample to .env
3) Required env vars:
   1. TELEGRAM_BOT_TOKEN for Telegram bot access
   2. MONGODB_URI for MongoDB persistence
   3. HERO_SMS_API_KEY for HeroSMS API access
4) Optional env vars:
   1. HERO_SMS_BASE_URL defaults to https://hero-sms.com/stubs/handler_api.php
   2. BOT_OWNER_IDS comma-separated Telegram user IDs with owner access
   3. PORT defaults to 3000
   4. PUBLIC_BASE_URL used to display webhook instructions
   5. HERO_SMS_WEBHOOK_SECRET enables and protects the webhook route
   6. DEFAULT_COUNTRY_PRIORITY defaults to Philippines,Vietnam
   7. DEFAULT_SERVICE_CODE optional default service code
   8. DEFAULT_MAX_PRICE optional default price ceiling
   9. POLL_INTERVAL_MS defaults to 15000
   10. POLL_BATCH_LIMIT defaults to 20

Authorization
1) The bot is restricted because it spends paid HeroSMS balance
2) Users in BOT_OWNER_IDS are automatically authorized
3) Other users must exist as authorized records in MongoDB telegram_users
4) Unauthorized users receive a short denial message and the bot makes no HeroSMS request

Concurrency behavior
1) /order supports qty greater than 1
2) Multiple upstream purchase requests are sent concurrently with a safe cap from ORDER_CONCURRENCY_LIMIT
3) Each activation is stored separately in MongoDB
4) Polling resumes from MongoDB after restarts
5) Per-activation processing is lock-protected in the single Node.js process

Webhook route
1) Route: POST /webhooks/herosms
2) The service listens on PORT with a safe fallback
3) If HERO_SMS_WEBHOOK_SECRET is set, the route requires a shared secret through x-herosms-secret or payload.secret
4) If HERO_SMS_WEBHOOK_SECRET is missing, the route stays disabled without crashing
5) Webhook events are deduplicated in MongoDB and return HTTP 200 quickly even for duplicates
6) If PUBLIC_BASE_URL is set, the full route is PUBLIC_BASE_URL plus /webhooks/herosms

Supported commands
1) /start
   What it does: explains the bot purpose, authorization scope, and main commands
   Usage: /start
2) /help
   What it does: lists public commands and examples
   Usage: /help
3) /balance
   What it does: shows current HeroSMS balance
   Usage: /balance
4) /countries
   What it does: lists countries with Philippines and Vietnam first
   Usage: /countries
5) /services [country]
   What it does: lists services for a country
   Usage: /services philippines
6) /prices [service] [country]
   What it does: shows current pricing and availability
   Usage: /prices service=wa country=philippines
7) /order
   What it does: creates one or more activation orders
   Usage: /order service=wa country=philippines qty=2 maxPrice=20 fixed=1
8) /active
   What it does: shows active activations with compact status
   Usage: /active
9) /orders
   What it does: shows recent order history
   Usage: /orders
10) /cancel
   What it does: cancels an activation
   Usage: /cancel 12345
11) /retry
   What it does: requests another SMS where supported
   Usage: /retry 12345
12) /finish
   What it does: finishes an activation
   Usage: /finish 12345
13) /status
   What it does: owner-only command showing defaults and basic status
   Usage: /status

Philippines and Vietnam prioritization
1) The bot fetches countries dynamically from HeroSMS
2) It resolves Philippines and Vietnam by English name matching using DEFAULT_COUNTRY_PRIORITY
3) Those countries are shown first in country lists and are used as default flow priorities
4) Other countries are still available and can be chosen manually

Persistence
1) orders stores activation records, upstream snippets, OTP data, status transitions, and timestamps
2) webhook_events stores deduplicated webhook payloads
3) telegram_users stores Telegram user metadata and authorization state
4) events stores summary operational events
5) createdAt is only written on insert and never overwritten during updates

Polling
1) The polling subsystem scans active orders from MongoDB in batches
2) It logs when polling starts, each cycle count, and failures
3) It fetches HeroSMS status updates and SMS data
4) When OTP arrives, it notifies the Telegram requester once and avoids duplicates
