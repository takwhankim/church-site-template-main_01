import { createSiteServer } from "../scripts/server.mjs";

const server = createSiteServer();
export async function GET() {
  try {
    const content = await server.readContent();
    return Response.json(content, { headers: { "Cache-Control": "no-store", "X-Onmam-Content-Source": content._onmam.source } });
  } catch (error) {
    console.error("콘텐츠 조회 실패:", error.message);
    return Response.json({ error: "콘텐츠를 불러오지 못했습니다." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
