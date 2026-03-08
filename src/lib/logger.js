export function safeErr(err) {
  return err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || String(err);
}

function emit(level, event, meta = {}) {
  const payload = {
    level,
    event,
    ...meta,
    ts: new Date().toISOString(),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInfo(event, meta = {}) {
  emit("info", event, meta);
}

export function logWarn(event, meta = {}) {
  emit("warn", event, meta);
}

export function logError(event, meta = {}) {
  emit("error", event, meta);
}
