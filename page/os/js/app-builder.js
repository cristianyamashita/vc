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
    if (record.iconType === "url" && record.iconUrl) return record.iconUrl;
    return window.OSBuilderIcons.dataUrl("globe", "teal");
  }

  function revokeIcon(id) {
    const url = iconUrls.get(id);
    if (!url) return;
    URL.revokeObjectURL(url);
    iconUrls.delete(id);
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

  function list() {
    return records.slice();
  }

  function get(id) {
    return records.find((row) => row.id === id) || null;
  }

  async function save(record) {
    if (!isValidRecord(record)) throw new Error("invalid-record");
    revokeIcon(record.id);
    await window.OSState.putUserApp(record);
    await hydrate();
    if (window.OS && window.OS.registerUserApp) window.OS.registerUserApp(record.id, { desktop: false });
    if (window.OSWindows && window.OSWindows.refreshUserApp) window.OSWindows.refreshUserApp(record.id);
    return record;
  }

  async function remove(id) {
    if (!id) return;
    if (window.OS && window.OS.unregisterUserApp) window.OS.unregisterUserApp(id);
    await window.OSState.deleteUserApp(id);
    revokeIcon(id);
    await hydrate();
    if (window.OS && window.OS.refreshChrome) window.OS.refreshChrome();
  }

  return { hydrate, list, get, save, remove, iconUrlFor, toCatalogApp };
})();
