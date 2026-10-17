// Custom object editor: compose primitive parts (box, rounded box,
// cylinder, sphere, cone, torus) on the same canvas, with the same gizmo,
// and save the result as a prop document in IndexedDB. Built-in objects
// are edited as a copy; custom ones in place. Part sizes and positions are
// shown in cm but stored in metres, like every prop document.
import * as THREE from "three";
import { shapeGeometry, registerCustom, unregisterCustom, customIds, propDocSync, invalidateGeometry, catalog } from "./props.js";
import { propChecked, SHAPES, uid, clone } from "./schema.js";
import { invalidateThumb } from "./thumbs.js";
import { surfaceMaterial, textureIndex } from "./materials.js";
import { textureControl } from "./textures.js";
import * as store from "./store.js";

const DEG = Math.PI / 180;
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const r3 = (v) => Math.round(v * 1000) / 1000;
const LAST_COLORS = ["#b9b1a0", "#8d6e4f", "#5f6b73", "#c9202a", "#2e5aa8", "#3f7a3b"];

export class PropEditor {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.root = new THREE.Group();
    this.root.name = "propEditor";
    this.root.visible = false;
    app.scene.scene.add(this.root);
    this.meshes = [];
    this.selected = -1;
    this.undoStack = [];
    this.redoStack = [];
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: 0xcfd6d3, roughness: 1 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.001;
    this.floor.receiveShadow = true;
    this.root.add(this.floor);
  }
  get t() {
    return this.app.t;
  }
  freshDoc() {
    const t = this.t;
    return {
      kind: "prop", version: 1, id: `custom-${uid("p").slice(2)}`,
      name: { en: t("newObject"), pt: t("newObject"), ja: t("newObject") },
      category: "custom", tags: { en: [], pt: [], ja: [] },
      source: { type: "boxes", boxes: [{ w: 0.6, h: 0.4, d: 0.6, x: 0, y: 0.2, z: 0, rx: 0, ry: 0, rz: 0, shape: "box", axis: "y", color: "#b9b1a0", opacity: 1, locked: false }] },
    };
  }
  /** Open the editor on a document (null = new). Built-ins are copied. */
  enter(source = null) {
    const app = this.app;
    if (source) {
      const d = clone(source);
      if (!customIds.has(d.id)) {
        d.id = `custom-${d.id}-${uid("c").slice(2, 8)}`;
        for (const k of ["en", "pt", "ja"]) d.name[k] = `${d.name[k] || d.name.en} (${this.t("copySuffix")})`;
      }
      d.category = d.category && d.category !== "custom" ? d.category : "custom";
      d.tags = d.tags || { en: [], pt: [], ja: [] };
      d.source.boxes = d.source.boxes.filter((b) => !b.hole).map((b) => ({ ...b, locked: !!b.locked }));
      this.doc = propChecked(d);
    } else this.doc = this.freshDoc();
    this.editingId = source && customIds.has(source.id) ? source.id : null;
    this.active = true;
    this.undoStack = [];
    this.redoStack = [];
    app.gizmo.detach();
    app.tools.reset();
    app.scene.world.visible = false;
    app.scene.overlay.visible = false;
    app.sun.roofs.visible = false;
    app.night.group.visible = false;
    app.notes.render();
    app.scene.setToolActive(false);
    this.root.visible = true;
    document.body.classList.add("editing");
    $("#tabs").querySelectorAll("button").forEach((b) => (b.disabled = true));
    this.rebuild();
    this.select(0);
    this.app.gizmo.setMode("translate");
    this.renderToolbar();
    this.refreshPanels();
    this.frame();
  }
  exit() {
    const app = this.app;
    this.active = false;
    app.gizmo.detach();
    this.clearMeshes();
    this.root.visible = false;
    app.scene.world.visible = true;
    app.scene.overlay.visible = true;
    app.sun.roofs.visible = true;
    app.night.group.visible = true;
    document.body.classList.remove("editing");
    $("#tabs").querySelectorAll("button").forEach((b) => (b.disabled = false));
    $("#editor-parts").hidden = true;
    app.setTool(app.state.tool);
    app.refreshAll();
    app.fitAll();
  }
  frame() {
    const box = new THREE.Box3().setFromObject(this.root);
    box.min.y = Math.max(box.min.y, -0.1);
    this.app.scene.fit(box);
  }
  // --------------------------------------------------------------- scene
  clearMeshes() {
    for (const m of this.meshes) {
      this.root.remove(m);
      m.geometry.dispose();
      if (!m.material.userData?.shared) m.material.dispose();
    }
    this.meshes = [];
  }
  /** Material for one part: a shared triplanar one when it has a texture, else its own. */
  partMaterial(b) {
    const op = b.opacity ?? 1;
    if (b.material && textureIndex[b.material] && op >= 1) return surfaceMaterial({ material: b.material, tint: b.color, roughness: 0.8 });
    return new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.8, transparent: op < 1, opacity: op, depthWrite: op >= 1 });
  }
  rebuild() {
    this.clearMeshes();
    this.doc.source.boxes.forEach((b, i) => {
      const m = this.makeMesh(b, i);
      this.root.add(m);
      this.meshes.push(m);
    });
    this.app.scene.requestRender();
  }
  makeMesh(b, i) {
    const op = b.opacity ?? 1;
    const m = new THREE.Mesh(shapeGeometry(b), this.partMaterial(b));
    m.position.set(b.x || 0, b.y || 0, b.z || 0);
    m.rotation.set(b.rx || 0, b.ry || 0, b.rz || 0, "YXZ");
    m.castShadow = op >= 0.7;
    m.receiveShadow = true;
    m.userData = { kind: "part", index: i };
    return m;
  }
  /** Rebuild only one part's mesh (geometry, material and placement). */
  refreshPart(i) {
    const b = this.doc.source.boxes[i], m = this.meshes[i];
    if (!b || !m) return this.rebuild();
    m.geometry.dispose();
    m.geometry = shapeGeometry(b);
    const op = b.opacity ?? 1;
    if (!m.material.userData?.shared) m.material.dispose();
    m.material = this.partMaterial(b);
    m.castShadow = op >= 0.7;
    m.position.set(b.x || 0, b.y || 0, b.z || 0);
    m.rotation.set(b.rx || 0, b.ry || 0, b.rz || 0, "YXZ");
    m.scale.set(1, 1, 1);
    if (i === this.selected) {
      this.app.gizmo.syncProxy();
      this.app.gizmo.refreshHighlight();
    }
    this.app.scene.requestRender();
  }
  // ----------------------------------------------------------- selection
  select(i) {
    const app = this.app;
    this.selected = i;
    const b = this.doc.source.boxes[i], m = this.meshes[i];
    if (!b || !m) {
      this.selected = -1;
      app.gizmo.detach();
      this.refreshPanels();
      return;
    }
    const editor = this;
    const adapter = {
      planar: false, modes: ["translate", "rotate", "scale"], rebuild: "none",
      apply(group, { snapTo }) {
        const step = app.state.snap ? 0.01 : 0.001;
        b.x = r3(snapTo(group.position.x, step));
        b.y = r3(snapTo(group.position.y, step));
        b.z = r3(snapTo(group.position.z, step));
        const turn = app.state.snap ? 15 * DEG : 0.5 * DEG;
        b.rx = r3(snapTo(group.rotation.x, turn));
        b.ry = r3(snapTo(group.rotation.y, turn));
        b.rz = r3(snapTo(group.rotation.z, turn));
        if (app.gizmo.mode === "scale") {
          b.w = r3(Math.max(0.005, b.w * group.scale.x));
          b.h = r3(Math.max(0.005, b.h * group.scale.y));
          b.d = r3(Math.max(0.005, b.d * group.scale.z));
        }
        editor.refreshPart(editor.selected);
        editor.renderPartFields();
      },
    };
    app.gizmo.attach(m, b, this.root, { lockedOnly: !!b.locked, adapter });
    this.refreshPanels();
  }
  pick(e) {
    const hits = this.app.scene.pickObjects(e, this.meshes, false);
    this.select(hits[0] ? hits[0].object.userData.index : -1);
  }
  // ------------------------------------------------------------- editing
  checkpoint() {
    this.undoStack.push(JSON.stringify(this.doc));
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack.length = 0;
  }
  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(this.undoStack.pop());
    this.rebuild();
    this.select(Math.min(this.selected, this.doc.source.boxes.length - 1));
  }
  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.doc));
    this.doc = JSON.parse(this.redoStack.pop());
    this.rebuild();
    this.select(Math.min(this.selected, this.doc.source.boxes.length - 1));
  }
  addPart(shape) {
    this.checkpoint();
    const base = this.doc.source.boxes[this.selected];
    const color = base?.color || LAST_COLORS[this.doc.source.boxes.length % LAST_COLORS.length];
    const size = shape === "sphere" ? 0.3 : 0.4;
    const part = { w: size, h: shape === "cylinder" || shape === "cone" ? 0.6 : size, d: size, x: base ? base.x + 0.3 : 0, y: base ? base.y : size / 2, z: base ? base.z : 0, rx: 0, ry: 0, rz: 0, shape, axis: "y", color, opacity: 1, locked: false };
    if (shape === "cylinder" || shape === "cone") part.y = base ? base.y : 0.3;
    this.doc.source.boxes.push(part);
    this.rebuild();
    this.select(this.doc.source.boxes.length - 1);
  }
  duplicatePart() {
    const b = this.doc.source.boxes[this.selected];
    if (!b) return;
    this.checkpoint();
    const copy = { ...b, x: r3(b.x + b.w), locked: false };
    this.doc.source.boxes.splice(this.selected + 1, 0, copy);
    this.rebuild();
    this.select(this.selected + 1);
  }
  mirrorPart() {
    const b = this.doc.source.boxes[this.selected];
    if (!b) return;
    this.checkpoint();
    const copy = { ...b, x: r3(-b.x), ry: r3(-(b.ry || 0)), rz: r3(-(b.rz || 0)), locked: false };
    this.doc.source.boxes.splice(this.selected + 1, 0, copy);
    this.rebuild();
    this.select(this.selected + 1);
  }
  deletePart() {
    const b = this.doc.source.boxes[this.selected];
    if (!b) return;
    if (b.locked) return this.app.toast(this.t("lockedItem"));
    if (this.doc.source.boxes.length < 2) return this.app.toast(this.t("lastPart"));
    this.checkpoint();
    this.doc.source.boxes.splice(this.selected, 1);
    this.rebuild();
    this.select(Math.min(this.selected, this.doc.source.boxes.length - 1));
  }
  /** Drop the whole object so its lowest point sits on y = 0. */
  ground() {
    this.checkpoint();
    const box = new THREE.Box3();
    for (const m of this.meshes) box.expandByObject(m);
    const dy = -box.min.y;
    for (const b of this.doc.source.boxes) b.y = r3((b.y || 0) + dy);
    this.rebuild();
    this.select(this.selected);
  }
  async save() {
    const app = this.app, t = this.t;
    let doc;
    try {
      doc = propChecked(this.doc);
    } catch {
      return app.toast(t("importError"));
    }
    if (!doc.name.en.trim()) doc.name.en = t("newObject");
    for (const k of ["pt", "ja"]) if (!doc.name[k].trim()) doc.name[k] = doc.name.en;
    doc.updatedAt = new Date().toISOString();
    try {
      await store.saveCustomProp(doc);
    } catch (err) {
      console.warn(err);
      return app.toast(t("unsaved"));
    }
    invalidateGeometry(doc.id);
    invalidateThumb(doc.id);
    registerCustom(doc);
    const i = app.customProps.findIndex((p) => p.id === doc.id);
    if (i >= 0) app.customProps[i] = doc;
    else app.customProps.push(doc);
    this.exit();
    app.state.pendingProp = doc;
    app.state.ghostYaw = 0;
    app.setTab("objects");
    app.setTool("place");
    app.changed({ rebuild: "all", save: false });
    app.toast(`${t("saved")}: ${doc.name[app.lang] || doc.name.en}`);
  }
  async deleteCustom(id) {
    const app = this.app, t = this.t;
    const used = app.project.objects.some((o) => o.prop === id) || app.project.buildings.some((b) => b.storeys.some((s) => s.objects.some((o) => o.prop === id)));
    if (used) return app.toast(t("propInUse"));
    const doc = propDocSync(id);
    if (!confirm(t("confirmDeleteProp", { name: doc?.name[app.lang] || id }))) return;
    await store.deleteCustomProp(id);
    unregisterCustom(id);
    invalidateThumb(id);
    app.customProps = app.customProps.filter((p) => p.id !== id);
    if (app.state.pendingProp?.id === id) app.state.pendingProp = null;
    app.renderCatalog();
    app.refreshToolbar();
  }
  // ------------------------------------------------------------------ UI
  renderToolbar() {
    const t = this.t;
    const host = $("#tools");
    const shapes = ["box", "rounded", "cylinder", "sphere", "cone", "torus"];
    host.innerHTML =
      shapes.map((s) => `<button class="tb small" data-shape="${s}" title="${esc(t(`shape_${s}`))}">+ ${esc(s === "rounded" ? t("shortRounded") : t(`shape_${s}`).split(" ")[0])}</button>`).join("") +
      `<span class="sep"></span>` +
      ["translate", "rotate", "scale"].map((m) => `<button class="tb small ${this.app.gizmo.mode === m ? "on" : ""}" data-mode="${m}">${esc(t(m))}</button>`).join("");
    const extra = $("#tool-extra");
    extra.innerHTML = `<button class="tb small on" data-act="save">${esc(t("saveObject"))}</button><button class="tb small" data-act="cancel">${esc(t("cancel"))}</button>`;
    host.onclick = (e) => {
      const s = e.target.closest("[data-shape]");
      if (s) return this.addPart(s.dataset.shape);
      const m = e.target.closest("[data-mode]");
      if (m) {
        this.app.gizmo.setMode(m.dataset.mode);
        this.renderToolbar();
      }
    };
    extra.onclick = (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      ({ save: () => this.save(), cancel: () => this.cancel() })[b.dataset.act]();
    };
  }
  cancel() {
    if (this.undoStack.length && !confirm(this.t("confirmDiscard"))) return;
    this.exit();
  }
  refreshPanels() {
    this.renderPartsList();
    this.renderPartFields();
  }
  renderPartsList() {
    const t = this.t;
    $("#tree").hidden = true;
    $("#tree-search").hidden = true;
    $("#catalog").hidden = true;
    const host = $("#editor-parts");
    host.hidden = false;
    host.innerHTML =
      `<div class="stitle">${esc(this.doc.name[this.app.lang] || this.doc.name.en)} · ${this.doc.source.boxes.length} ${esc(t("partsCount"))}</div>` +
      this.doc.source.boxes
        .map((b, i) => `<div class="trow ${i === this.selected ? "selected" : ""}" data-part="${i}" style="--depth:0"><span class="swatch" style="background:${esc(b.color)}"></span><span class="tlabel">${i + 1} · ${esc(t(`shape_${b.shape}`))} · ${Math.round(b.w * 100)}×${Math.round(b.h * 100)}×${Math.round(b.d * 100)}${b.material ? " ▦" : ""}</span><button class="mini ${b.locked ? "on" : ""}" data-lockpart="${i}">${b.locked ? "🔒" : "🔓"}</button></div>`)
        .join("");
    host.onclick = (e) => {
      const lock = e.target.closest("[data-lockpart]");
      if (lock) {
        const i = Number(lock.dataset.lockpart);
        this.checkpoint();
        this.doc.source.boxes[i].locked = !this.doc.source.boxes[i].locked;
        if (i === this.selected) this.select(i);
        else this.renderPartsList();
        return;
      }
      const row = e.target.closest("[data-part]");
      if (row) this.select(Number(row.dataset.part));
    };
  }
  field(label, control, unit = "") {
    const l = document.createElement("label");
    l.className = "field";
    const s = document.createElement("span");
    s.className = "flabel";
    s.textContent = label;
    l.append(s, control);
    if (unit) {
      const u = document.createElement("span");
      u.className = "unit";
      u.textContent = unit;
      l.append(u);
    }
    return l;
  }
  numberField(b, key, { label, scale = 100, unit = "cm", min = -1e4, max = 1e4, step = 1, locked = false } = {}) {
    const input = document.createElement("input");
    input.type = "number";
    input.step = step;
    input.min = min;
    input.max = max;
    input.value = Math.round((b[key] || 0) * scale * 100) / 100;
    if (locked) input.disabled = true;
    input.addEventListener("change", () => {
      const v = Math.min(max, Math.max(min, Number(input.value) || 0)) / scale;
      if (v === b[key]) return;
      this.checkpoint();
      b[key] = r3(v);
      this.refreshPart(this.selected);
      this.renderPartsList();
    });
    return this.field(label, input, unit);
  }
  section(title, children) {
    const d = document.createElement("div");
    d.className = "section";
    if (title) {
      const s = document.createElement("div");
      s.className = "stitle";
      s.textContent = title;
      d.append(s);
    }
    for (const c of children) if (c) d.append(c);
    return d;
  }
  renderPartFields() {
    const app = this.app, t = this.t, root = $("#props");
    root.innerHTML = "";
    const head = document.createElement("div");
    head.className = "phead";
    head.innerHTML = `<span class="ptype">${esc(t("objectEditor"))}</span>`;
    root.append(head);
    // object fields
    const doc = this.doc;
    const nameField = (lang) => {
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 60;
      input.value = doc.name[lang] || "";
      input.addEventListener("change", () => {
        doc.name[lang] = input.value.trim();
        this.renderPartsList();
      });
      return this.field(`${t("name")} ${lang.toUpperCase()}`, input);
    };
    const cat = document.createElement("select");
    for (const [id, n] of Object.entries(catalog.categories)) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = n[app.lang] || n.en;
      cat.append(o);
    }
    cat.value = doc.category in catalog.categories ? doc.category : "custom";
    cat.addEventListener("change", () => (doc.category = cat.value));
    const tagsField = (lang) => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = (doc.tags[lang] || []).join(", ");
      input.placeholder = t("tagsHint");
      input.addEventListener("change", () => (doc.tags[lang] = input.value.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 24)));
      return this.field(`${t("tags")} ${lang.toUpperCase()}`, input);
    };
    root.append(this.section(t("object"), [nameField("en"), nameField("pt"), nameField("ja"), this.field(t("category"), cat), tagsField("en"), tagsField("pt"), tagsField("ja")]));
    const b = doc.source.boxes[this.selected];
    if (!b) return;
    const locked = !!b.locked;
    const shape = document.createElement("select");
    for (const s of SHAPES) {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = t(`shape_${s}`);
      shape.append(o);
    }
    shape.value = b.shape;
    shape.disabled = locked;
    shape.addEventListener("change", () => {
      this.checkpoint();
      b.shape = shape.value;
      this.refreshPart(this.selected);
      this.refreshPanels();
    });
    const axis = document.createElement("select");
    for (const a of ["x", "y", "z"]) {
      const o = document.createElement("option");
      o.value = a;
      o.textContent = a.toUpperCase();
      axis.append(o);
    }
    axis.value = b.axis || "y";
    axis.disabled = locked;
    axis.addEventListener("change", () => {
      this.checkpoint();
      b.axis = axis.value;
      this.refreshPart(this.selected);
    });
    const color = document.createElement("input");
    color.type = "color";
    color.value = b.color;
    color.disabled = locked;
    let cp = false;
    color.addEventListener("input", () => {
      if (!cp) {
        this.checkpoint();
        cp = true;
      }
      b.color = color.value;
      this.refreshPart(this.selected);
    });
    color.addEventListener("change", () => {
      cp = false;
      this.renderPartsList();
    });
    const n = (key, label, opts = {}) => this.numberField(b, key, { label, locked, ...opts });
    const lockBtn = document.createElement("button");
    lockBtn.className = `btn ${locked ? "on" : ""}`;
    lockBtn.textContent = locked ? `🔒 ${t("unlock")}` : `🔓 ${t("lock")}`;
    lockBtn.addEventListener("click", () => {
      this.checkpoint();
      b.locked = !b.locked;
      this.select(this.selected);
    });
    const tex = textureControl(app, {
      value: b.material || null,
      disabled: locked,
      onChange: (id) => {
        this.checkpoint();
        b.material = id;
        this.refreshPart(this.selected);
        this.renderPartsList();
      },
    });
    const noTint = document.createElement("input");
    noTint.type = "checkbox";
    noTint.checked = !!b.noTint;
    noTint.disabled = locked;
    noTint.addEventListener("change", () => {
      this.checkpoint();
      b.noTint = noTint.checked;
    });
    const noTintField = document.createElement("label");
    noTintField.className = "field check";
    const noTintLabel = document.createElement("span");
    noTintLabel.className = "flabel";
    noTintLabel.textContent = t("noTint");
    noTintField.append(noTint, noTintLabel);
    const round = ["cylinder", "cone", "roundcone", "torus"].includes(b.shape);
    root.append(
      this.section(`${t("part")} ${this.selected + 1}`, [
        this.field(t("shape"), shape),
        round ? this.field(t("axis"), axis) : null,
        n("w", t("width")), n("h", t("height")), n("d", t("depth")),
      ]),
      this.section(t("position"), [n("x", "X"), n("y", "Y"), n("z", "Z")]),
      this.section(t("rotation"), [n("rx", "X", { scale: 180 / Math.PI, unit: "°", min: -360, max: 360 }), n("ry", "Y", { scale: 180 / Math.PI, unit: "°", min: -360, max: 360 }), n("rz", "Z", { scale: 180 / Math.PI, unit: "°", min: -360, max: 360 })]),
      this.section(t("surface"), [this.field(t("texture"), tex), this.field(t("tint"), color), n("opacity", t("opacity"), { scale: 100, unit: "%", min: 5, max: 100 }), noTintField]),
      this.section(null, [
        this.actionButton(t("duplicate"), () => this.duplicatePart()),
        this.actionButton(t("mirrorX"), () => this.mirrorPart()),
        this.actionButton(t("dropToFloor"), () => this.ground()),
        lockBtn,
        this.actionButton(t("deletePart"), () => this.deletePart(), "danger"),
      ]),
    );
  }
  actionButton(text, onClick, cls = "") {
    const b = document.createElement("button");
    b.className = `btn ${cls}`;
    b.type = "button";
    b.textContent = text;
    b.addEventListener("click", onClick);
    return b;
  }
}
