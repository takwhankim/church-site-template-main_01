(function loadOnmamContent() {
  let assetBase = "/uploads/";
  let revision = "";
  let lastContent = "";
  let loading = false;
  const safeText = (value) => String(value ?? "");
  const setText = (selector, value) => {
    const node = document.querySelector(selector);
    if (node && value !== undefined && value !== null) node.textContent = safeText(value);
  };
  const setLines = (selector, value) => {
    const node = document.querySelector(selector);
    if (!node || value === undefined || value === null) return;
    const escaped = safeText(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    node.innerHTML = escaped.replace(/\n/g, "<br>");
  };
  const safeUrl = (value) => {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  };
  const safeImageUrl = (value) => {
    const raw = safeText(value).trim();
    if (!raw) return "";
    const lower = raw.toLowerCase();
    if (lower.startsWith("http://") || lower.startsWith("https://") || raw.startsWith("//")) return safeUrl(raw);
    if (/^[a-z][a-z\d+.-]*:/i.test(raw) || raw.includes("\\")) return "";
    let relative = raw;
    while (relative.startsWith("/")) relative = relative.slice(1);
    if (relative.toLowerCase().startsWith("uploads/")) relative = relative.slice("uploads/".length);
    if (relative.split("/").includes("..")) return "";
    const url = new URL(relative, new URL(assetBase, window.location.href));
    if (revision && url.origin === window.location.origin) url.searchParams.set("v", revision);
    return safeUrl(url.href);
  };
  const setImage = (node, value, alt) => {
    const url = safeImageUrl(value);
    if (!node || value === undefined) return false;
    if (!url) {
      node.hidden = true;
      node.removeAttribute("src");
      return false;
    }
    node.hidden = false;
    node.src = url;
    if (alt !== undefined && alt !== null) node.alt = safeText(alt);
    return true;
  };
  const openExternal = (button, value) => {
    const url = safeUrl(value);
    if (!button) return false;
    button.onclick = null;
    if (!url) {
      button.disabled = true;
      return false;
    }
    button.removeAttribute("data-info");
    button.removeAttribute("disabled");
    button.onclick = (event) => {
      event.preventDefault();
      window.open(url, "_blank", "noopener,noreferrer");
    };
    return true;
  };

  function renderContent(data) {
    if (data.churchName) document.title = safeText(data.churchName) + " | 교회 홈페이지";
    const logoAlt = data.churchName ? safeText(data.churchName) + " 로고" : "교회 로고";
    document.querySelectorAll(".custom-logo").forEach((logo) => {
      const hasLogo = setImage(logo, data.logo, logoAlt);
      let fallback = logo.parentElement.querySelector("[data-logo-fallback]");
      if (!fallback) {
        fallback = document.createElement("span");
        fallback.dataset.logoFallback = "";
        logo.parentElement.appendChild(fallback);
      }
      fallback.textContent = safeText(data.churchName || "교회");
      fallback.hidden = hasLogo || data.logo === undefined;
      logo.parentElement.setAttribute("aria-label", logoAlt);
    });
    setImage(document.querySelector(".hero-image"), data.hero?.image, data.hero?.imageAlt || "온맘교회 예배당");
    setLines(".hero h1", data.hero?.title);
    setLines(".hero .lead", data.hero?.description);

    setText("#worship .section-head h2", data.worship?.heading);
    const schedule = document.querySelector("#worship .schedule");
    const services = Array.isArray(data.worship?.services) ? data.worship.services : [];
    if (schedule && services.length) {
      const cards = [...schedule.querySelectorAll("article")];
      services.slice(0, cards.length).forEach((service, index) => {
        const card = cards[index];
        setTextWithin(card, "h3", service.name);
        setTextWithin(card, ".time", service.time);
        setTextWithin(card, "small", service.note);
      });
    }

    setText("#sermon .section-head h2", data.sermon?.heading);
    const channelButton = document.querySelector("#sermon .section-head .text-link");
    if (channelButton) openExternal(channelButton, data.sermon?.channelUrl);
    const latestSermon = Array.isArray(data.sermon?.items) ? data.sermon.items[0] : null;
    if (latestSermon) {
      setLines("#sermon .sermon-copy h3", latestSermon.title);
      setLines("#sermon .sermon-copy > p:not(.eyebrow)", latestSermon.summary);
      const sermonNote = document.querySelector("#sermon .sermon-copy small");
      if (sermonNote) sermonNote.textContent = [latestSermon.date, latestSermon.scripture].filter(Boolean).join(" · ") || "YouTube URL 연동 · 실제 영상 등록 전";
      openExternal(document.querySelector("#sermon .play-btn"), latestSermon.videoUrl);
    }

    setLines("#community .section-head h2", data.community?.heading);
    const communityIntro = document.querySelector("#community .section-head p:not(.eyebrow)");
    if (communityIntro && data.community?.description) communityIntro.textContent = safeText(data.community.description);
    setText("#community .board-note", data.community?.notice);
    const community = document.querySelector("#community");
    community?.querySelector(".board-toolbar")?.setAttribute("hidden", "");
    community?.querySelector(".board-status")?.setAttribute("hidden", "");
    community?.querySelector(".section-head button")?.setAttribute("hidden", "");
    const cardsContainer = document.querySelector("#community .board-cards");
    const communityPosts = Array.isArray(data.community?.posts) ? data.community.posts : [];
    const postPhotos = communityPosts.map((post) => {
      const coverUrl = safeImageUrl(post.image);
      const cover = coverUrl ? [{ src: coverUrl, alt: post.imageAlt || post.title || "온맘교회 소식" }] : [];
      const gallery = Array.isArray(post.gallery) ? post.gallery.map((item) => {
        const src = safeImageUrl(item?.image);
        return src ? { src, alt: item?.alt || post.title || "온맘교회 사진" } : null;
      }).filter(Boolean) : [];
      return [...cover, ...gallery];
    });
    if (cardsContainer && Array.isArray(data.community?.posts)) {
      cardsContainer.innerHTML = communityPosts.map((post, index) => {
        const photos = postPhotos[index];
        const cover = photos[0];
        const imageMarkup = cover
          ? '<div class="blog-card-media"><img src="' + escapeAttr(cover.src) + '" alt="' + escapeAttr(cover.alt) + '" loading="lazy">' + (photos.length ? '<span class="blog-count">사진 ' + photos.length + '장</span>' : '') + '</div>'
          : '<div class="blog-card-media"><div class="blog-no-image">OUR STORIES</div></div>';
        return '<article class="blog-card"><button class="blog-card-button" type="button" data-cms-post-index="' + index + '" aria-label="' + escapeAttr(post.title || "온맘교회 소식") + ' 글 보기">' + imageMarkup + '<div class="blog-card-meta"><span class="blog-card-tag">' + escapeHtml(post.category || "교회소식") + '</span><span>' + escapeHtml(post.dateLabel || "") + '</span></div><h3>' + escapeHtml(post.title || "") + '</h3><p>' + escapeHtml(post.excerpt || "") + '</p><div class="blog-card-footer"><span>' + escapeHtml(post.author || "온맘교회") + '</span><span>이야기</span></div></button></article>';
      }).join("");
      const detailDialog = document.getElementById("blog-detail-dialog");
      const detailContent = document.getElementById("blog-detail-content");
      const imageDialog = document.getElementById("blog-image-dialog");
      const fullImage = document.getElementById("blog-full-image");
      const imageCaption = document.getElementById("blog-image-caption");
      cardsContainer.onclick = (event) => {
        const card = event.target.closest("[data-cms-post-index]");
        if (!card || !detailDialog || !detailContent) return;
        const index = Number(card.dataset.cmsPostIndex);
        const post = communityPosts[index];
        const photos = postPhotos[index] || [];
        if (!post) return;
        detailDialog.dataset.cmsPostIndex = String(index);
        const cover = photos[0];
        const galleryMarkup = photos.length > 1 ? '<div class="blog-gallery">' + photos.slice(1).map((photo, offset) => '<figure><button type="button" data-cms-photo-index="' + (offset + 1) + '" aria-label="사진 ' + (offset + 2) + ' 크게 보기"><img src="' + escapeAttr(photo.src) + '" alt="' + escapeAttr(photo.alt) + '" loading="lazy"></button><figcaption>' + escapeHtml(photo.alt || ('사진 ' + (offset + 2))) + '</figcaption></figure>').join("") + '</div>' : '';
        const coverMarkup = cover ? '<button type="button" data-cms-photo-index="0" style="padding:0;border:0;background:none;width:100%;cursor:zoom-in" aria-label="대표사진 크게 보기"><img class="blog-detail-cover" src="' + escapeAttr(cover.src) + '" alt="' + escapeAttr(cover.alt) + '"></button>' : '';
        detailContent.innerHTML = '<div class="blog-detail-meta"><span>' + escapeHtml(post.category || "교회소식") + '</span><span>' + escapeHtml(post.author || "온맘교회") + '</span><span>' + escapeHtml(post.dateLabel || "") + '</span></div><h2 id="blog-detail-title">' + escapeHtml(post.title || "") + '</h2>' + coverMarkup + '<div class="blog-detail-body">' + escapeHtml(post.excerpt || "").replace(/\n/g, "<br>") + '</div>' + galleryMarkup;
        if (typeof detailDialog.showModal === "function") detailDialog.showModal();
      };
      if (detailContent) detailContent.onclick = (event) => {
        const photoButton = event.target.closest("[data-cms-photo-index]");
        if (!photoButton || !imageDialog || !fullImage) return;
        const postIndex = Number(detailDialog?.dataset.cmsPostIndex);
        const photo = postPhotos[postIndex]?.[Number(photoButton.dataset.cmsPhotoIndex)];
        if (!photo) return;
        fullImage.src = photo.src;
        fullImage.alt = photo.alt;
        if (imageCaption) imageCaption.textContent = photo.alt;
        if (typeof imageDialog.showModal === "function") imageDialog.showModal();
      };
    }

    setText("#bulletin h3", data.bulletin?.title);
    setText("#bulletin p:not(.eyebrow)", data.bulletin?.description);
    const bulletinButton = document.querySelector("#bulletin button");
    if (bulletinButton) {
      bulletinButton.textContent = data.bulletin?.pdfUrl ? "주보 PDF 열기 ↗" : "주보 PDF 등록 예정";
      if (!openExternal(bulletinButton, data.bulletin?.pdfUrl)) bulletinButton.disabled = true;
    }

    setLines("#next .next-intro h2", data.newcomer?.heading);
    setText("#next .next-intro > p:not(.eyebrow)", data.newcomer?.description);
    const steps = [...document.querySelectorAll("#next .steps .step span")];
    (data.newcomer?.steps || []).slice(0, steps.length).forEach((step, index) => { steps[index].textContent = safeText(step); });
    setText("#next .next-intro > p:last-child", data.newcomer?.formNotice);

    setLines("#contact h2", data.contact?.heading);
    const detailValues = [data.contact?.address, data.contact?.phone, data.contact?.email];
    document.querySelectorAll("#contact .contact-details p").forEach((row, index) => {
      const valueNode = row.childNodes[row.childNodes.length - 1];
      if (valueNode && detailValues[index] !== undefined) valueNode.textContent = safeText(detailValues[index]);
    });
    setText("#contact .contact-grid > div:first-child .muted", data.contact?.visitNote);
    setText("#contact .map-placeholder strong", data.churchName);
    setText("#contact .map-placeholder small", data.contact?.mapNote);
    openExternal(document.querySelector("#contact .map-placeholder button"), data.contact?.mapUrl);

    const chat = document.querySelector("#onmam-chat-panel");
    if (chat) {
      setText("#onmam-chat-panel .onmam-chat-head strong", data.chatbot?.title);
      setText("#onmam-chat-panel .onmam-chat-body > p:first-child", data.chatbot?.greeting);
      setText("#onmam-chat-panel .onmam-chat-note", data.chatbot?.notice);
      const choices = [...chat.querySelectorAll(".onmam-chat-choices button")];
      (data.chatbot?.choices || []).slice(0, choices.length).forEach((choice, index) => {
        choices[index].textContent = safeText(choice.label);
        choices[index].dataset.chatTarget = safeText(choice.target);
        choices[index].hidden = false;
      });
      choices.slice((data.chatbot?.choices || []).length).forEach((button) => { button.hidden = true; });
    }
  }

  async function refreshContent() {
    if (loading || document.hidden) return;
    loading = true;
    try {
      const response = await fetch("./content/site.json", { cache: "no-store", signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error("콘텐츠 요청 실패: " + response.status);
      const data = await response.json();
      if (!data || typeof data !== "object" || typeof data.churchName !== "string") throw new Error("올바른 홈페이지 콘텐츠가 아닙니다.");
      const content = JSON.stringify(data);
      if (content === lastContent || document.querySelector("dialog[open]")) return;
      assetBase = data._onmam?.assetBase || "/uploads/";
      revision = data._onmam?.revision || "";
      renderContent(data);
      lastContent = content;
      document.documentElement.dataset.contentSource = data._onmam?.source || "local";
      window.dispatchEvent(new CustomEvent("onmam:content-updated", { detail: { revision, source: data._onmam?.source || "local" } }));
    } catch (error) {
      console.warn("온맘교회 콘텐츠를 갱신하지 못했습니다. 기존 화면을 유지합니다.", error);
    } finally {
      loading = false;
    }
  }
  refreshContent();
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-blog-close]");
    if (!button) return;
    const dialog = document.getElementById(button.dataset.blogClose);
    if (dialog instanceof HTMLDialogElement) dialog.close();
  });
  window.addEventListener("focus", refreshContent);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshContent(); });
  document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("close", refreshContent));
  window.setInterval(refreshContent, 15_000);

  function setTextWithin(parent, selector, value) {
    const node = parent.querySelector(selector);
    if (node && value !== undefined && value !== null) node.textContent = safeText(value);
  }
  function escapeHtml(value) {
    return safeText(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }
  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }
})();
