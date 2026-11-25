import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import randomArticleHandler from "./api/random.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 4200;
const DEFAULT_HOST = "127.0.0.1";

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".xml", "application/xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"]
]);

function isInsideRoot(filePath) {
  const relative = path.relative(ROOT, filePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolvePublicFile(pathname) {
  let decoded;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");

  if (!relative || relative.split(/[\\/]+/).some((segment) => segment.startsWith("."))) {
    return null;
  }

  const filePath = path.resolve(ROOT, relative);
  return isInsideRoot(filePath) ? filePath : null;
}

function setStaticHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function sendNotFound(res, method) {
  res.statusCode = 404;
  setStaticHeaders(res);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  if (method !== "HEAD") res.end("Not found");
  else res.end();
}

async function serveStaticFile(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Method not allowed");
    return;
  }

  const requestedPath = resolvePublicFile(pathname);
  if (!requestedPath) {
    sendNotFound(res, req.method);
    return;
  }

  try {
    const requestedInfo = await stat(requestedPath);
    const filePath = requestedInfo.isDirectory() ? path.join(requestedPath, "index.html") : requestedPath;
    const fileInfo = await stat(filePath);

    if (!fileInfo.isFile()) {
      sendNotFound(res, req.method);
      return;
    }

    res.statusCode = 200;
    setStaticHeaders(res);
    res.setHeader("Content-Type", MIME_TYPES.get(path.extname(filePath).toLowerCase()) || "application/octet-stream");
    res.setHeader("Content-Length", fileInfo.size);

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const stream = createReadStream(filePath);
    stream.on("error", () => {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("Could not read file");
      }
    });
    stream.pipe(res);
  } catch {
    sendNotFound(res, req.method);
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname === "/api/random") {
    await randomArticleHandler(req, res);
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendNotFound(res, req.method);
    return;
  }

  await serveStaticFile(req, res, url.pathname);
}

export function createDevServer() {
  return createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error("Dev server request failed:", error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end("Internal server error");
      } else {
        res.end();
      }
    });
  });
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  const host = process.env.HOST || DEFAULT_HOST;
  const server = createDevServer();

  server.listen(port, host, () => {
    console.log(`Big Red Button dev server: http://${host}:${port}`);
  });
}
