Hero SMS Bot

Telegram bot for authorized users to order and manage HeroSMS OTP activations with a workflow optimized for Philippines and Vietnam.

Features
1) Telegram bot built with grammY
2) MongoDB persistence for orders, users, events, and webhook dedupe
3) HeroSMS service adapter supporting legacy text and JSON responses
4) Concurrent order creation with a safe cap
5) Polling and webhook processing in the same Node.js process
6) Owner-only status controls

Architecture
1) src/index.js boots Telegram polling, MongoDB, polling service, and HTTP routes
2) src/bot.js wires grammY commands and callback actions
3) src/services/herosms.js handles HeroSMS API calls
4) src/services/orderService.js and orderStore.js manage domain logic and persistence
5) src/services/poller.js resumes and tracks active orders from MongoDB
6) src/services/webhook.js processes inbound SMS webhook events idempotently

Setup
1) Install dependencies with npm install
2) Copy .env.sample to .env
3) Set TELEGRAM_BOT_TOKEN, MONGODB_URI, and HERO_SMS_API_KEY
4) Optionally set BOT_OWNER_IDS, PUBLIC_BASE_URL, HERO_SMS_WEBHOOK_SECRET, and polling defaults
5) Run npm run dev for development or npm start for production

Commands
1) /start
2) /help
3) /balance
4) /countries
5) /services [country]
6) /prices service=wa country=philippines
7) /order service=wa country=philippines qty=2 maxPrice=20 fixed=1
8) /active
9) /orders
10) /cancel <activationId>
11) /retry <activationId>
12) /finish <activationId>
13) /status owner only

Integrations
1) HeroSMS base URL defaults to https://hero-sms.com/stubs/handler_api.php
2) Authentication uses api_key query param from HERO_SMS_API_KEY
3) Actions supported include getBalance, getCountries, getServicesList, getPrices, getNumberV2, getStatus, getStatusV2, getActiveActivations, getHistory, getAllSms, setStatus, finishActivation, cancelActivation
4) Upstream transport and parsing failures are normalized before being shown to users

Database
1) orders collection stores activation lifecycle state
2) telegram_users stores authorized user metadata
3) webhook_events stores dedupe keys for idempotent webhook handling
4) events stores audit trail events
5) Indexes are created for orderId, activationId, status and time fields, and webhook dedupe keys

Deployment
1) Deploy as a single Node.js service
2) Expose PORT for HTTP route handling
3) Telegram uses long polling by default
4) If PUBLIC_BASE_URL and HERO_SMS_WEBHOOK_SECRET are set, webhook endpoint is available at /webhooks/herosms

Troubleshooting
1) If startup exits, verify TELEGRAM_BOT_TOKEN, MONGODB_URI, and HERO_SMS_API_KEY are set
2) If Telegram polling conflicts with another instance, the bot retries automatically
3) If orders fail with BAD_KEY or NO_BALANCE, fix the HeroSMS account before retrying
4) Check logs for boot.start, herosms.request.*, poll.*, webhook.*, and db.* events

Extensibility
1) Add new commands under src/commands
2) Add new provider logic under src/services
3) Keep help text and DOCS.md in sync with implemented commands
