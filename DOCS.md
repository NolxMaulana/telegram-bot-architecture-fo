This bot lets authorized Telegram users order and manage HeroSMS OTP activations. It is optimized for Philippines and Vietnam by prioritizing those countries in selection lists and defaults, while still allowing other countries.

Setup
1) Install dependencies with npm install
2) Copy .env.sample to .env
3) Required env vars:
   1. TELEGRAM_BOT_TOKEN for Telegram bot access
   2. HERO_SMS_API_KEY for HeroSMS API access
4) Optional env vars:
   1. MONGODB_URI enables MongoDB persistence for orders, audits, and runtime config overrides
   2. HERO_SMS_BASE_URL defaults to https://hero-sms.com/stubs/handler_api.php
   3. BOT_OWNER_IDS comma-separated Telegram user IDs with owner access
   4. PORT defaults to 3000
   5. PUBLIC_BASE_URL used to display webhook instructions
   6. HERO_SMS_WEBHOOK_SECRET enables and protects the webhook route
   7. DEFAULT_COUNTRY_PRIORITY defaults to Philippines,Vietnam
   8. DEFAULT_SERVICE_CODE optional default service code
   9. DEFAULT_MAX_PRICE optional default price ceiling
   10. POLL_INTERVAL_MS defaults to 15000
   11. POLL_BATCH_LIMIT defaults to 20
   12. ORDER_CONCURRENCY_LIMIT defaults to 3

Authorization
1) The bot is restricted because it spends paid HeroSMS balance
2) Users in BOT_OWNER_IDS are automatically authorized
3) Other users must exist as authorized records in MongoDB telegram_users
4) Unauthorized users receive a short denial message and the bot makes no HeroSMS request
5) Owner-only commands are /env and /status

Runtime config editing
1) Owners can manage selected runtime settings from Telegram with /env
2) Editable keys are allowlisted only. Arbitrary process env mutation is not allowed
3) /env shows editable keys with type, masked effective value, and whether changes apply live or on restart
4) /env show KEY shows a concise description and masked value
5) /env edit KEY starts an owner-only edit flow
6) The bot validates the new value based on the key type, asks for confirmation, then saves it to MongoDB runtime_config
7) Sensitive values are never shown in full and are never logged in plaintext
8) Every edit attempt and result is written to MongoDB runtime_config_audit when MongoDB is available
9) If MONGODB_URI is missing or MongoDB is unavailable, /env reports that persistence is unavailable and no change is saved

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
13) /env
   What it does: owner-only runtime config management flow
   Usage: /env, /env show KEY, /env edit KEY, /env cancel
14) /status
   What it does: owner-only command showing sanitized effective defaults, Mongo override status, and runtime status
   Usage: /status

Persistence
1) If MongoDB is available, orders stores activation records, upstream snippets, OTP data, status transitions, and timestamps
2) webhook_events stores deduplicated webhook payloads
3) telegram_users stores Telegram user metadata and authorization state
4) events stores summary operational events
5) runtime_config stores owner-edited runtime overrides
6) runtime_config_audit stores masked audit trail records for env edit attempts and changes
7) createdAt is only written on insert and never overwritten during updates

Polling
1) The polling subsystem scans active orders in batches
2) It logs when polling starts, each cycle count, and failures
3) It fetches HeroSMS status updates and SMS data
4) When OTP arrives, it notifies the Telegram requester once and avoids duplicates
5) Polling settings read from the effective runtime config, so owner edits can take effect live when safe
