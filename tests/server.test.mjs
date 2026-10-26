import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSiteServer } from "../scripts/server.mjs";

async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "onmam-test-"));
  await mkdir(join(root, "content"));
  await mkdir(join(root, "uploads"));
  await mkdir(join(root, "admin"));
  await writeFile(join(root, "index.html"), "<h1>온맘교회</h1>");
  await writeFile(join(root, "admin/index.html"), "<h1>관리자</h1>");
  await writeFile(join(root, "content/site.json"), JSON.stringify({ churchName: "로컬 교회", hero: { image: "/uploads/한글 사진.jpg" } }));
  const warnings = [];
  const server = createSiteServer({ root, refreshMs: 0, logger: { warn: (...args) => warnings.push(args) }, ...options });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  });
  return { root, warnings, url: `http://127.0.0.1:${server.address().port}` };
}

test("관리자 저장으로 커밋이 바뀌면 새 콘텐츠와 동일 커밋의 이미지 주소를 전달한다", async (t) => {
  let revision = "a".repeat(40);
  const commits = new Map([
    [revision, { churchName: "온맘교회", hero: { image: "/uploads/첫 사진.jpg" } }],
    ["b".repeat(40), { churchName: "온맘교회", hero: { image: "/uploads/바꾼 사진.jpg" } }],
  ]);
  let reads = 0;
  const { url } = await fixture(t, { resolveRevision: async () => revision, fetchContent: async (sha) => { reads++; return commits.get(sha); } });
  const first = await (await fetch(url + "/content/site.json")).json();
  assert.equal(first.hero.image, "/uploads/첫 사진.jpg");
  assert.ok(first._onmam.assetBase.includes(revision));
  await fetch(url + "/content/site.json");
  assert.equal(reads, 1, "같은 커밋의 JSON은 다시 다운로드하지 않는다");
  revision = "b".repeat(40);
  const second = await (await fetch(url + "/content/site.json")).json();
  assert.equal(second.hero.image, "/uploads/바꾼 사진.jpg");
  assert.ok(second._onmam.assetBase.includes(revision));
  assert.notEqual(first._onmam.revision, second._onmam.revision);
});

test("동시 요청이 들어와도 GitHub 동기화는 한 번만 수행한다", async (t) => {
  let checks = 0;
  const { url } = await fixture(t, {
    refreshMs: 10_000,
    resolveRevision: async () => { checks++; await new Promise((r) => setTimeout(r, 25)); return "c".repeat(40); },
    fetchContent: async () => ({ churchName: "온맘교회" }),
  });
  const results = await Promise.all(Array.from({ length: 5 }, () => fetch(url + "/content/site.json")));
  assert.ok(results.every((r) => r.ok));
  assert.equal(checks, 1);
});

test("연결이 끊기면 마지막 정상 콘텐츠를 보존하고 복구 후 최신 저장본을 읽는다", async (t) => {
  let offline = false;
  let revision = "d".repeat(40);
  const { url, warnings } = await fixture(t, {
    resolveRevision: async () => { if (offline) throw new Error("offline"); return revision; },
    fetchContent: async () => ({ churchName: "온맘교회", hero: { title: revision } }),
  });
  const first = await (await fetch(url + "/content/site.json")).json();
  offline = true;
  const stale = await (await fetch(url + "/content/site.json")).json();
  assert.equal(stale.hero.title, first.hero.title);
  assert.equal(stale._onmam.source, "stale");
  assert.equal(warnings.length, 1);
  offline = false;
  revision = "e".repeat(40);
  const recovered = await (await fetch(url + "/content/site.json")).json();
  assert.equal(recovered._onmam.source, "github");
  assert.equal(recovered.hero.title, revision);
});

test("첫 실행부터 오프라인이면 로컬 백업을 제공한다", async (t) => {
  const { url } = await fixture(t, { resolveRevision: async () => { throw new Error("offline"); } });
  const response = await fetch(url + "/content/site.json");
  const data = await response.json();
  assert.equal(data.churchName, "로컬 교회");
  assert.equal(response.headers.get("x-onmam-content-source"), "local");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("로컬 편집 모드는 파일 변경을 즉시 반영하며 네트워크를 사용하지 않는다", async (t) => {
  const { url, root } = await fixture(t, { source: "local", resolveRevision: async () => { throw new Error("호출하면 안 됨"); } });
  const first = await (await fetch(url + "/content/site.json")).json();
  await writeFile(join(root, "content/site.json"), JSON.stringify({ churchName: "수정 교회" }));
  const second = await (await fetch(url + "/content/site.json")).json();
  assert.equal(second.churchName, "수정 교회");
  assert.notEqual(first._onmam.revision, second._onmam.revision);
});

test("허용한 홈페이지·관리자·한글 미디어만 제공하고 설정·경로 이탈·쓰기 요청을 차단한다", async (t) => {
  const { url, root } = await fixture(t, { source: "local" });
  await writeFile(join(root, "uploads/한글 사진.jpg"), "photo");
  await writeFile(join(root, ".env"), "PRIVATE_TEST_VALUE=never_serve");
  await symlink(join(root, ".env"), join(root, "uploads/.secret"));
  await symlink(join(tmpdir(), "does-not-exist-outside-root"), join(root, "uploads/outside"));
  assert.equal((await fetch(url)).status, 200);
  assert.equal((await fetch(url + "/admin/")).status, 200);
  assert.equal(await (await fetch(url + "/uploads/" + encodeURIComponent("한글 사진.jpg"))).text(), "photo");
  for (const path of ["/.env", "/.git/config", "/package.json", "/scripts/server.mjs", "/uploads/.secret", "/uploads/%2e%2e%2f.env", "/uploads/outside"]) {
    assert.equal((await fetch(url + path)).status, 404, path);
  }
  assert.equal((await fetch(url, { method: "POST", body: "test" })).status, 405);
  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal((await fetch(url + "/%zz")).status, 400);
});

test("GitHub의 잘못된 콘텐츠가 정상 화면을 덮어쓰지 않는다", async (t) => {
  const { url } = await fixture(t, { resolveRevision: async () => "f".repeat(40), fetchContent: async () => [] });
  const data = await (await fetch(url + "/content/site.json")).json();
  assert.equal(data.churchName, "로컬 교회");
  assert.equal(data._onmam.source, "local");
});

test("미디어 경로의 심볼릭 링크로 프로젝트 내부 비밀파일을 읽을 수 없다", async (t) => {
  const { url, root } = await fixture(t, { source: "local" });
  await writeFile(join(root, ".env"), "PRIVATE_TEST_VALUE=never_serve");
  await symlink(join(root, ".env"), join(root, "uploads/config-alias.txt"));
  const response = await fetch(url + "/uploads/config-alias.txt");
  assert.equal(response.status, 404);
});
