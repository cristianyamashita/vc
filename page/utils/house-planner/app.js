// House Planner: bootstrap and the application object that every module
// talks to. Document units are centimetres; the Three.js scene is metres.
import * as THREE from "three";
import { TEXT, makeT, translate } from "./js/i18n.js";
import { prefs, savePrefs } from "./js/prefs.js";
import { Scene3D, M, CM } from "./js/scene.js";
import { Sun } from "./js/sun.js";
import { Terrain } from "./js/terrain.js";
import { Gizmo } from "./js/gizmo.js";
import { Tools, TAB_TOOLS } from "./js/tools.js";
import { Tree } from "./js/panels/tree.js";
import { PropsPanel } from "./js/panels/props.js";
import { History } from "./js/history.js";
import { loadTextureIndex, setTextureReadyCallback, textureIndex } from "./js/materials.js";
import { loadCatalog, catalog, getPropDoc, propObject, searchCatalog, registerCustom, customIds, propDocSync } from "./js/props.js";
import { thumbnail } from "./js/thumbs.js";
import { PropEditor } from "./js/propedit.js";
import { buildFloorGroup, floorTop, floorThickness, tileSet, tileKey, splitTiles } from "./js/build/slabs.js";
import { buildWall } from "./js/build/walls.js";
import { buildStairs, stairsCutQuads, tilesUnderQuads } from "./js/build/stairs.js";
import { buildPolygon, DEFAULT_MATERIAL } from "./js/build/outdoor.js";
import * as store from "./js/store.js";
import { freshProject, freshBuilding, freshStorey, locate, isLocked, uid, clone, OPENING_PRESETS, projectChecked } from "./js/schema.js";

const DEG = Math.PI / 180;
const $ = (s, r = document) => r.querySelector(s);
const TABS = ["terrain", "floors", "walls", "openings", "stairs", "outdoor", "garden", "objects"];
const DEFAULT_TOOL = { terrain: "raise", floors: "paint", walls: "draw", openings: "add", stairs: "place", outdoor: "polygon", garden: "polygon", objects: "place" };

class App {
  constructor() {
    this.prefs = prefs;
    this.lang = prefs.lang;
    this.t = makeT(() => this.lang);
    this.project = freshProject();
    this.state = { tab: "floors", tool: "select", selection: null, activeBuilding: null, activeStorey: null, activeFloorGroup: null, pendingPreset: "door-single", pendingProp: null, ghostYaw: 0, pendingStairShape: "straight", pendingOutdoorType: "deck", pendingGardenMaterial: DEFAULT_MATERIAL.garden, snap: prefs.snap !== false, orbitOverride: false };
    this.buildingGroups = new Map();
    this.storeyGroups = new Map();
    this.objectGroups = new Map();
    this.saveTimer = null;
    this.customProps = [];
  }
  async boot() {
    document.documentElement.setAttribute("data-theme", prefs.theme);
    document.documentElement.lang = this.lang;
    $("#lang-switcher").value = this.lang;
    this.scene = new Scene3D($("#view"), $("#viewport"));
    this.scene.setBackground(prefs.theme === "dark");
    this.sun = new Sun(this.scene.scene);
    this.terrain = new Terrain();
    this.gizmo = new Gizmo(this);
    this.tools = new Tools(this);
    this.tree = new Tree(this, $("#tree"));
    this.propsPanel = new PropsPanel(this, $("#props"));
    this.editor = new PropEditor(this);
    this.history = new History(() => this.project, (p) => this.restore(p));
    this.history.onChange(() => this.refreshHistoryButtons());
    setTextureReadyCallback(() => this.scene.requestRender());
    this.bindUI();
    await loadTextureIndex();
    try {
      this.customProps = await store.listCustomProps();
    } catch {
      this.customProps = [];
    }
    await loadCatalog(this.customProps);
    let project = null;
    try {
      if (prefs.lastProjectId) project = await store.loadProject(prefs.lastProjectId);
      if (!project) {
        const list = await store.listProjects();
        if (list[0]) project = await store.loadProject(list[0].id);
      }
    } catch (err) {
      console.warn("load failed", err);
    }
    this.setProject(project || freshProject(this.t("untitled")), { fit: true });
    this.setTab(TABS.includes(prefs.tab) ? prefs.tab : "floors");
    this.translateAll();
  }

  // --------------------------------------------------------- project

