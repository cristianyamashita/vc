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
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      selecting = true;
      start = { x: e.clientX, y: e.clientY };
      try {
        overlay.setPointerCapture(e.pointerId);
      } catch (_err) {
        /* ignore */
      }
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
    overlay.addEventListener("pointercancel", () => {
      selecting = false;
      overlay.hidden = true;
      if (box) box.remove();
      box = null;
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !overlay || overlay.hidden) return;
      selecting = false;
      overlay.hidden = true;
      if (box) box.remove();
      box = null;
    });
    return overlay;
  }

  function ignoreCaptureEl(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.id === "os-snip-overlay" || el.id === "wallpaper" || el.id === "snip-debug") return true;
    return !!(el.classList && el.classList.contains("os-snip-hide"));
  }

  function captureOptions(extra) {
    return Object.assign(
      {
        useCORS: true,
        logging: false,
        backgroundColor: null,
        imageTimeout: 2500,
        ignoreElements: ignoreCaptureEl,
      },
      extra || {}
    );
  }

  async function renderNode(node, extra) {
    if (typeof html2canvas !== "function") throw new Error("missing");
    extra = extra || {};
    const preferCanvas = !!extra.preferCanvas;
    delete extra.preferCanvas;
    const modes = preferCanvas
      ? [{ foreignObjectRendering: false }, { foreignObjectRendering: true }]
      : [{ foreignObjectRendering: true }, { foreignObjectRendering: false }];
    let lastErr = null;
    for (let i = 0; i < modes.length; i += 1) {
      try {
        return await html2canvas(node, captureOptions(Object.assign({}, modes[i], extra)));
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("capture failed");
  }

  function iframeDoc(iframe) {
    try {
      return iframe && iframe.contentDocument;
    } catch (_err) {
      return null;
    }
  }

  function fieldPageRect(el, iframe) {
    const br = el.getBoundingClientRect();
    if (!iframe) return { x: br.left, y: br.top, w: br.width, h: br.height };
    const ib = iframe.getBoundingClientRect();
    const sx = ib.width / Math.max(1, iframe.clientWidth || br.width);
    const sy = ib.height / Math.max(1, iframe.clientHeight || br.height);
    return {
      x: ib.left + br.left * sx,
      y: ib.top + br.top * sy,
      w: br.width * sx,
      h: br.height * sy,
    };
  }

  function wrapLines(ctx, text, maxWidth, whiteSpace) {
    const paragraphs = String(text).split("\n");
    if (whiteSpace === "pre" || whiteSpace === "nowrap") return paragraphs;
    const lines = [];
    paragraphs.forEach((para) => {
      if (!para) {
        lines.push("");
        return;
      }
      let current = "";
      const tokens = para.split(/(\s+)/);
      for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        const trial = current + token;
        if (current && ctx.measureText(trial).width > maxWidth) {
          lines.push(current);
          current = /^\s+$/.test(token) ? "" : token;
          while (current && ctx.measureText(current).width > maxWidth && current.length > 1) {
            let cut = current.length - 1;
            while (cut > 1 && ctx.measureText(current.slice(0, cut)).width > maxWidth) cut -= 1;
            lines.push(current.slice(0, cut));
            current = current.slice(cut);
          }
        } else {
          current = trial;
        }
      }
      lines.push(current);
    });
    return lines;
  }

  function paintFieldText(ctx, el, view, iframe, rect, destScaleX, destScaleY) {
    if (!isTextField(el) || !view) return;
    if (el.offsetWidth < 2 || el.offsetHeight < 2) return;
    const cs = view.getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return;
    const page = fieldPageRect(el, iframe);
    const hit = overlap(rect, page);
    if (!hit) return;
    const value = el.type === "password" ? "•".repeat(String(el.value || "").length) : String(el.value || "");
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const padT = parseFloat(cs.paddingTop) || 0;
    const fontSize = parseFloat(cs.fontSize) || 14;
    let lineHeight = parseFloat(cs.lineHeight);
    if (!lineHeight) lineHeight = fontSize * 1.5;
    ctx.save();
    ctx.setTransform(destScaleX, 0, 0, destScaleY, 0, 0);
    ctx.beginPath();
    ctx.rect(page.x - rect.x, page.y - rect.y, page.w, page.h);
    ctx.clip();
    ctx.font = cs.font || fontSize + "px sans-serif";
    ctx.fillStyle = cssColor(cs.color) || "#111";
    ctx.textBaseline = "top";
    ctx.textAlign = cs.textAlign === "center" || cs.textAlign === "right" ? cs.textAlign : "left";
    const maxWidth = Math.max(8, el.clientWidth - padL - padR);
    const lines = wrapLines(ctx, value, maxWidth, cs.whiteSpace);
    const x0 = page.x - rect.x + padL - (el.scrollLeft || 0);
    let y = page.y - rect.y + padT - (el.scrollTop || 0);
    const align = ctx.textAlign;
    const xMid = page.x - rect.x + padL + maxWidth / 2;
    const xRight = page.x - rect.x + page.w - padR;
    for (let i = 0; i < lines.length; i += 1) {
      const x = align === "center" ? xMid : align === "right" ? xRight : x0;
      ctx.fillText(lines[i], x, y);
      y += lineHeight;
      if (y > page.y - rect.y + page.h + lineHeight) break;
    }
    ctx.restore();
  }

  function paintAllFieldText(ctx, rect) {
    const destScaleX = ctx.canvas.width / Math.max(1, rect.w);
    const destScaleY = ctx.canvas.height / Math.max(1, rect.h);
    Array.from(document.querySelectorAll("textarea, input")).forEach((el) => {
      if (el.closest && el.closest(".os-snip-hide, #os-snip-overlay")) return;
      paintFieldText(ctx, el, window, null, rect, destScaleX, destScaleY);
    });
    document.querySelectorAll(".os-window:not(.minimized) iframe").forEach((iframe) => {
      try {
        const win = iframe.closest(".os-window");
        if (win && win.classList.contains("os-snip-hide")) return;
        const doc = iframeDoc(iframe);
        const view = iframe.contentWindow;
        if (!doc || !view) return;
        Array.from(doc.querySelectorAll("textarea, input")).forEach((el) => {
          try {
            paintFieldText(ctx, el, view, iframe, rect, destScaleX, destScaleY);
          } catch (_err) {
            /* skip this field */
          }
        });
      } catch (_err) {
        /* skip this frame */
      }
    });
  }

  function cssColor(value) {
    if (!value) return value;
    try {
      const ctx = cssColor.ctx || (cssColor.ctx = document.createElement("canvas").getContext("2d"));
      ctx.fillStyle = "#000";
      ctx.fillStyle = value;
      return ctx.fillStyle;
    } catch (_err) {
      return value;
    }
  }

  function isTextField(el) {
    if (!el) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName !== "INPUT") return false;
    const type = String(el.type || "text").toLowerCase();
    return /^(text|search|url|email|password|number|tel|date|time|datetime-local|month|week)$/.test(type);
  }

  function overlap(a, b) {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const r = Math.min(a.x + a.w, b.x + b.w);
    const btm = Math.min(a.y + a.h, b.y + b.h);
    if (r - x < 2 || btm - y < 2) return null;
    return { x, y, w: r - x, h: btm - y };
  }

  function drawSafe(ctx, source) {
    if (!source) return false;
    if (source.getContext) {
      try {
        source.getContext("2d").getImageData(0, 0, 1, 1);
      } catch (_err) {
        return false;
      }
    }
    try {
      ctx.drawImage(source, 0, 0, ctx.canvas.width, ctx.canvas.height);
      return true;
    } catch (_err) {
      return false;
    }
  }

  async function paintBackdrop(ctx, rect, scale) {
    const wp = document.getElementById("wallpaper") || document.body;
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor || "#111";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    try {
      const bg = await html2canvas(wp, {
        x: rect.x,
        y: rect.y,
        width: rect.w,
        height: rect.h,
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: null,
        foreignObjectRendering: false,
        ignoreElements: (el) => el && el.id === "os-snip-overlay",
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });
      drawSafe(ctx, bg);
    } catch (_err) {
      /* keep the solid fill */
    }
  }

  async function stampIframes(ctx, rect) {
    const destScaleX = ctx.canvas.width / Math.max(1, rect.w);
    const destScaleY = ctx.canvas.height / Math.max(1, rect.h);
    const frames = Array.from(document.querySelectorAll(".os-window:not(.minimized) iframe"))
      .filter((iframe) => {
        const win = iframe.closest(".os-window");
        return win && !win.classList.contains("os-snip-hide") && iframeDoc(iframe);
      })
      .sort((a, b) => {
        const za = Number((a.closest(".os-window") || {}).style.zIndex || 0);
        const zb = Number((b.closest(".os-window") || {}).style.zIndex || 0);
        return za - zb;
      });
    for (let i = 0; i < frames.length; i += 1) {
      const iframe = frames[i];
      const doc = iframeDoc(iframe);
      if (!doc || !doc.documentElement) continue;
      const br = iframe.getBoundingClientRect();
      const hit = overlap(rect, { x: br.left, y: br.top, w: br.width, h: br.height });
      if (!hit) continue;
      const view = iframe.contentWindow;
      const cssW = Math.max(1, iframe.clientWidth || Math.round(br.width));
      const cssH = Math.max(1, iframe.clientHeight || Math.round(br.height));
      try {
        const shot = await renderNode(doc.documentElement, {
          preferCanvas: true,
          scale: destScaleX,
          width: cssW,
          height: cssH,
          windowWidth: cssW,
          windowHeight: cssH,
          scrollX: view ? -view.scrollX : 0,
          scrollY: view ? -view.scrollY : 0,
        });
        const srcScaleX = shot.width / Math.max(1, br.width);
        const srcScaleY = shot.height / Math.max(1, br.height);
        try {
          shot.getContext("2d").getImageData(0, 0, 1, 1);
          ctx.drawImage(
            shot,
            (hit.x - br.left) * srcScaleX,
            (hit.y - br.top) * srcScaleY,
            hit.w * srcScaleX,
            hit.h * srcScaleY,
            (hit.x - rect.x) * destScaleX,
            (hit.y - rect.y) * destScaleY,
            hit.w * destScaleX,
            hit.h * destScaleY
          );
        } catch (_drawErr) {
          /* tainted iframe shot */
        }
      } catch (_err) {
        /* cross-origin or paint failure: leave the shell capture */
      }
    }
  }

  async function finishCapture(rect) {
    overlay.hidden = true;
    if (box) box.remove();
    box = null;
    const wins = window.OSWindows.list().filter((w) => (w.appId || window.OSWindows.appIdOf(w.id)) === "snip");
    wins.forEach((w) => w.el.classList.add("os-snip-hide"));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const scale = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(rect.w * scale));
      canvas.height = Math.max(1, Math.round(rect.h * scale));
      const ctx = canvas.getContext("2d");
      await paintBackdrop(ctx, rect, scale);
      const main = await renderNode(document.documentElement, {
        x: rect.x,
        y: rect.y,
        width: rect.w,
        height: rect.h,
        scale,
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });
      drawSafe(ctx, main);
      await stampIframes(ctx, rect);
      try {
        paintAllFieldText(ctx, rect);
      } catch (_err) {
        /* keep the raster even if glyph overlay fails */
      }
      lastBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!lastBlob) throw new Error("empty");
    } catch (err) {
      lastBlob = null;
      if (typeof console !== "undefined" && console.warn) console.warn("OSSnip capture failed", err);
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
