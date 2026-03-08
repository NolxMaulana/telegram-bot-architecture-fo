import { getEffectiveConfigValue } from "../lib/configRuntime.js";
import { getCountries } from "./herosms.js";

let cache = { ts: 0, items: [] };

function normalizeCountries(payload) {
  const data = payload?.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    return Object.entries(data).map(([id, value]) => ({ id, name: value?.name || value?.eng || value?.title || String(value) }));
  }
  return [];
}

function priorityNames() {
  return getEffectiveConfigValue("DEFAULT_COUNTRY_PRIORITY")
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean);
}

export async function getPrioritizedCountries() {
  const now = Date.now();
  if (cache.items.length && now - cache.ts < 10 * 60 * 1000) return cache.items;
  const result = await getCountries();
  const items = normalizeCountries(result);
  const priorities = priorityNames();
  items.sort((a, b) => {
    const ap = priorities.findIndex((p) => String(a.name || "").toLowerCase().includes(p));
    const bp = priorities.findIndex((p) => String(b.name || "").toLowerCase().includes(p));
    const av = ap === -1 ? 999 : ap;
    const bv = bp === -1 ? 999 : bp;
    if (av !== bv) return av - bv;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
  cache = { ts: now, items };
  return items;
}

export async function resolveCountry(input) {
  const items = await getPrioritizedCountries();
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return items[0] || null;
  return items.find((item) => String(item.id) === raw || String(item.name || "").toLowerCase().includes(raw)) || null;
}
