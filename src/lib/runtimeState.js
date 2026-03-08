const envSessions = new Map();

export function getEnvSession(userId) {
  return envSessions.get(String(userId || "")) || null;
}

export function setEnvSession(userId, session) {
  envSessions.set(String(userId || ""), { ...session, updatedAt: Date.now() });
}

export function clearEnvSession(userId) {
  envSessions.delete(String(userId || ""));
}
