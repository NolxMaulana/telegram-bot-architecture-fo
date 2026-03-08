export function buildBotProfile() {
  const commands = [
    "/start - welcome and access rules",
    "/help - command help and examples",
    "/balance - show HeroSMS balance",
    "/countries - list countries with Philippines and Vietnam first",
    "/services - list services for a country",
    "/prices - check prices by service and country",
    "/order - create one or more activation orders",
    "/active - show active orders",
    "/orders - show recent order history",
    "/cancel - cancel an activation",
    "/retry - request another SMS",
    "/finish - finish an activation",
    "/status - admin status and defaults"
  ];

  return [
    "Purpose: This Telegram bot lets authorized users order and manage HeroSMS OTP activations with a workflow optimized for Philippines and Vietnam.",
    `Public commands: ${commands.join("; ")}`,
    "Rules: Unauthorized users must be denied and no upstream HeroSMS request should be made. Admin status/defaults are owner-only. The bot runs with MongoDB persistence, webhook support, and polling in the same process."
  ].join(" ");
}
