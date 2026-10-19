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
import { loadTextureIndex, setTextureReadyCallback, isCustomTexture, textureIndex } from "./js/materials.js";
import { loadCatalog, catalog, getPropDoc, propObject, searchCatalog, registerCustom, registerGenerated, customIds, propDocSync } from "./js/props.js";
import { thumbnail, clearThumbs } from "./js/thumbs.js";
import { TextureManager, textureControl, fillTextureSelect } from "./js/textures.js";
import { KITCHEN_UNITS, kitchenDocs } from "./js/build/kitchen.js";
import { PropEditor } from "./js/propedit.js";
import { Dims } from "./js/dims.js";
import { Night } from "./js/night.js";
import { Notes } from "./js/notes.js";
import { RoomLabels } from "./js/roomlabels.js";
import { syncRooms, roomLabel } from "./js/rooms.js";
import { buildRoomFinish } from "./js/build/room.js";
import { computeQuantities, quantitiesCSV, formatQuantity, unitLabel, columnLabel, COLUMNS } from "./js/quantities.js";
import { selectedItems, canJoin, copySelection, pasteClipboard, arrange, Ruler } from "./js/multi.js";
import { makeTemplate, TEMPLATE_IDS } from "./js/templates.js";
import { pointInPolygon } from "./js/geom.js";
import { shareLink, readShareHash, exportGLB } from "./js/share.js";
import { storyStudioBundle, storyFilename } from "./js/storyset.js";
import { buildFloorGroup, buildFoundation, floorTop, floorThickness, tileSet, tileKey, splitTiles, tilesOutline, coveredTiles } from "./js/build/slabs.js";
import { mergeProject } from "./js/merge.js";
import { buildWall } from "./js/build/walls.js";
import { buildStairs, stairsCutQuads, tilesUnderQuads } from "./js/build/stairs.js";
import { buildPolygon, polygonOutline, DEFAULT_MATERIAL, WATER_TYPES } from "./js/build/outdoor.js";
import { buildSiteWall } from "./js/build/sitewall.js";
import { buildRoof, CEILING } from "./js/build/roof.js";
import { buildRailing, railingOffset } from "./js/build/railing.js";
import { Walk } from "./js/walk.js";
import { renderPlan } from "./js/plan2d.js";
import { propBounds } from "./js/props.js";
import * as store from "./js/store.js";
import { freshProject, freshBuilding, freshStorey, freshNote, freshLight, locate, isLocked, uid, clone, wallChecked, OPENING_PRESETS, OUTDOOR_TYPES, projectChecked, findBuilding, topStorey, RAILING_STYLES, FENCE_STYLES, GATE_TYPES, WALL_TOPS } from "./js/schema.js";

const DEG = Math.PI / 180;
const $ = (s, r = document) => r.querySelector(s);
const TABS = ["terrain", "floors", "walls", "openings", "stairs", "outdoor", "garden", "objects"];
// Keyboard shortcuts shown in parentheses on labels. Global ones are unique;
// tool keys are per tab (only the active tab's tools listen).
const HOTKEYS = {
  menu: { new: "N", template: "Shift+N", open: "O", versions: "H", save: "S", saveAs: "Shift+S", export: "X", import: "I", exportPlan: "P", exportView: "Shift+P", exportGlb: "Shift+X", share: "Shift+L" },
  view: { "snap-btn": "G", "cutaway-btn": "C", "doors-btn": "B", "ruler-btn": "D", "night-btn": "J", "view-3d": "Q", "view-top": "T", "view-walk": "K", "fit-btn": "F" },
  modes: { translate: "W", rotate: "E", scale: "R", dims: "M" },
  tools: { light: "Z", select: "V", raise: "A", lower: "Z", flatten: "L", smooth: "U", paint: "A", erase: "Z", rect: "L", draw: "A", railing: "L", add: "A", gate: "L", place: "A", polygon: "A", fence: "L", siteWall: "U", kitchen: "L", note: "U" },
};

