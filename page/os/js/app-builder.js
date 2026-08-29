window.OSAppBuilder = (function () {
  const iconUrls = new Map();
  let records = [];

  function localized(text) {
    const value = String(text || "");
    return { en: value, pt: value, ja: value };
  }

  function myAppsTag() {
    return { en: "My apps", pt: "Meus apps", ja: "マイアプリ" };
  }

  function isValidRecord(row) {
    return (
      row &&
      typeof row.id === "string" &&
      row.id.startsWith("user-") &&
      (row.mode === "url" || row.mode === "html") &&
      typeof row.name === "string"
    );
  }

  function iconUrlFor(record) {
    if (!record) return window.OSBuilderIcons.dataUrl("globe", "teal");
    if (record.iconType === "gallery") {
      return window.OSBuilderIcons.dataUrl(record.galleryId || "globe", record.galleryColor || "teal");
    }
    if (record.iconBlob) {
      if (iconUrls.has(record.id)) return iconUrls.get(record.id);
      const url = URL.createObjectURL(record.iconBlob);
      iconUrls.set(record.id, url);
      return url;
    }
    return window.OSBuilderIcons.dataUrl("globe", "teal");
  }

  function toCatalogApp(record) {
    return {
      id: record.id,
      href: record.mode === "url" ? record.url : null,
      url: record.url || "",
      html: record.html || "",
      icon: iconUrlFor(record),
      kind: "user",
      mode: record.mode,
      uninstallable: true,
      defaultInstalled: true,
      channel: "stable",
      tag: myAppsTag(),
      name: localized(record.name),
      desc: localized(record.desc),
    };
  }

  function syncCatalog() {
    if (window.OSCatalog && window.OSCatalog.setUserApps) {
      window.OSCatalog.setUserApps(records.map(toCatalogApp));
    }
  }

  async function hydrate() {
    try {
      const rows = await window.OSState.listUserApps();
      records = (rows || []).filter(isValidRecord).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } catch (err) {
      console.warn("userApps load failed", err);
      records = [];
    }
    syncCatalog();
  }

  return { hydrate };
})();
