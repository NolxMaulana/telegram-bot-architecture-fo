# Changelog

All notable changes to this bot project are recorded here.

## 2026-03-08 16:41:23. UTC
- Request: environtment variable are edited from user
- Summary: Refined the existing Telegram HeroSMS bot with a Mongo-backed owner-only /env workflow, effective runtime config layer, masked audit trail, graceful no-Mongo fallback, and expanded owner /status output while preserving …
- Files: .env.sample, DOCS.md, package.json, src/bot.js, src/commands/env.js, src/commands/help.js, src/commands/start.js, src/commands/status.js, src/index.js, src/lib/auth.js, src/lib/botProfile.js, src/lib/config.js, src/lib/configRuntime.js, src/lib/db.js (+8 more)

## 2026-03-08 16:27:56. UTC
- Request: a bot that can auto order otp whatsapp at https://hero-sms.com/ focus on philipine, vietnam with this documentation json version, make sure to support concurrency order { "openapi": "3.1.0", "info": { "title": "API prot…
- Summary: Built a new Telegram-only HeroSMS bot project with grammY, MongoDB persistence, HTTP webhook routes in the same process, owner-gated authorization, concurrent order creation, polling recovery, inline activation actions,…
- Files: .env.sample, DOCS.md, README.md, package.json, src/bot.js, src/commands/active.js, src/commands/balance.js, src/commands/cancel.js, src/commands/countries.js, src/commands/finish.js, src/commands/help.js, src/commands/loader.js, src/commands/order.js, src/com…