  setProject(project, { fit = false } = {}) {
    this.project = project;
    prefs.lastProjectId = project.id;
    savePrefs();
    this.state.selection = null;
    this.state.activeBuilding = project.view.activeBuilding;
    this.state.activeStorey = project.view.activeStorey;
    this.state.activeFloorGroup = null;
    this.history.clear();
    this.gizmo.detach();
    this.rebuildAll();
    if (project.view.camera) this.scene.restoreCamera(project.view.camera);
    else if (fit) this.fitAll();
    this.refreshAll();
    $("#save-status").textContent = "";
  }
  restore(project) {
    // after undo/redo: keep selection if it still exists
    this.project = project;
    if (!locate(project, this.state.activeStorey)) {
      this.state.activeBuilding = project.view.activeBuilding;
      this.state.activeStorey = project.view.activeStorey;
    }
    if (this.state.selection && !locate(project, this.state.selection)) this.state.selection = null;
    this.rebuildAll();
    this.refreshAll();
    this.queueSave();
  }
  building() {
    return this.project.buildings.find((b) => b.id === this.state.activeBuilding) || this.project.buildings[0];
  }
  storey() {
    const b = this.building();
    return b.storeys.find((s) => s.id === this.state.activeStorey) || b.storeys[0];
  }
  locate(id) {
    return locate(this.project, id);
  }
  setActive(buildingId, storeyId) {
    const b = this.project.buildings.find((x) => x.id === buildingId) || this.project.buildings[0];
    const s = b.storeys.find((x) => x.id === storeyId) || b.storeys[0];
    this.state.activeBuilding = b.id;
    this.state.activeStorey = s.id;
    this.state.activeFloorGroup = null;
    this.project.view.activeBuilding = b.id;
    this.project.view.activeStorey = s.id;
    this.applyVisibility();
    this.refreshAll();
    this.queueSave();
  }
  activeFloorGroup() {
    const s = this.storey();
    return s.floorGroups.find((g) => g.id === this.state.activeFloorGroup) || null;
  }
  ensureFloorGroup() {
    const s = this.storey();
    let fg = this.activeFloorGroup();
    if (!fg) fg = s.floorGroups.find((g) => !g.locked) || null;
    if (!fg) {
      fg = { id: uid("fg"), name: "", offset: 0, thickness: null, material: "woodFloor", tint: null, tiles: [], locked: false };
      s.floorGroups.push(fg);
    }
    this.state.activeFloorGroup = fg.id;
    return fg;
  }
  newFloorGroup() {
    const s = this.storey();
    this.checkpoint();
    const fg = { id: uid("fg"), name: "", offset: 0, thickness: null, material: "woodFloor", tint: null, tiles: [], locked: false };
    s.floorGroups.push(fg);
    this.state.activeFloorGroup = fg.id;
    this.changed({ rebuild: "none" });
    this.select(fg.id, { keepTool: true });
  }
  mergeFloorGroups(targetId) {
    const s = this.storey();
    const target = s.floorGroups.find((g) => g.id === targetId);
    if (!target) return;
    this.checkpoint();
    for (const g of s.floorGroups) if (g !== target && !g.locked) target.tiles.push(...g.tiles);
    s.floorGroups = s.floorGroups.filter((g) => g === target || g.locked);
    this.changed({ rebuild: "building" });
  }
  splitFloorGroup(id) {
    const s = this.storey();
    const fg = s.floorGroups.find((g) => g.id === id);
    if (!fg) return;
    const parts = splitTiles(fg.tiles);
    if (parts.length < 2) return;
    this.checkpoint();
    fg.tiles = parts[0];
    for (const tiles of parts.slice(1)) s.floorGroups.push({ ...clone(fg), id: uid("fg"), tiles });
    this.changed({ rebuild: "building" });
  }
  addStorey(buildingId, preset) {
    const b = this.project.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    this.checkpoint();
    const top = b.storeys.reduce((m, s) => Math.max(m, s.elevation + s.height), 0);
    const prev = { elevation: 0, height: top };
    const s = freshStorey(prev, preset);
    b.storeys.push(s);
    b.storeys.sort((x, y) => x.elevation - y.elevation);
    this.setActive(b.id, s.id);
    this.changed({ rebuild: "building" });
    this.select(s.id);
  }
  addBuilding() {
    this.checkpoint();
    const n = this.project.buildings.length;
    const b = freshBuilding("", [n * 1200, 0]);
    this.project.buildings.push(b);
    this.setActive(b.id, b.storeys[0].id);
    this.changed({ rebuild: "all" });
    this.select(b.id);
  }
  addObject(doc, { wx, wz, top, building, storey, yaw }) {
    this.checkpoint();
    const placement = { id: uid("ob"), name: "", prop: doc.id, inline: null, at: [wx, top, wz], rotation: [0, yaw, 0], scale: [1, 1, 1], tint: null, material: null, locked: false };
    if (building && storey) {
      const l = this.toLocal(building, new THREE.Vector3(wx * M, top * M, wz * M));
      placement.at = [r1(l.x), r1(l.y - storey.elevation), r1(l.z)];
      placement.rotation = [0, (yaw - building.rotation + 360) % 360, 0];
      storey.objects.push(placement);
      this.changed({ rebuild: "building", buildingId: building.id });
    } else {
      this.project.objects.push(placement);
      this.changed({ rebuild: "site" });
    }
    this.toast(`${this.t("placed")}: ${doc.name[this.lang] || doc.name.en}`);
  }
  deleteSelected() {
    const id = this.state.selection;
    const found = id && this.locate(id);
    if (!found) return this.toast(this.t("noSelection"));
    if (found.type === "terrain" || found.type === "sun") return;
    if (isLocked(this.project, id)) return this.toast(this.t("lockedItem"));
    if (found.type === "building" && this.project.buildings.length < 2) return this.toast(this.t("lastBuilding"));
    if (found.type === "storey" && found.building.storeys.length < 2) return this.toast(this.t("lastStorey"));
    if ((found.type === "building" || found.type === "storey") && !confirm(this.t("confirmDelete"))) return;
    this.checkpoint();
    if (found.type === "building") this.project.buildings = this.project.buildings.filter((b) => b !== found.item);
    else if (found.type === "storey") found.building.storeys = found.building.storeys.filter((s) => s !== found.item);
    else found.list.splice(found.list.indexOf(found.item), 1);
    this.state.selection = null;
    this.gizmo.detach();
    if (!locate(this.project, this.state.activeStorey)) {
      const b = this.project.buildings[0];
      this.state.activeBuilding = b.id;
      this.state.activeStorey = b.storeys[0].id;
    }
    this.changed({ rebuild: "all" });
    this.toast(this.t("deleted"));
  }
  duplicateSelected() {
    const found = this.state.selection && this.locate(this.state.selection);
    if (!found || !["object", "stairs", "outdoor", "garden"].includes(found.type)) return;
    this.checkpoint();
    const copy = clone(found.item);
    copy.id = uid(found.type === "object" ? "ob" : found.type === "stairs" ? "sr" : found.type === "garden" ? "g" : "d");
    copy.locked = false;
    if (copy.points) copy.points = copy.points.map(([x, z]) => [x + 50, z + 50]);
    else copy.at[0] += 50;
    found.list.push(copy);
    this.changed({ rebuild: found.building ? "building" : "site", buildingId: found.building?.id });
    this.select(copy.id);
  }
  toggleLock(id) {
    const found = this.locate(id);
    if (!found) return;
    this.checkpoint();
    found.item.locked = !found.item.locked;
    this.changed({ rebuild: "none" });
    if (this.state.selection === id) this.select(id, { keepTool: true });
  }
  toggleVisible(id) {
    const found = this.locate(id);
    if (!found || found.type !== "storey") return;
    found.item.visible = !found.item.visible;
    this.applyVisibility();
    this.refreshAll();
    this.queueSave();
  }

