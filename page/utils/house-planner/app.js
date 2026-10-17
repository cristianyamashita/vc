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
import { loadTextureIndex, setTextureReadyCallback, isCustomTexture } from "./js/materials.js";
import { loadCatalog, catalog, getPropDoc, propObject, searchCatalog, registerCustom, registerGenerated, customIds, propDocSync } from "./js/props.js";
import { thumbnail, clearThumbs } from "./js/thumbs.js";
import { TextureManager, textureControl, fillTextureSelect } from "./js/textures.js";
import { KITCHEN_UNITS, kitchenDocs } from "./js/build/kitchen.js";
import { PropEditor } from "./js/propedit.js";
import { Dims } from "./js/dims.js";
import { Night } from "./js/night.js";
import { Notes } from "./js/notes.js";
import { buildFloorGroup, floorTop, floorThickness, tileSet, tileKey, splitTiles } from "./js/build/slabs.js";
import { buildWall } from "./js/build/walls.js";
import { buildStairs, stairsCutQuads, tilesUnderQuads } from "./js/build/stairs.js";
import { buildPolygon, polygonOutline, DEFAULT_MATERIAL, WATER_TYPES } from "./js/build/outdoor.js";
import { buildSiteWall } from "./js/build/sitewall.js";
import { buildRoof } from "./js/build/roof.js";
import { buildRailing, railingOffset } from "./js/build/railing.js";
import { Walk } from "./js/walk.js";
import { renderPlan } from "./js/plan2d.js";
import { propBounds } from "./js/props.js";
import * as store from "./js/store.js";
import { freshProject, freshBuilding, freshStorey, freshNote, locate, isLocked, uid, clone, OPENING_PRESETS, OUTDOOR_TYPES, projectChecked, findBuilding, topStorey, RAILING_STYLES, FENCE_STYLES, GATE_TYPES, WALL_TOPS } from "./js/schema.js";

const DEG = Math.PI / 180;
const $ = (s, r = document) => r.querySelector(s);
const TABS = ["terrain", "floors", "walls", "openings", "stairs", "outdoor", "garden", "objects"];
// Keyboard shortcuts shown in parentheses on labels. Global ones are unique;
// tool keys are per tab (only the active tab's tools listen).
const HOTKEYS = {
  menu: { new: "N", open: "O", save: "S", saveAs: "Shift+S", export: "X", import: "I", exportPlan: "P", exportView: "Shift+P" },
  view: { "snap-btn": "G", "cutaway-btn": "C", "doors-btn": "B", "night-btn": "J", "view-3d": "Q", "view-top": "T", "view-walk": "K", "fit-btn": "F" },
  modes: { translate: "W", rotate: "E", scale: "R", dims: "M" },
  tools: { select: "V", raise: "A", lower: "Z", flatten: "L", smooth: "U", paint: "A", erase: "Z", rect: "L", draw: "A", railing: "L", add: "A", gate: "L", place: "A", polygon: "A", fence: "L", siteWall: "U", kitchen: "L", note: "U" },
};
const DEFAULT_TOOL = { terrain: "raise", floors: "paint", walls: "draw", openings: "add", stairs: "place", outdoor: "polygon", garden: "polygon", objects: "place" };

