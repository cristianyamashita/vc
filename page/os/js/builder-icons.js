window.OSBuilderIcons = (function () {
  const COLORS = {
    teal: { bg: "#008f7d", dark: "#006056" },
    blue: { bg: "#2b6cb0", dark: "#1a4971" },
    orange: { bg: "#dd6b20", dark: "#9c4221" },
  };
  const W = "#ffffff";

  function bg(p) {
    return `<rect width="32" height="32" rx="7" fill="${p.bg}"/>`;
  }

  const GLYPHS = {
    globe: (p) =>
      `${bg(p)}<circle cx="16" cy="16" r="8" fill="none" stroke="${W}" stroke-width="1.8"/><ellipse cx="16" cy="16" rx="3.5" ry="8" fill="none" stroke="${W}" stroke-width="1.4"/><path d="M8 16h16M10 12h12M10 20h12" fill="none" stroke="${W}" stroke-width="1.4"/>`,
    code: (p) =>
      `${bg(p)}<path d="M12 10l-5 6 5 6M20 10l5 6-5 6M18 9l-4 14" fill="none" stroke="${W}" stroke-width="1.8" stroke-linecap="round"/>`,
    terminal: (p) =>
      `${bg(p)}<rect x="6" y="8" width="20" height="16" rx="2" fill="${p.dark}"/><path d="M9 13l4 3-4 3M15 19h8" fill="none" stroke="${W}" stroke-width="1.6" stroke-linecap="round"/>`,
    document: (p) =>
      `${bg(p)}<path d="M10 7h8l6 6v12H10z" fill="${W}"/><path d="M18 7v6h6" fill="${p.dark}"/><rect x="13" y="16" width="8" height="1.4" fill="${p.dark}"/><rect x="13" y="19" width="6" height="1.4" fill="${p.dark}"/>`,
    notes: (p) =>
      `${bg(p)}<rect x="8" y="7" width="16" height="18" rx="2" fill="${W}"/><rect x="11" y="6" width="3" height="4" rx="0.5" fill="${p.dark}"/><rect x="18" y="6" width="3" height="4" rx="0.5" fill="${p.dark}"/><rect x="11" y="13" width="10" height="1.5" fill="${p.dark}"/><rect x="11" y="17" width="8" height="1.5" fill="${p.dark}"/>`,
    checklist: (p) =>
      `${bg(p)}<rect x="7" y="8" width="5" height="5" rx="1" fill="${W}"/><path d="M8.2 10.6l1.3 1.3 2.4-2.6" fill="none" stroke="${p.dark}" stroke-width="1.3"/><rect x="14" y="9.5" width="11" height="2" fill="${W}"/><rect x="7" y="16" width="5" height="5" rx="1" fill="${W}"/><rect x="14" y="17.5" width="11" height="2" fill="${W}"/>`,
    calendar: (p) =>
      `${bg(p)}<rect x="7" y="9" width="18" height="15" rx="2" fill="${W}"/><rect x="7" y="9" width="18" height="5" fill="${p.dark}"/><rect x="11" y="7" width="2" height="4" rx="0.5" fill="${W}"/><rect x="19" y="7" width="2" height="4" rx="0.5" fill="${W}"/><rect x="10" y="17" width="3" height="3" fill="${p.dark}"/><rect x="15" y="17" width="3" height="3" fill="${p.dark}"/>`,
    clock: (p) =>
      `${bg(p)}<circle cx="16" cy="16" r="8.5" fill="${W}"/><circle cx="16" cy="16" r="1.3" fill="${p.dark}"/><path d="M16 11.5V16l3.5 2.2" fill="none" stroke="${p.dark}" stroke-width="1.6" stroke-linecap="round"/>`,
    chat: (p) =>
      `${bg(p)}<path d="M8 9h16a2 2 0 012 2v8a2 2 0 01-2 2h-6l-4 4v-4H8a2 2 0 01-2-2v-8a2 2 0 012-2z" fill="${W}"/><circle cx="12" cy="15" r="1.2" fill="${p.dark}"/><circle cx="16" cy="15" r="1.2" fill="${p.dark}"/><circle cx="20" cy="15" r="1.2" fill="${p.dark}"/>`,
    mail: (p) =>
      `${bg(p)}<rect x="6" y="10" width="20" height="13" rx="2" fill="${W}"/><path d="M7 11l9 7 9-7" fill="none" stroke="${p.dark}" stroke-width="1.6"/>`,
    folder: (p) =>
      `${bg(p)}<path d="M7 12h6l2 2h10v10H7z" fill="${W}"/><path d="M7 12V10a1.5 1.5 0 011.5-1.5H14L16 12" fill="${p.dark}"/>`,
    bookmark: (p) =>
      `${bg(p)}<path d="M11 7h10v18l-5-4-5 4z" fill="${W}"/>`,
    star: (p) =>
      `${bg(p)}<path d="M16 7l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L16 19.6 10.9 22.2l1.2-5.6L8 12.8l5.6-.6z" fill="${W}"/>`,
    heart: (p) =>
      `${bg(p)}<path d="M16 24s-8-5.2-8-11a4.5 4.5 0 018-3 4.5 4.5 0 018 3c0 5.8-8 11-8 11z" fill="${W}"/>`,
    lightning: (p) =>
      `${bg(p)}<path d="M18 6l-8 11h6l-2 9 10-13h-6z" fill="${W}"/>`,
    puzzle: (p) =>
      `${bg(p)}<path d="M8 8h6v3a2 2 0 104 0V8h6v6h-3a2 2 0 100 4h3v6h-6v-3a2 2 0 10-4 0v3H8v-6h3a2 2 0 100-4H8z" fill="${W}"/>`,
    wrench: (p) =>
      `${bg(p)}<path d="M20 8a5 5 0 00-6.5 6.1L8 19.6 12.4 24l5.5-5.5A5 5 0 0024 12l-3 1-1-1 1-3z" fill="${W}"/>`,
    palette: (p) =>
      `${bg(p)}<path d="M16 7a9 9 0 100 18c1.4 0 2-1.2 2-2.2 0-.7-.4-1.3-1-1.6-.5-.3-.8-.8-.8-1.4 0-.9.7-1.6 1.6-1.6H20a4 4 0 004-4A9 9 0 0016 7z" fill="${W}"/><circle cx="12" cy="13" r="1.3" fill="${p.dark}"/><circle cx="16" cy="11" r="1.3" fill="${p.dark}"/><circle cx="20.5" cy="13.5" r="1.3" fill="${p.dark}"/>`,
    camera: (p) =>
      `${bg(p)}<rect x="6" y="12" width="20" height="12" rx="2" fill="${W}"/><rect x="12" y="9" width="8" height="4" rx="1" fill="${W}"/><circle cx="16" cy="18" r="3.4" fill="${p.dark}"/><circle cx="16" cy="18" r="1.6" fill="${W}"/>`,
    image: (p) =>
      `${bg(p)}<rect x="7" y="8" width="18" height="16" rx="2" fill="${W}"/><circle cx="12.5" cy="13" r="1.8" fill="${p.dark}"/><path d="M8 20l6-6 4 4 3-3 4 5H8z" fill="${p.dark}"/>`,
    music: (p) =>
      `${bg(p)}<path d="M12 22a3 3 0 116 0 3 3 0 01-6 0zm8-14v10.2a3.2 3.2 0 00-2-.6" fill="${W}"/><path d="M20 8l-8 2V12l8-2z" fill="${W}"/>`,
    video: (p) =>
      `${bg(p)}<rect x="6" y="10" width="14" height="12" rx="2" fill="${W}"/><path d="M20 13l6-3v12l-6-3z" fill="${W}"/>`,
    gamepad: (p) =>
      `${bg(p)}<rect x="5" y="12" width="22" height="10" rx="5" fill="${W}"/><rect x="10" y="15.5" width="6" height="1.8" fill="${p.dark}"/><rect x="12.1" y="13.4" width="1.8" height="6" fill="${p.dark}"/><circle cx="21" cy="15.2" r="1.2" fill="${p.dark}"/><circle cx="23.4" cy="17.6" r="1.2" fill="${p.dark}"/>`,
    bars: (p) =>
      `${bg(p)}<rect x="7" y="16" width="4" height="8" fill="${W}"/><rect x="14" y="11" width="4" height="13" fill="${W}"/><rect x="21" y="8" width="4" height="16" fill="${W}"/>`,
    pie: (p) =>
      `${bg(p)}<circle cx="16" cy="16" r="8.5" fill="${W}"/><path d="M16 16V7.5A8.5 8.5 0 0124 20z" fill="${p.dark}"/>`,
    pin: (p) =>
      `${bg(p)}<path d="M16 6a7 7 0 00-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 00-7-7z" fill="${W}"/><circle cx="16" cy="13" r="2.4" fill="${p.dark}"/>`,
    compass: (p) =>
      `${bg(p)}<circle cx="16" cy="16" r="8.5" fill="${W}"/><path d="M16 9l2.8 12L16 19l-2.8 2z" fill="${p.dark}"/>`,
    cloud: (p) =>
      `${bg(p)}<path d="M12 22h11a5 5 0 00.4-10 7 7 0 00-13.4 2.2A4.5 4.5 0 0012 22z" fill="${W}"/>`,
    lock: (p) =>
      `${bg(p)}<rect x="9" y="14" width="14" height="11" rx="2" fill="${W}"/><path d="M12 14v-3a4 4 0 018 0v3" fill="none" stroke="${W}" stroke-width="2"/><circle cx="16" cy="19.5" r="1.6" fill="${p.dark}"/>`,
    key: (p) =>
      `${bg(p)}<circle cx="12" cy="16" r="5" fill="${W}"/><circle cx="12" cy="16" r="1.8" fill="${p.dark}"/><rect x="16" y="14.6" width="9" height="2.8" fill="${W}"/><rect x="22" y="14.6" width="2" height="5" fill="${W}"/>`,
    user: (p) =>
      `${bg(p)}<circle cx="16" cy="12" r="4.2" fill="${W}"/><path d="M8 24c1.2-5 4.2-7.5 8-7.5S22.8 19 24 24z" fill="${W}"/>`,
    group: (p) =>
      `${bg(p)}<circle cx="12" cy="12" r="3.2" fill="${W}"/><circle cx="20" cy="12" r="3.2" fill="${W}"/><path d="M6 24c.8-4 3-6 6-6s5.2 2 6 6M14 24c.8-4 3-6 6-6s5.2 2 6 6" fill="${W}"/>`,
    home: (p) =>
      `${bg(p)}<path d="M6 16l10-9 10 9" fill="none" stroke="${W}" stroke-width="2" stroke-linejoin="round"/><path d="M10 15.5V24h12v-8.5" fill="${W}"/><rect x="14" y="18" width="4" height="6" fill="${p.dark}"/>`,
    search: (p) =>
      `${bg(p)}<circle cx="14" cy="14" r="6" fill="none" stroke="${W}" stroke-width="2"/><path d="M18.5 18.5L25 25" fill="none" stroke="${W}" stroke-width="2.2" stroke-linecap="round"/>`,
    link: (p) =>
      `${bg(p)}<path d="M13 19l-2 2a4 4 0 11-6-6l3-3a4 4 0 015.2-.4M19 13l2-2a4 4 0 116 6l-3 3a4 4 0 01-5.2.4" fill="none" stroke="${W}" stroke-width="1.8" stroke-linecap="round"/><path d="M13 19l6-6" fill="none" stroke="${W}" stroke-width="1.8"/>`,
    download: (p) =>
      `${bg(p)}<path d="M16 7v12" fill="none" stroke="${W}" stroke-width="2.2" stroke-linecap="round"/><path d="M10 15l6 6 6-6" fill="none" stroke="${W}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 25h16" fill="none" stroke="${W}" stroke-width="2" stroke-linecap="round"/>`,
    upload: (p) =>
      `${bg(p)}<path d="M16 21V9" fill="none" stroke="${W}" stroke-width="2.2" stroke-linecap="round"/><path d="M10 13l6-6 6 6" fill="none" stroke="${W}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 25h16" fill="none" stroke="${W}" stroke-width="2" stroke-linecap="round"/>`,
    database: (p) =>
      `${bg(p)}<ellipse cx="16" cy="9" rx="8" ry="3.2" fill="${W}"/><path d="M8 9v14c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V9" fill="none" stroke="${W}" stroke-width="1.8"/><path d="M8 16c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2" fill="none" stroke="${W}" stroke-width="1.8"/>`,
    cube: (p) =>
      `${bg(p)}<path d="M16 7l9 5v9l-9 5-9-5v-9z" fill="${W}"/><path d="M16 7v9l9 5M16 16L7 21" fill="none" stroke="${p.dark}" stroke-width="1.4"/>`,
    layers: (p) =>
      `${bg(p)}<path d="M16 6l10 5-10 5L6 11z" fill="${W}"/><path d="M7 16l9 4.5 9-4.5" fill="none" stroke="${W}" stroke-width="1.8"/><path d="M7 21l9 4.5 9-4.5" fill="none" stroke="${W}" stroke-width="1.8"/>`,
    grid: (p) =>
      `${bg(p)}<rect x="7" y="7" width="7" height="7" rx="1.2" fill="${W}"/><rect x="18" y="7" width="7" height="7" rx="1.2" fill="${W}"/><rect x="7" y="18" width="7" height="7" rx="1.2" fill="${W}"/><rect x="18" y="18" width="7" height="7" rx="1.2" fill="${W}"/>`,
    window: (p) =>
      `${bg(p)}<rect x="7" y="8" width="18" height="16" rx="2" fill="${W}"/><rect x="7" y="8" width="18" height="4" fill="${p.dark}"/><rect x="9" y="14" width="7" height="6" fill="${p.bg}"/>`,
    megaphone: (p) =>
      `${bg(p)}<path d="M8 14h4l10-6v16L12 18H8a2 2 0 01-2-2v0a2 2 0 012-2z" fill="${W}"/><path d="M8 18v4h4" fill="none" stroke="${W}" stroke-width="1.8"/>`,
    flask: (p) =>
      `${bg(p)}<path d="M13 6h6v5l5 11H8l5-11z" fill="${W}"/><rect x="13" y="6" width="6" height="3" fill="${W}"/><path d="M11 18h10" fill="none" stroke="${p.dark}" stroke-width="1.5"/>`,
    rocket: (p) =>
      `${bg(p)}<path d="M16 5c4 4 5 10 4 14l-4 1-4-1c-1-4 0-10 4-14z" fill="${W}"/><circle cx="16" cy="13" r="2" fill="${p.dark}"/><path d="M10 20l-3 5 6-2M22 20l3 5-6-2" fill="${W}"/>`,
    wand: (p) =>
      `${bg(p)}<path d="M8 24l12-12" fill="none" stroke="${W}" stroke-width="2.2" stroke-linecap="round"/><path d="M20 8l2 2M24 10l2 2M22 6v3M26 14h-3" fill="none" stroke="${W}" stroke-width="1.6" stroke-linecap="round"/><rect x="17.5" y="8.5" width="6" height="6" rx="1" transform="rotate(45 20.5 11.5)" fill="${W}"/>`,
    bag: (p) =>
      `${bg(p)}<path d="M8 12h16l-1.4 12H9.4z" fill="${W}"/><path d="M12 12V10a4 4 0 018 0v2" fill="none" stroke="${W}" stroke-width="1.8"/>`,
    calculator: (p) =>
      `${bg(p)}<rect x="9" y="6" width="14" height="20" rx="2" fill="${W}"/><rect x="11" y="8.5" width="10" height="4" fill="${p.dark}"/><rect x="11" y="15" width="3" height="3" fill="${p.dark}"/><rect x="15.5" y="15" width="3" height="3" fill="${p.dark}"/><rect x="20" y="15" width="3" height="7.5" fill="${p.bg}"/><rect x="11" y="19.5" width="3" height="3" fill="${p.dark}"/><rect x="15.5" y="19.5" width="3" height="3" fill="${p.dark}"/>`,
    book: (p) =>
      `${bg(p)}<path d="M8 8h7c2 0 3 1 3 2v14c0-1-1-2-3-2H8z" fill="${W}"/><path d="M24 8h-7c-2 0-3 1-3 2v14c0-1 1-2 3-2h7z" fill="${W}"/><path d="M16 10v12" fill="none" stroke="${p.dark}" stroke-width="1.4"/>`,
    wifi: (p) =>
      `${bg(p)}<path d="M7 14a13 13 0 0118 0" fill="none" stroke="${W}" stroke-width="2" stroke-linecap="round"/><path d="M10.5 17.5a8 8 0 0111 0" fill="none" stroke="${W}" stroke-width="2" stroke-linecap="round"/><path d="M13.5 21a4 4 0 015 0" fill="none" stroke="${W}" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="24.2" r="1.5" fill="${W}"/>`,
  };

  const IDS = Object.keys(GLYPHS);

  function svgMarkup(id, color) {
    const pal = COLORS[color] || COLORS.teal;
    const glyph = GLYPHS[id] || GLYPHS.globe;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${glyph(pal)}</svg>`;
  }

  function dataUrl(id, color) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgMarkup(id, color));
  }

  function blob(id, color) {
    return new Blob([svgMarkup(id, color)], { type: "image/svg+xml" });
  }

  return { COLORS, IDS, svgMarkup, dataUrl, blob };
})();
