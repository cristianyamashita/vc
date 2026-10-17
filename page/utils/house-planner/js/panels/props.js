// Right panel: properties of the selection, built from small field helpers.
import { arrange } from "../multi.js";
import { OPENING_PRESETS, STOREY_PRESETS, ROOF_PRESETS, CITIES, ROOF_TYPES, RAILING_STYLES, FENCE_STYLES, GATE_TYPES, GATE_WIDTHS, WALL_TOPS, OUTDOOR_TYPES, NOTE_COLORS, isLocked, wallLength, polylineLength } from "../schema.js";
import { textureIds, textureIndex } from "../materials.js";
import { textureControl } from "../textures.js";
import { Sun } from "../sun.js";
import { propDocSync, customIds } from "../props.js";
import { stairsSteps } from "../build/stairs.js";
import { polygonLevels } from "../build/outdoor.js";
import { clampGate } from "../build/railing.js";
import { formatArea } from "../rooms.js";

export class PropsPanel {
  constructor(app, root) {
    this.app = app;
    this.root = root;
  }
  // ------------------------------------------------------------ helpers
  el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) e.setAttribute(k, v);
    }
    for (const c of children) if (c) e.append(c);
    return e;
  }
  field(label, control, unit = "") {
    return this.el("label", { class: "field" }, [this.el("span", { class: "flabel", text: label }), control, unit ? this.el("span", { class: "unit", text: unit }) : null]);
  }
  number(obj, key, { min = -1e5, max = 1e5, step = 1, unit = "cm", label, nullable = false, after } = {}) {
    const input = this.el("input", { type: "number", min, max, step, value: obj[key] ?? "", placeholder: nullable ? "—" : null, disabled: this.locked ? "" : null });
    input.addEventListener("change", () => {
      let v = input.value === "" ? null : Number(input.value);
      if (v === null && !nullable) v = obj[key];
      if (v !== null) v = Math.min(max, Math.max(min, v));
      if (v === obj[key]) return;
      this.app.checkpoint();
      obj[key] = v;
      after?.(v);
      this.app.changed({ rebuild: this.scope, panels: false });
      this.app.tree.render();
    });
    return this.field(label ?? this.app.t(key), input, unit);
  }
  vec(obj, key, index, opts) {
    const proxy = { get v() { return obj[key][index]; }, set v(x) { obj[key][index] = x; } };
    return this.number(proxy, "v", opts);
  }
  text(obj, key, { label } = {}) {
    const input = this.el("input", { type: "text", value: obj[key] ?? "", maxlength: 60, disabled: this.locked ? "" : null });
    input.addEventListener("change", () => {
      this.app.checkpoint();
      obj[key] = input.value.trim();
      this.app.changed({ rebuild: "none" });
    });
    return this.field(label ?? this.app.t(key), input);
  }
  check(obj, key, { label, rebuild, after, allowLocked = false } = {}) {
    const input = this.el("input", { type: "checkbox", disabled: this.locked && !allowLocked ? "" : null });
    input.checked = !!obj[key];
    input.addEventListener("change", () => {
      this.app.checkpoint();
      obj[key] = input.checked;
      after?.(input.checked);
      this.app.changed({ rebuild: rebuild ?? this.scope });
    });
    return this.el("label", { class: "field check" }, [input, this.el("span", { class: "flabel", text: label ?? this.app.t(key) })]);
  }
  select(obj, key, options, { label, after, rebuild } = {}) {
    const sel = this.el("select", { disabled: this.locked ? "" : null });
    for (const [value, text] of options) {
      const o = this.el("option", { value, text });
      if (String(obj[key] ?? "") === String(value)) o.selected = true;
      sel.append(o);
    }
    sel.addEventListener("change", () => {
      this.app.checkpoint();
      const v = sel.value === "" ? null : isNaN(Number(sel.value)) || sel.value === "" ? sel.value : Number(sel.value);
      obj[key] = typeof obj[key] === "number" && typeof v === "string" ? Number(v) : v;
      after?.(obj[key]);
      this.app.changed({ rebuild: rebuild ?? this.scope });
    });
    return this.field(label ?? this.app.t(key), sel);
  }
  color(obj, key, { label, nullable = true, rebuild } = {}) {
    const wrap = this.el("span", { class: "colorwrap" });
    const input = this.el("input", { type: "color", value: obj[key] || "#ffffff", disabled: this.locked ? "" : null });
    input.addEventListener("input", () => {
      if (!this.colorCheckpoint) {
        this.app.checkpoint();
        this.colorCheckpoint = true;
      }
      obj[key] = input.value;
      input.classList.remove("empty");
      this.app.changed({ rebuild: rebuild ?? this.scope, save: false, panels: false });
    });
    input.addEventListener("change", () => {
      this.colorCheckpoint = false;
      this.app.changed({ rebuild: rebuild ?? this.scope });
    });
    wrap.append(input);
    if (nullable) {
      const clear = this.el("button", { class: "mini", type: "button", text: "×", title: this.app.t("none"), disabled: this.locked ? "" : null });
      clear.addEventListener("click", () => {
        if (obj[key] == null) return;
        this.app.checkpoint();
        obj[key] = null;
        this.app.changed({ rebuild: rebuild ?? this.scope });
      });
      wrap.append(clear);
      if (obj[key] == null) input.classList.add("empty");
    }
    return this.field(label ?? this.app.t(key), wrap);
  }
  material(obj, key, { label, rebuild } = {}) {
    const control = textureControl(this.app, {
      value: obj[key],
      disabled: !!this.locked,
      onChange: (id) => {
        if (id === obj[key]) return;
        this.app.checkpoint();
        obj[key] = id;
        this.app.changed({ rebuild: rebuild ?? this.scope });
      },
    });
    return this.field(label ?? this.app.t("texture"), control);
  }
  button(text, onClick, cls = "") {
    return this.el("button", { class: `btn ${cls}`, type: "button", text, onclick: onClick });
  }
  section(title, children) {
    return this.el("div", { class: "section" }, [title ? this.el("div", { class: "stitle", text: title }) : null, ...children]);
  }
  lockRow(item, id) {
    const t = this.app.t;
    const locked = !!item.locked;
    return this.el("div", { class: "row-actions" }, [
      this.button(locked ? `🔒 ${t("unlock")}` : `🔓 ${t("lock")}`, () => this.app.toggleLock(id), locked ? "on" : ""),
    ]);
  }
  // ------------------------------------------------------------- render
  render() {
    const app = this.app, t = app.t;
    const root = this.root;
    root.innerHTML = "";
    const sel = app.state.selection;
    const found = sel ? app.locate(sel) : null;
    this.locked = found ? isLocked(app.project, sel) && found.type !== "sun" : false;
    this.scope = "building";
    if (!found) return this.renderProject();
    const head = this.el("div", { class: "phead" }, [this.el("span", { class: "ptype", text: t(found.type) }), this.locked ? this.el("span", { class: "tag", text: `🔒 ${t("lockedShort")}` }) : null]);
    root.append(head);
    const caps = app.state.caps || [];
    const icons = { translate: "↔", rotate: "⟳", scale: "⤢" };
    if (caps.length || found.type !== "sun")
      root.append(
        this.el("div", { class: "row-actions modes" }, [
          ...["translate", "rotate", "scale"].filter((m) => caps.includes(m)).map((m) => this.el("button", { class: `btn mode ${app.state.transformMode === m ? "on" : ""}`, type: "button", onclick: () => app.setTransformMode(m) }, [this.el("span", { class: "mico", text: icons[m] }), this.el("span", { class: "mlabel", text: `${t(m)} (${{ translate: "W", rotate: "E", scale: "R" }[m]})` })])),
          this.el("button", { class: `btn mode ${app.dims.enabled ? "on" : ""}`, type: "button", onclick: () => app.toggleDims() }, [this.el("span", { class: "mico", text: "📏" }), this.el("span", { class: "mlabel", text: `${t("dims")} (M)` })]),
        ]),
      );
    switch (found.type) {
      case "terrain": return this.renderTerrain(found.item);
      case "sun": return this.renderSun(found.item);
      case "building": return this.renderBuilding(found);
      case "storey": return this.renderStorey(found);
      case "floorGroup": return this.renderFloorGroup(found);
      case "room": return this.renderRoom(found);
      case "wall": return this.renderWall(found);
      case "opening": return this.renderOpening(found);
      case "object": return this.renderObject(found);
      case "stairs": return this.renderStairs(found);
      case "outdoor": case "garden": return this.renderPolygon(found);
      case "railing": case "fence": return this.renderRailing(found);
      case "gate": return this.renderGate(found);
      case "siteWall": return this.renderSiteWall(found);
      case "note": return this.renderNote(found);
    }
  }
  renderProject() {
    const app = this.app, t = app.t, p = app.project;
    this.scope = "none";
    const stats = p.buildings.reduce((n, b) => n + b.storeys.reduce((m, s) => m + s.walls.length + s.objects.length + s.floorGroups.length, 0), 0) + p.objects.length;
    this.root.append(
      this.el("div", { class: "phead" }, [this.el("span", { class: "ptype", text: t("project") })]),
      this.section(null, [
        this.text(p, "name", { label: t("projectName") }),
        this.number(p.grid, "snap", { min: 1, max: 100, label: t("snap") }),
        this.el("p", { class: "hint", text: `${p.buildings.length} ${t("buildingsCount")} · ${stats} ${t("itemsCount")}` }),
        this.el("p", { class: "hint", text: t("selectHint") }),
      ]),
    );
  }
  renderTerrain(tr) {
    const app = this.app, t = app.t;
    this.scope = "terrain";
    const size = { width: tr.width, depth: tr.depth, resolution: tr.resolution };
    const apply = () => {
      app.checkpoint();
      app.terrain.resample(size.width, size.depth, size.resolution);
      app.changed({ rebuild: "all" });
    };
    const sizeField = (key, min, max) => {
      const input = this.el("input", { type: "number", min, max, step: key === "resolution" ? 1 : 50, value: size[key], disabled: this.locked ? "" : null });
      input.addEventListener("change", () => {
        size[key] = Math.min(max, Math.max(min, Number(input.value) || min));
        apply();
      });
      return this.field(t(key), input, key === "resolution" ? "" : "cm");
    };
    const brush = app.prefs.brush;
    const brushField = (key, min, max) => {
      const input = this.el("input", { type: "range", min, max, step: 1, value: brush[key] });
      const out = this.el("span", { class: "unit", text: `${brush[key]} cm` });
      input.addEventListener("input", () => {
        brush[key] = Number(input.value);
        out.textContent = `${brush[key]} cm`;
        app.savePrefs();
      });
      return this.el("label", { class: "field" }, [this.el("span", { class: "flabel", text: t(key) }), input, out]);
    };
    this.root.append(
      this.section(t("brush"), [brushField("radius", 20, 1000), brushField("strength", 1, 100), this.el("p", { class: "hint", text: t("terrainHint") })]),
      this.section(t("size"), [sizeField("width", 200, 50000), sizeField("depth", 200, 50000), sizeField("resolution", 8, 96)]),
      this.section(t("surface"), [this.material(tr, "material"), this.color(tr, "tint"), this.check(tr, "flattenUnderBuildings", { rebuild: "all" })]),
      this.section(null, [
        this.button(t("flattenAll"), () => {
          app.checkpoint();
          tr.heights.fill(0);
          app.terrain.update();
          app.changed({ rebuild: "none", terrain: true });
        }),
        this.lockRow(tr, "terrain"),
      ]),
    );
  }
  renderSun(sun) {
    const app = this.app, t = app.t;
    this.scope = "light";
    const range = (key, min, max, step, unit, disabled = false) => {
      const input = this.el("input", { type: "range", min, max, step, value: sun[key], disabled: disabled ? "" : null });
      const out = this.el("span", { class: "unit", text: `${sun[key]}${unit}` });
      let cp = false;
      input.addEventListener("input", () => {
        if (!cp) {
          app.checkpoint();
          cp = true;
        }
        sun[key] = Number(input.value);
        out.textContent = `${sun[key]}${unit}`;
        app.changed({ rebuild: "none", light: true, save: false, panels: false });
      });
      input.addEventListener("change", () => {
        cp = false;
        app.changed({ rebuild: "none", light: true });
      });
      return this.el("label", { class: "field" }, [this.el("span", { class: "flabel", text: t(key) }), input, out]);
    };
    const eff = Sun.angles(sun);
    const months = Array.from({ length: 12 }, (_, i) => [i + 1, new Date(2024, i, 1).toLocaleString(app.lang, { month: "short" })]);
    this.root.append(
      this.section(t("position"), [
        this.check(sun, "useTime", { rebuild: "light", label: t("useTime") }),
        range("azimuth", 0, 360, 1, "°", sun.useTime),
        range("elevation", 2, 90, 1, "°", sun.useTime),
        sun.useTime ? this.el("p", { class: "hint", text: `${t("azimuth")} ${eff.azimuth}° · ${t("elevation")} ${eff.elevation}°` }) : null,
      ]),
      this.section(t("timeOfDay"), [
        range("time", 0, 24, 0.25, " h", !sun.useTime),
        this.select(sun, "city", [...CITIES.map((c) => [c.id, c.name[app.lang] || c.name.en]), ["custom", t("custom")]], {
          label: t("city"),
          rebuild: "light",
          after: (v) => {
            const c = CITIES.find((x) => x.id === v);
            if (c) sun.latitude = c.lat;
          },
        }),
        this.number(sun, "latitude", { min: -70, max: 70, unit: "°", label: t("latitude"), after: () => (sun.city = "custom") }),
        this.select(sun, "month", months, { label: t("month"), rebuild: "light" }),
      ]),
      this.section(t("light"), [
        range("intensity", 0, 3, 0.05, "×"),
        this.check(sun, "shadows", { rebuild: "light" }),
        this.check(sun, "night", { rebuild: "light", label: `${t("night")} (J)` }),
        this.el("p", { class: "hint", text: t("nightHint") }),
      ]),
      this.section(t("seasons"), [this.button(`🗓 ${t("compare")}`, () => app.compareSeasons()), this.el("p", { class: "hint", text: t("compareHint") })]),
    );
  }
  renderBuilding({ item: b }) {
    const app = this.app, t = app.t;
    this.scope = "building";
    const presetSel = this.el("select", {}, STOREY_PRESETS.map((p) => this.el("option", { value: p.id, text: t(`preset_${p.id}`) })));
    presetSel.value = "upper";
    this.root.append(
      this.section(null, [this.text(b, "name"), this.vec(b, "at", 0, { label: "X" }), this.vec(b, "at", 1, { label: "Z" }), this.number(b, "rotation", { min: -360, max: 360, unit: "°" })]),
      this.section(t("roof"), this.roofFields(b)),
      this.section(t("storeys"), [
        this.el("div", { class: "row-actions" }, [presetSel, this.button(`+ ${t("addStorey")}`, () => app.addStorey(b.id, presetSel.value))]),
        this.el("p", { class: "hint", text: t("storeyHint") }),
      ]),
      this.section(null, [this.lockRow(b, b.id), this.button(t("deleteBuilding"), () => app.deleteSelected(), "danger")]),
    );
  }
  /** Roof fields of a building; the roof has its own lock. */
  roofFields(b) {
    const app = this.app, t = app.t, roof = b.roof;
    const buildingLocked = this.locked;
    this.locked = buildingLocked || roof.locked;
    const sloped = roof.type === "gable" || roof.type === "hip" || roof.type === "shed";
    const fields = [this.select(roof, "type", ROOF_TYPES.map((k) => [k, t(`roof_${k}`)]), { label: t("roofType") })];
    if (roof.type !== "none") {
      if (sloped) fields.push(this.number(roof, "pitch", { min: 5, max: 60, unit: "°" }), this.select(roof, "ridgeAxis", [["x", t("ridge_x")], ["z", t("ridge_z")]], { label: t("ridgeAxis") }));
      if (roof.type === "shed") fields.push(this.select(roof, "highSide", [["+", t("highSide_plus")], ["-", t("highSide_minus")]], { label: t("highSide") }));
      fields.push(this.number(roof, "overhang", { min: 0, max: 200 }));
      if (roof.type === "flat") fields.push(this.number(roof, "height", { min: 0, max: 150, label: t("parapet") }));
      const preset = { v: ROOF_PRESETS.find((p) => p.material === roof.material)?.id || "" };
      fields.push(
        this.select(preset, "v", [...ROOF_PRESETS.map((p) => [p.id, t(`roofPreset_${p.id}`)]), ["", t("custom")]], {
          label: t("roofPreset"),
          after: (v) => {
            const p = ROOF_PRESETS.find((x) => x.id === v);
            if (p) {
              roof.material = p.material;
              roof.tint = p.tint || null;
            }
          },
        }),
        this.material(roof, "material"),
        this.color(roof, "tint"),
        this.check(roof, "ceiling", { label: t("roofCeiling") }),
      );
    }
    const lockBtn = this.button(roof.locked ? `🔒 ${t("unlock")}` : `🔓 ${t("lock")}`, () => app.toggleLock(`roof:${b.id}`), roof.locked ? "on" : "");
    lockBtn.disabled = buildingLocked;
    this.locked = buildingLocked;
    fields.push(
      this.check(roof, "visible", { label: t("roofVisible"), allowLocked: true, rebuild: "none", after: () => app.applyVisibility() }),
      this.check(b, "roofShadow", { rebuild: "light" }),
      this.el("div", { class: "row-actions" }, [lockBtn]),
    );
    return fields;
  }
  renderStorey({ item: s, building }) {
    const app = this.app, t = app.t;
    this.scope = "building";
    this.root.append(
      this.section(null, [
        this.text(s, "name"),
        this.number(s, "elevation", { min: -5000, max: 50000, step: 10 }),
        this.number(s, "height", { min: 100, max: 1500, step: 10 }),
        this.number(s, "slabThickness", { min: 2, max: 100 }),
        this.check(s, "visible", { allowLocked: true }),
      ]),
      this.section(null, [
        this.button(t("setActive"), () => app.setActive(building.id, s.id)),
        this.lockRow(s, s.id),
        this.button(t("deleteStorey"), () => app.deleteSelected(), "danger"),
      ]),
    );
  }
  renderFloorGroup({ item: fg, storey }) {
    const app = this.app, t = app.t;
    this.scope = "building";
    this.root.append(
      this.section(null, [
        this.text(fg, "name"),
        this.number(fg, "offset", { min: -500, max: 500 }),
        this.number(fg, "thickness", { min: 2, max: 100, nullable: true, label: `${t("thickness")} (${storey.slabThickness})` }),
        this.material(fg, "material"),
        this.color(fg, "tint"),
        this.el("p", { class: "hint", text: `${fg.tiles.length} ${t("tilesCount")}` }),
      ]),
      this.section(null, [
        this.button(t("paintThis"), () => {
          app.state.activeFloorGroup = fg.id;
          app.setTab("floors");
          app.setTool("paint");
        }),
        this.button(t("mergeInto"), () => app.mergeFloorGroups(fg.id)),
        this.button(t("splitGroup"), () => app.splitFloorGroup(fg.id)),
        this.lockRow(fg, fg.id),
        this.button(t("delete"), () => app.deleteSelected(), "danger"),
      ]),
    );
  }
  renderRoom({ item: r }) {
    const app = this.app, t = app.t, lang = app.lang;
    this.scope = "building";
    const face = app.roomFace(r.id);
    const textures = textureIds().map((id) => [id, textureIndex[id].name[lang] || id]);
    this.root.append(
      this.section(null, [
        this.text(r, "name"),
        face ? this.el("p", { class: "hint", text: `${t("area")}: ${formatArea(face.area, lang)} · ${t("grossArea")}: ${formatArea(face.grossArea, lang)} · ${t("perimeter")}: ${Math.round(face.perimeter)} cm` }) : null,
        this.el("p", { class: "hint", text: t("roomHint") }),
      ]),
      this.section(t("floorFinish"), [
        this.select(r, "floorMaterial", [["", t("none")], ...textures], { label: t("texture") }),
        this.color(r, "floorTint", { label: t("tint") }),
      ]),
      this.section(t("ceiling"), [this.color(r, "ceilingTint", { label: t("tint") })]),
      this.section(null, [this.lockRow(r, r.id)]),
    );
  }
  renderWall({ item: w, storey }) {
    const app = this.app, t = app.t;
    this.scope = "building";
    this.root.append(
      this.section(null, [
        this.text(w, "name"),
        this.vec(w, "a", 0, { label: "A·X" }), this.vec(w, "a", 1, { label: "A·Z" }),
        this.vec(w, "b", 0, { label: "B·X" }), this.vec(w, "b", 1, { label: "B·Z" }),
        this.el("p", { class: "hint", text: `${t("length")}: ${Math.round(wallLength(w))} cm` }),
        this.number(w, "thickness", { min: 5, max: 100 }),
        this.number(w, "height", { min: 30, max: 1500, nullable: true, label: `${t("height")} (${storey.height})` }),
        this.check(w, "skirting"),
        this.check(w, "trim"),
      ]),
      this.section(t("innerSide"), [this.material(w, "material"), this.color(w, "tint", { nullable: false })]),
      this.section(t("outerSide"), [
        this.material(w, "outerMaterial", { label: `${t("texture")} (${t("sameAsInner")})` }),
        this.color(w, "outerTint"),
        this.check(w, "flipOuter"),
        this.el("p", { class: "hint", text: t("outerHint") }),
      ]),
      this.section(null, [
        this.button(t("addOpening"), () => {
          app.select(w.id);
          app.setTab("openings");
          app.setTool("add");
        }),
        this.lockRow(w, w.id),
        this.button(t("delete"), () => app.deleteSelected(), "danger"),
      ]),
    );
  }
  renderOpening({ item: o, wall }) {
    const app = this.app, t = app.t;
    this.scope = "building";
    const len = wallLength(wall);
    const presets = Object.keys(OPENING_PRESETS).map((k) => [k, t(k)]);
    this.root.append(
      this.section(null, [
        this.select(o, "preset", presets, {
          label: t("type"),
          after: (v) => {
            const p = OPENING_PRESETS[v];
            o.type = p.type;
            o.width = p.width;
            o.height = p.height;
            o.sill = p.sill;
          },
        }),
        this.number(o, "offset", { min: 0, max: len }),
        this.number(o, "width", { min: 30, max: 600 }),
        this.number(o, "height", { min: 30, max: 500 }),
        this.number(o, "sill", { min: 0, max: 400 }),
        this.check(o, "flip"),
      ]),
      this.section(t("colors"), [this.color(o, "frameColor", { nullable: false }), this.color(o, "leafColor", { nullable: false }), this.color(o, "glassColor", { nullable: false })]),
      this.section(null, [this.lockRow(o, o.id), this.button(t("delete"), () => app.deleteSelected(), "danger")]),
    );
  }
  /** Align / distribute / mirror buttons for a multi-selection. */
  arrangeSection() {
    const app = this.app, t = app.t;
    const n = app.state.extra.size + 1;
    if (!app.state.extra.size) return this.el("p", { class: "hint", text: t("multiHint") });
    const b = (label, op, edge) => this.el("button", { class: "btn", type: "button", text: label, onclick: () => arrange(app, op, edge) });
    return this.section(`${t("arrange")} (${n})`, [
      this.el("div", { class: "row-actions" }, [b(`⇤ ${t("alignLeft")}`, "alignX", "min"), b(`⇥ ${t("alignRight")}`, "alignX", "max"), b(`⤒ ${t("alignBack")}`, "alignZ", "min"), b(`⤓ ${t("alignFront")}`, "alignZ", "max")]),
      this.el("div", { class: "row-actions" }, [b(`↔ ${t("centerX")}`, "centerX"), b(`↕ ${t("centerZ")}`, "centerZ"), b(`⋯ ${t("distributeX")}`, "distX"), b(`⋮ ${t("distributeZ")}`, "distZ")]),
      this.el("div", { class: "row-actions" }, [b(`⇋ ${t("mirrorX")}`, "mirrorX"), b(`⇵ ${t("mirrorZ")}`, "mirrorZ")]),
    ]);
  }
  renderStairs({ item: st, building }) {
    const app = this.app, t = app.t;
    this.scope = "building";
    const info = stairsSteps(st);
    const n = (key, i, label, opts = {}) => this.vec(st, key, i, { label, ...opts });
    this.root.append(
      this.section(null, [
        this.text(st, "name"),
        this.select(st, "shape", [["straight", t("shape_straight")], ["L", t("shape_L")], ["U", t("shape_U")]], { label: t("shape") }),
        this.select(st, "turn", [["left", t("turnLeft")], ["right", t("turnRight")]], { label: t("turn") }),
        this.select(st, "railing", [["none", t("none")], ["left", t("turnLeft")], ["right", t("turnRight")], ["both", t("both")]], { label: t("stairRailing") }),
        this.select(st, "railingStyle", [["wood", t("style_wood")], ["metal", t("style_metal")]], { label: t("style") }),
        n("at", 0, "X"), n("at", 1, "Z"),
        this.number(st, "rotation", { min: -360, max: 360, unit: "°", step: 15 }),
      ]),
      this.section(t("size"), [
        this.number(st, "width", { min: 60, max: 300 }),
        this.number(st, "rise", { min: 30, max: 1000 }),
        this.number(st, "stepHeight", { min: 10, max: 25, step: 0.5 }),
        this.number(st, "treadDepth", { min: 20, max: 40 }),
        this.el("p", { class: "hint", text: t("stepsInfo", { n: info.steps, r: Math.round(info.riser * 10) / 10 }) }),
        this.check(st, "cutFloorAbove"),
      ]),
      this.section(t("surface"), [this.material(st, "material"), this.color(st, "tint")]),
      this.arrangeSection(),
      this.section(null, [this.button(t("duplicate"), () => app.duplicateSelected()), this.lockRow(st, st.id), this.button(t("delete"), () => app.deleteSelected(), "danger")]),
    );
    void building;
  }
  /** Editable point list of a polygon (closed) or a polyline (open). */
  pointsSection(item, { rebuild, min, closed, hint, buildingId = null }) {
    const app = this.app, t = app.t;
    const changed = () => app.changed({ rebuild, buildingId });
    const pointRows = item.points.map((pt, i) => {
      const row = this.el("div", { class: "ptrow" });
      const mk = (idx) => {
        const input = this.el("input", { type: "number", step: 1, value: pt[idx], disabled: this.locked ? "" : null });
        input.addEventListener("change", () => {
          const v = Number(input.value);
          if (!Number.isFinite(v) || v === pt[idx]) return;
          app.checkpoint();
          pt[idx] = Math.max(-1e5, Math.min(1e5, v));
          changed();
        });
        return input;
      };
      const del = this.el("button", { class: "mini", type: "button", text: "×", title: t("removePoint"), disabled: this.locked || item.points.length <= min ? "" : null });
      del.addEventListener("click", () => {
        app.checkpoint();
        item.points.splice(i, 1);
        changed();
      });
      row.append(this.el("span", { class: "flabel", text: `${i + 1}` }), mk(0), mk(1), del);
      return row;
    });
    const addPoint = this.button(`+ ${t("addPoint")}`, () => {
      const n = item.points.length;
      const a = item.points[n - 1], b = closed ? item.points[0] : item.points[n - 2] || a;
      app.checkpoint();
      // closed: between the last and first point; open: extend the last segment
      item.points.push(closed ? [Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)] : [Math.round(a[0] + (a[0] - b[0]) * 0.5), Math.round(a[1] + (a[1] - b[1]) * 0.5)]);
      changed();
    });
    addPoint.disabled = this.locked || item.points.length >= 200;
    return this.section(`${t("points")} (${item.points.length})`, [...pointRows, addPoint, hint ? this.el("p", { class: "hint", text: hint }) : null]);
  }
  renderPolygon({ item: poly, type }) {
    const app = this.app, t = app.t;
    this.scope = "site";
    const levels = polygonLevels(poly, type, app.terrain);
    const main = [this.text(poly, "name")];
    const stream = type === "outdoor" && poly.type === "stream";
    if (type === "outdoor") {
      // a stream is a polyline; the other types are closed polygons
      const types = OUTDOOR_TYPES.filter((k) => (k === "stream") === stream).map((k) => [k, t(k)]);
      main.push(this.select(poly, "type", types, { label: t("type") }));
      if (poly.type === "deck") {
        main.push(this.number(poly, "height", { min: -300, max: 300, label: t("deckHeight") }), this.check(poly, "open", { label: t("deckOpen"), rebuild: "site" }));
        if (poly.open) main.push(this.number(poly, "postSize", { min: 8, max: 40 }));
      } else if (poly.type === "pool") {
        const proxy = { get v() { return Math.abs(poly.height); }, set v(x) { poly.height = -Math.abs(x); } };
        main.push(this.number(proxy, "v", { min: 30, max: 300, label: t("poolDepth") }), this.check(poly, "lights", { label: t("poolLights"), rebuild: "light" }));
      } else if (poly.type === "pond") {
        main.push(this.number(poly, "height", { min: 0, max: 300, label: t("waterLevel") }), this.number(poly, "depth", { min: 5, max: 300, label: t("bedDepth") }));
      } else if (stream) {
        main.push(this.number(poly, "width", { min: 20, max: 1000, label: t("streamWidth") }), this.number(poly, "depth", { min: 5, max: 200, label: t("bedDepth") }), this.el("p", { class: "hint", text: `${t("length")}: ${Math.round(polylineLength(poly.points))} cm` }));
      }
    }
    if (levels) main.push(this.el("p", { class: "hint", text: `${t("topLevel")}: ${Math.round(levels.top)} cm · ${t("bottomLevel")}: ${Math.round(levels.bottom)} cm` }));
    this.root.append(
      this.section(null, main),
      this.section(t("surface"), [this.material(poly, "material"), this.color(poly, "tint")]),
      this.pointsSection(poly, { rebuild: "site", min: stream ? 2 : 3, closed: !stream, hint: t(stream ? "lineEditHint" : "pointsHint") }),
      this.section(null, [this.button(t("duplicate"), () => app.duplicateSelected()), this.lockRow(poly, poly.id), this.button(t("delete"), () => app.deleteSelected(), "danger")]),
    );
  }
  renderRailing({ item: r, type, building }) {
    const app = this.app, t = app.t;
    const fence = type === "fence";
    this.scope = fence ? "site" : "building";
    const styles = (fence ? FENCE_STYLES : RAILING_STYLES).map((k) => [k, t(`style_${k}`)]);
    const main = [
      this.text(r, "name"),
      this.select(r, "style", styles, { label: t("style") }),
      this.number(r, "height", { min: 20, max: 400 }),
      this.number(r, "postSpacing", { min: 40, max: 600 }),
      this.el("p", { class: "hint", text: `${t("length")}: ${Math.round(polylineLength(r.points))} cm` }),
    ];
    const actions = [];
    if (fence) {
      actions.push(this.button(t("addGate"), () => {
        app.select(r.id);
        app.setTab("openings");
        app.setTool("gate");
      }));
    }
    this.root.append(
      this.section(null, main),
      this.section(t("surface"), [this.material(r, "material"), this.color(r, "tint")]),
      this.pointsSection(r, { rebuild: this.scope, min: 2, closed: false, hint: t("lineEditHint"), buildingId: building?.id || null }),
      this.section(null, [...actions, this.button(t("duplicate"), () => app.duplicateSelected()), this.lockRow(r, r.id), this.button(t("delete"), () => app.deleteSelected(), "danger")]),
    );
  }
  renderSiteWall({ item: w }) {
    const app = this.app, t = app.t;
    this.scope = "site";
    const main = [
      this.text(w, "name"),
      this.number(w, "height", { min: 30, max: 400 }),
      this.number(w, "thickness", { min: 10, max: 60 }),
      this.select(w, "top", WALL_TOPS.map((k) => [k, t(`top_${k}`)]), { label: t("wallTop") }),
      this.el("p", { class: "hint", text: `${t("length")}: ${Math.round(polylineLength(w.points))} cm` }),
    ];
    if (w.top === "stepped") main.splice(4, 0, this.number(w, "stepLength", { min: 50, max: 500 }));
    this.root.append(
      this.section(null, main),
      this.section(t("surface"), [this.material(w, "material"), this.color(w, "tint")]),
      this.section(t("outerFace"), [this.material(w, "outerMaterial"), this.color(w, "outerTint")]),
      this.pointsSection(w, { rebuild: "site", min: 2, closed: false, hint: t("lineEditHint"), buildingId: null }),
      this.section(null, [
        this.button(t("addGate"), () => {
          app.select(w.id);
          app.setTab("openings");
          app.setTool("gate");
        }),
        this.button(t("duplicate"), () => app.duplicateSelected()),
        this.lockRow(w, w.id),
        this.button(t("delete"), () => app.deleteSelected(), "danger"),
      ]),
    );
  }
  renderGate({ item: g, host }) {
    const app = this.app, t = app.t;
    const fence = host;
    this.scope = "site";
    const len = polylineLength(fence.points);
    const clamp = () => clampGate(g, fence);
    this.root.append(
      this.section(null, [
        this.select(g, "type", GATE_TYPES.map((k) => [k, t(`gate_${k}`)]), {
          label: t("type"),
          after: (v) => {
            g.width = GATE_WIDTHS[v] ?? g.width;
            clamp();
          },
        }),
        this.number(g, "offset", { min: 0, max: len, after: clamp, label: t("position") }),
        this.number(g, "width", { min: 60, max: 600, after: clamp }),
        this.el("p", { class: "hint", text: t("gateSlideHint") }),
      ]),
      this.section(null, [this.lockRow(g, g.id), this.button(t("delete"), () => app.deleteSelected(), "danger")]),
    );
  }
  /** Light on/off and intensity of a lighting object (used at night). */
  lightFields(o) {
    const app = this.app, t = app.t;
    const input = this.el("input", { type: "range", min: 0, max: 3, step: 0.1, value: o.lightIntensity ?? 1, disabled: this.locked ? "" : null });
    const out = this.el("span", { class: "unit", text: `${o.lightIntensity ?? 1}×` });
    let cp = false;
    input.addEventListener("input", () => {
      if (!cp) {
        app.checkpoint();
        cp = true;
      }
      o.lightIntensity = Number(input.value);
      out.textContent = `${o.lightIntensity}×`;
      app.changed({ rebuild: "none", light: true, save: false, panels: false });
    });
    input.addEventListener("change", () => {
      cp = false;
      app.changed({ rebuild: "none", light: true, panels: false });
    });
    return [
      this.check(o, "lightOn", { rebuild: "light" }),
      this.el("label", { class: "field" }, [this.el("span", { class: "flabel", text: t("lightIntensity") }), input, out]),
      this.el("p", { class: "hint", text: t(app.project.sun.night ? "lightNightOn" : "lightNightOff") }),
    ];
  }
  renderNote({ item: n }) {
    const app = this.app, t = app.t;
    this.scope = "none";
    const index = app.project.notes.indexOf(n) + 1;
    const area = this.el("textarea", { rows: 3, maxlength: 240 });
    area.value = n.text;
    area.addEventListener("change", () => {
      app.checkpoint();
      n.text = area.value.trim().slice(0, 240);
      app.changed({ rebuild: "none" });
    });
    const swatches = this.el("div", { class: "row-actions" }, NOTE_COLORS.map((c) => {
      const b = this.el("button", { class: `swatch-btn ${n.color === c ? "on" : ""}`, type: "button", title: c });
      b.style.background = c;
      b.addEventListener("click", () => {
        if (n.color === c) return;
        app.checkpoint();
        n.color = c;
        app.changed({ rebuild: "none" });
      });
      return b;
    }));
    const pos = (i, label) => this.vec(n, "at", i, { label, after: () => app.notes.render() });
    this.root.append(
      this.section(null, [
        this.el("p", { class: "hint", text: `${t("note")} ${index}` }),
        this.el("label", { class: "field stack" }, [this.el("span", { class: "flabel", text: t("noteText") }), area]),
        this.check(n, "done", { label: t("noteDone"), rebuild: "none" }),
        this.field(t("tint"), swatches),
        this.color(n, "color", { nullable: false, rebuild: "none", label: t("custom") }),
      ]),
      this.section(t("position"), [pos(0, "X"), pos(1, "Y"), pos(2, "Z")]),
      this.section(null, [this.button(t("duplicate"), () => app.duplicateSelected()), this.button(t("delete"), () => app.deleteSelected(), "danger")]),
    );
  }
  renderObject({ item: o, building }) {
    const app = this.app, t = app.t;
    this.scope = building ? "building" : "site";
    const doc = o.inline || propDocSync(o.prop);
    const after = () => app.layoutObject(o.id);
    const n = (key, i, label, opts = {}) => this.vec(o, key, i, { label, after, ...opts });
    this.root.append(
      this.section(null, [
        this.el("p", { class: "hint", text: doc ? `${doc.name[app.lang] || doc.name.en} · ${doc.source.boxes.length} ${t("partsCount")}` : o.prop }),
        this.text(o, "name"),
      ]),
      this.section(t("position"), [n("at", 0, "X"), n("at", 1, "Y"), n("at", 2, "Z")]),
      this.section(t("rotation"), [n("rotation", 0, "X", { unit: "°", min: -360, max: 360 }), n("rotation", 1, "Y", { unit: "°", min: -360, max: 360 }), n("rotation", 2, "Z", { unit: "°", min: -360, max: 360 })]),
      this.section(t("scale"), [n("scale", 0, "X", { unit: "×", min: 0.05, max: 50, step: 0.05 }), n("scale", 1, "Y", { unit: "×", min: 0.05, max: 50, step: 0.05 }), n("scale", 2, "Z", { unit: "×", min: 0.05, max: 50, step: 0.05 })]),
      this.section(t("surface"), [this.material(o, "material"), this.color(o, "tint")]),
      doc?.category === "lighting" ? this.section(t("light"), this.lightFields(o)) : null,
      this.arrangeSection(),
      this.section(null, [
        this.button(t("duplicate"), () => app.duplicateSelected()),
        doc ? this.button(`✎ ${t(o.prop && customIds.has(o.prop) ? "editObject" : "editCopy")}`, () => app.editor.enter(doc)) : null,
        this.lockRow(o, o.id),
        this.button(t("delete"), () => app.deleteSelected(), "danger"),
      ]),
    );
  }
}
