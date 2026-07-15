import { createServer } from "node:http";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { calculateLocalResult } from "./local-result.mjs";

const root = path.dirname(fileURLToPath(import.meta.url));
const defaultPort = Number(process.env.PORT || 4175);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

function sendStatic(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    if (!statSync(target).isFile()) throw new Error("not a file");
    const type = mimeTypes[path.extname(target)] || "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    response.end(readFileSync(target));
  } catch {
    response.writeHead(404).end("Not found");
  }
}

export function createDemoServer() {
  return createServer((request, response) => {
  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, { code: 0, data: { mode: "local" } });
    return;
  }
  if (request.method === "OPTIONS" && request.url === "/api/submit-quiz") {
    response.writeHead(204, {
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Origin": "*"
    });
    response.end();
    return;
  }
  if (request.method === "POST" && request.url === "/api/submit-quiz") {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      try {
        sendJson(response, 200, calculateLocalResult(JSON.parse(body)));
      } catch (error) {
        sendJson(response, 400, { code: 1, message: error.message || "result calculation failed" });
      }
    });
    return;
  }
  sendStatic(request, response);
  });
}

export function startDemoServer({ port = defaultPort } = {}) {
  const server = createDemoServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Campus Persona demo: http://127.0.0.1:${port}`);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startDemoServer();
}
