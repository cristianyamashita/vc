// Left panel: the project as a tree (sun, terrain, site objects, buildings
// → storeys → floors / walls → openings / objects) with lock and
// visibility toggles and a search box.
import { propDocSync } from "../props.js";
import { formatArea, roomLabel } from "../rooms.js";
import { TEXT, makeT } from "../i18n.js";

/** Lower case without accents, so "Telhado" finds "telhado" and "Área" finds "area". */
const fold = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export class Tree {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.collapsed = new Set();
    this.query = "";
    this.langs = Object.keys(TEXT);
    this.T = Object.fromEntries(this.langs.map((l) => [l, makeT(() => l)]));
    root.addEventListener("click", (e) => this.onClick(e));
  }
  label(type, item, index, t = this.app.t, lang = this.app.lang) {
    if (item.name) return item.name;
    switch (type) {
      case "building": return `${t("building")} ${index + 1}`;
      case "siteWall": return `${t("siteWall")} ${index + 1}`;
      case "light": return `${t(item.type === "spot" ? "lightSpot" : "lightPoint")} ${index + 1}`;
      case "storey": return `${t("storey")} ${index + 1}`;
      case "floorGroup": return `${t("floor")} ${index + 1}`;
      case "room": return `${t("room")} ${index + 1}`;
      case "wall": return `${t("wall")} ${index + 1}`;
      case "opening": return `${t(item.type === "door" ? "door" : "window")} ${index + 1}`;
      case "stairs": return `${t("stairs")} ${index + 1} · ${t(`shape_${item.shape}`)}`;
      case "outdoor": return `${t(item.type)} ${index + 1}`;
      case "garden": return `${t("gardenPatch")} ${index + 1}`;
      case "railing": case "fence": return `${t(type)} ${index + 1} · ${t(`style_${item.style}`)}`;
      case "gate": return `${t(`gate_${item.type}`)} ${index + 1}`;
      case "note": return `${index + 1}. ${item.text ? item.text.slice(0, 40) : t("note")}`;
      case "object": {
        const doc = item.inline || propDocSync(item.prop);
        return doc ? doc.name[lang] || doc.name.en || item.prop : item.prop || t("object");
      }
      default: return t(type);
    }
  }
  /** A row text in the current language plus its wording in every language, so the search matches any of them. */
  multi(fn) {
    return { text: fn(this.app.t, this.app.lang), all: this.langs.map((l) => fn(this.T[l], l)) };
  }
  render() {
    const { project, state } = this.app;
    const t = this.app.t;
    const rows = [];
    this.keys = new Set(); // every collapsible node seen in this render
    const sel = state.selection;
    const q = fold(this.query.trim());
    const row = (id, type, text, depth, opts = {}) => {
      if (opts.children) this.keys.add(opts.children);
      const m = typeof text === "string" ? { text, all: [text] } : text;
      rows.push({ id, type, text: m.text, all: m.all, depth, opts });
    };
    const open = (key) => q || !this.collapsed.has(key);
    const L = (type, item, index) => this.multi((tt, lang) => this.label(type, item, index, tt, lang));
    row("sun", "sun", this.multi((tt) => tt("sun")), 0, { icon: "☀" });
    row("terrain", "terrain", this.multi((tt) => tt("terrain")), 0, { icon: "⛰", lockable: true, locked: project.terrain.locked });
    row("site", "site", this.multi((tt) => `${tt("siteObjects")} (${project.objects.length})`), 0, { icon: "🌳", children: "site" });
    if (open("site")) project.objects.forEach((o, i) => row(o.id, "object", L("object", o, i), 1, { icon: "▫", lockable: true, locked: o.locked }));
    row("lightList", "site", this.multi((tt) => `${tt("lights")} (${(project.lights || []).length})`), 0, { icon: "💡", children: "siteLights" });
    if (open("siteLights")) (project.lights || []).forEach((l, i) => row(l.id, "light", L("light", l, i), 1, { icon: "✦", lockable: true, locked: l.locked }));
    row("outdoorList", "site", this.multi((tt) => `${tt("outdoor")} (${project.outdoor.length})`), 0, { icon: "🪵", children: "outdoor" });
    if (open("outdoor")) project.outdoor.forEach((d, i) => row(d.id, "outdoor", L("outdoor", d, i), 1, { icon: { pool: "💧", path: "〰", pond: "🌊", stream: "💦" }[d.type] || "▭", lockable: true, locked: d.locked }));
    row("gardenList", "site", this.multi((tt) => `${tt("garden")} (${project.gardenPatches.length})`), 0, { icon: "🌿", children: "garden" });
    if (open("garden")) project.gardenPatches.forEach((g, i) => row(g.id, "garden", L("garden", g, i), 1, { icon: "▧", lockable: true, locked: g.locked }));
    row("fenceList", "site", this.multi((tt) => `${tt("fences")} (${project.fences.length})`), 0, { icon: "🪧", children: "fences" });
    if (open("fences"))
      project.fences.forEach((f, i) => {
        row(f.id, "fence", L("fence", f, i), 1, { icon: "⫴", lockable: true, locked: f.locked });
        f.gates.forEach((g, gi) => row(g.id, "gate", L("gate", g, gi), 2, { icon: "⊏", lockable: true, locked: g.locked }));
      });
    row("siteWallList", "site", this.multi((tt) => `${tt("siteWalls")} (${project.siteWalls.length})`), 0, { icon: "🧱", children: "siteWalls" });
    if (open("siteWalls"))
      project.siteWalls.forEach((w, i) => {
        row(w.id, "siteWall", L("siteWall", w, i), 1, { icon: "▬", lockable: true, locked: w.locked });
        w.gates.forEach((g, gi) => row(g.id, "gate", L("gate", g, gi), 2, { icon: "⊏", lockable: true, locked: g.locked }));
      });
    const notes = project.notes || [];
    row("noteList", "site", this.multi((tt) => `${tt("notes")} (${notes.length})`), 0, { icon: "📌", children: "notes" });
    if (open("notes")) notes.forEach((n, i) => row(n.id, "note", L("note", n, i), 1, { icon: n.done ? "☑" : "☐", hidden: n.done }));
    project.buildings.forEach((b, bi) => {
      const bkey = `b:${b.id}`;
      row(b.id, "building", L("building", b, bi), 0, { icon: "🏠", children: bkey, lockable: true, locked: b.locked, active: b.id === state.activeBuilding });
      if (!open(bkey)) return;
      row(`roof:${b.id}`, "roof", this.multi((tt) => `${tt("roof")} · ${tt(`roof_${b.roof.type}`)}`), 1, { icon: "⌂", lockable: true, locked: b.roof.locked, visibleToggle: true, visible: b.roof.visible, hidden: !b.roof.visible });
      b.storeys.forEach((s, si) => {
        const skey = `s:${s.id}`;
        row(s.id, "storey", this.multi((tt, lang) => `${this.label("storey", s, si, tt, lang)} · ${s.elevation} cm`), 1, { icon: "▤", children: skey, lockable: true, locked: s.locked, visibleToggle: true, visible: s.visible, active: s.id === state.activeStorey, hidden: !s.visible });
        if (!open(skey)) return;
        const fkey = `f:${s.id}`;
        row(`group:${fkey}`, "group", this.multi((tt) => `${tt("floors")} (${s.floorGroups.length})`), 2, { children: fkey });
        if (open(fkey)) s.floorGroups.forEach((fg, i) => row(fg.id, "floorGroup", this.multi((tt, lang) => `${this.label("floorGroup", fg, i, tt, lang)} · ${fg.tiles.length}`), 3, { icon: "▦", lockable: true, locked: fg.locked, active: fg.id === state.activeFloorGroup }));
        const rmkey = `rm:${s.id}`;
        row(`group:${rmkey}`, "group", this.multi((tt) => `${tt("rooms")} (${s.rooms.length})`), 2, { children: rmkey });
        if (open(rmkey))
          s.rooms.forEach((r, i) => {
            const face = this.app.roomFace(r.id);
            row(r.id, "room", this.multi((tt, lang) => `${roomLabel(r, s, tt, r.name ? "" : this.app.roomAutoName(r, s, tt))}${face ? ` · ${formatArea(face.area, lang)}` : ""}`), 3, { icon: "⬚", lockable: true, locked: r.locked });
          });
        const wkey = `w:${s.id}`;
        row(`group:${wkey}`, "group", this.multi((tt) => `${tt("walls")} (${s.walls.length})`), 2, { children: wkey });
        if (open(wkey))
          s.walls.forEach((w, i) => {
            row(w.id, "wall", L("wall", w, i), 3, { icon: "▬", lockable: true, locked: w.locked });
            w.openings.forEach((o, oi) => row(o.id, "opening", L("opening", o, oi), 4, { icon: o.type === "door" ? "🚪" : "🪟", lockable: true, locked: o.locked }));
          });
        const stkey = `st:${s.id}`;
        row(`group:${stkey}`, "group", this.multi((tt) => `${tt("stairs")} (${s.stairs.length})`), 2, { children: stkey });
        if (open(stkey)) s.stairs.forEach((st, i) => row(st.id, "stairs", L("stairs", st, i), 3, { icon: "🪜", lockable: true, locked: st.locked }));
        const rkey = `r:${s.id}`;
        row(`group:${rkey}`, "group", this.multi((tt) => `${tt("railings")} (${s.railings.length})`), 2, { children: rkey });
        if (open(rkey)) s.railings.forEach((r, i) => row(r.id, "railing", L("railing", r, i), 3, { icon: "⫴", lockable: true, locked: r.locked }));
        const okey = `o:${s.id}`;
        row(`group:${okey}`, "group", this.multi((tt) => `${tt("objects")} (${s.objects.length})`), 2, { children: okey });
        if (open(okey)) s.objects.forEach((o, i) => row(o.id, "object", L("object", o, i), 3, { icon: "▫", lockable: true, locked: o.locked }));
        const lkey = `l:${s.id}`;
        row(`group:${lkey}`, "group", this.multi((tt) => `${tt("lights")} (${(s.lights || []).length})`), 2, { children: lkey });
        if (open(lkey)) (s.lights || []).forEach((l, i) => row(l.id, "light", L("light", l, i), 3, { icon: "✦", lockable: true, locked: l.locked }));
      });
    });
    // searching: keep the rows that match in any language and every row above them, so a roof is listed under its house
    let shown = rows;
    if (q) {
      const keep = rows.map((r) => r.all.some((s) => fold(s).includes(q)));
      for (let i = rows.length - 1; i >= 0; i--) {
        if (!keep[i]) continue;
        let d = rows[i].depth;
        for (let j = i - 1; j >= 0 && d > 0; j--) if (rows[j].depth < d) { keep[j] = true; d = rows[j].depth; }
      }
      shown = rows.filter((_, i) => keep[i]);
    }
    const html = shown.map(({ id, type, text, depth, opts }) => {
      const locked = opts.locked ?? false;
      const caret = opts.children ? `<button class="caret" data-toggle="${opts.children}" aria-label="toggle">${!q && this.collapsed.has(opts.children) ? "▸" : "▾"}</button>` : `<span class="caret"></span>`;
      const lock = opts.lockable ? `<button class="mini ${locked ? "on" : ""}" data-lock="${id}" title="${t("lock")}">${locked ? "🔒" : "🔓"}</button>` : "";
      const eye = opts.visibleToggle ? `<button class="mini ${opts.visible ? "" : "off"}" data-eye="${id}" title="${t("visible")}">${opts.visible ? "👁" : "⊘"}</button>` : "";
      return `<div class="trow ${sel === id ? "selected" : ""} ${opts.active ? "active" : ""} ${opts.hidden ? "muted" : ""} ${type === "group" || type === "site" ? "group" : ""}" data-id="${id}" data-type="${type}" ${opts.children ? `data-children="${opts.children}"` : ""} style="--depth:${depth}">${caret}<span class="ticon">${opts.icon || ""}</span><span class="tlabel">${escapeHtml(text)}</span>${eye}${lock}</div>`;
    });
    this.root.innerHTML = html.length ? html.join("") : `<p class="hint">${escapeHtml(t("noResults"))}</p>`;
    const selected = this.root.querySelector(".trow.selected");
    if (selected) selected.scrollIntoView({ block: "nearest" });
  }
  onClick(e) {
    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      const k = toggle.dataset.toggle;
      if (this.collapsed.has(k)) this.collapsed.delete(k);
      else this.collapsed.add(k);
      this.render();
      return;
    }
    const lock = e.target.closest("[data-lock]");
    if (lock) {
      this.app.toggleLock(lock.dataset.lock);
      return;
    }
    const eye = e.target.closest("[data-eye]");
    if (eye) {
      this.app.toggleVisible(eye.dataset.eye);
      return;
    }
    const row = e.target.closest(".trow");
    if (!row) return;
    const id = row.dataset.id, type = row.dataset.type;
    if (type === "group" || type === "site") {
      // a heading row toggles its children when clicked anywhere
      if (row.dataset.children) this.toggle(row.dataset.children);
      return;
    }
    this.app.select(type === "roof" ? id.slice(5) : id);
  }
  toggle(key) {
    if (this.collapsed.has(key)) this.collapsed.delete(key);
    else this.collapsed.add(key);
    this.render();
  }
  /** Fold every node that has children (the top-level headings stay listed). */
  collapseAll() {
    if (!this.keys) this.render();
    for (const k of this.keys) this.collapsed.add(k);
    this.render();
  }
  expandAll() {
    this.collapsed.clear();
    this.render();
  }
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