  // ------------------------------------------------------------ scene

  rebuildAll() {
    for (const id of [...this.buildingGroups.keys()]) this.disposeBuilding(id);
    this.scene.world.clear();
    this.objectGroups.clear();
    if (this.terrain.mesh) this.terrain.dispose();
    this.scene.world.add(this.terrain.build(this.project.terrain));
    this.terrain.setClamp(this.project.terrain.flattenUnderBuildings ? this.makeClamp() : null);
    this.siteGroup = new THREE.Group();
    this.siteGroup.name = "site";
    this.scene.world.add(this.siteGroup);
    for (const b of this.project.buildings) this.rebuildBuilding(b.id, { quiet: true });
    this.rebuildSite({ quiet: true });
    this.afterSceneChange();
  }
  disposeBuilding(id) {
    const g = this.buildingGroups.get(id);
    if (!g) return;
    g.traverse((o) => {
      if (o.isMesh && o.geometry && !o.userData.sharedGeometry) o.geometry.dispose();
      if (o.userData.kind === "object") this.objectGroups.delete(o.userData.id);
    });
    g.parent?.remove(g);
    this.buildingGroups.delete(id);
  }
  applyBuildingTransform(group, b) {
    group.position.set(b.at[0] * M, 0, b.at[1] * M);
    group.rotation.set(0, -b.rotation * DEG, 0);
  }
  rebuildBuilding(id, { quiet = false } = {}) {
    const b = this.project.buildings.find((x) => x.id === id);
    if (!b) return;
    this.disposeBuilding(id);
    const group = new THREE.Group();
    group.userData = { kind: "building", id };
    this.applyBuildingTransform(group, b);
    for (const s of b.storeys) {
      const sg = new THREE.Group();
      sg.userData = { kind: "storeyGroup", id: s.id };
      for (const fg of s.floorGroups) {
        const mesh = buildFloorGroup(fg, s, this.project.grid.tile, this.stairWells(b, s, fg));
        if (mesh) sg.add(mesh);
      }
      for (const w of s.walls) sg.add(buildWall(w, s, s.walls, this.project.grid.tile));
      for (const st of s.stairs) sg.add(buildStairs(st, s));
      for (const o of s.objects) sg.add(this.makeObjectGroup(o, s.elevation));
      group.add(sg);
      this.storeyGroups.set(s.id, sg);
    }
    this.scene.world.add(group);
    this.buildingGroups.set(id, group);
    this.applyVisibility();
    if (!quiet) this.afterSceneChange();
  }
  /** Tiles of a floor group left open by stairs from the storeys below. */
  stairWells(b, s, fg) {
    const quads = [];
    const underside = floorTop(s, fg) - floorThickness(s, fg);
    for (const lower of b.storeys) {
      if (lower.elevation >= s.elevation) continue;
      for (const st of lower.stairs) if (st.cutFloorAbove) quads.push(...stairsCutQuads(st, lower, underside));
    }
    return quads.length ? tilesUnderQuads(fg.tiles, quads, this.project.grid.tile) : null;
  }
  rebuildSite({ quiet = false } = {}) {
    if (!this.siteGroup) return;
    for (const c of [...this.siteGroup.children]) {
      this.siteGroup.remove(c);
      this.objectGroups.delete(c.userData.id);
      if (c.userData.kind !== "object") c.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    this.terrain.setCutouts(this.project.outdoor.filter((p) => p.type === "pool" && p.points.length >= 3).map((p) => p.points));
    for (const o of this.project.objects) this.siteGroup.add(this.makeObjectGroup(o, 0));
    for (const d of this.project.outdoor) {
      const g = buildPolygon(d, "outdoor", this.terrain);
      if (g) this.siteGroup.add(g);
    }
    for (const gp of this.project.gardenPatches) {
      const g = buildPolygon(gp, "garden", this.terrain);
      if (g) this.siteGroup.add(g);
    }
    if (!quiet) this.afterSceneChange();
  }
  makeObjectGroup(o, baseY) {
    const doc = o.inline || this.propDoc(o.prop);
    let g;
    if (doc) g = propObject(doc, { tint: o.tint, material: o.material });
    else {
      g = new THREE.Group();
      const ph = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x999999, wireframe: true }));
      ph.position.y = 0.25;
      g.add(ph);
      getPropDoc(o.prop).then((d) => d && this.changed({ rebuild: "all", save: false }));
    }
    g.userData = { kind: "object", id: o.id };
    g.traverse((m) => {
      if (m.isMesh) m.userData.sharedGeometry = true;
    });
    this.layoutGroup(g, o, baseY);
    this.objectGroups.set(o.id, g);
    return g;
  }
  propDoc(id) {
    return propDocSyncLocal(id);
  }
  layoutGroup(g, o, baseY) {
    g.position.set(o.at[0] * M, (o.at[1] + baseY) * M, o.at[2] * M);
    g.rotation.set(o.rotation[0] * DEG, o.rotation[1] * DEG, o.rotation[2] * DEG, "YXZ");
    g.scale.fromArray(o.scale);
  }
  layoutObject(id) {
    const found = this.locate(id);
    const g = this.objectGroups.get(id);
    if (!found || !g) return;
    this.layoutGroup(g, found.item, found.storey ? found.storey.elevation : 0);
    if (this.state.selection === id) {
      this.gizmo.syncProxy();
      this.gizmo.refreshHighlight();
    }
    this.scene.requestRender();
  }
  applyVisibility() {
    const active = this.storey();
    for (const b of this.project.buildings)
      for (const s of b.storeys) {
        const g = this.storeyGroups.get(s.id);
        if (!g) continue;
        const cut = this.project.view.cutaway && s.elevation > active.elevation;
        g.visible = s.visible && !cut;
      }
    this.scene.requestRender();
  }
  /** Sun fit, roofs, terrain clamp, grid, render. */
  afterSceneChange() {
    // the ground under slabs moved: paths and patches follow it
    if (this.terrain.setClamp(this.project.terrain.flattenUnderBuildings ? this.makeClamp() : null)) this.rebuildSite({ quiet: true });
    const box = new THREE.Box3();
    for (const g of this.buildingGroups.values()) box.union(new THREE.Box3().setFromObject(g));
    if (this.siteGroup?.children.length) box.union(new THREE.Box3().setFromObject(this.siteGroup));
    if (box.isEmpty() && this.terrain.mesh) box.setFromObject(this.terrain.mesh);
    this.sceneBounds = box;
    this.sun.fit(box);
    this.sun.apply(this.project.sun);
    const roofs = [];
    for (const b of this.project.buildings) {
      if (!b.roofShadow || !b.storeys.some((s) => s.walls.length)) continue;
      const g = this.buildingGroups.get(b.id);
      if (!g) continue;
      const bb = new THREE.Box3().setFromObject(g);
      if (bb.isEmpty()) continue;
      const top = b.storeys.reduce((m, s) => Math.max(m, s.elevation + s.height), 0) * M;
      roofs.push({ min: [bb.min.x - 0.1, 0, bb.min.z - 0.1], max: [bb.max.x + 0.1, top, bb.max.z + 0.1] });
    }
    this.sun.setRoofs(roofs);
    this.scene.requestRender();
  }
  makeClamp() {
    const items = [];
    for (const b of this.project.buildings) {
      const s = b.storeys[0];
      if (!s) continue;
      const c = Math.cos(b.rotation * DEG), sn = Math.sin(b.rotation * DEG);
      for (const fg of s.floorGroups) {
        if (!fg.tiles.length) continue;
        items.push({ b, c, sn, set: tileSet(fg), max: floorTop(s, fg) - floorThickness(s, fg) - 1 });
      }
    }
    if (!items.length) return null;
    const tile = this.project.grid.tile;
    return (x, z) => {
      let max = Infinity;
      for (const it of items) {
        const dx = x - it.b.at[0], dz = z - it.b.at[1];
        const lx = dx * it.c + dz * it.sn, lz = -dx * it.sn + dz * it.c;
        if (it.set.has(tileKey(Math.floor(lx / tile), Math.floor(lz / tile)))) max = Math.min(max, it.max);
      }
      return max;
    };
  }
  terrainTouched() {
    this.scene.requestRender();
  }
  buildingGroup(id) {
    return this.buildingGroups.get(id) || null;
  }
  /** World metres -> building-local centimetres. */
  toLocal(b, v) {
    const g = this.buildingGroups.get(b.id);
    const l = g ? g.worldToLocal(v.clone()) : v.clone();
    return { x: l.x * CM, y: l.y * CM, z: l.z * CM };
  }
  fitAll() {
    this.scene.fit(this.sceneBounds);
  }

  // ---------------------------------------------------------- changes

  checkpoint() {
    if (this.editor?.active) return this.editor.checkpoint();
    this.history.checkpoint();
  }
  /**
   * Something in the project changed. rebuild: all | building | site |
   * terrain | light | none. buildingId defaults to the selection's building
   * or the active one.
   */
  changed({ rebuild = "building", buildingId = null, light = false, terrain = false, save = true } = {}) {
    if (rebuild === "all") this.rebuildAll();
    else if (rebuild === "building") {
      const id = buildingId || this.locate(this.state.selection)?.building?.id || this.building().id;
      this.rebuildBuilding(id);
    } else if (rebuild === "site") this.rebuildSite();
    else if (rebuild === "terrain") {
      this.terrain.refreshMaterial();
      this.afterSceneChange();
    } else if (rebuild === "light" || light) {
      this.sun.apply(this.project.sun);
      this.afterSceneChange();
    }
    if (terrain) {
      this.terrain.update();
      this.sun.place();
      if (this.project.outdoor.length || this.project.gardenPatches.length) this.rebuildSite({ quiet: true });
    }
    if (this.state.selection) {
      const found = this.locate(this.state.selection);
      if (!found) {
        this.state.selection = null;
        this.gizmo.detach();
      } else this.attachSelection(found);
    }
    this.scene.requestRender();
    this.refreshAll();
    if (save) this.queueSave();
  }
  queueSave() {
    clearTimeout(this.saveTimer);
    $("#save-status").textContent = this.t("saving");
    this.saveTimer = setTimeout(() => this.saveNow(), 1500);
  }
  async saveNow() {
    clearTimeout(this.saveTimer);
    this.project.view.camera = this.scene.cameraState();
    try {
      await store.saveProject(this.project);
      $("#save-status").textContent = this.t("saved");
    } catch (err) {
      console.warn(err);
      $("#save-status").textContent = this.t("unsaved");
    }
  }
  refreshAll() {
    if (this.editor?.active) return this.editor.refreshPanels();
    this.tree.render();
    this.propsPanel.render();
    this.refreshSelectors();
    this.refreshHistoryButtons();
    this.refreshToolbar();
  }
  refreshHistoryButtons() {
    $("#undo-btn").disabled = !this.history.canUndo();
    $("#redo-btn").disabled = !this.history.canRedo();
  }
  refreshSelectors() {
    const bs = $("#building-select"), ss = $("#storey-select");
    bs.innerHTML = this.project.buildings.map((b, i) => `<option value="${b.id}">${esc(b.name || `${this.t("building")} ${i + 1}`)}</option>`).join("");
    bs.value = this.building().id;
    ss.innerHTML = this.building().storeys.map((s, i) => `<option value="${s.id}">${esc(s.name || `${this.t("storey")} ${i + 1}`)} · ${s.elevation} cm</option>`).join("");
    ss.value = this.storey().id;
  }

  // -------------------------------------------------------- selection

  select(id, { keepTool = false } = {}) {
    this.state.selection = id;
    const found = id ? this.locate(id) : null;
    if (!found) {
      this.state.selection = null;
      this.gizmo.detach();
    } else {
      if (found.storey && found.type !== "storey") {
        if (found.storey.id !== this.state.activeStorey) {
          this.state.activeBuilding = found.building.id;
          this.state.activeStorey = found.storey.id;
          this.project.view.activeBuilding = found.building.id;
          this.project.view.activeStorey = found.storey.id;
          this.applyVisibility();
        }
      } else if (found.type === "building" || found.type === "storey") {
        if (found.type === "building" && found.item.id !== this.state.activeBuilding) this.setActive(found.item.id, found.item.storeys[0].id);
        if (found.type === "storey") this.setActive(found.building.id, found.item.id);
      }
      if (found.type === "floorGroup") this.state.activeFloorGroup = found.item.id;
      this.attachSelection(found);
      if (!keepTool && found.type !== "sun" && found.type !== "terrain" && this.state.tool !== "select") this.setTool("select");
    }
    this.refreshAll();
  }
  attachSelection(found) {
    const id = found.item.id ?? found.type;
    if (found.type === "object") {
      const g = this.objectGroups.get(id);
      const parent = found.storey ? this.storeyGroups.get(found.storey.id) : this.siteGroup;
      if (g && parent) this.gizmo.attach(g, found.item, parent, { lockedOnly: isLocked(this.project, id) });
      return;
    }
    if (found.type === "stairs") {
      const g = this.findGroup(this.buildingGroups.get(found.building.id), "stairsGroup", id);
      const parent = this.storeyGroups.get(found.storey.id);
      if (g && parent) {
        const st = found.item, buildingId = found.building.id;
        const adapter = {
          planar: true, modes: ["translate", "rotate"], rebuild: "building", buildingId,
          apply: (group, { step, turn, snapTo }) => {
            st.at = [snapTo(group.position.x * CM, step), snapTo(group.position.z * CM, step)].map(r1);
            st.rotation = r1(((snapTo(group.rotation.y / DEG, turn) % 360) + 360) % 360);
            group.position.set(st.at[0] * M, group.position.y, st.at[1] * M);
            group.rotation.set(0, st.rotation * DEG, 0);
          },
        };
        this.gizmo.attach(g, st, parent, { lockedOnly: isLocked(this.project, id), adapter });
      }
      return;
    }
    if (found.type === "outdoor" || found.type === "garden") {
      const g = this.findGroup(this.siteGroup, `${found.type}Group`, id);
      if (g) {
        const poly = found.item;
        const adapter = {
          planar: true, modes: ["translate"], rebuild: "site",
          apply: (group, { step, snapTo }) => {
            const [ox, oz] = group.userData.origin || [0, 0];
            const dx = snapTo(group.position.x * CM - ox, step), dz = snapTo(group.position.z * CM - oz, step);
            if (dx || dz) poly.points = poly.points.map(([x, z]) => [r1(x + dx), r1(z + dz)]);
            group.position.set((ox + dx) * M, 0, (oz + dz) * M);
            group.userData.origin = [ox + dx, oz + dz];
          },
        };
        this.gizmo.attach(g, poly, this.siteGroup, { lockedOnly: isLocked(this.project, id), adapter });
      }
      return;
    }
    this.gizmo.control.detach();
    let obj = null;
    if (found.type === "wall" || found.type === "opening") {
      const g = this.buildingGroups.get(found.building.id);
      g?.traverse((o) => {
        if (!obj && o.userData.kind === found.type && o.userData.id === id) obj = o;
      });
    } else if (found.type === "floorGroup") {
      const g = this.buildingGroups.get(found.building.id);
      g?.traverse((o) => {
        if (!obj && o.userData.kind === "floorGroup" && o.userData.id === id) obj = o;
      });
    } else if (found.type === "building") obj = this.buildingGroups.get(id);
    else if (found.type === "storey") obj = this.storeyGroups.get(id);
    if (obj) {
      this.gizmo.highlight.setFromObject(obj);
      this.gizmo.highlight.visible = true;
    } else this.gizmo.highlight.visible = false;
    this.scene.requestRender();
  }
  findGroup(root, kind, id) {
    let out = null;
    root?.traverse((o) => {
      if (!out && o.userData.kind === kind && o.userData.id === id) out = o;
    });
    return out;
  }
  pickSelect(event) {
    const hits = this.scene.ray(event).intersectObjects(this.scene.world.children, true);
    for (const h of hits) {
      let o = h.object, visible = true;
      for (let p = o; p; p = p.parent) if (!p.visible) visible = false;
      if (!visible) continue;
      if (o.userData.kind === "terrain" && this.terrain.isCut(h.point.x * CM, h.point.z * CM)) continue; // ground inside a pool
      let kind = null, id = null;
      for (let p = o; p && !kind; p = p.parent) {
        const k = p.userData.kind;
        if (["terrain", "floorGroup", "wall", "opening", "object", "stairs", "outdoor", "garden"].includes(k)) {
          kind = k;
          id = p.userData.id;
        } else if (k === "leaf" || k === "glass") {
          kind = "wall";
          id = p.userData.wallId;
        }
      }
      if (!kind) continue;
      if (kind === "terrain") {
        if (this.state.tab === "terrain") this.select("terrain");
        else this.select(null);
        return;
      }
      this.select(id);
      return;
    }
    this.select(null);
  }

  // --------------------------------------------------------- tabs/tools

  setTab(tab) {
    if (this.editor?.active) return;
    this.state.tab = tab;
    prefs.tab = tab;
    savePrefs();
    $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    const tools = TAB_TOOLS[tab];
    const def = DEFAULT_TOOL[tab] || "select";
    if (tab === "terrain") this.state.selection = "terrain";
    else if (this.state.selection === "terrain") this.state.selection = null;
    this.setTool(tools.includes(def) ? def : "select");
  }
  setTool(tool) {
    this.state.tool = tool;
    this.tools.reset();
    this.scene.setToolActive(tool !== "select");
    if (tool !== "select") {
      this.gizmo.control.detach();
    } else if (this.state.selection) {
      const f = this.locate(this.state.selection);
      if (f) this.attachSelection(f);
    }
    this.refreshToolbar();
    this.updateLeftPanel();
    this.propsPanel.render();
    this.tree.render();
  }
  refreshToolbar() {
    const t = this.t, tab = this.state.tab, tool = this.state.tool;
    const host = $("#tools");
    host.innerHTML = TAB_TOOLS[tab].map((k) => `<button class="tb small ${k === tool ? "on" : ""}" data-tool="${k}">${esc(t(k))}</button>`).join("");
    const extra = $("#tool-extra");
    extra.innerHTML = "";
    if (tab === "floors") {
      const s = this.storey();
      const sel = document.createElement("select");
      sel.innerHTML = s.floorGroups.map((g, i) => `<option value="${g.id}">${esc(g.name || `${t("floor")} ${i + 1}`)} (${g.offset} cm)</option>`).join("");
      const active = this.activeFloorGroup();
      if (active) sel.value = active.id;
      else if (s.floorGroups[0]) this.state.activeFloorGroup = s.floorGroups[0].id;
      sel.addEventListener("change", () => {
        this.state.activeFloorGroup = sel.value;
        this.tree.render();
      });
      const btn = document.createElement("button");
      btn.className = "tb small";
      btn.textContent = `+ ${t("newGroup")}`;
      btn.addEventListener("click", () => this.newFloorGroup());
      extra.append(sel, btn);
    } else if (tab === "openings") {
      const sel = document.createElement("select");
      sel.innerHTML = Object.keys(OPENING_PRESETS).map((k) => `<option value="${k}">${esc(t(k))}</option>`).join("");
      sel.value = this.state.pendingPreset;
      sel.addEventListener("change", () => (this.state.pendingPreset = sel.value));
      extra.append(sel);
    } else if (tab === "stairs") {
      const sel = document.createElement("select");
      sel.innerHTML = ["straight", "L", "U"].map((k) => `<option value="${k}">${esc(t(`shape_${k}`))}</option>`).join("");
      sel.value = this.state.pendingStairShape;
      sel.addEventListener("change", () => {
        this.state.pendingStairShape = sel.value;
        this.tools.clearGhost();
      });
      const hint = document.createElement("label");
      hint.textContent = t("rotateGhost");
      extra.append(sel, hint);
    } else if (tab === "outdoor") {
      const sel = document.createElement("select");
      sel.innerHTML = ["deck", "pool", "path"].map((k) => `<option value="${k}">${esc(t(k))}</option>`).join("");
      sel.value = this.state.pendingOutdoorType;
      sel.addEventListener("change", () => (this.state.pendingOutdoorType = sel.value));
      const hint = document.createElement("label");
      hint.textContent = t("polygonHint");
      extra.append(sel, hint);
    } else if (tab === "garden") {
      const sel = document.createElement("select");
      sel.innerHTML = Object.keys(textureIndex).map((k) => `<option value="${k}">${esc(textureIndex[k].name[this.lang] || k)}</option>`).join("");
      sel.value = this.state.pendingGardenMaterial;
      sel.addEventListener("change", () => (this.state.pendingGardenMaterial = sel.value));
      const hint = document.createElement("label");
      hint.textContent = t("polygonHint");
      extra.append(sel, hint);
    } else if (tab === "objects") {
      const hint = document.createElement("label");
      hint.textContent = this.state.pendingProp ? `${this.state.pendingProp.name[this.lang] || this.state.pendingProp.name.en} · ${t("rotateGhost")}` : t("catalog");
      const btn = document.createElement("button");
      btn.className = "tb small";
      btn.textContent = `+ ${t("newObject")}`;
      btn.addEventListener("click", () => this.editProp(null));
      extra.append(btn, hint);
    }
    $("#snap-btn").classList.toggle("on", this.state.snap);
    $("#cutaway-btn").classList.toggle("on", this.project.view.cutaway);
  }
  updateLeftPanel() {
    const showCatalog = this.state.tab === "objects" && this.state.tool === "place";
    $("#catalog").hidden = !showCatalog;
    $("#tree").hidden = showCatalog;
    $("#tree-search").hidden = showCatalog;
    if (showCatalog) this.renderCatalog();
  }
  renderCatalog() {
    const t = this.t, lang = this.lang;
    const cat = $("#catalog-category");
    const cats = Object.entries(catalog.categories);
    cat.innerHTML = [`<option value="all">${esc(t("allCategories"))}</option>`, ...cats.map(([id, n]) => `<option value="${id}">${esc(n[lang] || n.en)}</option>`)].join("");
    cat.value = prefs.catalogCategory || "all";
    if (cat.value !== prefs.catalogCategory) cat.value = "all";
    const q = $("#catalog-search").value;
    const items = searchCatalog(q, cat.value);
    const list = $("#catalog-list");
    list.innerHTML = items.length
      ? items.map((p) => `<div class="citem ${this.state.pendingProp?.id === p.id ? "on" : ""}" data-prop="${p.id}"><img class="cthumb" alt="" data-thumb="${p.id}"><span class="cname">${esc(p.name[lang] || p.name.en)}</span><span class="ccat">${esc(catalog.categories[p.category]?.[lang] || p.category)}</span><span class="cacts"><button class="mini" data-edit="${p.id}" title="${esc(t(p.custom ? "editObject" : "editCopy"))}">✎</button>${p.custom ? `<button class="mini" data-delprop="${p.id}" title="${esc(t("delete"))}">🗑</button>` : ""}</span></div>`).join("")
      : `<p class="hint">${esc(t("noResults"))}</p>`;
    this.fillThumbs(list);
  }
  /** Render thumbnails for the visible catalog, a few per frame. */
  fillThumbs(list) {
    const imgs = [...list.querySelectorAll("img[data-thumb]")];
    const token = (this.thumbToken = (this.thumbToken || 0) + 1);
    const step = async () => {
      if (token !== this.thumbToken) return;
      const batch = imgs.splice(0, 4);
      if (!batch.length) return;
      for (const img of batch) {
        const doc = await getPropDoc(img.dataset.thumb);
        if (token !== this.thumbToken) return;
        if (doc) {
          try {
            img.src = thumbnail(doc);
          } catch (err) {
            console.warn("thumb", err);
          }
        }
      }
      requestAnimationFrame(step);
    };
    step();
  }
  async editProp(id) {
    const doc = id ? await getPropDoc(id) : null;
    if (id && !doc) return;
    this.editor.enter(doc);
  }
  async pickProp(id) {
    const doc = await getPropDoc(id);
    if (!doc) return;
    this.state.pendingProp = doc;
    this.state.ghostYaw = 0;
    this.setTool("place");
  }

  // ---------------------------------------------------------------- UI

  bindUI() {
    const t = this.t;
    $$("#tabs button").forEach((b) => b.addEventListener("click", () => this.setTab(b.dataset.tab)));
    $("#tools").addEventListener("click", (e) => {
      const b = e.target.closest("[data-tool]");
      if (b) this.setTool(b.dataset.tool);
    });
    $("#snap-btn").addEventListener("click", () => {
      this.state.snap = !this.state.snap;
      prefs.snap = this.state.snap;
      savePrefs();
      this.gizmo.applySnap();
      this.refreshToolbar();
    });
    $("#cutaway-btn").addEventListener("click", () => {
      this.project.view.cutaway = !this.project.view.cutaway;
      this.applyVisibility();
      this.afterSceneChange();
      this.refreshToolbar();
      this.queueSave();
    });
    $("#view-3d").addEventListener("click", () => this.setView("3d"));
    $("#view-top").addEventListener("click", () => this.setView("top"));
    $("#fit-btn").addEventListener("click", () => this.fitAll());
    $("#undo-btn").addEventListener("click", () => this.history.undo());
    $("#redo-btn").addEventListener("click", () => this.history.redo());
    $("#building-select").addEventListener("change", (e) => {
      const b = this.project.buildings.find((x) => x.id === e.target.value);
      if (b) this.setActive(b.id, b.storeys[0].id);
    });
    $("#storey-select").addEventListener("change", (e) => this.setActive(this.building().id, e.target.value));
    $("#add-building").addEventListener("click", () => this.addBuilding());
    $("#tree-search").addEventListener("input", (e) => {
      this.tree.query = e.target.value;
      this.tree.render();
    });
    $("#catalog-search").addEventListener("input", () => this.renderCatalog());
    $("#catalog-category").addEventListener("change", (e) => {
      prefs.catalogCategory = e.target.value;
      savePrefs();
      this.renderCatalog();
    });
    $("#catalog-list").addEventListener("click", (e) => {
      const edit = e.target.closest("[data-edit]");
      if (edit) return this.editProp(edit.dataset.edit);
      const del = e.target.closest("[data-delprop]");
      if (del) return this.editor.deleteCustom(del.dataset.delprop);
      const it = e.target.closest("[data-prop]");
      if (it) this.pickProp(it.dataset.prop);
    });
    // project menu
    const menu = $("#project-menu");
    $("#project-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
    });
    document.addEventListener("click", () => (menu.hidden = true));
    menu.addEventListener("click", (e) => {
      const b = e.target.closest("[data-action]");
      if (!b) return;
      menu.hidden = true;
      this.projectAction(b.dataset.action);
    });
    $("#import-file").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const parsed = store.parseImport(await file.text());
        if (parsed.prop) {
          await store.saveCustomProp(parsed.prop);
          registerCustom(parsed.prop);
          this.customProps.push(parsed.prop);
        } else {
          for (const p of parsed.customProps) {
            await store.saveCustomProp(p);
            registerCustom(p);
          }
          const project = parsed.project;
          const existing = await store.loadProject(project.id).catch(() => null);
          if (existing) project.id = uid("p");
          await store.saveProject(project);
          this.setProject(project, { fit: true });
        }
        this.toast(t("importOk"));
      } catch (err) {
        console.warn(err);
        this.toast(t("importError"));
      }
    });
    // dialogs
    $$("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
    $("#help-btn").addEventListener("click", () => $("#help-dialog").showModal());
    $("#lang-switcher").addEventListener("change", (e) => {
      this.lang = e.target.value;
      prefs.lang = this.lang;
      savePrefs();
      document.documentElement.lang = this.lang;
      this.translateAll();
      this.refreshAll();
      if (!$("#catalog").hidden) this.renderCatalog();
    });
    $("#theme-switcher").addEventListener("click", () => {
      prefs.theme = prefs.theme === "dark" ? "light" : "dark";
      savePrefs();
      document.documentElement.setAttribute("data-theme", prefs.theme);
      this.scene.setBackground(prefs.theme === "dark");
    });
    // keyboard
    document.addEventListener("keydown", (e) => this.onKey(e));
    document.addEventListener("keyup", (e) => {
      if (e.key === "Alt") {
        this.state.orbitOverride = false;
        this.scene.applyButtons(false);
      }
    });
    window.addEventListener("beforeunload", () => {
      if (this.saveTimer) this.saveNow();
    });
  }
  setView(view) {
    this.scene.setView(view);
    this.gizmo.setCamera(this.scene.camera);
    $("#view-3d").classList.toggle("on", view === "3d");
    $("#view-top").classList.toggle("on", view === "top");
  }
  onKey(e) {
    const tag = document.activeElement?.tagName;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(tag) || document.querySelector("dialog[open]")) {
      if (e.key === "Escape") document.activeElement?.blur?.();
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "Alt") {
      this.state.orbitOverride = true;
      this.scene.applyButtons(true);
      e.preventDefault();
      return;
    }
    if (this.editor?.active) {
      if (mod && e.key.toLowerCase() === "z") (e.shiftKey ? this.editor.redo() : this.editor.undo());
      else if (mod && e.key.toLowerCase() === "y") this.editor.redo();
      else if (mod && e.key.toLowerCase() === "d") this.editor.duplicatePart();
      else if (mod && e.key.toLowerCase() === "s") this.editor.save();
      else if (e.key === "Delete" || e.key === "Backspace") this.editor.deletePart();
      else if (e.key === "Escape") this.editor.cancel();
      else if (/^[wW]$/.test(e.key)) this.editor.app.gizmo.setMode("translate");
      else if (/^[eE]$/.test(e.key)) this.editor.app.gizmo.setMode("rotate");
      else if (/^[rR]$/.test(e.key)) this.editor.app.gizmo.setMode("scale");
      else if (/^[fF]$/.test(e.key)) this.editor.frame();
      else if (e.key === "?") $("#help-dialog").showModal();
      else return;
      if (/^[wWeErR]$/.test(e.key)) this.editor.renderToolbar();
      e.preventDefault();
      return;
    }
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) this.history.redo();
      else this.history.undo();
      return;
    }
    if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      this.history.redo();
      return;
    }
    if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      this.duplicateSelected();
      return;
    }
    if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      this.saveNow();
      return;
    }
    if (mod) return;
    switch (e.key) {
      case "?": $("#help-dialog").showModal(); break;
      case "Escape":
        if (this.tools.busy) this.tools.cancel();
        else if (this.state.tool !== "select") this.setTool("select");
        else this.select(null);
        break;
      case "Enter":
        if (this.tools.poly) this.tools.closePolygon();
        else return;
        break;
      case "Delete": case "Backspace": this.deleteSelected(); break;
      case "v": case "V": this.setTool("select"); break;
      case "w": case "W": this.gizmo.setMode("translate"); break;
      case "e": case "E": this.gizmo.setMode("rotate"); break;
      case "r": case "R": this.gizmo.setMode("scale"); break;
      case "[": this.tools.rotateGhost(-15); break;
      case "]": this.tools.rotateGhost(15); break;
      case "f": case "F": this.fitAll(); break;
      default:
        if (/^[1-8]$/.test(e.key)) this.setTab(TABS[Number(e.key) - 1]);
        else return;
    }
    e.preventDefault();
  }
  async projectAction(action) {
    const t = this.t;
    if (this.editor?.active) return this.toast(t("finishEditing"));
    switch (action) {
      case "new":
        await this.saveNow();
        this.setProject(freshProject(t("untitled")), { fit: true });
        this.queueSave();
        break;
      case "save": await this.saveNow(); this.toast(t("saved")); break;
      case "saveAs": {
        await this.saveNow();
        const copy = clone(this.project);
        copy.id = uid("p");
        copy.name = `${copy.name || t("untitled")} (2)`;
        await store.saveProject(copy);
        this.setProject(projectChecked(copy));
        this.queueSave();
        break;
      }
      case "export":
        store.download(store.exportProject(this.project, this.customProps), store.safeFilename(this.project.name, ""));
        this.toast(t("exported"));
        break;
      case "import": $("#import-file").click(); break;
      case "open": await this.openProjectsDialog(); break;
    }
  }
  async openProjectsDialog() {
    const t = this.t;
    await this.saveNow();
    const list = await store.listProjects();
    const host = $("#projects-list");
    host.innerHTML = list.length
      ? `<div class="plist">${list.map((p) => `<div class="pitem" data-id="${p.id}"><span class="pname">${esc(p.name || t("untitled"))}</span><span class="pdate">${new Date(p.updatedAt).toLocaleString(this.lang)}</span><button class="tb small" data-open="${p.id}">${esc(t("open"))}</button><button class="tb small danger" data-del="${p.id}">${esc(t("delete"))}</button></div>`).join("")}</div>`
      : `<p class="hint">${esc(t("noProjects"))}</p>`;
    host.onclick = async (e) => {
      const open = e.target.closest("[data-open]") || e.target.closest(".pname")?.parentElement;
      const del = e.target.closest("[data-del]");
      if (del) {
        const p = list.find((x) => x.id === del.dataset.del);
        if (!confirm(t("confirmDeleteProject", { name: p?.name || t("untitled") }))) return;
        await store.deleteProject(del.dataset.del);
        if (del.dataset.del === this.project.id) {
          this.setProject(freshProject(t("untitled")), { fit: true });
          this.queueSave();
        }
        this.openProjectsDialog();
        return;
      }
      if (open) {
        const id = open.dataset.open || open.dataset.id;
        const project = await store.loadProject(id);
        if (project) this.setProject(project);
        $("#projects-dialog").close();
      }
    };
    $("#projects-dialog").showModal();
  }
  translateAll() {
    translate(document, this.t);
    document.title = this.t("title");
  }
  toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (el.hidden = true), 1800);
  }
  showMeasure(text) {
    const el = $("#measure");
    el.textContent = text;
    el.hidden = !text;
    clearTimeout(this.measureTimer);
    this.measureTimer = setTimeout(() => (el.hidden = true), 1200);
  }
  savePrefs() {
    savePrefs();
  }
}

import { propDocSync as propDocSyncLocal } from "./js/props.js";
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const r1 = (v) => Math.round(v * 10) / 10;

const app = new App();
window.HousePlanner = app;
app.boot().catch((err) => {
  console.error(err);
  const el = document.createElement("pre");
  el.style.cssText = "position:fixed;inset:auto 10px 10px 10px;background:#fff;color:#c00;padding:10px;border-radius:8px;z-index:99;white-space:pre-wrap";
  el.textContent = `Failed to start: ${err?.message || err}`;
  document.body.append(el);
});
void TEXT;
