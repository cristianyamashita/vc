window.OSWidgets = (function () {
  const TYPES = ["clock", "calendar", "stickies", "stats", "weather"];
  let root;
  let drag = null;

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

  function list() {
    const s = window.OS && window.OS.state;
    return s && Array.isArray(s.widgets) ? s.widgets : [];
  }

  function persist() {
    if (window.OS && typeof window.OS.persistNow === "function") window.OS.persistNow();
  }

  function seedIfNeeded() {
    const s = window.OS && window.OS.state;
    if (!s) return;
    if (s.appliedWidgets) return;
    s.appliedWidgets = true;
    if (!Array.isArray(s.widgets)) s.widgets = [];
    if (!Array.isArray(s.stickies)) s.stickies = [];
    if (s.widgets.length) {
      persist();
      return;
    }
    const right = Math.max(24, window.innerWidth - 292);
    if (!s.stickies.length) {
      s.stickies.push({ id: window.OSDesk.nid("st_"), text: t("stickyWelcome"), color: "gold" });
    }
    const sticky = s.stickies[0] || null;
    s.widgets = [
      { id: window.OSDesk.nid("wd_"), type: "clock", x: right, y: 24, w: 248, h: 148 },
      { id: window.OSDesk.nid("wd_"), type: "calendar", x: right, y: 188, w: 248, h: 268 },
      { id: window.OSDesk.nid("wd_"), type: "stickies", x: right - 268, y: 24, w: 248, h: 176, stickyId: sticky ? sticky.id : null },
      { id: window.OSDesk.nid("wd_"), type: "stats", x: right, y: 472, w: 248, h: 118 },
    ];
    persist();
  }

  function add(type) {
    const s = window.OS && window.OS.state;
    if (!s || !TYPES.includes(type)) return;
    if (!Array.isArray(s.widgets)) s.widgets = [];
    const widget = {
      id: window.OSDesk.nid("wd_"),
      type,
      x: 80 + (s.widgets.length % 4) * 28,
      y: 80 + (s.widgets.length % 4) * 28,
      w: type === "calendar" ? 248 : 248,
      h: type === "calendar" ? 268 : type === "clock" ? 148 : 160,
    };
    if (type === "stickies") {
      const note = window.OSDesk.addSticky({ text: "", color: "gold" });
      widget.stickyId = note ? note.id : null;
    }
    s.widgets.push(widget);
    persist();
    refresh();
  }

  function remove(id) {
    const s = window.OS && window.OS.state;
    if (!s || !Array.isArray(s.widgets)) return;
    s.widgets = s.widgets.filter((w) => w && w.id !== id);
    persist();
    refresh();
  }

  function weatherLabel(code) {
    if (code == null) return t("weatherUnknown");
    if (code === 0) return t("weatherClear");
    if (code <= 3) return t("weatherCloud");
    if (code <= 67) return t("weatherRain");
    if (code <= 77) return t("weatherSnow");
    return t("weatherStorm");
  }

  async function fillWeather(el, widget) {
    const box = el.querySelector("[data-weather-body]");
    if (!box) return;
    try {
      let lat = widget.lat;
      let lon = widget.lon;
      if (lat == null || lon == null) {
        lat = 35.68;
        lon = 139.69;
        if (navigator.geolocation) {
          await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                lat = pos.coords.latitude;
                lon = pos.coords.longitude;
                resolve();
              },
              () => resolve(),
              { timeout: 2500 }
            );
          });
        }
        widget.lat = lat;
        widget.lon = lon;
      }
      const url =
        "https://api.open-meteo.com/v1/forecast?latitude=" +
        lat +
        "&longitude=" +
        lon +
        "&current=temperature_2m,weather_code&timezone=auto";
      const res = await fetch(url);
      const data = await res.json();
      const temp = data && data.current && data.current.temperature_2m;
      const code = data && data.current && data.current.weather_code;
      box.innerHTML = `<strong>${temp != null ? Math.round(temp) + "°" : "—"}</strong><span>${escapeHtml(weatherLabel(code))}</span>`;
    } catch (_err) {
      box.textContent = t("weatherUnavailable");
    }
  }

  function clockHtml() {
    const now = new Date();
    const lang = (window.OS && window.OS.lang) || "en";
    const locale = lang === "pt" ? "pt-BR" : lang === "ja" ? "ja-JP" : "en-US";
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `<div class="os-widget-clock"><div class="os-widget-time">${hh}:${mm}</div><div class="os-widget-date">${escapeHtml(now.toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric" }))}</div></div>`;
  }

  function calendarHtml() {
    const view = new Date();
    const today = window.OSDesk.dateKey(view);
    const cells = window.OSDesk.buildMonthGrid(view);
    return `<div class="os-widget-cal-title">${escapeHtml(window.OSDesk.monthTitle(view))}</div>
      <div class="os-widget-week">${window.OSDesk.weekdayLabels().map((d) => `<span>${escapeHtml(d)}</span>`).join("")}</div>
      <div class="os-widget-grid">${cells
        .map((d) => {
          if (!d) return `<span></span>`;
          const key = window.OSDesk.dateKey(d);
          const marked = window.OSDesk.calendarItems().some((item) => item && item.date === key);
          return `<span class="${key === today ? "today" : ""} ${marked ? "marked" : ""}">${d.getDate()}</span>`;
        })
        .join("")}</div>`;
  }

  function stickyHtml(widget) {
    const note = window.OSDesk.stickies().find((row) => row.id === widget.stickyId) || window.OSDesk.stickies()[0];
    const text = note ? note.text : "";
    const id = note ? note.id : "";
    return `<textarea data-sticky-id="${escapeHtml(id)}" placeholder="${escapeHtml(t("stickyPlaceholder"))}">${escapeHtml(text)}</textarea>`;
  }

  function statsHtml(info) {
    const used = info && window.OSFS ? window.OSFS.formatSize(info.used) : "—";
    const files = info ? String(info.files) : "—";
    return `<div class="os-widget-stats"><div><span>${escapeHtml(t("storage"))}</span><strong>${escapeHtml(used)}</strong></div><div><span>${escapeHtml(t("storageFiles"))}</span><strong>${escapeHtml(files)}</strong></div></div>`;
  }

  function widgetBody(widget, info) {
    if (widget.type === "clock") return clockHtml();
    if (widget.type === "calendar") return calendarHtml();
    if (widget.type === "stickies") return stickyHtml(widget);
    if (widget.type === "stats") return statsHtml(info);
    if (widget.type === "weather") return `<div class="os-widget-weather" data-weather-body>${escapeHtml(t("weatherLoading"))}</div>`;
    return "";
  }

  async function refresh() {
    if (!root) return;
    const info = window.OS && window.OS.getStorageInfo ? await window.OS.getStorageInfo() : null;
    root.innerHTML = list()
      .map((widget) => {
        const title =
          widget.type === "clock"
            ? t("widgetClock")
            : widget.type === "calendar"
              ? t("widgetCalendar")
              : widget.type === "stickies"
                ? t("widgetStickies")
                : widget.type === "stats"
                  ? t("widgetStats")
                  : t("widgetWeather");
        return `<section class="os-widget os-widget-${widget.type}" data-widget-id="${escapeHtml(widget.id)}" style="left:${widget.x}px;top:${widget.y}px;width:${widget.w}px;min-height:${widget.h}px">
          <header data-widget-drag>
            <span>${escapeHtml(title)}</span>
            <button type="button" data-widget-close aria-label="${escapeHtml(t("close"))}">×</button>
          </header>
          <div class="os-widget-body">${widgetBody(widget, info)}</div>
        </section>`;
      })
      .join("");
    list()
      .filter((w) => w.type === "weather")
      .forEach((widget) => {
        const el = root.querySelector('[data-widget-id="' + widget.id + '"]');
        if (el) fillWeather(el, widget);
      });
  }

  function bind() {
    if (!root) return;
    root.addEventListener("pointerdown", (e) => {
      const close = e.target.closest("[data-widget-close]");
      if (close) {
        const id = close.closest("[data-widget-id]").dataset.widgetId;
        remove(id);
        return;
      }
      const handle = e.target.closest("[data-widget-drag]");
      if (!handle || e.target.closest("button")) return;
      const card = handle.closest("[data-widget-id]");
      const widget = list().find((w) => w.id === card.dataset.widgetId);
      if (!widget) return;
      drag = { id: widget.id, dx: e.clientX - widget.x, dy: e.clientY - widget.y };
      card.classList.add("dragging");
      e.preventDefault();
    });
    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const widget = list().find((w) => w.id === drag.id);
      if (!widget) return;
      widget.x = Math.max(8, Math.min(window.innerWidth - 80, e.clientX - drag.dx));
      widget.y = Math.max(8, Math.min(window.innerHeight - 80, e.clientY - drag.dy));
      const el = root.querySelector('[data-widget-id="' + drag.id + '"]');
      if (el) {
        el.style.left = widget.x + "px";
        el.style.top = widget.y + "px";
      }
    });
    window.addEventListener("pointerup", () => {
      if (!drag) return;
      const el = root.querySelector('[data-widget-id="' + drag.id + '"]');
      if (el) el.classList.remove("dragging");
      drag = null;
      persist();
    });
    root.addEventListener("input", (e) => {
      const area = e.target.closest("[data-sticky-id]");
      if (!area) return;
      window.OSDesk.updateSticky(area.dataset.stickyId, { text: area.value }, { emit: false, flush: false });
    });
    root.addEventListener("focusout", (e) => {
      const area = e.target.closest("[data-sticky-id]");
      if (!area || !window.OSDesk) return;
      window.OSDesk.updateSticky(area.dataset.stickyId, { text: area.value });
    });
    root.addEventListener("dblclick", (e) => {
      if (e.target.closest(".os-widget-calendar, .os-widget-cal-title, .os-widget-grid")) {
        if (window.OSWindows) window.OSWindows.open("calendar");
      }
    });
    root.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".os-widget")) e.preventDefault();
    });
  }

  function contextItems() {
    return [
      { act: "widget-clock", label: t("widgetClock") },
      { act: "widget-calendar", label: t("widgetCalendar") },
      { act: "widget-stickies", label: t("widgetStickies") },
      { act: "widget-stats", label: t("widgetStats") },
      { act: "widget-weather", label: t("widgetWeather") },
    ];
  }

  function handleContext(act) {
    if (typeof act === "string" && act.startsWith("widget-")) add(act.slice(7));
  }

  function init() {
    root = document.getElementById("desktop-widgets");
    if (!root) return;
    seedIfNeeded();
    bind();
    refresh();
    setInterval(() => {
      if (!root) return;
      root.querySelectorAll(".os-widget-body").forEach((body) => {
        if (!body.querySelector(".os-widget-clock")) return;
        body.innerHTML = clockHtml();
      });
    }, 30000);
    if (window.OSDesk) {
      window.OSDesk.onChange(() => {
        if (root && root.querySelector("textarea:focus")) return;
        refresh();
      });
    }
  }

  return { init, refresh, add, remove, contextItems, handleContext };
})();
