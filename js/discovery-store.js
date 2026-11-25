const RECENT_KEY = "big-red-button.recent.v1";
const COUNT_KEY = "big-red-button.discoveries.v1";
const MAX_RECENT = 48;
const MAX_EXCLUSIONS = 60;

function resolveStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readJSON(storage, key, fallback) {
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readRecent(storage) {
  const value = readJSON(storage, RECENT_KEY, []);
  if (!Array.isArray(value)) return [];

  return value
    .filter((title) => typeof title === "string" && title.trim())
    .slice(0, MAX_RECENT);
}

function readCount(storage) {
  if (!storage) return 0;

  try {
    const value = Number.parseInt(storage.getItem(COUNT_KEY) || "0", 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * Small local memory for the site. Nothing leaves the browser.
 */
export function createDiscoveryStore({ storage = resolveStorage() } = {}) {
  let recent = readRecent(storage);
  let discoveries = readCount(storage);

  function persist() {
    if (!storage) return;

    try {
      storage.setItem(RECENT_KEY, JSON.stringify(recent));
      storage.setItem(COUNT_KEY, String(discoveries));
    } catch {
      // Private browsing or a full storage bucket: the button still works.
    }
  }

  return {
    get count() {
      return discoveries;
    },

    get recent() {
      return [...recent];
    },

    exclusionsFor(currentTitle = "") {
      return [...new Set([currentTitle, ...recent].filter(Boolean))].slice(0, MAX_EXCLUSIONS);
    },

    record(title) {
      if (typeof title !== "string" || !title.trim()) return discoveries;

      recent = [title, ...recent.filter((recentTitle) => recentTitle !== title)].slice(0, MAX_RECENT);
      discoveries += 1;
      persist();

      return discoveries;
    }
  };
}