class App {
  constructor() {
    this.prefs = prefs;
    this.lang = prefs.lang;
    this.t = makeT(() => this.lang);
    this.project = freshProject();
    this.state = { tab: "floors", tool: "select", selection: null, activeBuilding: null, activeStorey: null, activeFloorGroup: null, pendingPreset: "door-single", pendingProp: null, ghostYaw: 0, pendingStairShape: "straight", pendingOutdoorType: "deck", pendingStreamWidth: 120, pendingGardenMaterial: DEFAULT_MATERIAL.garden, pendingRailingStyle: "glass", pendingFenceStyle: "picket", pendingGateType: "single", pendingWallTop: "follow", extra: new Set(), pendingKitchenUnit: "base", kitchenFinish: { material: null, tint: "#ece7dd" }, snap: prefs.snap !== false, orbitOverride: false, transformMode: null, caps: [] };
    this.buildingGroups = new Map();
    this.storeyGroups = new Map();
    this.roofGroups = new Map();
    this.objectGroups = new Map();
    this.roomsByStorey = new Map(); // storey id -> [{face, room}]
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
    this.roomLabels = new RoomLabels(this);
    this.ruler = new Ruler(this);
    this.extraHelpers = new Map();
    // the live clock moves the sun every five minutes (cheap: one light update)
    setInterval(() => {
      if (this.project?.sun.live) this.changed({ rebuild: "none", light: true, save: false, panels: false });
    }, 5 * 60 * 1000);
    this.scene.onFrame = () => {
      this.updateCompass();
      this.dims.update();
      this.notes.update();
      this.night.frame();
      this.roomLabels.update();
      this.ruler.update();
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
    const shared = await readShareHash();
    if (shared) {
      try {
        const parsed = store.parseImport(shared);
        for (const p of parsed.customProps || []) {
          await store.saveCustomProp(p);
          registerCustom(p);
        }
        project = parsed.project;
        project.id = uid("p");
        history.replaceState(null, "", location.pathname + location.search);
      } catch (err) {
        console.warn("share link", err);
      }
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
    this.dirty = false;
    document.title = this.t("title");
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
    if (this.walk.active) this.updateWalkTools();
  }
  /** Floor above / below buttons of the walk mode: which storey they lead to, and the one the walker is on. */
  updateWalkTools() {
    const host = $("#walk-tools");
    if (host.hidden || !this.walk.active) return;
    const b = this.walk.building;
    const name = (s) => `${s.name || `${this.t("storey")} ${b.storeys.indexOf(s) + 1}`} · ${s.elevation} cm`;
    const up = this.walk.neighbour(1), down = this.walk.neighbour(-1);
    $("#walk-up").disabled = !up;
    $("#walk-up").title = up ? name(up) : "";
    $("#walk-down").disabled = !down;
    $("#walk-down").title = down ? name(down) : "";
    $("#walk-storey").textContent = name(this.walk.storey);
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
  /**
   * Walls around a floor group: every boundary edge of its tiles that no
   * wall already runs along becomes a new exterior wall. Returns how many
   * walls were added.
   */
  addOuterWalls(fgId) {
    const found = this.locate(fgId);
    if (!found || found.type !== "floorGroup") return 0;
    const { item: fg, storey } = found;
    if (isLocked(found)) return this.toast(this.t("lockedItem")), 0;
    const tile = this.project.grid.tile;
    const set = tileSet(fg);
    const runs = []; // {axis: "x"|"z", at, from, to} in cm
    const edges = { x: new Map(), z: new Map() }; // horizontal runs keyed by z, vertical by x
    const mark = (map, key, v) => (map.get(key) || map.set(key, []).get(key)).push(v);
    for (const [x, z] of fg.tiles) {
      if (!set.has(tileKey(x, z - 1))) mark(edges.x, z, x);
      if (!set.has(tileKey(x, z + 1))) mark(edges.x, z + 1, x);
      if (!set.has(tileKey(x - 1, z))) mark(edges.z, x, z);
      if (!set.has(tileKey(x + 1, z))) mark(edges.z, x + 1, z);
    }
    for (const axis of ["x", "z"])
      for (const [at, list] of edges[axis]) {
        const sorted = [...new Set(list)].sort((a, b) => a - b);
        let start = sorted[0], prev = sorted[0];
        for (const v of sorted.slice(1).concat([null])) {
          if (v === prev + 1) {
            prev = v;
            continue;
          }
          runs.push({ axis, at: at * tile, from: start * tile, to: (prev + 1) * tile });
          start = prev = v;
        }
      }
    // subtract the stretches an existing wall already covers
    const covered = (run) => {
      const spans = [];
      for (const w of storey.walls) {
        const horizontal = Math.abs(w.a[1] - w.b[1]) < 1, vertical = Math.abs(w.a[0] - w.b[0]) < 1;
        if (run.axis === "x" && horizontal && Math.abs(w.a[1] - run.at) <= Math.max(15, w.thickness)) spans.push([Math.min(w.a[0], w.b[0]), Math.max(w.a[0], w.b[0])]);
        if (run.axis === "z" && vertical && Math.abs(w.a[0] - run.at) <= Math.max(15, w.thickness)) spans.push([Math.min(w.a[1], w.b[1]), Math.max(w.a[1], w.b[1])]);
      }
      let pieces = [[run.from, run.to]];
      for (const [s0, s1] of spans) pieces = pieces.flatMap(([p0, p1]) => (s1 <= p0 || s0 >= p1 ? [[p0, p1]] : [[p0, Math.max(p0, s0)], [Math.min(p1, s1), p1]]));
      return pieces.filter(([p0, p1]) => p1 - p0 >= tile);
    };
    const added = [];
    for (const run of runs)
      for (const [p0, p1] of covered(run)) {
        const a = run.axis === "x" ? [p0, run.at] : [run.at, p0], b = run.axis === "x" ? [p1, run.at] : [run.at, p1];
        added.push(wallChecked({ a, b, thickness: 20 }));
      }
    if (!added.length) return this.toast(this.t("outerWallsNone")), 0;
    this.checkpoint();
    storey.walls.push(...added);
    this.changed({ rebuild: "building", buildingId: found.building.id });
    this.toast(this.t("outerWallsAdded", { n: added.length }));
    return added.length;
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
    if (doc.id) {
      prefs.recentProps = [doc.id, ...(prefs.recentProps || []).filter((id) => id !== doc.id)].slice(0, 24);
      savePrefs();
    }
    this.toast(`${this.t("placed")}: ${doc.name[this.lang] || doc.name.en}`);
  }
  deleteSelected() {
    const id = this.state.selection;
    const found = id && this.locate(id);
    if (!found) return this.toast(this.t("noSelection"));
    if (this.state.extra.size) {
      const items = selectedItems(this).filter((f) => !isLocked(this.project, f.item.id));
      if (!items.length) return this.toast(this.t("lockedItem"));
      this.checkpoint();
      for (const f of items) f.list.splice(f.list.indexOf(f.item), 1);
      this.state.selection = null;
      this.state.extra.clear();
      this.gizmo.detach();
      this.changed({ rebuild: "all" });
      this.toast(this.t("deleted"));
      return;
    }
    if (found.type === "terrain" || found.type === "sun") return;
    if (found.type === "room") return this.toast(this.t("roomDerived"));
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
    if (!found || !["object", "stairs", "outdoor", "garden", "railing", "fence", "siteWall", "note", "light"].includes(found.type)) return;
    if (this.state.extra.size) {
      if (copySelection(this)) pasteClipboard(this);
      return;
    }
    this.checkpoint();
    const copy = clone(found.item);
    copy.id = uid({ object: "ob", stairs: "sr", garden: "g", outdoor: "d", railing: "rl", fence: "fe", siteWall: "sw", note: "nt", light: "lt" }[found.type]);
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
    this.lightMarkers?.clear();
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
      const rooms = syncRooms(s);
      this.roomsByStorey.set(s.id, rooms);
      const foundation = s === b.storeys[0] && s.foundation?.enabled ? this.groundSampler(b) : null;
      for (const fg of s.floorGroups) {
        const wells = this.stairWells(b, s, fg);
        const mesh = buildFloorGroup(fg, s, this.project.grid.tile, wells);
        if (mesh) sg.add(mesh);
        const base = foundation && buildFoundation(fg, s, this.project.grid.tile, foundation, wells, s.foundation);
        if (base) sg.add(base);
      }
      for (const w of s.walls) sg.add(buildWall(w, s, s.walls, this.project.grid.tile, { doorsOpen: this.project.view.doorsOpen }));
      for (const st of s.stairs) sg.add(buildStairs(st, s));
      for (const r of s.railings) sg.add(buildRailing(r, "railing", { baseY: s.elevation + railingOffset(r, s, this.project.grid.tile), storeyId: s.id }));
      for (const o of s.objects) sg.add(this.makeObjectGroup(o, s.elevation));
      for (const l of s.lights || []) sg.add(this.makeLightMarker(l, s.elevation));
      for (const { face, room } of rooms) {
        const g = buildRoomFinish(face, room, s, { floorY: this.roomFloorY(b, s, face), ceilingY: this.roomCeilingY(b, s, face) });
        if (g) sg.add(g);
      }
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
    this.refreshTerrainCuts();
    this.applyVisibility();
    if (!quiet) this.afterSceneChange();
  }
  /** Detected rooms of a storey as [{face, room}] (see js/rooms.js). */
  roomsOf(s) {
    let pairs = this.roomsByStorey.get(s.id);
    if (!pairs) {
      pairs = syncRooms(s);
      this.roomsByStorey.set(s.id, pairs);
    }
    return pairs;
  }
  /** Display name of a room: its own, else one guessed from the furniture inside, else "Room n". */
  roomName(room, storey) {
    return roomLabel(room, storey, this.t, room.name ? "" : this.roomAutoName(room, storey));
  }
  roomAutoName(room, storey) {
    const face = this.roomFace(room.id);
    if (!face) return "";
    if (!this.categoryById) this.categoryById = new Map(catalog.props.map((p) => [p.id, p.category]));
    const score = {};
    const add = (k, w) => (score[k] = (score[k] || 0) + w);
    let wet = false;
    for (const o of storey.objects) {
      if (!pointInPolygon(o.at[0], o.at[2], face.polygon)) continue;
      const id = o.prop || o.inline?.id || "";
      const cat = o.inline?.category || this.categoryById.get(id) || "";
      if (cat === "vehicles") add("garage", 3);
      if (/toilet|bath-vanity|shower|bathtub|bidet/.test(id)) add("bathroom", 3);
      if (/shower|bathtub/.test(id)) wet = true;
      if (/washing-machine|dryer|laundry|ironing/.test(id)) add("laundry", 3);
      if (cat === "kitchen" || /stove|kitchen-|fridge/.test(id)) add("kitchen", 2);
      if (/(^|-)bed($|-)|bunk|crib|cradle/.test(id)) add("bedroom", 6);
      if (/closet|wardrobe/.test(id)) add("closet", 2);
      if (cat === "storage") add("storage", 2);
      if (cat === "sports") add(/pool-table|cue-rack|dart|foosball|arcade|ping-pong/.test(id) ? "games" : "gym", 2);
      if (cat === "office") add("office", 2);
      if (/dining-table|dining-chair|round-table|refectory/.test(id)) add("dining", 2);
      if (/sofa|(^|-)tv($|-)|coffee-table|armchair|fireplace|^rug$/.test(id)) add("living", 2);
    }
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    if (!best) return storey.stairs.some((st) => pointInPolygon(st.at[0], st.at[1], face.polygon)) ? this.t("room_hall") : "";
    return this.t(`room_${best[0] === "bathroom" && !wet ? "lavatory" : best[0]}`);
  }
  roomFace(id) {
    for (const pairs of this.roomsByStorey.values()) for (const p of pairs) if (p.room.id === id) return p.face;
    return null;
  }
  /** Floor level (cm, building-relative) under a room: its floor group, else the storey. */
  roomFloorY(b, s, face) {
    const tile = this.project.grid.tile;
    const k = tileKey(Math.floor(face.labelPoint[0] / tile), Math.floor(face.labelPoint[1] / tile));
    const fg = s.floorGroups.findLast((g) => g.tiles.some(([x, z]) => tileKey(x, z) === k));
    return fg ? floorTop(s, fg) : s.elevation;
  }
  /** Underside of the slab above a room, or the storey top (minus the roof ceiling). */
  roomCeilingY(b, s, face) {
    const tile = this.project.grid.tile;
    const k = tileKey(Math.floor(face.labelPoint[0] / tile), Math.floor(face.labelPoint[1] / tile));
    const above = b.storeys.filter((x) => x.elevation > s.elevation).sort((x, y) => x.elevation - y.elevation)[0];
    if (above) {
      const fg = above.floorGroups.findLast((g) => g.tiles.some(([x, z]) => tileKey(x, z) === k));
      if (fg) return floorTop(above, fg) - floorThickness(above, fg);
    }
    const top = s.elevation + s.height;
    return !above && b.roof && b.roof.type !== "none" && b.roof.ceiling !== false ? top - CEILING : top;
  }
  /**
   * Tiles of a floor group that are not shown: left open by stairs from the
   * storeys below, or painted over by a later floor group of the storey (the
   * last one placed wins, so the kitchen tiles laid over the wood floor are
   * the only slab drawn there).
   */
  stairWells(b, s, fg) {
    const quads = [];
    const underside = floorTop(s, fg) - floorThickness(s, fg);
    for (const lower of b.storeys) {
      if (lower.elevation >= s.elevation) continue;
      for (const st of lower.stairs) if (st.cutFloorAbove) quads.push(...stairsCutQuads(st, lower, underside));
    }
    const wells = quads.length ? tilesUnderQuads(fg.tiles, quads, this.project.grid.tile) : null;
    const covered = coveredTiles(s, fg);
    if (!covered) return wells;
    if (!wells) return covered;
    return new Set([...wells, ...covered]);
  }
  rebuildSite({ quiet = false } = {}) {
    if (!this.siteGroup) return;
    for (const c of [...this.siteGroup.children]) {
      this.siteGroup.remove(c);
      this.objectGroups.delete(c.userData.id);
      if (c.userData.kind !== "object") c.traverse((o) => o.isMesh && o.geometry.dispose());
    }
    this.refreshTerrainCuts();
    for (const o of this.project.objects) this.siteGroup.add(this.makeObjectGroup(o, 0));
    for (const l of this.project.lights || []) this.siteGroup.add(this.makeLightMarker(l, 0));
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
  /** The terrain is not drawn over water nor over floors that lie below it (cellars), so an active cellar shows in cutaway. */
  refreshTerrainCuts() {
    const water = this.project.outdoor.filter((p) => WATER_TYPES.includes(p.type)).map((p) => polygonOutline(p)).filter((pts) => pts.length >= 3);
    this.terrain.setCutouts(water, this.buriedFloorOutlines());
  }
  /** Outlines (world cm) of floor groups whose slab lies under the shown ground. */
  buriedFloorOutlines() {
    const out = [], tile = this.project.grid.tile;
    for (const b of this.project.buildings) {
      const c = Math.cos(b.rotation * DEG), sn = Math.sin(b.rotation * DEG);
      const ground = this.groundSampler(b);
      for (const s of b.storeys)
        for (const fg of s.floorGroups) {
          if (!fg.tiles.length) continue;
          const top = floorTop(s, fg);
          if (!fg.tiles.some(([x, z]) => ground((x + 0.5) * tile, (z + 0.5) * tile) > top + 5)) continue;
          for (const loop of tilesOutline(fg.tiles, tile)) out.push(loop.map(([lx, lz]) => [b.at[0] + lx * c - lz * sn, b.at[1] + lx * sn + lz * c]));
        }
    }
    return out;
  }
  /** Small emissive marker for a light point (selectable, movable). */
  makeLightMarker(l, baseY) {
    this.lightMarkers ??= new Map();
    const g = new THREE.Group();
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshBasicMaterial({ color: l.on === false ? 0x777777 : l.color }));
    bulb.userData.sharedGeometry = false;
    g.add(bulb);
    if (l.type === "spot") {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 12, 1, true), new THREE.MeshBasicMaterial({ color: l.color, wireframe: true }));
      cone.position.y = -0.1;
      g.add(cone);
    }
    g.position.set(l.at[0] * M, (l.at[1] + baseY) * M, l.at[2] * M);
    g.userData = { kind: "light", id: l.id };
    this.lightMarkers.set(l.id, g);
    return g;
  }
  addLight(at, building = null, storey = null) {
    this.checkpoint();
    const light = freshLight();
    if (building && storey) {
      const l = this.toLocal(building, new THREE.Vector3(at[0] * M, at[1] * M, at[2] * M));
      light.at = [r1(l.x), r1(l.y - storey.elevation), r1(l.z)];
      storey.lights ??= [];
      storey.lights.push(light);
      this.changed({ rebuild: "building", buildingId: building.id });
    } else {
      light.at = at.map(r1);
      this.project.lights ??= [];
      this.project.lights.push(light);
      this.changed({ rebuild: "site" });
    }
    this.select(light.id, { keepTool: true });
    if (!this.project.sun.night) this.toast(this.t("lightNightOff"));
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
      // one loader per prop id, and one coalesced rebuild once docs arrive
      // (registering a rebuild per object per rebuild doubled the work each time)
      this.pendingProps ??= new Set();
      if (o.prop && !this.pendingProps.has(o.prop)) {
        this.pendingProps.add(o.prop);
        getPropDoc(o.prop).then((d) => {
          this.pendingProps.delete(o.prop);
          if (!d) return;
          clearTimeout(this.propRebuildTimer);
          this.propRebuildTimer = setTimeout(() => this.changed({ rebuild: "all", save: false }), 60);
        });
      }
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
        // room ceilings open up with the roof ceiling in cutaway
        for (const rg of g.children) if (rg.userData.kind === "roomGroup") for (const m of rg.children) if (m.userData.ceiling) m.visible = !this.project.view.cutaway;
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
      if (!s || s.foundation?.enabled) continue; // the foundation reaches the natural ground instead
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
  /** Terrain height (cm) at building-local cm, following the building's position and rotation. */
  groundSampler(b) {
    const c = Math.cos(b.rotation * DEG), sn = Math.sin(b.rotation * DEG);
    return (lx, lz) => this.terrain.heightAt(b.at[0] + lx * c - lz * sn, b.at[1] + lx * sn + lz * c);
  }
  /** Buildings whose foundation follows the ground (rebuilt when the terrain moves). */
  foundationBuildings() {
    return this.project.buildings.filter((b) => b.storeys[0]?.foundation?.enabled);
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
  /** The needle follows the camera: north is -Z (the top of the plan). */
  updateCompass() {
    const az = this.scene.view === "top" || this.walk.active ? (this.walk.active ? this.scene.camera.rotation.y : 0) : this.scene.controls.getAzimuthalAngle();
    if (az === this.compassAngle) return;
    this.compassAngle = az;
    $("#compass .needle").style.transform = `rotate(${az}rad)`;
  }
  /** Turn the camera to look north, keeping its distance and height. */
  faceNorth() {
    if (this.walk.active || this.scene.view === "top") return;
    const c = this.scene.controls, p = this.scene.camera.position;
    const r = Math.hypot(p.x - c.target.x, p.z - c.target.z);
    p.set(c.target.x, p.y, c.target.z + r);
    c.update();
    this.scene.requestRender();
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
      for (const b of this.foundationBuildings()) this.rebuildBuilding(b.id, { quiet: true });
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
  /** The project changed: nothing is written until the user saves (Save, Ctrl+S). */
  queueSave() {
    this.dirty = true;
    $("#save-status").textContent = `● ${this.t("unsaved")}`;
    document.title = `● ${this.t("title")}`;
  }
  async saveNow() {
    this.project.view.camera = this.scene.cameraState();
    try {
      await store.saveProject(this.project);
      this.dirty = false;
      this.maybeSaveVersion();
      $("#save-status").textContent = this.t("saved");
      document.title = this.t("title");
    } catch (err) {
      console.warn(err);
      $("#save-status").textContent = `● ${this.t("unsaved")}`;
    }
  }
  /** Before replacing the project: true when there is nothing unsaved or the user agrees to lose it. */
  confirmDiscard() {
    return !this.dirty || confirm(this.t("discardChanges"));
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
    this.roomLabels.refresh();
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

  /** Shift+click: add or remove an item from the multi-selection. */
  toggleExtra(id) {
    const found = this.locate(id);
    if (!found) return;
    if (!this.state.selection) return this.select(id);
    if (id === this.state.selection) return;
    if (!canJoin(this, found)) return this.toast(this.t("multiSameStorey"));
    if (this.state.extra.has(id)) this.state.extra.delete(id);
    else this.state.extra.add(id);
    this.refreshExtras();
    this.propsPanel.render();
    this.tree.render();
  }
  refreshExtras() {
    for (const [id, h] of this.extraHelpers) {
      if (!this.state.extra.has(id)) {
        this.scene.overlay.remove(h);
        h.geometry.dispose();
        this.extraHelpers.delete(id);
      }
    }
    for (const id of this.state.extra) {
      const found = this.locate(id);
      const group = found && this.transformTarget(found)?.group;
      if (!group) {
        this.state.extra.delete(id);
        continue;
      }
      let h = this.extraHelpers.get(id);
      if (!h) {
        h = new THREE.BoxHelper(group, 0x3aa5ff);
        h.material.depthTest = false;
        h.renderOrder = 20;
        this.scene.overlay.add(h);
        this.extraHelpers.set(id, h);
      } else h.setFromObject(group);
    }
    this.scene.requestRender();
  }
  /** The primary placement moved by the gizmo: move the extras by the same delta. */
  extrasFollow(from, to) {
    if (!this.state.extra.size || !from || !to) return;
    const d = to.map((v, i) => v - (from[i] ?? 0));
    if (!d.some((v) => Math.abs(v) > 0.01)) return;
    let building = null;
    for (const f of selectedItems(this).filter((f) => f.item.id !== this.state.selection && !f.item.locked)) {
      if (f.type === "stairs") f.item.at = [f.item.at[0] + d[0], f.item.at[1] + d[2]];
      else f.item.at = f.item.at.map((v, i) => Math.round((v + d[i]) * 10) / 10);
      building = f.building;
    }
    this.changed({ rebuild: building ? "building" : "site", buildingId: building?.id });
  }
  select(id, { keepTool = false } = {}) {
    const changedId = id !== this.state.selection;
    if (changedId) this.state.extra.clear();
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
        else if (found.type === "room") {
          const face = this.roomFace(found.item.id), g = this.buildingGroups.get(found.building.id);
          if (face && g) this.scene.centerOn(new THREE.Vector3(face.labelPoint[0] * M, (this.roomFloorY(found.building, found.storey, face) + 50) * M, face.labelPoint[1] * M).applyMatrix4(g.matrixWorld));
        }
      }
      if (!keepTool && found.type !== "sun" && found.type !== "terrain" && this.state.tool !== "select") this.setTool("select");
    }
    this.refreshExtras();
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
      case "light": {
        const g = this.lightMarkers?.get(id);
        const parent = found.storey ? this.storeyGroups.get(found.storey.id) : this.siteGroup;
        const l = found.item;
        const adapter = {
          planar: false, modes: ["translate"], rebuild: found.building ? "building" : "site", buildingId: found.building?.id || null,
          apply: (group, { step, snapTo }) => {
            l.at = [snapTo(group.position.x * CM, step), snapTo(group.position.y * CM - (found.storey ? found.storey.elevation : 0), step), snapTo(group.position.z * CM, step)].map(r1);
            group.position.set(l.at[0] * M, (l.at[1] + (found.storey ? found.storey.elevation : 0)) * M, l.at[2] * M);
          },
        };
        return T(g, parent, l, adapter, adapter.modes);
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
    this.roomLabels.refresh();
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
        if (["terrain", "floorGroup", "wall", "opening", "object", "stairs", "outdoor", "garden", "roof", "railing", "fence", "gate", "siteWall", "room", "light"].includes(k)) {
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
      if (event.shiftKey && this.state.selection) return this.toggleExtra(id);
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
    // every tab opens with the Select tool; the tab's own tools are a click or hotkey away
    if (tab === "terrain") this.state.selection = "terrain";
    else if (this.state.selection === "terrain") this.state.selection = null;
    this.setTool("select");
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
      hint.textContent = tool === "light" ? t("lightPointHint") : tool === "note" ? t("noteHint") : this.state.pendingProp ? `${this.state.pendingProp.name[this.lang] || this.state.pendingProp.name.en} · ${t("rotateGhost")}` : t("catalog");
      const btn = document.createElement("button");
      btn.className = "tb small";
      btn.textContent = `+ ${t("newObject")}`;
      btn.addEventListener("click", () => this.editProp(null));
      extra.append(btn, hint);
    }
    $("#snap-btn").classList.toggle("on", this.state.snap);
    $("#ruler-btn").classList.toggle("on", !!this.ruler?.active);
    $("#cutaway-btn").classList.toggle("on", this.project.view.cutaway);
    $("#doors-btn").classList.toggle("on", this.project.view.doorsOpen);
    $("#night-btn").classList.toggle("on", !!this.project.sun.night);
  }
  updateLeftPanel() {
    const showCatalog = this.state.tab === "objects" && this.state.tool === "place";
    $("#catalog").hidden = !showCatalog;
    $("#tree").hidden = showCatalog;
    $("#tree-search").hidden = showCatalog;
    $("#tree-tools").hidden = showCatalog;
    if (showCatalog) this.renderCatalog();
  }
  renderCatalog() {
    const t = this.t, lang = this.lang;
    const cat = $("#catalog-category");
    const cats = Object.entries(catalog.categories);
    cat.innerHTML = [`<option value="all">${esc(t("allCategories"))}</option>`, `<option value="recent">${esc(t("recent"))}</option>`, ...cats.map(([id, n]) => `<option value="${id}">${esc(n[lang] || n.en)}</option>`)].join("");
    cat.value = prefs.catalogCategory || "all";
    if (cat.value !== prefs.catalogCategory) cat.value = "all";
    const q = $("#catalog-search").value;
    let items = searchCatalog(q, cat.value === "recent" ? "all" : cat.value);
    if (cat.value === "recent") {
      const order = prefs.recentProps || [];
      items = items.filter((p) => order.includes(p.id)).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
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
    $("#ruler-btn").addEventListener("click", () => this.ruler.toggle());
    $("#undo-btn").addEventListener("click", () => this.history.undo());
    $("#redo-btn").addEventListener("click", () => this.history.redo());
    $("#building-select").addEventListener("change", (e) => {
      const b = this.project.buildings.find((x) => x.id === e.target.value);
      if (b) this.setActive(b.id, b.storeys[0].id);
    });
    $("#storey-select").addEventListener("change", (e) => this.setActive(this.building().id, e.target.value));
    $("#add-building").addEventListener("click", () => this.addBuilding());
    $("#walk-up").addEventListener("click", () => this.walk.changeStorey(1));
    $("#walk-down").addEventListener("click", () => this.walk.changeStorey(-1));
    $("#tree-collapse").addEventListener("click", () => this.tree.collapseAll());
    $("#tree-expand").addEventListener("click", () => this.tree.expandAll());
    $("#tree-search").addEventListener("input", (e) => {
      this.tree.query = e.target.value;
      this.tree.render();
    });
    $("#catalog-search").addEventListener("input", () => this.renderCatalog());
    $("#compass").addEventListener("click", () => this.faceNorth());
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
          if (this.importMode === "add") {
            await this.addProject(project, { extendTerrain: true });
            this.importMode = "replace";
            return;
          }
          if (!this.confirmDiscard()) return;
          const existing = await store.loadProject(project.id).catch(() => null);
          if (existing) project.id = uid("p");
          this.setProject(project, { fit: true });
          this.queueSave();
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
    $("#quantities-csv").addEventListener("click", () => this.exportQuantities());
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
    window.addEventListener("beforeunload", (e) => {
      if (!this.dirty) return;
      e.preventDefault();
      e.returnValue = "";
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
    $("#walk-tools").hidden = view !== "walk";
    this.updateWalkTools();
    $("#viewport").classList.toggle("walking", view === "walk");
    this.roomLabels.refresh();
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
      rooms: this.roomsOf(s),
      roomName: (room) => this.roomName(room, s),
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const idx = b.storeys.indexOf(s) + 1;
    downloadBlob(blob, store.safeFilename(this.project.name, `-plan-${idx}`).replace(/\.json$/, ".png"));
    this.toast(this.t("exported"));
  }
  /** Rows of the bill of quantities for the whole project. */
  quantities() {
    const t = this.t, lang = this.lang;
    return computeQuantities(this.project, {
      t,
      textureName: (id) => textureIndex[id]?.name?.[lang] || id,
      objectName: (o) => this.objectName(o) || o.prop || t("object"),
      buildingName: (b, i) => b.name || `${t("building")} ${i + 1}`,
      storeyName: (s, i) => s.name || `${t("storey")} ${i + 1}`,
      roomName: (room, s) => this.roomName(room, s),
      roomsOf: (s) => this.roomsOf(s),
      wellTiles: (b, s, fg) => this.stairWells(b, s, fg),
    });
  }
  exportQuantities() {
    const csv = quantitiesCSV(this.quantities(), this.t);
    downloadBlob(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }), store.safeFilename(this.project.name, "-quantities").replace(/\.json$/, ".csv"));
    this.toast(this.t("exported"));
  }
  showQuantities() {
    const t = this.t, rows = this.quantities();
    const host = $("#quantities-body");
    if (!rows.length) host.innerHTML = `<p class="hint">${esc(t("noQuantities"))}</p>`;
    else {
      const head = COLUMNS.map((c) => `<th class="${c === "quantity" ? "num" : ""}">${esc(columnLabel(c, t))}</th>`).join("");
      let last = "";
      const body = rows.map((r) => {
        const grp = `${r.building}\u0001${r.storey}`;
        const first = grp !== last;
        last = grp;
        return `<tr class="${first ? "grp" : ""}"><td>${first ? esc(r.building) : ""}</td><td>${first ? esc(r.storey) : ""}</td><td>${esc(t(`cat_${r.category}`))}</td><td>${esc(r.item)}</td><td>${esc(r.material)}</td><td class="num">${esc(formatQuantity(r, this.lang))}</td><td>${esc(unitLabel(r.unit, t))}</td></tr>`;
      }).join("");
      host.innerHTML = `<table class="qtable"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }
    $("#quantities-dialog").showModal();
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
      this.saveNow().then(() => this.toast(this.t("saved")));
      return;
    }
    if (mod && e.key.toLowerCase() === "c") {
      const n = copySelection(this);
      if (n) {
        e.preventDefault();
        this.toast(`${this.t("copied")} (${n})`);
      }
      return;
    }
    if (mod && e.key.toLowerCase() === "v") {
      const n = pasteClipboard(this);
      if (n) {
        e.preventDefault();
        this.toast(`${this.t("pasted")} (${n})`);
      }
      return;
    }
    if (mod) return;
    switch (e.key) {
      case "?": $("#help-dialog").showModal(); break;
      case "Escape":
        if (this.ruler.active) this.ruler.toggle(false);
        else if (this.tools.busy) this.tools.cancel();
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
        if (!this.confirmDiscard()) break;
        this.setProject(freshProject(t("untitled")), { fit: true });
        this.queueSave();
        break;
      case "save": await this.saveNow(); this.toast(t("saved")); break;
      case "saveAs": {
        const name = prompt(t("saveAsName"), `${this.project.name || t("untitled")} (2)`);
        if (name === null) break;
        const copy = clone(this.project);
        copy.id = uid("p");
        copy.name = name.trim() || `${this.project.name || t("untitled")} (2)`;
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
      case "import": this.importMode = "replace"; $("#import-file").click(); break;
      case "importAdd": this.importMode = "add"; $("#import-file").click(); break;
      case "textures": this.textures.open(); break;
      case "exportPlan": await this.exportPlan(); break;
      case "quantities": this.showQuantities(); break;
      case "quantitiesCsv": this.exportQuantities(); break;
      case "exportView": await this.exportView(); break;
      case "open": await this.openProjectsDialog(); break;
      case "template": this.openTemplatesDialog(); break;
      case "versions": await this.openVersionsDialog(); break;
      case "share": {
        try {
          const url = await shareLink(this.project, this.customProps);
          await navigator.clipboard.writeText(url);
          this.toast(`${t("linkCopied")} (${Math.round(url.length / 1024)} KB)`);
        } catch (err) {
          console.warn(err);
          this.toast(t("linkFailed"));
        }
        break;
      }
      case "exportGlb": {
        try {
          await exportGLB(this.scene.world, store.safeFilename(this.project.name, "").replace(/\.json$/, ".glb"));
          this.toast(t("exported"));
        } catch (err) {
          console.warn(err);
          this.toast(t("importError"));
        }
        break;
      }
      case "exportStory": {
        try {
          store.download(JSON.stringify(this.storyStudioBundle(), null, 1), storyFilename(this.project));
          this.toast(t("exported"));
        } catch (err) {
          console.warn(err);
          this.toast(t("importError"));
        }
        break;
      }
    }
  }
  /** The project as a Story Studio bundle (js/storyset.js): a set plus the props it needs. */
  storyStudioBundle() {
    return storyStudioBundle(this.project, {
      propDoc: (id) => this.propDoc(id),
      shipped: (id) => catalog.props.find((p) => p.id === id)?.origin === "story-studio",
      wells: (b, s, fg) => this.stairWells(b, s, fg),
      roomsOf: (s) => this.roomsOf(s),
      roomLevels: (b, s, face) => ({ floorY: this.roomFloorY(b, s, face), ceilingY: this.roomCeilingY(b, s, face) }),
      terrain: { heightAt: (x, z) => this.terrain.heightAt(x, z), heights: () => this.terrain.shown },
    });
  }
  /** Merge another project into this one as extra buildings beside the current content (js/merge.js). */
  async addProject(source, { extendTerrain = false } = {}) {
    if (this.editor?.active) return this.toast(this.t("finishEditing"));
    this.checkpoint();
    const merged = mergeProject(this.project, source, { extendTerrain, tile: this.project.grid.tile });
    merged.id = this.project.id;
    merged.name = this.project.name;
    merged.createdAt = this.project.createdAt;
    merged.view = { ...this.project.view, camera: null };
    this.setProject(merged, { fit: true });
    this.queueSave();
    this.toast(this.t("addedToProject"));
  }
  openTemplatesDialog() {
    const t = this.t;
    const host = $("#templates-list");
    host.innerHTML = `<div class="plist">${TEMPLATE_IDS.map((id) => `<div class="pitem tpl"><img class="tthumb" src="../../assets/house-planner/templates/${id}.png" alt="" loading="lazy" width="160" height="100"><span class="pname">${esc(t(`template_${id}`))}</span><span class="pdate">${esc(t(`template_${id}_desc`))}</span><span class="tacts"><button class="tb small" data-template="${id}">${esc(t("new"))}</button><button class="tb small" data-template-add="${id}">${esc(t("addToProject"))}</button></span></div>`).join("")}</div>`;
    for (const img of host.querySelectorAll("img.tthumb")) img.addEventListener("error", () => img.classList.add("missing"), { once: true });
    host.onclick = async (e) => {
      const add = e.target.closest("[data-template-add]");
      if (add) {
        $("#templates-dialog").close();
        await this.addProject(makeTemplate(add.dataset.templateAdd, t(`template_${add.dataset.templateAdd}`)));
        return;
      }
      const b = e.target.closest("[data-template]");
      if (!b) return;
      if (!this.confirmDiscard()) return;
      $("#templates-dialog").close();
      const project = makeTemplate(b.dataset.template, t(`template_${b.dataset.template}`));
      this.setProject(project, { fit: true });
      this.queueSave();
    };
    $("#templates-dialog").showModal();
  }
  /** Keep a version at most every 10 minutes of saving. */
  async maybeSaveVersion(force = false, label = "") {
    const now = Date.now();
    if (!force && this.lastVersionAt && now - this.lastVersionAt < 10 * 60 * 1000) return;
    this.lastVersionAt = now;
    try {
      await store.saveVersion(this.project, label);
    } catch (err) {
      console.warn("version", err);
    }
  }
  async openVersionsDialog() {
    const t = this.t;
    const render = async () => {
      const list = await store.listVersions(this.project.id);
      const host = $("#versions-list");
      host.innerHTML =
        `<div class="row-actions"><button class="tb small" data-newversion>${esc(t("saveVersion"))}</button></div>` +
        (list.length
          ? `<div class="plist">${list.map((v) => `<div class="pitem"><span class="pname">${esc(v.label || new Date(v.savedAt).toLocaleString(this.lang))}</span><span class="pdate">${esc(new Date(v.savedAt).toLocaleString(this.lang))}</span><button class="tb small" data-restore="${v.id}">${esc(t("restore"))}</button><button class="tb small danger" data-delversion="${v.id}">${esc(t("delete"))}</button></div>`).join("")}</div>`
          : `<p class="hint">${esc(t("noVersions"))}</p>`);
      host.onclick = async (e) => {
        if (e.target.closest("[data-newversion]")) {
          await this.maybeSaveVersion(true, prompt(t("versionLabel"), "") || "");
          return render();
        }
        const del = e.target.closest("[data-delversion]");
        if (del) {
          await store.deleteVersion(del.dataset.delversion);
          return render();
        }
        const res = e.target.closest("[data-restore]");
        if (res) {
          if (!confirm(t("confirmRestore"))) return;
          await this.maybeSaveVersion(true, t("beforeRestore"));
          const project = await store.loadVersion(res.dataset.restore);
          if (project) {
            project.id = this.project.id;
            await store.saveProject(project);
            this.setProject(project);
          }
          $("#versions-dialog").close();
        }
      };
    };
    await render();
    $("#versions-dialog").showModal();
  }
  async openProjectsDialog() {
    const t = this.t;
    const list = await store.listProjects();
    const host = $("#projects-list");
    host.innerHTML = list.length
      ? `<div class="plist">${list.map((p) => `<div class="pitem" data-id="${p.id}"><span class="pname">${esc(p.name || t("untitled"))}</span><span class="pdate">${new Date(p.updatedAt).toLocaleString(this.lang)}</span><button class="tb small" data-open="${p.id}">${esc(t("open"))}</button><button class="tb small" data-add="${p.id}">${esc(t("addToProject"))}</button><button class="tb small danger" data-del="${p.id}">${esc(t("delete"))}</button></div>`).join("")}</div>`
      : `<p class="hint">${esc(t("noProjects"))}</p>`;
    host.onclick = async (e) => {
      const open = e.target.closest("[data-open]") || e.target.closest(".pname")?.parentElement;
      const del = e.target.closest("[data-del]");
      const add = e.target.closest("[data-add]");
      if (add) {
        $("#projects-dialog").close();
        const source = await store.loadProject(add.dataset.add);
        if (source) await this.addProject(source, { extendTerrain: true });
        return;
      }
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
        if (id !== this.project.id && !this.confirmDiscard()) return;
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
      if (key === "N") return this.projectAction("template"), true;
      if (key === "X") return this.projectAction("exportGlb"), true;
      if (key === "L") return this.projectAction("share"), true;
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
