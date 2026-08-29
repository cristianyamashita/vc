window.OSDesk = (function () {
  const listeners = new Set();

  function state() {
    return window.OS && window.OS.state ? window.OS.state : null;
  }

  function persist(opts) {
    const silent = opts && opts.emit === false;
    const flush = !opts || opts.flush !== false;
    if (flush && window.OS && typeof window.OS.persistNow === "function") window.OS.persistNow();
    else if (window.OS && typeof window.OS.persistSession === "function") window.OS.persistSession();
    else if (window.OS && typeof window.OS.persistNow === "function") window.OS.persistNow();
    if (!silent) emit();
  }

  let stickySyncTimer = null;

  function scheduleStickySync() {
    clearTimeout(stickySyncTimer);
    stickySyncTimer = setTimeout(() => emit(), 400);
  }

  function emit() {
    listeners.forEach((fn) => {
      try {
        fn();
      } catch (_err) {}
    });
    document.dispatchEvent(new CustomEvent("os-desk-change"));
    if (window.OSWindows && typeof window.OSWindows.list === "function") {
      window.OSWindows.list().forEach((win) => {
        const iframe = win.el && win.el.querySelector("iframe");
        if (!iframe || !iframe.contentWindow) return;
        try {
          iframe.contentWindow.postMessage({ type: "os-desk-change" }, location.origin);
        } catch (_err) {}
      });
    }
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function nid(prefix) {
    return prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function dateKey(d) {
    const dt = d instanceof Date ? d : new Date(d);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function calendarItems() {
    const s = state();
    return s && Array.isArray(s.calendarItems) ? s.calendarItems : [];
  }

  function calendarFor(date) {
    const key = dateKey(date);
    return calendarItems()
      .filter((item) => item && item.date === key)
      .slice()
      .sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
  }

  function addCalendar(item) {
    const s = state();
    if (!s) return null;
    if (!Array.isArray(s.calendarItems)) s.calendarItems = [];
    const next = {
      id: nid("cal_"),
      date: dateKey(item.date || new Date()),
      time: item.time ? String(item.time) : "",
      title: String(item.title || "").trim() || (item.kind === "note" ? "Note" : "Event"),
      notes: String(item.notes || ""),
      kind: item.kind === "note" ? "note" : "event",
    };
    s.calendarItems.push(next);
    persist();
    return next;
  }

  function updateCalendar(id, patch) {
    const s = state();
    if (!s || !Array.isArray(s.calendarItems)) return null;
    const item = s.calendarItems.find((row) => row && row.id === id);
    if (!item) return null;
    if (patch.date) item.date = dateKey(patch.date);
    if (patch.time != null) item.time = String(patch.time);
    if (patch.title != null) item.title = String(patch.title);
    if (patch.notes != null) item.notes = String(patch.notes);
    if (patch.kind) item.kind = patch.kind === "note" ? "note" : "event";
    persist();
    return item;
  }

  function removeCalendar(id) {
    const s = state();
    if (!s || !Array.isArray(s.calendarItems)) return;
    s.calendarItems = s.calendarItems.filter((row) => row && row.id !== id);
    persist();
  }

  function stickies() {
    const s = state();
    return s && Array.isArray(s.stickies) ? s.stickies : [];
  }

  function addSticky(item) {
    const s = state();
    if (!s) return null;
    if (!Array.isArray(s.stickies)) s.stickies = [];
    const next = {
      id: nid("st_"),
      text: item && item.text ? String(item.text) : "",
      color: (item && item.color) || "gold",
    };
    s.stickies.push(next);
    persist();
    return next;
  }

  function updateSticky(id, patch, opts) {
    const s = state();
    if (!s || !Array.isArray(s.stickies)) return null;
    const item = s.stickies.find((row) => row && row.id === id);
    if (!item) return null;
    if (patch.text != null) item.text = String(patch.text);
    if (patch.color) item.color = String(patch.color);
    const silent = opts && opts.emit === false;
    persist({ emit: !silent, flush: !(opts && opts.flush === false) });
    if (silent) scheduleStickySync();
    return item;
  }

  function removeSticky(id) {
    const s = state();
    if (!s) return;
    if (Array.isArray(s.stickies)) s.stickies = s.stickies.filter((row) => row && row.id !== id);
    if (Array.isArray(s.widgets)) {
      s.widgets = s.widgets.filter((w) => !(w && w.type === "stickies" && w.stickyId === id));
    }
    persist();
  }

  function browserState() {
    const s = state();
    if (!s) return { bookmarks: [], history: [], cookies: [], proxy: "" };
    if (!s.browser || typeof s.browser !== "object") s.browser = { bookmarks: [], history: [], cookies: [], proxy: "" };
    if (!Array.isArray(s.browser.bookmarks)) s.browser.bookmarks = [];
    if (!Array.isArray(s.browser.history)) s.browser.history = [];
    if (!Array.isArray(s.browser.cookies)) s.browser.cookies = [];
    if (typeof s.browser.proxy !== "string") s.browser.proxy = "";
    return s.browser;
  }

  function saveBrowser() {
    persist();
  }

  const WEEKDAYS = {
    en: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    pt: ["D", "S", "T", "Q", "Q", "S", "S"],
    ja: ["日", "月", "火", "水", "木", "金", "土"],
  };

  function weekdayLabels() {
    const lang = (window.OS && window.OS.lang) || "en";
    return WEEKDAYS[lang] || WEEKDAYS.en;
  }

  function monthTitle(date) {
    const lang = (window.OS && window.OS.lang) || "en";
    const locale = lang === "pt" ? "pt-BR" : lang === "ja" ? "ja-JP" : "en-US";
    return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
  }

  function buildMonthGrid(view) {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = first.getDay();
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < start; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(new Date(view.getFullYear(), view.getMonth(), d));
    while (cells.length % 7) cells.push(null);
    return cells;
  }

  function t(key, vars) {
    return window.OSI18n ? window.OSI18n.t(key, vars) : key;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  let flyout;
  let viewMonth = new Date();
  let selected = new Date();

  function closeFlyout() {
    if (flyout) flyout.hidden = true;
  }

  function isFlyoutOpen() {
    return !!(flyout && !flyout.hidden);
  }

  function paintFlyout() {
    if (!flyout) return;
    const todayKey = dateKey(new Date());
    const selKey = dateKey(selected);
    const items = calendarFor(selected);
    const cells = buildMonthGrid(viewMonth);
    flyout.innerHTML = `
      <div class="os-cal-card">
        <div class="os-cal-now">${escapeHtml(new Date().toLocaleString((window.OS && window.OS.lang) === "pt" ? "pt-BR" : (window.OS && window.OS.lang) === "ja" ? "ja-JP" : "en-US", { weekday: "long", month: "long", day: "numeric" }))}</div>
        <div class="os-cal-nav">
          <button type="button" data-cal-nav="-1" aria-label="${escapeHtml(t("calPrev"))}">‹</button>
          <strong>${escapeHtml(monthTitle(viewMonth))}</strong>
          <button type="button" data-cal-nav="1" aria-label="${escapeHtml(t("calNext"))}">›</button>
        </div>
        <div class="os-cal-week">${weekdayLabels().map((d) => `<span>${escapeHtml(d)}</span>`).join("")}</div>
        <div class="os-cal-grid">${cells
          .map((d) => {
            if (!d) return `<span class="os-cal-empty"></span>`;
            const key = dateKey(d);
            const marked = calendarItems().some((item) => item && item.date === key);
            const cls = [
              "os-cal-day",
              key === todayKey ? "today" : "",
              key === selKey ? "selected" : "",
              marked ? "marked" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return `<button type="button" class="${cls}" data-cal-day="${key}">${d.getDate()}</button>`;
          })
          .join("")}</div>
        <div class="os-cal-items">${
          items.length
            ? items
                .map(
                  (item) => `<div class="os-cal-item" data-cal-id="${escapeHtml(item.id)}">
              <strong>${escapeHtml(item.time ? item.time + " · " : "")}${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.kind === "note" ? t("calNote") : t("calEvent"))}</span>
            </div>`
                )
                .join("")
            : `<p class="muted">${escapeHtml(t("calEmpty"))}</p>`
        }</div>
        <form class="os-cal-form">
          <input name="title" maxlength="80" placeholder="${escapeHtml(t("calTitle"))}" required>
          <div class="os-cal-form-row">
            <select name="kind">
              <option value="event">${escapeHtml(t("calEvent"))}</option>
              <option value="note">${escapeHtml(t("calNote"))}</option>
            </select>
            <input name="time" type="time">
          </div>
          <textarea name="notes" rows="2" placeholder="${escapeHtml(t("calNotes"))}"></textarea>
          <button type="submit" class="os-cal-save">${escapeHtml(t("calSave"))}</button>
        </form>
        <button type="button" class="os-cal-open" data-open-calendar>${escapeHtml(t("calOpenApp"))}</button>
      </div>`;
  }

  function openFlyout() {
    if (!flyout) return;
    selected = new Date();
    viewMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
    paintFlyout();
    flyout.hidden = false;
  }

  function toggleFlyout() {
    if (isFlyoutOpen()) closeFlyout();
    else openFlyout();
  }

  function initFlyout() {
    flyout = document.getElementById("os-cal-flyout");
    const clock = document.getElementById("clock");
    if (!flyout || !clock) return;
    clock.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.OSStart) {
        window.OSStart.close();
        window.OSStart.closeContext();
      }
      if (window.OSTray) window.OSTray.closeAll();
      toggleFlyout();
    });
    flyout.addEventListener("click", (e) => e.stopPropagation());
    flyout.addEventListener("click", (e) => {
      const nav = e.target.closest("[data-cal-nav]");
      if (nav) {
        viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + Number(nav.dataset.calNav), 1);
        paintFlyout();
        return;
      }
      const day = e.target.closest("[data-cal-day]");
      if (day) {
        selected = new Date(day.dataset.calDay + "T00:00:00");
        paintFlyout();
        return;
      }
      if (e.target.closest("[data-open-calendar]")) {
        closeFlyout();
        if (window.OSWindows) window.OSWindows.open("calendar");
      }
    });
    flyout.addEventListener("submit", (e) => {
      const form = e.target.closest(".os-cal-form");
      if (!form) return;
      e.preventDefault();
      const data = new FormData(form);
      addCalendar({
        date: selected,
        title: data.get("title"),
        time: data.get("time"),
        notes: data.get("notes"),
        kind: data.get("kind"),
      });
      paintFlyout();
      if (window.OSWidgets) window.OSWidgets.refresh();
    });
    document.addEventListener("click", () => closeFlyout());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeFlyout();
    });
    onChange(() => {
      if (isFlyoutOpen()) paintFlyout();
    });
  }

  return {
    onChange,
    dateKey,
    weekdayLabels,
    monthTitle,
    buildMonthGrid,
    calendarItems,
    calendarFor,
    addCalendar,
    updateCalendar,
    removeCalendar,
    stickies,
    addSticky,
    updateSticky,
    removeSticky,
    browserState,
    saveBrowser,
    closeFlyout,
    isFlyoutOpen,
    initFlyout,
    nid,
  };
})();
