// Left panel: the project as a tree (sun, terrain, site objects, buildings
// → storeys → floors / walls → openings / objects) with lock and
// visibility toggles and a search box.
import { propDocSync } from "../props.js";

export class Tree {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.collapsed = new Set();
    this.query = "";
    root.addEventListener("click", (e) => this.onClick(e));
  }
  label(type, item, index) {
    const t = this.app.t, lang = this.app.lang;
    if (item.name) return item.name;
    switch (type) {
      case "building": return `${t("building")} ${index + 1}`;
      case "siteWall": return `${t("siteWall")} ${index + 1}`;
      case "storey": return `${t("storey")} ${index + 1}`;
      case "floorGroup": return `${t("floor")} ${index + 1}`;
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
  render() {
    const { project, state } = this.app;
    const t = this.app.t;
    const rows = [];
    const sel = state.selection;
    const q = this.query.trim().toLowerCase();
    const row = (id, type, text, depth, opts = {}) => {
      if (q && !text.toLowerCase().includes(q) && !opts.always) return;
      const locked = opts.locked ?? false;
      const caret = opts.children ? `<button class="caret" data-toggle="${opts.children}" aria-label="toggle">${this.collapsed.has(opts.children) ? "▸" : "▾"}</button>` : `<span class="caret"></span>`;
      const lock = opts.lockable ? `<button class="mini ${locked ? "on" : ""}" data-lock="${id}" title="${t("lock")}">${locked ? "🔒" : "🔓"}</button>` : "";
      const eye = opts.visibleToggle ? `<button class="mini ${opts.visible ? "" : "off"}" data-eye="${id}" title="${t("visible")}">${opts.visible ? "👁" : "⊘"}</button>` : "";
      rows.push(
        `<div class="trow ${sel === id ? "selected" : ""} ${opts.active ? "active" : ""} ${opts.hidden ? "muted" : ""}" data-id="${id}" data-type="${type}" style="--depth:${q ? 0 : depth}">${caret}<span class="ticon">${opts.icon || ""}</span><span class="tlabel">${escapeHtml(text)}</span>${eye}${lock}</div>`,
      );
    };
    const open = (key) => q || !this.collapsed.has(key);
    row("sun", "sun", t("sun"), 0, { icon: "☀", always: true });
    row("terrain", "terrain", t("terrain"), 0, { icon: "⛰", lockable: true, locked: project.terrain.locked, always: true });
    row("site", "site", `${t("siteObjects")} (${project.objects.length})`, 0, { icon: "🌳", children: "site", always: true });
    if (open("site")) project.objects.forEach((o, i) => row(o.id, "object", this.label("object", o, i), 1, { icon: "▫", lockable: true, locked: o.locked }));
    row("outdoorList", "site", `${t("outdoor")} (${project.outdoor.length})`, 0, { icon: "🪵", children: "outdoor", always: true });
    if (open("outdoor")) project.outdoor.forEach((d, i) => row(d.id, "outdoor", this.label("outdoor", d, i), 1, { icon: { pool: "💧", path: "〰", pond: "🌊", stream: "💦" }[d.type] || "▭", lockable: true, locked: d.locked }));
    row("gardenList", "site", `${t("garden")} (${project.gardenPatches.length})`, 0, { icon: "🌿", children: "garden", always: true });
    if (open("garden")) project.gardenPatches.forEach((g, i) => row(g.id, "garden", this.label("garden", g, i), 1, { icon: "▧", lockable: true, locked: g.locked }));
    row("fenceList", "site", `${t("fences")} (${project.fences.length})`, 0, { icon: "🪧", children: "fences", always: true });
    if (open("fences"))
      project.fences.forEach((f, i) => {
        row(f.id, "fence", this.label("fence", f, i), 1, { icon: "⫴", lockable: true, locked: f.locked });
        f.gates.forEach((g, gi) => row(g.id, "gate", this.label("gate", g, gi), 2, { icon: "⊏", lockable: true, locked: g.locked }));
      });
    row("siteWallList", "site", `${t("siteWalls")} (${project.siteWalls.length})`, 0, { icon: "🧱", children: "siteWalls", always: true });
    if (open("siteWalls"))
      project.siteWalls.forEach((w, i) => {
        row(w.id, "siteWall", this.label("siteWall", w, i), 1, { icon: "▬", lockable: true, locked: w.locked });
        w.gates.forEach((g, gi) => row(g.id, "gate", this.label("gate", g, gi), 2, { icon: "⊏", lockable: true, locked: g.locked }));
      });
    const notes = project.notes || [];
    row("noteList", "site", `${t("notes")} (${notes.length})`, 0, { icon: "📌", children: "notes", always: true });
    if (open("notes")) notes.forEach((n, i) => row(n.id, "note", this.label("note", n, i), 1, { icon: n.done ? "☑" : "☐", hidden: n.done }));
    project.buildings.forEach((b, bi) => {
      const bkey = `b:${b.id}`;
      row(b.id, "building", this.label("building", b, bi), 0, { icon: "🏠", children: bkey, lockable: true, locked: b.locked, active: b.id === state.activeBuilding, always: true });
      if (!open(bkey)) return;
      row(`roof:${b.id}`, "roof", `${t("roof")} · ${t(`roof_${b.roof.type}`)}`, 1, { icon: "⌂", lockable: true, locked: b.roof.locked, visibleToggle: true, visible: b.roof.visible, hidden: !b.roof.visible });
      b.storeys.forEach((s, si) => {
        const skey = `s:${s.id}`;
        const sLocked = b.locked || s.locked;
        row(s.id, "storey", `${this.label("storey", s, si)} · ${s.elevation} cm`, 1, { icon: "▤", children: skey, lockable: true, locked: s.locked, visibleToggle: true, visible: s.visible, active: s.id === state.activeStorey, hidden: !s.visible });
        if (!open(skey)) return;
        const fkey = `f:${s.id}`;
        row(`group:${fkey}`, "group", `${t("floors")} (${s.floorGroups.length})`, 2, { children: fkey, always: true });
        if (open(fkey)) s.floorGroups.forEach((fg, i) => row(fg.id, "floorGroup", `${this.label("floorGroup", fg, i)} · ${fg.tiles.length}`, 3, { icon: "▦", lockable: true, locked: fg.locked, active: fg.id === state.activeFloorGroup }));
        const wkey = `w:${s.id}`;
        row(`group:${wkey}`, "group", `${t("walls")} (${s.walls.length})`, 2, { children: wkey, always: true });
        if (open(wkey))
          s.walls.forEach((w, i) => {
            row(w.id, "wall", this.label("wall", w, i), 3, { icon: "▬", lockable: true, locked: w.locked });
            w.openings.forEach((o, oi) => row(o.id, "opening", this.label("opening", o, oi), 4, { icon: o.type === "door" ? "🚪" : "🪟", lockable: true, locked: o.locked }));
          });
        const stkey = `st:${s.id}`;
        row(`group:${stkey}`, "group", `${t("stairs")} (${s.stairs.length})`, 2, { children: stkey, always: true });
        if (open(stkey)) s.stairs.forEach((st, i) => row(st.id, "stairs", this.label("stairs", st, i), 3, { icon: "🪜", lockable: true, locked: st.locked }));
        const rkey = `r:${s.id}`;
        row(`group:${rkey}`, "group", `${t("railings")} (${s.railings.length})`, 2, { children: rkey, always: true });
        if (open(rkey)) s.railings.forEach((r, i) => row(r.id, "railing", this.label("railing", r, i), 3, { icon: "⫴", lockable: true, locked: r.locked }));
        const okey = `o:${s.id}`;
        row(`group:${okey}`, "group", `${t("objects")} (${s.objects.length})`, 2, { children: okey, always: true });
        if (open(okey)) s.objects.forEach((o, i) => row(o.id, "object", this.label("object", o, i), 3, { icon: "▫", lockable: true, locked: o.locked }));
        void sLocked;
      });
    });
    this.root.innerHTML = rows.join("");
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
    if (type === "group" || type === "site") return;
    this.app.select(type === "roof" ? id.slice(5) : id);
  }
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
