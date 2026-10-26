(async function loadOnmamContent() {
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
  const openExternal = (button, value) => {
    const url = safeUrl(value);
    if (!button || !url) return false;
    button.removeAttribute("data-info");
    button.removeAttribute("disabled");
    button.onclick = (event) => {
      event.preventDefault();
      window.open(url, "_blank", "noopener,noreferrer");
    };
    return true;
  };

  try {
    const response = await fetch("./content/site.json", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();

    if (data.churchName) document.title = safeText(data.churchName) + " | 교회 홈페이지";
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
    if (cardsContainer && Array.isArray(data.community?.posts)) {
      const fallbacks = [...cardsContainer.querySelectorAll(".blog-card img")].map((image) => image.src);
      cardsContainer.innerHTML = data.community.posts.map((post, index) => {
        const imageUrl = safeUrl(post.image) || fallbacks[index] || "";
        const imageMarkup = imageUrl
          ? '<div class="blog-card-media"><img src="' + escapeAttr(imageUrl) + '" alt="' + escapeAttr(post.title || "온맘교회 소식") + '" loading="lazy"></div>'
          : '<div class="blog-card-media"><div class="blog-no-image">OUR STORIES</div></div>';
        return '<article class="blog-card"><div class="blog-card-button">' + imageMarkup + '<div class="blog-card-meta"><span class="blog-card-tag">' + escapeHtml(post.category || "교회소식") + '</span><span>' + escapeHtml(post.dateLabel || "") + '</span></div><h3>' + escapeHtml(post.title || "") + '</h3><p>' + escapeHtml(post.excerpt || "") + '</p><div class="blog-card-footer"><span>' + escapeHtml(post.author || "온맘교회") + '</span><span>이야기</span></div></div></article>';
      }).join("");
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
  } catch (error) {
    console.warn("온맘교회 콘텐츠 파일을 불러오지 못했습니다.", error);
  }

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
