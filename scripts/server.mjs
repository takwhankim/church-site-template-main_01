import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".pdf": "application/pdf", ".woff2": "font/woff2" };

export function createSiteServer({
  root = projectRoot,
  source = "github",
  repository = "takwhankim/church-site-template-main_01",
  branch = "main",
  refreshMs = 10_000,
  resolveRevision = async () => {
    const response = await fetch(`https://github.com/${repository}.git/info/refs?service=git-upload-pack`, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!response.ok) throw new Error(`저장소 조회 실패 (${response.status})`);
    const refs = await response.text();
    const refName = `refs/heads/${branch}`;
    const line = refs.split("\n").find((line) => line.endsWith(` ${refName}`));
    const revision = line?.match(/([a-f0-9]{40}) refs\/heads\//)?.[1] || "";
    if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("콘텐츠 브랜치를 찾지 못했습니다.");
    return revision;
  },
  fetchContent = async (revision) => {
    const response = await fetch(`https://raw.githubusercontent.com/${repository}/${revision}/content/site.json`, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`콘텐츠 요청 실패 (${response.status})`);
    return response.json();
  },
  logger = console,
} = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[\w./-]+$/.test(branch)) throw new Error("저장소 또는 브랜치 설정을 확인하세요.");
  if (!["local", "github"].includes(source)) throw new Error("콘텐츠 소스는 local 또는 github여야 합니다.");
  let snapshot;
  let nextCheck = 0;
  let pending;

  const validate = (data) => {
    if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.churchName !== "string") throw new Error("올바른 홈페이지 콘텐츠가 아닙니다.");
    return data;
  };
  async function localContent() {
    const raw = await readFile(resolve(root, "content/site.json"), "utf8");
    return { ...validate(JSON.parse(raw)), _onmam: { source: "local", revision: createHash("sha256").update(raw).digest("hex"), assetBase: "/uploads/" } };
  }
  async function latestContent() {
    if (source === "local") return localContent();
    if (snapshot && Date.now() < nextCheck) return snapshot;
    if (pending) return pending;
    pending = (async () => {
      try {
        const revision = await resolveRevision();
        if (revision !== snapshot?._onmam.revision || snapshot?._onmam.source !== "github") {
          const data = validate(await fetchContent(revision));
          snapshot = { ...data, _onmam: { source: "github", revision, assetBase: `https://raw.githubusercontent.com/${repository}/${revision}/uploads/` } };
        }
        snapshot._onmam.source = "github";
        nextCheck = Date.now() + refreshMs;
        return snapshot;
      } catch (error) {
        logger.warn("콘텐츠 동기화 실패:", error.message);
        snapshot = snapshot || await localContent();
        snapshot._onmam.source = snapshot._onmam.source === "local" ? "local" : "stale";
        nextCheck = Date.now() + refreshMs;
        return snapshot;
      } finally {
        pending = undefined;
      }
    })();
    return pending;
  }

  const server = createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (pathname === "/content/site.json") {
        const data = await latestContent();
        response.writeHead(200, { "Content-Type": types[".json"], "Cache-Control": "no-store", "X-Onmam-Content-Source": data._onmam.source });
        response.end(request.method === "HEAD" ? undefined : JSON.stringify(data));
        return;
      }
      let relative = pathname.replace(/^\/+/, "");
      if (!relative) relative = "index.html";
      if (relative === "admin" || relative === "admin/") relative = "admin/index.html";
      const allowed = relative === "index.html" || relative === "content-loader.js" || /^(admin|uploads|public)\//.test(relative);
      if (!allowed || relative.split(/[\\/]/).some((part) => part.startsWith(".") || part.includes("\0"))) {
        response.writeHead(404); response.end("Not found"); return;
      }
      const rootPath = await realpath(root);
      const filePath = await realpath(resolve(root, relative));
      const actualRelative = filePath.slice(rootPath.length + 1).split(sep).join("/");
      const actualAllowed = actualRelative === "index.html" || actualRelative === "content-loader.js" || /^(admin|uploads|public)\//.test(actualRelative);
      if (!filePath.startsWith(rootPath + sep) || !actualAllowed || actualRelative.split("/").some((part) => part.startsWith(".")) || !(await stat(filePath)).isFile()) {
        response.writeHead(404); response.end("Not found"); return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, { "Content-Type": types[extname(filePath).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      const notFound = error.code === "ENOENT" || error.code === "ENOTDIR";
      response.writeHead(error instanceof URIError ? 400 : notFound ? 404 : 503, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(notFound ? "Not found" : "콘텐츠를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  });
  server.readContent = latestContent;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const source = process.argv.includes("--local") ? "local" : process.env.ONMAM_CONTENT_SOURCE || "github";
  const server = createSiteServer({ source });
  server.on("error", (error) => { console.error(error.code === "EADDRINUSE" ? `${port}번 포트를 이미 사용하고 있습니다.` : error.message); process.exitCode = 1; });
  server.listen(port, "127.0.0.1", () => console.log(`온맘교회: http://localhost:${port}/ · 관리자: http://localhost:${port}/admin/ · 콘텐츠: ${source}`));
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
}
