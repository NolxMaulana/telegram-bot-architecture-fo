import { isOwner } from "../lib/auth.js";
import {
  describeEditableEnvKeys,
  getEnvKeyDetails,
  isRuntimeConfigPersistenceAvailable,
  saveEnvOverride,
  validateEnvEdit,
  writeAudit,
} from "../lib/configRuntime.js";
import { clearEnvSession, getEnvSession, setEnvSession } from "../lib/runtimeState.js";

function denyText() {
  return "Access denied.";
}

function buildListText() {
  const rows = describeEditableEnvKeys();
  const lines = [
    "Editable runtime config keys:",
    ...rows.map((row) => `${row.key} | ${row.type} | ${row.maskedValue} | ${row.live ? "live" : "restart"}`),
    "",
    "Use /env show KEY to inspect a key.",
    "Use /env edit KEY to start editing.",
    "Use /env cancel to stop the current edit.",
  ];
  return lines.join("\n");
}

export default function register(bot) {
  bot.command("env", async (ctx) => {
    if (!isOwner(ctx.from)) {
      await ctx.reply(denyText());
      return;
    }

    if (!isRuntimeConfigPersistenceAvailable()) {
      await ctx.reply("Runtime config persistence is unavailable because MongoDB is not configured. The bot still runs, but /env changes cannot be saved.");
      return;
    }

    const raw = String(ctx.match || "").trim();
    if (!raw) {
      await ctx.reply(buildListText());
      return;
    }

    const parts = raw.split(/\s+/);
    const sub = String(parts[0] || "").toLowerCase();
    const key = String(parts[1] || "").trim().toUpperCase();

    if (sub === "cancel") {
      clearEnvSession(ctx.from.id);
      await ctx.reply("Env edit canceled.");
      return;
    }

    if (sub === "list") {
      await ctx.reply(buildListText());
      return;
    }

    if (sub === "show") {
      if (!key) {
        await ctx.reply("Usage: /env show KEY");
        return;
      }
      const details = getEnvKeyDetails(key);
      if (!details) {
        await ctx.reply("That key is not editable.");
        return;
      }
      await ctx.reply([
        `${details.key}`,
        `Type: ${details.type}`,
        `Description: ${details.description}`,
        `Effective value: ${details.maskedValue}`,
        `Apply mode: ${details.live ? "live if safe" : "next restart"}`,
      ].join("\n"));
      return;
    }

    if (sub === "edit") {
      if (!key) {
        await ctx.reply("Usage: /env edit KEY");
        return;
      }
      const details = getEnvKeyDetails(key);
      if (!details) {
        await ctx.reply("That key is not editable.");
        return;
      }
      setEnvSession(ctx.from.id, {
        mode: "awaiting_value",
        key,
      });
      await ctx.reply([
        `Editing ${details.key}`,
        `Type: ${details.type}`,
        `Current: ${details.maskedValue}`,
        `${details.description}`,
        "Send the new value as a plain message.",
      ].join("\n"));
      return;
    }

    await ctx.reply("Usage: /env, /env list, /env show KEY, /env edit KEY, /env cancel");
  });

  bot.on("message:text", async (ctx, next) => {
    if (ctx.message?.text?.startsWith("/")) return next();
    if (!isOwner(ctx.from)) return next();

    const session = getEnvSession(ctx.from.id);
    if (!session) return next();
    if (!isRuntimeConfigPersistenceAvailable()) {
      clearEnvSession(ctx.from.id);
      await ctx.reply("MongoDB-backed config persistence is unavailable right now.");
      return;
    }

    const input = String(ctx.message?.text || "").trim();
    if (!input) {
      await ctx.reply("Send a value or /env cancel.");
      return;
    }

    if (session.mode === "awaiting_value") {
      const validation = validateEnvEdit(session.key, input);
      if (!validation.ok) {
        await writeAudit({
          actorTelegramId: ctx.from.id,
          key: session.key,
          oldMaskedSummary: getEnvKeyDetails(session.key)?.maskedValue || "not set",
          newMaskedSummary: "invalid input",
          resultStatus: "validation_failed",
        });
        await ctx.reply(`Invalid value: ${validation.message}`);
        return;
      }
      setEnvSession(ctx.from.id, {
        mode: "awaiting_confirmation",
        key: session.key,
        proposedRawValue: validation.value,
      });
      const details = getEnvKeyDetails(session.key);
      const preview = getEnvKeyDetails(session.key)?.sensitive ? "masked value ready" : String(validation.value || "not set");
      await ctx.reply([
        `Confirm change for ${session.key}?`,
        `Current: ${details?.maskedValue || "not set"}`,
        `New: ${preview}`,
        "Reply with yes to save or no to cancel.",
      ].join("\n"));
      return;
    }

    if (session.mode === "awaiting_confirmation") {
      const answer = input.toLowerCase();
      if (!["yes", "y", "no", "n"].includes(answer)) {
        await ctx.reply("Reply with yes to save or no to cancel.");
        return;
      }
      if (answer === "no" || answer === "n") {
        clearEnvSession(ctx.from.id);
        await writeAudit({
          actorTelegramId: ctx.from.id,
          key: session.key,
          oldMaskedSummary: getEnvKeyDetails(session.key)?.maskedValue || "not set",
          newMaskedSummary: "canceled",
          resultStatus: "canceled",
        });
        await ctx.reply("Env edit canceled.");
        return;
      }

      const result = await saveEnvOverride({
        actorTelegramId: ctx.from.id,
        key: session.key,
        newRawValue: session.proposedRawValue,
      });
      clearEnvSession(ctx.from.id);
      await ctx.reply(result.ok ? `Saved ${session.key}. ${result.message}` : `Save failed for ${session.key}: ${result.message}`);
      return;
    }

    return next();
  });
}
