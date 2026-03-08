import { denyIfUnauthorized } from "../lib/auth.js";
import { getPrioritizedCountries } from "../services/countryCache.js";
import { InlineKeyboard } from "grammy";

export default function register(bot) {
  bot.command("countries", async (ctx) => {
    const denied = await denyIfUnauthorized(ctx);
    if (denied) return;
    const countries = await getPrioritizedCountries();
    const top = countries.slice(0, 12);
    const text = top.map((c) => `${c.id} - ${c.name}`).join("\n") || "No countries found.";
    const keyboard = new InlineKeyboard();
    for (const c of top.slice(0, 6)) {
      keyboard.text(c.name.slice(0, 20), `country:${c.id}`).row();
    }
    await ctx.reply(text, { reply_markup: keyboard });
  });
}
