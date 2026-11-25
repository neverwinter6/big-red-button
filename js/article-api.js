const RANDOM_ARTICLE_ENDPOINT = "/api/random";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_EXCLUDED_TITLES = 60;

export class ArticleApiError extends Error {
  constructor(message, { cause, status = 0 } = {}) {
    super(message, { cause });
    this.name = "ArticleApiError";
    this.status = status;
  }
}

function isValidArticle(article) {
  return Boolean(
    article &&
      typeof article.title === "string" &&
      article.title.trim() &&
      Array.isArray(article.paragraphs) &&
      article.paragraphs.length > 0 &&
      article.paragraphs.every((paragraph) => typeof paragraph === "string")
  );
}

/**
 * Ask the server for a random article, excluding titles the visitor has
 * already read. The API returns an article already normalized for the reader.
 */
export async function fetchRandomArticle({ exclude = [], timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(RANDOM_ARTICLE_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        exclude: exclude
          .filter((title) => typeof title === "string" && title.trim())
          .slice(0, MAX_EXCLUDED_TITLES)
      }),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ArticleApiError(payload?.error || `The archive returned ${response.status}.`, {
        status: response.status
      });
    }

    if (!isValidArticle(payload?.article)) {
      throw new ArticleApiError("The archive sent an incomplete article.");
    }

    return payload.article;
  } catch (error) {
    if (error instanceof ArticleApiError) throw error;

    if (error?.name === "AbortError") {
      throw new ArticleApiError("The archive took too long to answer.", { cause: error });
    }

    throw new ArticleApiError("Could not reach the archive.", { cause: error });
  } finally {
    clearTimeout(timeoutId);
  }
}
