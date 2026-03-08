import { cfg } from "../lib/config.js";
import { safeErr, logInfo, logWarn } from "../lib/logger.js";

function buildUrl(action, extra = {}) {
  const url = new URL(cfg.HERO_SMS_BASE_URL || "https://hero-sms.com/stubs/handler_api.php");
  url.searchParams.set("api_key", cfg.HERO_SMS_API_KEY);
  url.searchParams.set("action", action);
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

function parseTextResponse(text) {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, errorCode: "EMPTY_RESPONSE", message: "Empty upstream response", raw };
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return parseStructuredResponse(JSON.parse(raw));
    } catch {
      return { ok: false, errorCode: "BAD_JSON", message: raw, raw };
    }
  }

  const parts = raw.split(":");
  const code = parts[0];
  if (["ACCESS_BALANCE", "STATUS_OK", "STATUS_WAIT_CODE", "STATUS_CANCEL", "STATUS_FINISH", "STATUS_WAIT_RESEND", "STATUS_WAIT_RETRY", "NEW_OTP_RECEIVED", "OTP_RECEIVED"].includes(code)) {
    return { ok: true, code, raw, parts };
  }
  return { ok: false, errorCode: code, message: raw, raw, parts };
}

function parseStructuredResponse(json) {
  if (json?.status === "success" || json?.success === true || json?.ok === true) {
    return { ok: true, code: json.status || "OK", data: json, raw: JSON.stringify(json).slice(0, 400) };
  }
  if (json?.error || json?.message || json?.status === "error") {
    return {
      ok: false,
      errorCode: json.errorCode || json.error || json.code || "UPSTREAM_ERROR",
      message: json.message || json.error || "Upstream error",
      data: json,
      raw: JSON.stringify(json).slice(0, 400),
      minPrice: json.minPrice || json.min_price || undefined,
    };
  }
  return { ok: true, code: "OK", data: json, raw: JSON.stringify(json).slice(0, 400) };
}

async function request(action, params = {}) {
  const url = buildUrl(action, params);
  logInfo("herosms.request.start", { action });
  try {
    const response = await fetch(url, { method: "GET" });
    const text = await response.text();
    const parsed = parseTextResponse(text);
    if (!response.ok) {
      logWarn("herosms.request.failure", { action, status: response.status, err: parsed.message || text.slice(0, 200) });
      return { ok: false, action, status: response.status, errorCode: parsed.errorCode || "HTTP_ERROR", message: parsed.message || text, raw: parsed.raw || text };
    }
    logInfo("herosms.request.success", { action, ok: parsed.ok });
    return { status: response.status, action, ...parsed };
  } catch (err) {
    const message = safeErr(err);
    logWarn("herosms.request.failure", { action, err: message });
    return { ok: false, action, status: 0, errorCode: "NETWORK_ERROR", message, raw: "" };
  }
}

export async function getBalance() { return request("getBalance"); }
export async function getCountries() { return request("getCountries"); }
export async function getServicesList(country) { return request("getServicesList", { country }); }
export async function getPrices(service, country) { return request("getPrices", { service, country }); }
export async function getNumberV2(params) { return request("getNumberV2", params); }
export async function getStatus(id) { return request("getStatus", { id }); }
export async function getStatusV2(id) { return request("getStatusV2", { id }); }
export async function getActiveActivations() { return request("getActiveActivations"); }
export async function getHistory() { return request("getHistory"); }
export async function getAllSms(id) { return request("getAllSms", { id }); }
export async function setStatus(id, status) { return request("setStatus", { id, status }); }
export async function finishActivation(id) { return request("finishActivation", { id }); }
export async function cancelActivation(id) { return request("cancelActivation", { id }); }
