import { cfg } from "../lib/config.js";
import { logInfo } from "../lib/logger.js";
import { getNumberV2, getPrices, getServicesList, getBalance, cancelActivation, finishActivation, setStatus, getStatusV2 } from "./herosms.js";
import { resolveCountry } from "./countryCache.js";
import { createOrder, generateOrderId, updateOrder, findRecentOrdersByUser, findOrderByActivationId, insertEvent } from "./orderStore.js";

async function runLimited(items, limit, worker) {
  const results = [];
  let index = 0;
  async function next() {
    const i = index++;
    if (i >= items.length) return;
    results[i] = await worker(items[i], i);
    await next();
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

function parsePurchaseSuccess(result) {
  if (result?.ok && result?.data?.activationId) {
    return {
      activationId: String(result.data.activationId),
      phoneNumber: result.data.phone || result.data.number || "",
      cost: result.data.cost || result.data.price || "",
      currency: result.data.currency || "USD",
      operator: result.data.operator || "",
      raw: result.raw || ""
    };
  }
  const parts = result?.parts || [];
  if (result?.ok && parts[0] === "ACCESS_NUMBER") {
    return {
      activationId: String(parts[1] || ""),
      phoneNumber: String(parts[2] || ""),
      cost: "",
      currency: "USD",
      operator: "",
      raw: result.raw || ""
    };
  }
  return null;
}

export async function createConcurrentOrders({ requester, serviceCode, countryInput, operator, maxPrice, fixedPrice, quantity }) {
  const country = await resolveCountry(countryInput);
  const qty = Math.max(1, Math.min(20, Number(quantity || 1)));
  const payloads = Array.from({ length: qty }).map(() => ({ country }));

  const results = await runLimited(payloads, cfg.ORDER_CONCURRENCY_LIMIT, async () => {
    const orderId = generateOrderId();
    const baseOrder = await createOrder({
      orderId,
      requesterId: String(requester.id),
      requesterUsername: requester.username || "",
      requesterChatId: String(requester.chatId),
      serviceCode,
      countryCode: country?.id || "",
      countryName: country?.name || countryInput || "",
      operator: operator || "",
      maxPrice: maxPrice || "",
      fixedPrice: !!fixedPrice,
      quantity: 1,
      localStatus: "requested",
      lastHeroStatus: "",
      phoneNumber: "",
      activationId: "",
      activationCost: "",
      currency: "",
      otpCode: "",
      otpText: "",
      errorHistory: [],
      pollAfter: new Date(),
      notifiedOtpHash: "",
      rawResponseSnippet: ""
    });

    await insertEvent({ type: "order_created", orderId, requesterId: String(requester.id) });

    const upstream = await getNumberV2({
      service: serviceCode,
      country: country?.id || countryInput || "",
      operator,
      maxPrice,
      fixedPrice: fixedPrice ? 1 : 0,
    });

    const success = parsePurchaseSuccess(upstream);
    if (!success) {
      const errorEntry = {
        code: upstream.errorCode || "ORDER_FAILED",
        message: upstream.message || upstream.raw || "Order failed",
        minPrice: upstream.minPrice || "",
        at: new Date().toISOString()
      };
      await updateOrder({ orderId }, {
        localStatus: "failed",
        rawResponseSnippet: upstream.raw || "",
        errorHistory: [errorEntry],
      });
      return { ok: false, orderId, error: errorEntry };
    }

    await updateOrder({ orderId }, {
      localStatus: "active",
      activationId: success.activationId,
      phoneNumber: success.phoneNumber,
      activationCost: success.cost,
      currency: success.currency,
      operator: success.operator || operator || "",
      rawResponseSnippet: success.raw,
      lastHeroStatus: "PURCHASED",
      pollAfter: new Date(Date.now() + cfg.POLL_INTERVAL_MS),
    });

    logInfo("order.created", { orderId, activationId: success.activationId, requesterId: String(requester.id) });
    return { ok: true, orderId, activationId: success.activationId, phoneNumber: success.phoneNumber, countryName: country?.name || "", cost: success.cost };
  });

  return results;
}

export async function listUserOrders(userId, activeOnly = false) {
  return findRecentOrdersByUser(userId, activeOnly ? 12 : 15, activeOnly);
}

export async function getBalanceSummary() {
  return getBalance();
}

export async function getServicesSummary(countryInput) {
  const country = await resolveCountry(countryInput);
  return getServicesList(country?.id || countryInput || "");
}

export async function getPricesSummary(serviceCode, countryInput) {
  const country = await resolveCountry(countryInput);
  return getPrices(serviceCode, country?.id || countryInput || "");
}

export async function cancelOrderByActivationId(activationId) {
  const result = await cancelActivation(activationId);
  if (result.ok) {
    await updateOrder({ activationId: String(activationId) }, { localStatus: "canceled", lastHeroStatus: result.code || "CANCELED" });
  }
  return result;
}

export async function finishOrderByActivationId(activationId) {
  const result = await finishActivation(activationId);
  if (result.ok) {
    await updateOrder({ activationId: String(activationId) }, { localStatus: "finished", lastHeroStatus: result.code || "FINISHED" });
  }
  return result;
}

export async function retryOrderByActivationId(activationId) {
  const result = await setStatus(activationId, 3);
  if (result.ok) {
    await updateOrder({ activationId: String(activationId) }, { localStatus: "waiting_retry", lastHeroStatus: result.code || "WAIT_RETRY", pollAfter: new Date(Date.now() + cfg.POLL_INTERVAL_MS) });
  }
  return result;
}

export async function refreshActivation(activationId) {
  return getStatusV2(activationId);
}

export async function getOrderByActivationId(activationId) {
  return findOrderByActivationId(activationId);
}