class App {
  constructor() {
    this.prefs = prefs;
    this.lang = prefs.lang;
    this.t = makeT(() => this.lang);
    this.project = freshProject();
    this.state = { tab: "floors", tool: "select", selection: null, activeBuilding: null, activeStorey: null, activeFloorGroup: null, pendingPreset: "door-single", pendingProp: null, ghostYaw: 0, pendingStairShape: "straight", pendingOutdoorType: "deck", pendingStreamWidth: 120, pendingGardenMaterial: DEFAULT_MATERIAL.garden, pendingRailingStyle: "glass", pendingFenceStyle: "picket", pendingGateType: "single", pendingWallTop: "follow", pendingKitchenUnit: "base", kitchenFinish: { material: null, tint: "#ece7dd" }, snap: prefs.snap !== false, orbitOverride: false, transformMode: null, caps: [] };
    this.buildingGroups = new Map();
    this.storeyGroups = new Map();
    this.roofGroups = new Map();
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
    this.walk = new Walk(this);
    this.tree = new Tree(this, $("#tree"));
    this.propsPanel = new PropsPanel(this, $("#props"));
    this.editor = new PropEditor(this);
    this.dims = new Dims(this);
    this.night = new Night(this);
    this.notes = new Notes(this);
    this.scene.onFrame = () => {
      this.dims.update();
      this.notes.update();
      this.night.frame();
    };
    this.history = new History(() => this.project, (p) => this.restore(p));
    this.history.onChange(() => this.refreshHistoryButtons());
    setTextureReadyCallback((id) => {
      this.scene.requestRender();
      if (isCustomTexture(id)) {
        // thumbnails rendered before the image arrived show a white stand-in
        clearThumbs();
        if (!$("#catalog").hidden) this.renderCatalog();
      }
    });
    this.textures = new TextureManager(this);
    this.bindUI();
    await loadTextureIndex();
    await this.textures.load(); // before the project: its ids must pass validation
    try {
      this.customProps = await store.listCustomProps();
    } catch {
      this.customProps = [];
    }
    await loadCatalog(this.customProps);
    for (const doc of kitchenDocs()) registerGenerated(doc);
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
    this.walk?.exit();
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
    if (preset === "attic") {
      // start from the storey below: same floor and knee walls, no openings
      const below = b.storeys.reduce((m, x) => (x.elevation + x.height > m.elevation + m.height ? x : m), b.storeys[0]);
      s.floorGroups = below.floorGroups.map((fg) => ({ ...clone(fg), id: uid("fg"), name: "", locked: false }));
      s.walls = below.walls.map((w) => ({ ...clone(w), id: uid("w"), name: "", height: null, openings: [], locked: false }));
      if (b.roof) {
        b.roof.ceiling = false;
        if (b.roof.type === "none" || b.roof.type === "flat") b.roof.type = "gable";
      }
    }
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
    if (!found || !["object", "stairs", "outdoor", "garden", "railing", "fence", "siteWall", "note"].includes(found.type)) return;
    this.checkpoint();
    const copy = clone(found.item);
    copy.id = uid({ object: "ob", stairs: "sr", garden: "g", outdoor: "d", railing: "rl", fence: "fe", siteWall: "sw", note: "nt" }[found.type]);
    copy.locked = false;
    if (copy.gates) for (const g of copy.gates) g.id = uid("gt");
    if (copy.points) copy.points = copy.points.map(([x, z]) => [x + 50, z + 50]);
    else copy.at[0] += 50;
    found.list.push(copy);
    this.changed({ rebuild: found.type === "note" ? "none" : found.building ? "building" : "site", buildingId: found.building?.id });
    this.select(copy.id);
  }
  toggleLock(id) {
    if (id.startsWith("roof:")) {
      const b = findBuilding(this.project, id.slice(5));
      if (!b) return;
      this.checkpoint();
      b.roof.locked = !b.roof.locked;
      this.changed({ rebuild: "none" });
      return;
    }
    const found = this.locate(id);
    if (!found) return;
    this.checkpoint();
    found.item.locked = !found.item.locked;
    this.changed({ rebuild: "none" });
    if (this.state.selection === id) this.select(id, { keepTool: true });
  }
  toggleVisible(id) {
    if (id.startsWith("roof:")) {
      const b = findBuilding(this.project, id.slice(5));
      if (!b) return;
      b.roof.visible = !b.roof.visible;
      this.applyVisibility();
      this.refreshAll();
      this.queueSave();
      return;
    }
    const found = this.locate(id);
    if (!found || found.type !== "storey") return;
    found.item.visible = !found.item.visible;
    // a hidden storey folds up in the list; showing it again unfolds it
    if (found.item.visible) this.tree.collapsed.delete(`s:${id}`);
    else this.tree.collapsed.add(`s:${id}`);
    this.applyVisibility();
    this.refreshAll();
    this.queueSave();
  }

  // ------------------------------------------------------------ scene

