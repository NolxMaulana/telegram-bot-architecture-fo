export function shortText(value, max = 180) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function formatMoney(value, currency = "USD") {
  const num = Number(value);
  if (!Number.isFinite(num)) return "n/a";
  return `${num.toFixed(2)} ${currency}`;
}

export function formatOrderLine(order) {
  return `${order.orderId} | ${order.countryName || order.countryCode || "?"} | ${order.serviceCode || "?"} | ${order.localStatus || "unknown"}${order.phoneNumber ? ` | ${order.phoneNumber}` : ""}`;
}

export function parseKeyValueArgs(input) {
  const out = {};
  const raw = String(input || "").trim();
  if (!raw) return out;
  for (const part of raw.split(/\s+/)) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}
