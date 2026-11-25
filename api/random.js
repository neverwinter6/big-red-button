const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const USER_AGENT =
  "TheBigRedButton/1.2 (https://big-red-button-phi.vercel.app; random article picker)";

const LIMITS = Object.freeze({
  excludedTitles: 60,
  requestsPerRound: 3,
  wikipediaTimeoutMs: 5_000,
  maxBodyBytes: 32_000,
  minExtractLength: 450
});

const CATEGORIES = Object.freeze([
  Object.freeze({
    title: "Good_articles",
    label: "Good article",
    url: "https://en.wikipedia.org/wiki/Wikipedia:Good_articles",
    weight: 0.58
  }),
  Object.freeze({
    title: "Featured_articles",
    label: "Featured article",
    url: "https://en.wikipedia.org/wiki/Wikipedia:Featured_articles",
    weight: 0.42
  })
]);

const PREFIXES = Object.freeze("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function pickCategory() {
  const roll = Math.random();
  let cumulativeWeight = 0;

  for (const category of CATEGORIES) {
    cumulativeWeight += category.weight;
    if (roll <= cumulativeWeight) return category;
  }

  return CATEGORIES[0];
}

function buildBatchUrl(category) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "categorymembers",
    gcmtitle: `Category:${category.title}`,
    gcmtype: "page",
    gcmlimit: "20",
    gcmstartsortkeyprefix: pickRandom(PREFIXES),
    prop: "extracts|pageimages|info|pageprops|description",
    exintro: "1",
    explaintext: "1",
    exlimit: "max",
    piprop: "thumbnail|name",
    pithumbsize: "1600",
    inprop: "url",
    ppprop: "disambiguation"
  });

  return `${WIKIPEDIA_API}?${params.toString()}`;
}

async function fetchCategoryBatch(category) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LIMITS.wikipediaTimeoutMs);

  try {
    const response = await fetch(buildBatchUrl(category), {
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Wikipedia returned ${response.status}`);
    }

    const payload = await response.json();

    if (payload.error) {
      throw new Error(payload.error.info || "Wikipedia returned an error");
    }

    return payload.query?.pages || [];
  } finally {
    clearTimeout(timeoutId);
  }
}

function isQualityArticle(page) {
  if (!page || page.ns !== 0) return false;
  if (page.missing !== undefined || page.invalid !== undefined) return false;
  if (page.pageprops?.disambiguation !== undefined) return false;
  if (/^List of /i.test(page.title || "")) return false;

  return (page.extract?.trim() || "").length >= LIMITS.minExtractLength;
}

function splitParagraphs(extract) {
  return extract
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function toReaderArticle(page, category) {
  return {
    title: page.title,
    description: (page.description || "").trim(),
    paragraphs: splitParagraphs(page.extract),
    imageUrl: page.thumbnail?.source || "",
    imageName: page.pageimage || "",
    articleUrl:
      page.fullurl ||
      `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    sourceLabel: category.label,
    sourceUrl: category.url
  };
}

async function drawCandidateBatch() {
  const draws = await Promise.allSettled(
    Array.from({ length: LIMITS.requestsPerRound }, () => {
      const category = pickCategory();
      return fetchCategoryBatch(category).then((pages) => ({ category, pages }));
    })
  );

  const candidates = [];
  const seenTitles = new Set();

  for (const draw of draws) {
    if (draw.status !== "fulfilled") continue;

    for (const page of draw.value.pages) {
      if (!isQualityArticle(page) || seenTitles.has(page.title)) continue;
      seenTitles.add(page.title);
      candidates.push({ page, category: draw.value.category });
    }
  }

  return candidates;
}

function mergeCandidates(...collections) {
  const merged = [];
  const titles = new Set();

  for (const collection of collections) {
    for (const candidate of collection) {
      if (titles.has(candidate.page.title)) continue;
      titles.add(candidate.page.title);
      merged.push(candidate);
    }
  }

  return merged;
}

async function selectArticle(excludedTitles) {
  let candidates = await drawCandidateBatch();

  if (candidates.length === 0) {
    candidates = await drawCandidateBatch();
  }

  if (candidates.length === 0) {
    throw new Error("No quality articles were available");
  }

  let unseen = candidates.filter(({ page }) => !excludedTitles.has(page.title));

  // If the first round happened to contain only titles we've seen, make one
  // more independent draw before falling back to a repeat.
  if (unseen.length === 0) {
    candidates = mergeCandidates(candidates, await drawCandidateBatch());
    unseen = candidates.filter(({ page }) => !excludedTitles.has(page.title));
  }

  const chosen = pickRandom(unseen.length > 0 ? unseen : candidates);
  return toReaderArticle(chosen.page, chosen.category);
}

function normalizeExcludedTitles(value) {
  if (!Array.isArray(value)) return new Set();

  return new Set(
    value
      .filter((title) => typeof title === "string")
      .map((title) => title.trim())
      .filter(Boolean)
      .slice(0, LIMITS.excludedTitles)
  );
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);

  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(body);
}

function parseJson(raw) {
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw new RequestError("Request body must be valid JSON.");
  }
}

function readRequestBody(req) {
  if (Buffer.isBuffer(req.body)) {
    return Promise.resolve(parseJson(req.body.toString("utf8")));
  }

  if (req.body && typeof req.body === "object") {
    return Promise.resolve(req.body);
  }

  if (typeof req.body === "string") {
    return Promise.resolve(parseJson(req.body));
  }

  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > LIMITS.maxBodyBytes) {
        reject(new RequestError("Request body is too large.", 413));
        req.destroy();
      }
    });

    req.on("end", () => {
      try {
        resolve(parseJson(raw));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "Use POST to request a random article." });
    return;
  }

  try {
    const body = await readRequestBody(req);
    const article = await selectArticle(normalizeExcludedTitles(body.exclude));

    sendJson(res, 200, {
      article,
      meta: {
        source: "wikipedia",
        fetchedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error instanceof RequestError) {
      sendJson(res, error.status, { error: error.message });
      return;
    }

    console.error("Random article request failed:", error.message);
    sendJson(res, 503, {
      error: "Could not find an article right now. Try again in a moment."
    });
  }
}

module.exports = handler;
