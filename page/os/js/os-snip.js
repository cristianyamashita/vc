window.OSSnip = (function () {
  const roots = new Map();
  let overlay;
  let selecting = false;
  let start = null;
  let box = null;
  let lastBlob = null;

  function t(key, vars) {
    return window.OSI18n.t(key, vars);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function paint(root) {
    const has = !!lastBlob;
    root.innerHTML = `
      <div class="os-snip">
        <h2>${escapeHtml(t("snipTitle"))}</h2>
        <p class="muted">${escapeHtml(t("snipHint"))}</p>
        <div class="os-snip-actions">
          <button type="button" class="settings-link" data-snip-new>${escapeHtml(t("snipNew"))}</button>
          <button type="button" data-snip-save ${has ? "" : "disabled"}>${escapeHtml(t("snipSave"))}</button>
          <button type="button" data-snip-paint ${has ? "" : "disabled"}>${escapeHtml(t("snipPaint"))}</button>
        </div>
        <div class="os-snip-preview">${has ? "<img alt=\"\">" : `<p class="muted">${escapeHtml(t("snipEmpty"))}</p>`}</div>
      </div>`;
    if (has) {
      const img = root.querySelector("img");
      img.src = URL.createObjectURL(lastBlob);
    }
    root.querySelector("[data-snip-new]").addEventListener("click", startCapture);
    root.querySelector("[data-snip-save]").addEventListener("click", saveDesktop);
    root.querySelector("[data-snip-paint]").addEventListener("click", openPaint);
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.getElementById("os-snip-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "os-snip-overlay";
      overlay.className = "os-snip-overlay";
      overlay.hidden = true;
      document.body.appendChild(overlay);
    }
    overlay.addEventListener("pointerdown", (e) => {
      selecting = true;
      start = { x: e.clientX, y: e.clientY };
      if (!box) {
        box = document.createElement("div");
        box.className = "os-snip-rect";
        overlay.appendChild(box);
      }
    });
    overlay.addEventListener("pointermove", (e) => {
      if (!selecting || !box) return;
      const x = Math.min(start.x, e.clientX);
      const y = Math.min(start.y, e.clientY);
      const w = Math.abs(e.clientX - start.x);
      const h = Math.abs(e.clientY - start.y);
      box.style.left = x + "px";
      box.style.top = y + "px";
      box.style.width = w + "px";
      box.style.height = h + "px";
    });
    overlay.addEventListener("pointerup", (e) => {
      if (!selecting) return;
      selecting = false;
      const x = Math.min(start.x, e.clientX);
      const y = Math.min(start.y, e.clientY);
      const w = Math.max(4, Math.abs(e.clientX - start.x));
      const h = Math.max(4, Math.abs(e.clientY - start.y));
      finishCapture({ x, y, w, h });
    });
    return overlay;
  }

  async function finishCapture(rect) {
    overlay.hidden = true;
    if (box) box.remove();
    box = null;
    const wins = window.OSWindows.list().filter((w) => (w.appId || window.OSWindows.appIdOf(w.id)) === "snip");
    wins.forEach((w) => w.el.classList.add("os-snip-hide"));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      if (typeof html2canvas !== "function") throw new Error("missing");
      const canvas = await html2canvas(document.documentElement, {
        x: rect.x,
        y: rect.y,
        width: rect.w,
        height: rect.h,
        useCORS: true,
        logging: false,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });
      lastBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    } catch (_err) {
      lastBlob = null;
    }
    wins.forEach((w) => w.el.classList.remove("os-snip-hide"));
    remountOpen();
  }

  function startCapture() {
    const layer = ensureOverlay();
    layer.innerHTML = "";
    box = null;
    layer.hidden = false;
    if (window.OSStart) {
      window.OSStart.close();
      window.OSStart.closeContext();
    }
  }

  async function saveDesktop() {
    if (!lastBlob || !window.OSFS) return;
    await window.OSFS.ready();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    await window.OSFS.createFile(window.OSFS.DESKTOP_ID, {
      name: "snip-" + stamp + ".png",
      mime: "image/png",
      blob: lastBlob,
    });
  }

  async function openPaint() {
    if (!lastBlob || !window.OSFS || !window.OSWindows) return;
    await window.OSFS.ready();
    const node = await window.OSFS.createFile(window.OSFS.DESKTOP_ID, {
      name: "snip.png",
      mime: "image/png",
      blob: lastBlob,
    });
    if (node) window.OSWindows.open("paint", { fileId: node.id, newInstance: true });
  }

  function mount(root) {
    if (!root) return;
    roots.set(root, true);
    paint(root);
  }

  function remountOpen() {
    document.querySelectorAll(".native-root").forEach((root) => {
      if (root.closest('[data-app-id="snip"]')) paint(root);
    });
  }

  return { mount, remountOpen, startCapture };
})();
