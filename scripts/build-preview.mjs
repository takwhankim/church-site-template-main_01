import { mkdir, cp, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
await mkdir(root + "dist", { recursive: true });
for (const file of ["index.html", "content-loader.js", "admin", "uploads", "content"]) {
  await cp(root + file, root + "dist/" + file, { recursive: true });
}
const html = await readFile(root + "dist/index.html", "utf8");
await writeFile(root + "dist/index.html", html.replace("<head>", '<head><meta name="robots" content="noindex,nofollow">'));
console.log("검토용 홈페이지와 관리자 정적 파일 준비 완료");
