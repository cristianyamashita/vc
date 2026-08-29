window.OSFileClient = (function () {
  function host() {
    try {
      if (window.parent && window.parent !== window && window.parent.OSFS) return window.parent;
    } catch (_err) {}
    return null;
  }

  function extOfName(name) {
    const text = String(name || "");
    const i = text.lastIndexOf(".");
    if (i <= 0) return "";
    return text.slice(i + 1).toLowerCase();
  }

  function stripExt(name) {
    const text = String(name || "");
    const i = text.lastIndexOf(".");
    if (i <= 0) return text;
    return text.slice(0, i);
  }

  function connect(spec) {
    spec = spec || {};
    const h = host();
    if (!h) {
      return {
        hosted: false,
        openPicker: async function () {},
        save: async function () {},
        saveAs: async function () {},
        loadId: async function () {},
        reloadPending: async function () { return false; },
        pendingId: function () { return null; },
        currentId: function () { return null; },
      };
    }

    let fileId = null;
    let loading = false;
    let queued = null;

    function currentWin() {
      if (!h.OSWindows || !h.OSWindows.list) return null;
      return (
        h.OSWindows.list().find(function (w) {
          const iframe = w.el && w.el.querySelector("iframe");
          try {
            return iframe && iframe.contentWindow === window;
          } catch (_err) {
            return false;
          }
        }) ||
        h.OSWindows.list().find(function (w) {
          return w.appId === spec.appId || w.id === spec.appId;
        }) ||
        null
      );
    }

    function pendingId() {
      const win = currentWin();
      return (win && win.fileId) || fileId || null;
    }

    function remember(id) {
      fileId = id || null;
      const win = currentWin();
      if (win) win.fileId = fileId;
    }

    async function loadId(id) {
      if (!id) return false;
      queued = id;
      if (loading) return false;
      loading = true;
      try {
        while (queued) {
          const current = queued;
          queued = null;
          const fs = h.OSFS;
          await fs.ready();
          if (queued) continue;
          const node = await fs.get(current);
          if (!node || node.kind !== "file") continue;
          const blob = await fs.getBlob(current);
          if (!blob) continue;
          remember(current);
          if (h.OS && typeof h.OS.rememberRecentFile === "function") {
            h.OS.rememberRecentFile(current, spec.appId, node.name);
          }
          if (spec.load) await spec.load(blob, node);
        }
        return true;
      } finally {
        loading = false;
        if (queued) loadId(queued);
      }
    }

    function reloadPending() {
      const id = pendingId();
      if (!id) return Promise.resolve(false);
      return loadId(id);
    }

    async function writeTo(parentId, name, payload) {
      const fs = h.OSFS;
      await fs.ready();
      const kids = await fs.list(parentId);
      const existing = kids.find(function (n) {
        return n.kind === "file" && n.name.toLowerCase() === name.toLowerCase();
      });
      const mime = payload.mime || (payload.blob && payload.blob.type) || undefined;
      let node;
      if (existing) node = await fs.writeFile(existing.id, payload.blob, mime ? { mime: mime } : undefined);
      else node = await fs.createFile(parentId, { name: name, mime: mime, blob: payload.blob });
      remember(node.id);
      if (h.OS && typeof h.OS.rememberRecentFile === "function") {
        h.OS.rememberRecentFile(node.id, spec.appId, node.name);
      }
      return node;
    }

    async function save() {
      if (!spec.serialize) return null;
      const payload = await spec.serialize();
      if (!payload || !payload.blob) return null;
      const fs = h.OSFS;
      await fs.ready();
      let node = fileId ? await fs.get(fileId) : null;
      if (node && node.kind === "file") {
        const mime = payload.mime || payload.blob.type || undefined;
        node = await fs.writeFile(node.id, payload.blob, mime ? { mime: mime } : undefined);
        remember(node.id);
        return node;
      }
      return saveAs(payload);
    }

    async function saveAs(payload) {
      payload = payload || (spec.serialize ? await spec.serialize() : null);
      if (!payload || !payload.blob || !h.OSFilePicker) return null;
      const picked = await h.OSFilePicker.saveAs({
        defaultName: payload.name || spec.defaultName || "untitled",
        ext: spec.defaultExt || extOfName(payload.name) || "",
      });
      if (!picked) return null;
      return writeTo(picked.parentId, picked.name, payload);
    }

    async function openPicker() {
      if (!h.OSFilePicker) return;
      const node = await h.OSFilePicker.open({
        exts: spec.exts || [],
        title: spec.openTitle,
      });
      if (node) await loadId(node.id);
    }

    window.addEventListener("message", function (e) {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.type === "os-file-open" && e.data.fileId) loadId(e.data.fileId);
    });

    reloadPending();

    return {
      hosted: true,
      openPicker: openPicker,
      save: save,
      saveAs: saveAs,
      loadId: loadId,
      reloadPending: reloadPending,
      pendingId: pendingId,
      currentId: function () {
        return fileId;
      },
      remember: remember,
      host: h,
    };
  }

  return {
    host: host,
    isHosted: function () {
      return !!host();
    },
    connect: connect,
    extOfName: extOfName,
    stripExt: stripExt,
  };
})();