  rebuildAll() {
    for (const id of [...this.buildingGroups.keys()]) this.disposeBuilding(id);
    this.scene.world.clear();
    this.objectGroups.clear();
    this.scene.world.add(this.terrain.ensure(this.project.terrain));
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
    this.roofGroups.delete(id);
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
      for (const w of s.walls) sg.add(buildWall(w, s, s.walls, this.project.grid.tile, { doorsOpen: this.project.view.doorsOpen }));
      for (const st of s.stairs) sg.add(buildStairs(st, s));
      for (const r of s.railings) sg.add(buildRailing(r, "railing", { baseY: s.elevation + railingOffset(r, s, this.project.grid.tile), storeyId: s.id }));
      for (const o of s.objects) sg.add(this.makeObjectGroup(o, s.elevation));
      group.add(sg);
      this.storeyGroups.set(s.id, sg);
    }
    const roof = buildRoof(b, this.project.grid.tile);
    if (roof) {
      group.add(roof);
      this.roofGroups.set(id, roof);
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
    this.terrain.setCutouts(this.project.outdoor.filter((p) => WATER_TYPES.includes(p.type)).map((p) => polygonOutline(p)).filter((pts) => pts.length >= 3));
    for (const o of this.project.objects) this.siteGroup.add(this.makeObjectGroup(o, 0));
    for (const d of this.project.outdoor) {
      const g = buildPolygon(d, "outdoor", this.terrain);
      if (g) this.siteGroup.add(g);
    }
    for (const gp of this.project.gardenPatches) {
      const g = buildPolygon(gp, "garden", this.terrain);
      if (g) this.siteGroup.add(g);
    }
    for (const f of this.project.fences) this.siteGroup.add(buildRailing(f, "fence", { heightAt: (x, z) => this.terrain.heightAt(x, z) }));
    for (const w of this.project.siteWalls) this.siteGroup.add(buildSiteWall(w, this.terrain));
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
    if (doc && this.night.isLamp(o, doc)) {
      const glow = this.night.glowMesh(doc);
      if (glow) g.add(glow);
    }
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
    for (const b of this.project.buildings) {
      for (const s of b.storeys) {
        const g = this.storeyGroups.get(s.id);
        if (!g) continue;
        const cut = this.project.view.cutaway && s.elevation > active.elevation;
        g.visible = s.visible && !cut;
      }
      const rg = this.roofGroups.get(b.id);
      if (rg) rg.visible = this.roofShown(b);
    }
    this.updateSunRoofs();
    this.scene.requestRender();
  }
  /**
   * Whether the real roof of a building is drawn: it hides with its top
   * storey, in cutaway, and while a lower storey of that building is active.
   */
  roofShown(b) {
    const top = topStorey(b);
    if (!top || !b.roof || b.roof.type === "none" || !b.roof.visible || !top.visible) return false;
    if (this.project.view.cutaway) return false;
    if (b.id === this.state.activeBuilding && this.state.activeStorey !== top.id) return false;
    return true;
  }
  /** Invisible shadow-only roofs for buildings whose real roof is not drawn. */
  updateSunRoofs() {
    const roofs = [];
    for (const b of this.project.buildings) {
      if (!b.roofShadow || this.roofShown(b) || !b.storeys.some((s) => s.walls.length)) continue;
      const g = this.buildingGroups.get(b.id);
      if (!g) continue;
      const bb = new THREE.Box3().setFromObject(g);
      if (bb.isEmpty()) continue;
      const top = b.storeys.reduce((m, s) => Math.max(m, s.elevation + s.height), 0) * M;
      roofs.push({ min: [bb.min.x - 0.1, 0, bb.min.z - 0.1], max: [bb.max.x + 0.1, top, bb.max.z + 0.1] });
    }
    this.sun.setRoofs(roofs);
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
    this.updateSunRoofs();
    this.night.update();
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
    if (this.walk.active) this.setView("3d");
    this.scene.fit(this.sceneBounds);
  }
  /** World bounding box of the selection's scene group, or null. */
  selectionBox(found = this.state.selection && this.locate(this.state.selection)) {
    if (!found) return null;
    const target = this.transformTarget(found);
    if (!target?.group) return null;
    const box = new THREE.Box3().setFromObject(target.group);
    return box.isEmpty() ? null : box;
  }
  /** F: frame the selection from the current angle, or everything. */
  frameSelection() {
    if (this.walk.active) return;
    const box = this.selectionBox();
    if (box) this.scene.fit(box, { keepDirection: true });
    else this.fitAll();
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
  changed({ rebuild = "building", buildingId = null, light = false, terrain = false, save = true, panels = true } = {}) {
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
      if (this.project.outdoor.length || this.project.gardenPatches.length || this.project.fences.length || this.project.siteWalls.length) this.rebuildSite({ quiet: true });
    }
    if (this.state.selection) {
      const found = this.locate(this.state.selection);
      if (!found) {
        this.state.selection = null;
        this.gizmo.detach();
      } else this.attachSelection(found);
    }
    this.scene.requestRender();
    if (panels) this.refreshAll();
    else this.refreshHistoryButtons();
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
    this.renderSelectionBar();
    this.tree.render();
    this.propsPanel.render();
    this.notes.render();
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
    const changedId = id !== this.state.selection;
    if (changedId) this.state.transformMode = null;
    this.state.selection = id;
    const found = id ? this.locate(id) : null;
    if (!found) {
      this.state.selection = null;
      this.state.caps = [];
      this.gizmo.detach();
      this.dims.hide();
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
      if (changedId && !this.walk?.active && found.type !== "sun" && found.type !== "terrain") {
        const box = this.selectionBox(found);
        if (box) this.scene.centerOn(box.getCenter(new THREE.Vector3()));
      }
      if (!keepTool && found.type !== "sun" && found.type !== "terrain" && this.state.tool !== "select") this.setTool("select");
    }
    this.refreshAll();
  }
  /** Modes the selection can be transformed with, and its scene group. */
  transformTarget(found) {
    const id = found.item.id ?? found.type;
    const locked = found.type !== "sun" && found.type !== "terrain" && isLocked(this.project, id);
    const T = (group, parent, placement, adapter, modes) => (group && parent ? { group, parent, placement, adapter, modes, locked } : null);
    const bGroup = found.building ? this.buildingGroups.get(found.building.id) : null;
    const sGroup = found.storey ? this.storeyGroups.get(found.storey.id) : null;
    switch (found.type) {
      case "object":
        return T(this.objectGroups.get(id), found.storey ? sGroup : this.siteGroup, found.item, null, ["translate", "rotate", "scale"]);
      case "stairs": {
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
        return T(this.findGroup(bGroup, "stairsGroup", id), sGroup, st, adapter, adapter.modes);
      }
      case "outdoor":
      case "garden": {
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
        return T(this.findGroup(this.siteGroup, `${found.type}Group`, id), this.siteGroup, poly, adapter, adapter.modes);
      }
      case "floorGroup": {
        const fg = found.item, tile = this.project.grid.tile, buildingId = found.building.id;
        const adapter = {
          planar: true, modes: ["translate", "rotate"], rebuild: "building", buildingId,
          apply: (group) => {
            const [ox, oz] = (group.userData.origin || [0, 0]).map((v) => v * CM); // metres -> cm
            const dx = Math.round((group.position.x * CM - ox) / tile), dz = Math.round((group.position.z * CM - oz) / tile);
            const q = ((Math.round(group.rotation.y / (Math.PI / 2)) % 4) + 4) % 4;
            if (q) {
              const xs = fg.tiles.map((t) => t[0]), zs = fg.tiles.map((t) => t[1]);
              const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, cz = (Math.min(...zs) + Math.max(...zs) + 1) / 2;
              for (let k = 0; k < q; k++)
                fg.tiles = fg.tiles.map(([x, z]) => {
                  const u = x + 0.5 - cx, v = z + 0.5 - cz; // quarter turn about Y: x' = z, z' = -x
                  return [Math.floor(cx + v), Math.floor(cz - u)];
                });
            }
            if (dx || dz) fg.tiles = fg.tiles.map(([x, z]) => [x + dx, z + dz]);
            group.position.set(ox * M, group.position.y, oz * M);
            group.rotation.set(0, 0, 0);
          },
        };
        return T(this.findGroup(bGroup, "floorGroup", id), sGroup, fg, adapter, adapter.modes);
      }
      case "wall": {
        const w = found.item, buildingId = found.building.id;
        const adapter = {
          planar: true, modes: ["translate", "rotate"], rebuild: "building", buildingId,
          apply: (group, { step, turn, snapTo }) => {
            const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
            const theta0 = Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]);
            const ax = snapTo(group.position.x * CM, step), az = snapTo(group.position.z * CM, step);
            // only a rotate drag changes the angle, by a snapped delta
            const delta = this.gizmo.mode === "rotate" ? snapTo((-group.rotation.y - theta0) / DEG, turn) * DEG : 0;
            const theta = theta0 + delta;
            w.a = [r1(ax), r1(az)];
            w.b = [r1(ax + Math.cos(theta) * L), r1(az + Math.sin(theta) * L)];
            group.position.set(w.a[0] * M, group.position.y, w.a[1] * M);
            group.rotation.set(0, -theta, 0);
          },
        };
        return T(this.findGroup(bGroup, "wallGroup", id), sGroup, w, adapter, adapter.modes);
      }
      case "opening": {
        const op = found.item, wall = found.wall, buildingId = found.building.id;
        const adapter = {
          planar: true, modes: ["translate"], rebuild: "building", buildingId, space: "local", axes: { x: true, y: false, z: false },
          apply: (group, { step, snapTo }) => {
            const L = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
            op.offset = r1(Math.max(0, Math.min(L - op.width, snapTo(group.position.x * CM - op.width / 2, step))));
            group.position.set((op.offset + op.width / 2) * M, group.position.y, 0);
            group.rotation.set(0, 0, 0);
          },
        };
        const hit = this.findGroup(bGroup, "opening", id);
        return T(hit, hit?.parent, op, adapter, adapter.modes);
      }
      case "building": {
        const b = found.item;
        const adapter = {
          planar: true, modes: ["translate", "rotate"], rebuild: "all",
          apply: (group, { step, turn, snapTo }) => {
            b.at = [r1(snapTo(group.position.x * CM, step)), r1(snapTo(group.position.z * CM, step))];
            if (this.gizmo.mode === "rotate") {
              const delta = snapTo(-group.rotation.y / DEG - b.rotation, turn);
              b.rotation = r1((((b.rotation + delta) % 360) + 360) % 360);
            }
            this.applyBuildingTransform(group, b);
          },
        };
        return T(bGroup, this.scene.world, b, adapter, adapter.modes);
      }
      case "railing":
      case "fence": {
        const fence = found.type === "fence";
        const item = found.item;
        const adapter = {
          planar: true, modes: ["translate", "rotate"], rebuild: fence ? "site" : "building", buildingId: found.building?.id || null,
          apply: (group, { step, turn, snapTo }) => {
            const [ox, oz] = group.userData.origin || item.points[0] || [0, 0];
            const dx = snapTo(group.position.x * CM - ox, step), dz = snapTo(group.position.z * CM - oz, step);
            const ang = this.gizmo.mode === "rotate" ? snapTo(-group.rotation.y / DEG, turn) * DEG : 0;
            if (dx || dz || ang) {
              const c = Math.cos(ang), sn = Math.sin(ang);
              item.points = item.points.map(([x, z]) => {
                const rx = x - ox, rz = z - oz;
                return [r1(ox + dx + rx * c - rz * sn), r1(oz + dz + rx * sn + rz * c)];
              });
            }
            group.position.set((ox + dx) * M, group.position.y, (oz + dz) * M);
            group.rotation.set(0, 0, 0);
            group.userData.origin = [ox + dx, oz + dz];
          },
        };
        const root = fence ? this.siteGroup : bGroup;
        return T(this.findGroup(root, `${found.type}Group`, id), fence ? this.siteGroup : sGroup, item, adapter, adapter.modes);
      }
      case "siteWall": {
        const item = found.item;
        const adapter = {
          planar: true, modes: ["translate", "rotate"], rebuild: "site",
          apply: (group, { step, turn, snapTo }) => {
            const [ox, oz] = group.userData.origin || item.points[0] || [0, 0];
            const dx = snapTo(group.position.x * CM - ox, step), dz = snapTo(group.position.z * CM - oz, step);
            const ang = this.gizmo.mode === "rotate" ? snapTo(-group.rotation.y / DEG, turn) * DEG : 0;
            if (dx || dz || ang) {
              const c = Math.cos(ang), sn = Math.sin(ang);
              item.points = item.points.map(([x, z]) => {
                const rx = x - ox, rz = z - oz;
                return [r1(ox + dx + rx * c - rz * sn), r1(oz + dz + rx * sn + rz * c)];
              });
            }
            group.position.set((ox + dx) * M, group.position.y, (oz + dz) * M);
            group.rotation.set(0, 0, 0);
            group.userData.origin = [ox + dx, oz + dz];
          },
        };
        return T(this.findGroup(this.siteGroup, "siteWallGroup", id), this.siteGroup, item, adapter, adapter.modes);
      }
      case "gate": {
        const hit = this.findGroup(this.siteGroup, "gate", id);
        return hit ? { group: hit, parent: hit.parent, placement: found.item, adapter: null, modes: [], locked } : null;
      }
      case "storey":
        return sGroup ? { group: sGroup, parent: bGroup, placement: found.item, adapter: null, modes: [], locked } : null;
      default:
        return null;
    }
  }
  attachSelection(found) {
    const target = this.transformTarget(found);
    this.state.caps = target && !target.locked ? target.modes : [];
    this.dims.show(target?.group || (found.type === "terrain" ? this.terrain.mesh : null));
    if (!target) {
      this.gizmo.detach();
      return;
    }
    const mode = this.state.transformMode;
    if (!mode || !this.state.caps.includes(mode)) {
      this.gizmo.control.detach();
      this.gizmo.target = null;
      this.gizmo.highlight.setFromObject(target.group);
      this.gizmo.highlight.visible = true;
      this.scene.requestRender();
      return;
    }
    this.gizmo.mode = mode;
    this.gizmo.attach(target.group, target.placement, target.parent, { lockedOnly: target.locked, adapter: target.adapter });
    this.gizmo.setMode(mode);
  }
  /** Mode buttons: null hides the handles, a mode shows them (toggle). */
  setTransformMode(mode) {
    if (this.editor?.active) {
      this.gizmo.setMode(mode);
      this.editor.renderToolbar();
      return;
    }
    this.state.transformMode = this.state.transformMode === mode ? null : mode;
    const found = this.state.selection && this.locate(this.state.selection);
    if (found) this.attachSelection(found);
    this.renderSelectionBar();
    this.propsPanel.render();
  }
  toggleDims() {
    this.dims.setEnabled(!this.dims.enabled);
    this.renderSelectionBar();
    this.propsPanel.render();
  }
  /** Row above the tree: move / rotate / scale / measures for the selection. */
  renderSelectionBar() {
    const host = $("#sel-actions"), t = this.t;
    const found = this.state.selection && this.locate(this.state.selection);
    if (!found) {
      host.hidden = true;
      return;
    }
    const icons = { translate: "↔", rotate: "⟳", scale: "⤢" };
    const caps = this.state.caps || [];
    host.hidden = false;
    host.innerHTML =
      ["translate", "rotate", "scale"].map((m) => `<button class="tb mode ${this.state.transformMode === m ? "on" : ""}" data-mode="${m}" ${caps.includes(m) ? "" : "disabled"} title="${esc(t(m))} (${HOTKEYS.modes[m]})"><span class="mico">${icons[m]}</span><span class="mlabel">${esc(t(m))}</span></button>`).join("") +
      `<button class="tb mode ${this.dims.enabled ? "on" : ""}" data-dims title="${esc(t("dims"))} (${HOTKEYS.modes.dims})"><span class="mico">📏</span><span class="mlabel">${esc(t("dims"))}</span></button>`;
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
        if (["terrain", "floorGroup", "wall", "opening", "object", "stairs", "outdoor", "garden", "roof", "railing", "fence", "gate", "siteWall"].includes(k)) {
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
    if (tool !== "select" && this.walk?.active) this.setView("3d");
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
    host.innerHTML = TAB_TOOLS[tab].map((k) => `<button class="tb small ${k === tool ? "on" : ""}" data-tool="${k}">${esc(t(k))}${hk(HOTKEYS.tools[k])}</button>`).join("");
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
    } else if (tab === "walls" && tool === "railing") {
      const sel = document.createElement("select");
      sel.innerHTML = RAILING_STYLES.map((k) => `<option value="${k}">${esc(t(`style_${k}`))}</option>`).join("");
      sel.value = this.state.pendingRailingStyle;
      sel.addEventListener("change", () => {
        this.state.pendingRailingStyle = sel.value;
        this.tools.clearGhost();
      });
      const hint = document.createElement("label");
      hint.textContent = t("lineHint");
      extra.append(sel, hint);
    } else if (tab === "garden" && tool === "fence") {
      const sel = document.createElement("select");
      sel.innerHTML = FENCE_STYLES.map((k) => `<option value="${k}">${esc(t(`style_${k}`))}</option>`).join("");
      sel.value = this.state.pendingFenceStyle;
      sel.addEventListener("change", () => {
        this.state.pendingFenceStyle = sel.value;
        this.tools.clearGhost();
      });
      const hint = document.createElement("label");
      hint.textContent = t("lineHint");
      extra.append(sel, hint);
    } else if (tab === "garden" && tool === "siteWall") {
      const sel = document.createElement("select");
      sel.innerHTML = WALL_TOPS.map((k) => `<option value="${k}">${esc(t(`top_${k}`))}</option>`).join("");
      sel.value = this.state.pendingWallTop;
      sel.addEventListener("change", () => {
        this.state.pendingWallTop = sel.value;
        this.tools.clearGhost();
      });
      const hint = document.createElement("label");
      hint.textContent = t("lineHint");
      extra.append(sel, hint);
    } else if (tab === "openings" && tool === "gate") {
      const sel = document.createElement("select");
      sel.innerHTML = GATE_TYPES.map((k) => `<option value="${k}">${esc(t(`gate_${k}`))}</option>`).join("");
      sel.value = this.state.pendingGateType;
      sel.addEventListener("change", () => (this.state.pendingGateType = sel.value));
      const hint = document.createElement("label");
      hint.textContent = t("gateHint");
      extra.append(sel, hint);
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
      sel.innerHTML = OUTDOOR_TYPES.map((k) => `<option value="${k}">${esc(t(k))}</option>`).join("");
      sel.value = this.state.pendingOutdoorType;
      sel.addEventListener("change", () => {
        this.state.pendingOutdoorType = sel.value;
        this.tools.reset();
        this.refreshToolbar();
      });
      extra.append(sel);
      if (this.state.pendingOutdoorType === "stream") {
        const w = document.createElement("input");
        w.type = "number";
        w.min = 20;
        w.max = 1000;
        w.step = 10;
        w.value = this.state.pendingStreamWidth;
        w.title = t("streamWidth");
        w.style.width = "64px";
        w.addEventListener("change", () => (this.state.pendingStreamWidth = Math.min(1000, Math.max(20, Number(w.value) || 120))));
        extra.append(w);
      }
      const hint = document.createElement("label");
      hint.textContent = t(this.state.pendingOutdoorType === "stream" ? "lineHint" : "polygonHint");
      extra.append(hint);
    } else if (tab === "garden") {
      const sel = fillTextureSelect(document.createElement("select"), { value: this.state.pendingGardenMaterial, lang: this.lang, t, none: false });
      sel.addEventListener("change", () => (this.state.pendingGardenMaterial = sel.value));
      const hint = document.createElement("label");
      hint.textContent = t("polygonHint");
      extra.append(sel, hint);
    } else if (tab === "objects" && tool === "kitchen") {
      const sel = document.createElement("select");
      sel.innerHTML = KITCHEN_UNITS.map((k) => `<option value="${k}">${esc(t(`unit_${k}`))}</option>`).join("");
      sel.value = this.state.pendingKitchenUnit;
      sel.addEventListener("change", () => {
        this.state.pendingKitchenUnit = sel.value;
        this.tools.clearGhost();
      });
      const finish = this.state.kitchenFinish;
      const tex = textureControl(this, { value: finish.material, onChange: (id) => (finish.material = id), small: true });
      tex.title = t("finish");
      const color = document.createElement("input");
      color.type = "color";
      color.value = finish.tint || "#ffffff";
      color.title = t("finish");
      color.addEventListener("input", () => (finish.tint = color.value));
      const hint = document.createElement("label");
      hint.textContent = t("kitchenHint");
      extra.append(sel, tex, color, hint);
    } else if (tab === "objects") {
      const hint = document.createElement("label");
      hint.textContent = tool === "note" ? t("noteHint") : this.state.pendingProp ? `${this.state.pendingProp.name[this.lang] || this.state.pendingProp.name.en} · ${t("rotateGhost")}` : t("catalog");
      const btn = document.createElement("button");
      btn.className = "tb small";
      btn.textContent = `+ ${t("newObject")}`;
      btn.addEventListener("click", () => this.editProp(null));
      extra.append(btn, hint);
    }
    $("#snap-btn").classList.toggle("on", this.state.snap);
    $("#cutaway-btn").classList.toggle("on", this.project.view.cutaway);
    $("#doors-btn").classList.toggle("on", this.project.view.doorsOpen);
    $("#night-btn").classList.toggle("on", !!this.project.sun.night);
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
    if (this.walk.active) this.setView("3d");
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
    $("#doors-btn").addEventListener("click", () => this.toggleDoors());
    $("#night-btn").addEventListener("click", () => this.toggleNight());
    $("#seasons-grid").addEventListener("click", (e) => {
      const b = e.target.closest("[data-time]");
      if (!b) return;
      $("#seasons-dialog").close();
      this.applySeason(Number(b.dataset.time), Number(b.dataset.month));
    });
    $("#view-3d").addEventListener("click", () => this.setView("3d"));
    $("#view-top").addEventListener("click", () => this.setView("top"));
    $("#view-walk").addEventListener("click", () => this.setView(this.walk.active ? "3d" : "walk"));
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
    $("#sel-actions").addEventListener("click", (e) => {
      const m = e.target.closest("[data-mode]");
      if (m && !m.disabled) return this.setTransformMode(m.dataset.mode);
      if (e.target.closest("[data-dims]")) this.toggleDims();
    });
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
        if (parsed.customTextures?.length) await this.textures.importRows(parsed.customTextures);
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
    if (view === "walk") {
      if (this.editor?.active) return this.toast(this.t("finishEditing"));
      this.walk.enter();
    } else {
      this.walk.exit();
      this.scene.setView(view);
      this.gizmo.setCamera(this.scene.camera);
    }
    $("#view-3d").classList.toggle("on", view === "3d");
    $("#view-top").classList.toggle("on", view === "top");
    $("#view-walk").classList.toggle("on", view === "walk");
    $("#walk-hint").hidden = view !== "walk";
    $("#viewport").classList.toggle("walking", view === "walk");
  }
  /** Night: dark sky, moon, lamps and windows lit (project.sun.night). */
  toggleNight() {
    this.checkpoint();
    this.project.sun.night = !this.project.sun.night;
    this.changed({ rebuild: "none", light: true });
  }
  /**
   * Seasons: the current view at 9 h, 12 h and 16 h for the chosen month and
   * the month six months later, rendered with the main renderer into small
   * canvases while the sun is temporarily moved, shown in a dialog.
   */
  compareSeasons() {
    const sun = this.project.sun, t = this.t;
    const saved = { ...sun };
    const months = [sun.month, ((sun.month + 5) % 12) + 1];
    const times = [9, 12, 16];
    const src = this.scene.canvas;
    const W = 168, H = Math.round((168 * src.height) / Math.max(1, src.width));
    const grid = $("#seasons-grid");
    grid.innerHTML = "";
    this.scene.controls.update();
    for (const month of months)
      for (const time of times) {
        Object.assign(sun, { useTime: true, time, month, night: false });
        this.sun.apply(sun);
        this.night.update();
        this.scene.renderer.render(this.scene.scene, this.scene.camera);
        const c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        c.getContext("2d").drawImage(src, 0, 0, W, H);
        const name = new Date(2024, month - 1, 1).toLocaleString(this.lang, { month: "short" });
        const b = document.createElement("button");
        b.className = "season";
        b.type = "button";
        b.dataset.time = String(time);
        b.dataset.month = String(month);
        const label = document.createElement("span");
        label.textContent = `${name} · ${time} h`;
        b.append(c, label);
        grid.append(b);
      }
    Object.assign(sun, saved);
    this.sun.apply(sun);
    this.night.update();
    this.scene.requestRender();
    $("#seasons-hint").textContent = t("seasonsHint");
    $("#seasons-dialog").showModal();
  }
  applySeason(time, month) {
    this.checkpoint();
    Object.assign(this.project.sun, { useTime: true, time, month });
    this.changed({ rebuild: "none", light: true });
  }
  /** A note pinned at a world point (cm). */
  addNote(at) {
    this.checkpoint();
    const note = freshNote(at.map(r1));
    this.project.notes.push(note);
    this.changed({ rebuild: "none" });
    this.select(note.id, { keepTool: true });
    this.propsPanel.root.querySelector("textarea")?.focus();
  }
  /** Swing every door leaf open (or closed) in all buildings. */
  toggleDoors() {
    this.project.view.doorsOpen = !this.project.view.doorsOpen;
    for (const b of this.project.buildings) this.rebuildBuilding(b.id, { quiet: true });
    this.afterSceneChange();
    if (this.state.selection) {
      const found = this.locate(this.state.selection);
      if (found && !this.walk.active) this.attachSelection(found);
    }
    this.refreshToolbar();
    this.queueSave();
  }
  /** Footprint (cm, before the placement's rotation) of a placed object. */
  objectFootprint(o) {
    const doc = o.inline || this.propDoc(o.prop);
    if (!doc) return null;
    const b = propBounds(doc), [sx, , sz] = o.scale;
    return { minX: b.min.x * CM * sx, maxX: b.max.x * CM * sx, minZ: b.min.z * CM * sz, maxZ: b.max.z * CM * sz };
  }
  objectName(o) {
    if (o.name) return o.name;
    const doc = o.inline || this.propDoc(o.prop);
    return doc ? doc.name[this.lang] || doc.name.en : "";
  }
  async exportPlan() {
    const b = this.building(), s = this.storey();
    const canvas = renderPlan({
      project: this.project, building: b, storey: s, lang: this.lang, t: this.t, notes: this.project.notes,
      objectFootprint: (o) => this.objectFootprint(o),
      objectName: (o) => this.objectName(o),
      wellTiles: (fg) => this.stairWells(b, s, fg),
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const idx = b.storeys.indexOf(s) + 1;
    downloadBlob(blob, store.safeFilename(this.project.name, `-plan-${idx}`).replace(/\.json$/, ".png"));
    this.toast(this.t("exported"));
  }
  async exportView() {
    const blob = await this.scene.capture();
    if (!blob) return;
    downloadBlob(blob, store.safeFilename(this.project.name, "-view").replace(/\.json$/, ".png"));
    this.toast(this.t("exported"));
  }
  onKey(e) {
    const tag = document.activeElement?.tagName;
    if (["INPUT", "SELECT", "TEXTAREA"].includes(tag) || document.querySelector("dialog[open]")) {
      if (e.key === "Escape") document.activeElement?.blur?.();
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (this.walk.active && !mod) {
      if (e.key === "?") $("#help-dialog").showModal();
      else if (!this.walk.key(e)) return;
      e.preventDefault();
      return;
    }
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
        else if (this.tools.line) this.tools.finishLine();
        else return;
        break;
      case "Delete": case "Backspace": this.deleteSelected(); break;
      case "v": case "V": this.setTool("select"); break;
      case "w": case "W": this.setTransformMode("translate"); break;
      case "e": case "E": this.setTransformMode("rotate"); break;
      case "r": case "R": this.setTransformMode("scale"); break;
      case "[": this.tools.rotateGhost(-15); break;
      case "]": this.tools.rotateGhost(15); break;
      case "f": case "F": this.frameSelection(); break;
      default:
        if (/^[1-8]$/.test(e.key)) this.setTab(TABS[Number(e.key) - 1]);
        else if (!this.runHotkey(e)) return;
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
      case "export": {
        const ids = store.usedTextureIds(this.project, this.customProps, this.textures.rows.map((r) => r.id));
        const textures = await this.textures.exportRows(ids);
        store.download(store.exportProject(this.project, this.customProps, textures), store.safeFilename(this.project.name, ""));
        this.toast(t("exported"));
        break;
      }
      case "import": $("#import-file").click(); break;
      case "textures": this.textures.open(); break;
      case "exportPlan": await this.exportPlan(); break;
      case "exportView": await this.exportView(); break;
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
    $$("#tabs button").forEach((b, i) => (b.innerHTML = `${esc(this.t(b.dataset.i18n))}${hk(i + 1)}`));
    for (const [action, key] of Object.entries(HOTKEYS.menu)) {
      const b = $(`#project-menu [data-action="${action}"]`);
      if (b) b.innerHTML = `${esc(this.t(b.dataset.i18n))}${hk(key)}`;
    }
    for (const [id, key] of Object.entries(HOTKEYS.view)) {
      const b = $(`#${id}`);
      if (b) b.innerHTML = `${esc(this.t(b.dataset.i18n))}${hk(key)}`;
    }
  }
  /** Single-letter shortcuts for menus, views and the active tab's tools. */
  runHotkey(e) {
    if (e.key.length !== 1) return false;
    const key = e.key.toUpperCase();
    if (e.shiftKey) {
      if (key === "S") return this.projectAction("saveAs"), true;
      if (key === "P") return this.projectAction("exportView"), true;
      return false;
    }
    const menu = Object.entries(HOTKEYS.menu).find(([, k]) => k === key);
    if (menu) return this.projectAction(menu[0]), true;
    const view = Object.entries(HOTKEYS.view).find(([, k]) => k === key);
    if (view) return $(`#${view[0]}`).click(), true;
    if (key === HOTKEYS.modes.dims) return this.toggleDims(), true;
    const tool = TAB_TOOLS[this.state.tab].find((k) => HOTKEYS.tools[k] === key);
    if (tool) return this.setTool(tool), true;
    return false;
  }
  /** A custom texture was added or removed: every texture select is rebuilt. */
  refreshAfterTextures() {
    this.refreshAll();
    if (this.editor?.active) this.editor.refreshPanels();
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
const hk = (key) => (key ? ` <span class="hk">(${esc(String(key))})</span>` : "");
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

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
