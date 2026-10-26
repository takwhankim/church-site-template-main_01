import { defineConfig } from "tinacms";

export default defineConfig({
  branch: process.env.GITHUB_BRANCH || "main",
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID || null,
  token: process.env.TINA_TOKEN || null,
  build: {
    outputFolder: "../admin",
    publicFolder: "public",
  },
  media: {
    tina: {
      mediaRoot: "uploads",
      publicFolder: ".",
    },
  },
  schema: {
    collections: [
      {
        name: "site",
        label: "홈페이지 콘텐츠",
        path: "content",
        format: "json",
        ui: {
          allowedActions: { create: false, delete: false },
        },
        fields: [
          { type: "string", name: "churchName", label: "교회 이름", required: true },
          { type: "image", name: "logo", label: "홈페이지 로고 (헤더·푸터)", description: "여기서 로고 사진을 선택하거나 업로드한 뒤 Insert → Save를 눌러 저장하세요. 헤더와 푸터에 함께 사용됩니다." },
          {
            type: "object", name: "hero", label: "첫 화면", description: "홈페이지 맨 위 문구와 큰 사진을 관리합니다. 사진 필드에서 선택 → Insert → 문서 Save 순서로 저장하세요.", fields: [
              { type: "string", name: "title", label: "메인 문구", ui: { component: "textarea" } },
              { type: "string", name: "description", label: "소개 문구", ui: { component: "textarea" } },
              { type: "image", name: "image", label: "히어로 이미지", description: "여기서 첫 화면 사진을 선택하거나 업로드하고 Insert를 누른 뒤, 문서의 Save로 저장하세요." },
              { type: "string", name: "imageAlt", label: "히어로 이미지 설명" },
            ],
          },
          {
            type: "object", name: "worship", label: "예배 안내", fields: [
              { type: "string", name: "heading", label: "섹션 제목" },
              { type: "object", name: "services", label: "예배 시간", list: true, ui: { itemProps: (item) => ({ label: item?.name || "새 예배 시간" }) }, fields: [
                { type: "string", name: "name", label: "예배 이름", required: true },
                { type: "string", name: "time", label: "예배 시간", required: true },
                { type: "string", name: "note", label: "추가 안내" },
              ] },
            ],
          },
          {
            type: "object", name: "sermon", label: "설교", fields: [
              { type: "string", name: "heading", label: "섹션 제목" },
              { type: "string", name: "channelUrl", label: "YouTube 채널 주소" },
              { type: "object", name: "items", label: "설교 목록", list: true, description: "홈페이지 주요 설교 영역에는 목록의 첫 번째 설교가 표시됩니다.", ui: { itemProps: (item) => ({ label: item?.title || "새 설교" }) }, fields: [
                { type: "string", name: "title", label: "설교 제목", required: true },
                { type: "string", name: "date", label: "설교 날짜 (YYYY-MM-DD)" },
                { type: "string", name: "scripture", label: "본문 말씀" },
                { type: "string", name: "summary", label: "요약", ui: { component: "textarea" } },
                { type: "string", name: "videoUrl", label: "YouTube 영상 주소" },
              ] },
            ],
          },
          {
            type: "object", name: "community", label: "교회 소식", description: "게시글에서 제목과 본문, 대표 사진, 추가 사진을 관리합니다. 사진은 각 사진 필드에서 선택 → Insert → 문서 Save 순서로 저장하세요.", fields: [
              { type: "string", name: "heading", label: "섹션 제목", ui: { component: "textarea" } },
              { type: "string", name: "description", label: "설명", ui: { component: "textarea" } },
              { type: "string", name: "notice", label: "게시판 안내" },
              { type: "object", name: "posts", label: "게시글", list: true, description: "수정할 글 제목을 누르세요. 새 글은 항목을 추가하고 제목과 본문, 사진을 입력한 뒤 문서의 Save로 저장합니다.", ui: { itemProps: (item) => ({ label: item?.title || "새 게시글" }) }, fields: [
                { type: "string", name: "id", label: "게시글 ID" },
                { type: "string", name: "category", label: "분류" },
                { type: "string", name: "dateLabel", label: "날짜 또는 표시 문구" },
                { type: "string", name: "title", label: "제목", required: true },
                { type: "string", name: "excerpt", label: "본문/요약", ui: { component: "textarea" } },
                { type: "string", name: "author", label: "작성자" },
                { type: "image", name: "image", label: "대표 사진", description: "여기서 목록과 상세 화면의 대표 사진을 선택하거나 업로드하고 Insert → 문서 Save로 저장하세요." },
                { type: "string", name: "imageAlt", label: "대표 사진 설명" },
                { type: "object", name: "gallery", label: "추가 사진 갤러리", list: true, description: "사진마다 항목을 추가하세요. 항목 안의 사진 필드에서 선택 → Insert 후 사진 설명을 적고 문서의 Save를 누릅니다.", ui: { itemProps: (item) => ({ label: item?.alt || "사진 설명을 입력하세요" }) }, fields: [
                  { type: "image", name: "image", label: "사진", description: "여기서 추가 사진을 선택하거나 업로드하고 Insert를 누르세요. 다른 사진도 넣은 뒤 문서의 Save로 함께 저장합니다." },
                  { type: "string", name: "alt", label: "사진 설명" },
                ] },
              ] },
            ],
          },
          {
            type: "object", name: "bulletin", label: "주보", fields: [
              { type: "string", name: "title", label: "주보 제목" },
              { type: "string", name: "description", label: "안내 문구", ui: { component: "textarea" } },
              { type: "string", name: "pdfUrl", label: "주보 PDF 주소" },
            ],
          },
          {
            type: "object", name: "newcomer", label: "새가족 안내", fields: [
              { type: "string", name: "heading", label: "제목", ui: { component: "textarea" } },
              { type: "string", name: "description", label: "설명", ui: { component: "textarea" } },
              { type: "string", name: "steps", label: "안내 단계", list: true },
              { type: "string", name: "formNotice", label: "양식 안내" },
            ],
          },
          {
            type: "object", name: "contact", label: "연락처와 위치", fields: [
              { type: "string", name: "heading", label: "제목", ui: { component: "textarea" } },
              { type: "string", name: "address", label: "주소" },
              { type: "string", name: "phone", label: "전화" },
              { type: "string", name: "email", label: "이메일" },
              { type: "string", name: "visitNote", label: "방문 안내" },
              { type: "string", name: "mapNote", label: "지도 안내" },
              { type: "string", name: "mapUrl", label: "지도 링크" },
            ],
          },
          {
            type: "object", name: "chatbot", label: "홈페이지 안내 메뉴", fields: [
              { type: "string", name: "title", label: "챗봇 제목" },
              { type: "string", name: "greeting", label: "첫 인사" },
              { type: "string", name: "notice", label: "안내 문구" },
              { type: "object", name: "choices", label: "빠른 안내 버튼", list: true, ui: { itemProps: (item) => ({ label: item?.label || "새 안내 버튼" }) }, fields: [
                { type: "string", name: "label", label: "버튼 이름", required: true },
                { type: "string", name: "target", label: "이동할 섹션 ID" },
              ] },
            ],
          },
        ],
      },
    ],
  },
});
