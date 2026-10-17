// Pointer tools per editor tab: terrain brushes, tile painting, wall
// drawing, opening placement and object placement. Each tool reads the
// pointer, shows a ghost in the overlay group and writes to the project
// through app.checkpoint() / app.changed().
import * as THREE from "three";
import { M, CM } from "./scene.js";
import { uid, OPENING_PRESETS, GATE_WIDTHS, wallLength, polylineLength, isLocked } from "./schema.js";
import { tileKey, floorTop } from "./build/slabs.js";
import { nearestOnWall, clampOpening, wallHeight } from "./build/walls.js";
import { propObject, propBounds } from "./props.js";
import { ghostMaterial } from "./materials.js";
import { buildStairs, defaultRise } from "./build/stairs.js";
import { DEFAULT_MATERIAL, MUD_TINT, streamBand } from "./build/outdoor.js";
import { buildSiteWall } from "./build/sitewall.js";
import { buildRailing, railingOffset, nearestOnPolyline, pointAlong, clampGate, DEFAULT_TEXTURE } from "./build/railing.js";

export const TAB_TOOLS = {
  terrain: ["select", "raise", "lower", "flatten", "smooth"],
  floors: ["select", "paint", "erase", "rect"],
  walls: ["select", "draw", "railing"],
  openings: ["select", "add", "gate"],
  stairs: ["select", "place"],
  outdoor: ["select", "polygon"],
  garden: ["select", "polygon", "fence", "siteWall"],
  objects: ["select", "place", "note"],
};
const DEG = Math.PI / 180;

export class Tools {
  constructor(app) {
    this.app = app;
    this.canvas = app.scene.canvas;
    this.down = null; // {x, y, button, moved}
    this.stroke = null; // per-drag state
    this.chain = null; // wall drawing start [x,z]
    this.poly = null; // polygon points being drawn (world cm)
    this.line = null; // railing / fence points being drawn (cm)
    this.lastMove = null; // last pointer event, to redraw ghosts
    this.ghost = new THREE.Group();
    app.scene.overlay.add(this.ghost);
    this.hoverWall = null;
    this.canvas.addEventListener("pointerdown", (e) => this.onDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onMove(e));
    this.canvas.addEventListener("pointerup", (e) => this.onUp(e));
    this.canvas.addEventListener("pointerleave", () => this.clearGhost());
    this.canvas.addEventListener("dblclick", () => {
      if (this.poly) this.closePolygon();
      else if (this.line) this.finishLine();
      else this.endChain();
    });
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (this.chain) this.endChain();
      else if (this.poly) this.closePolygon();
      else if (this.line) this.finishLine();
    });
  }
  get tool() {
    return this.app.state.tool;
  }
  reset() {
    this.chain = null;
    this.poly = null;
    this.line = null;
    this.stroke = null;
    this.down = null;
    this.clearGhost();
  }
  /** Something to cancel with Esc (wall chain or polygon)? */
  get busy() {
    return !!(this.chain || this.poly || this.line);
  }
  cancel() {
    if (this.chain) return this.endChain();
    if (this.line) return this.finishLine();
    if (this.poly) {
      this.poly = null;
      this.clearGhost();
    }
  }
  endChain() {
    if (!this.chain) return;
    this.chain = null;
    this.clearGhost();
    this.app.toast(this.app.t("wallDone"));
  }
  clearGhost() {
    for (const c of [...this.ghost.children]) {
      this.ghost.remove(c);
      c.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material && !o.material.userData?.shared) o.material.dispose?.();
      });
    }
    this.app.scene.requestRender();
  }
  setGhost(obj) {
    this.clearGhost();
    if (obj) this.ghost.add(obj);
    this.app.scene.requestRender();
  }

  // ----------------------------------------------------------- pointer

  onDown(e) {
    if (this.app.walk?.active) return;
    if (e.button !== 0 || this.app.gizmo.dragging || this.app.gizmo.hovering) return;
    if (this.app.state.orbitOverride) return;
    this.down = { x: e.clientX, y: e.clientY, moved: false };
    if (this.app.editor?.active) return;
    const tool = this.tool;
    if (tool === "select") return;
    const storey = this.app.storey(), building = this.app.building();
    switch (this.app.state.tab) {
      case "terrain":
        if (this.app.project.terrain.locked) return this.app.toast(this.app.t("lockedItem"));
        this.app.checkpoint();
        this.stroke = { base: this.app.project.terrain.heights.slice(), target: null };
        this.brush(e);
        break;
      case "floors":
        if (!storey || isLocked(this.app.project, storey.id)) return this.app.toast(this.app.t("lockedItem"));
        this.app.checkpoint();
        if (tool === "rect") {
          const p = this.floorPoint(e);
          this.stroke = { start: p, end: p };
        } else {
          this.stroke = { painted: new Set() };
          this.paintAt(e);
        }
        break;
      case "walls":
        if (!storey || isLocked(this.app.project, storey.id)) return this.app.toast(this.app.t("lockedItem"));
        if (tool === "railing") this.lineClick(e);
        else this.wallClick(e);
        break;
      case "openings":
        if (tool === "gate") return this.gateClick(e);
        if (!storey) return;
        this.openingClick(e);
        break;
      case "objects":
        if (tool === "note") this.noteClick(e);
        else this.placeClick(e);
        break;
      case "stairs":
        if (!storey || isLocked(this.app.project, storey.id)) return this.app.toast(this.app.t("lockedItem"));
        this.stairsClick(e);
        break;
      case "outdoor":
      case "garden":
        if (tool === "fence" || tool === "siteWall" || this.streamMode) this.lineClick(e);
        else this.polygonClick(e);
        break;
    }
  }
  /** Outdoor › stream: drawn as a polyline, not a closed polygon. */
  get streamMode() {
    return this.app.state.tab === "outdoor" && this.tool === "polygon" && this.app.state.pendingOutdoorType === "stream";
  }
  onMove(e) {
    if (this.app.walk?.active) return;
    if (this.down && (Math.abs(e.clientX - this.down.x) > 3 || Math.abs(e.clientY - this.down.y) > 3)) this.down.moved = true;
    if (this.app.gizmo.dragging || this.app.editor?.active) return;
    this.lastMove = e;
    const tool = this.tool;
    if (tool === "select") return;
    switch (this.app.state.tab) {
      case "stairs":
        this.stairsGhost(e);
        break;
      case "outdoor":
      case "garden":
        if (tool === "fence" || tool === "siteWall" || this.streamMode) this.lineGhost(e);
        else this.polygonGhost(e);
        break;
      case "terrain":
        if (this.stroke && this.down) this.brush(e);
        else this.brushGhost(e);
        break;
      case "floors":
        if (this.stroke && this.down) {
          if (tool === "rect") {
            this.stroke.end = this.floorPoint(e) || this.stroke.end;
            this.rectGhost();
          } else this.paintAt(e);
        } else this.tileGhost(e);
        break;
      case "walls":
        if (tool === "railing") this.lineGhost(e);
        else this.wallGhost(e);
        break;
      case "openings":
        if (tool === "gate") this.gateGhost(e);
        else this.openingGhost(e);
        break;
      case "objects":
        if (tool === "note") this.noteGhost(e);
        else this.placeGhost(e);
        break;
    }
  }
  onUp(e) {
    if (this.app.walk?.active) return;
    if (e.button !== 0) return;
    const down = this.down;
    this.down = null;
    if (this.app.editor?.active) {
      if (down && !down.moved && !this.app.gizmo.dragging) this.app.editor.pick(e);
      return;
    }
    if (!down) return;
    if (this.tool === "select") {
      if (!down.moved && !this.app.gizmo.dragging) this.app.pickSelect(e);
      return;
    }
    if (this.stroke) {
      const tab = this.app.state.tab;
      if (tab === "terrain") this.app.changed({ rebuild: "none", terrain: true });
      if (tab === "floors") {
        if (this.tool === "rect" && this.stroke.start && this.stroke.end) this.fillRect(this.stroke.start, this.stroke.end, this.tool === "rect");
        this.app.changed({ rebuild: "building" });
        this.clearGhost();
      }
      this.stroke = null;
    }
  }

  // ----------------------------------------------------------- terrain

  terrainHit(e) {
    const mesh = this.app.terrain.mesh;
    if (!mesh) return null;
    const hits = this.app.scene.pickObjects(e, [mesh], false);
    return hits[0]?.point || null;
  }
  brush(e) {
    const p = this.terrainHit(e);
    if (!p) return;
    const br = this.app.prefs.brush;
    if (this.stroke.target == null) this.stroke.target = this.app.terrain.heightAt(p.x * CM, p.z * CM);
    const changed = this.app.terrain.brush(p.x * CM, p.z * CM, { radius: br.radius, strength: br.strength, mode: this.tool, target: this.stroke.target, base: this.stroke.base });
    this.brushGhost(e, p);
    if (changed) this.app.terrainTouched();
  }
  brushGhost(e, p = this.terrainHit(e)) {
    if (!p) return this.clearGhost();
    const r = this.app.prefs.brush.radius * M;
    let ring = this.ghost.children[0];
    if (!ring || ring.userData.kind !== "brush") {
      ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: 0x008f7d, transparent: true, opacity: 0.8, depthTest: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.userData.kind = "brush";
      ring.renderOrder = 30;
      this.setGhost(ring);
    }
    ring.scale.set(r, r, 1);
    ring.position.set(p.x, p.y + 0.03, p.z);
    this.app.scene.requestRender();
  }

  // ------------------------------------------------------------ floors

  /** Building-local cm point on the active storey's floor plane. */
  floorPoint(e) {
    const storey = this.app.storey(), building = this.app.building();
    if (!storey || !building) return null;
    const y = (storey.elevation + this.activeOffset()) * M;
    const p = this.app.scene.pickPlane(e, y);
    if (!p) return null;
    const l = this.app.toLocal(building, p);
    return [l.x, l.z];
  }
  activeOffset() {
    const fg = this.app.activeFloorGroup();
    return fg ? fg.offset : 0;
  }
  tileAt(p) {
    const t = this.app.project.grid.tile;
    return [Math.floor(p[0] / t), Math.floor(p[1] / t)];
  }
  paintAt(e) {
    const p = this.floorPoint(e);
    if (!p) return;
    const [x, z] = this.tileAt(p);
    const key = tileKey(x, z);
    if (this.stroke.painted.has(key)) return;
    this.stroke.painted.add(key);
    const storey = this.app.storey();
    if (this.tool === "erase") {
      for (const fg of storey.floorGroups) fg.tiles = fg.tiles.filter(([tx, tz]) => tx !== x || tz !== z);
    } else {
      const fg = this.app.ensureFloorGroup();
      for (const other of storey.floorGroups) if (other !== fg) other.tiles = other.tiles.filter(([tx, tz]) => tx !== x || tz !== z);
      if (!fg.tiles.some(([tx, tz]) => tx === x && tz === z)) fg.tiles.push([x, z]);
    }
    this.app.rebuildBuilding(this.app.building().id);
    this.tileGhost(e);
  }
  fillRect(a, b) {
    const t = this.app.project.grid.tile;
    const [ax, az] = this.tileAt(a), [bx, bz] = this.tileAt(b);
    const storey = this.app.storey();
    const fg = this.app.ensureFloorGroup();
    for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++)
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) {
        for (const other of storey.floorGroups) if (other !== fg) other.tiles = other.tiles.filter(([tx, tz]) => tx !== x || tz !== z);
        if (!fg.tiles.some(([tx, tz]) => tx === x && tz === z)) fg.tiles.push([x, z]);
      }
    void t;
  }
  tileGhost(e) {
    const p = this.floorPoint(e);
    if (!p) return this.clearGhost();
    const [x, z] = this.tileAt(p);
    this.showTiles([[x, z]], this.tool === "erase" ? "#d9534f" : "#008f7d");
  }
  rectGhost() {
    const [ax, az] = this.tileAt(this.stroke.start), [bx, bz] = this.tileAt(this.stroke.end);
    const tiles = [];
    for (let z = Math.min(az, bz); z <= Math.max(az, bz); z++) for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) tiles.push([x, z]);
    this.showTiles(tiles, "#008f7d");
  }
  showTiles(tiles, color) {
    const t = this.app.project.grid.tile * M;
    const storey = this.app.storey(), building = this.app.building();
    const y = (storey.elevation + this.activeOffset()) * M + 0.01;
    const group = new THREE.Group();
    const mat = ghostMaterial(color);
    const geo = new THREE.PlaneGeometry(t * 0.96, t * 0.96);
    geo.rotateX(-Math.PI / 2);
    for (const [x, z] of tiles) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set((x + 0.5) * t, y, (z + 0.5) * t);
      group.add(m);
    }
    this.app.applyBuildingTransform(group, building);
    this.setGhost(group);
  }

  // ------------------------------------------------------------- walls

  wallPoint(e) {
    const storey = this.app.storey(), building = this.app.building();
    const p = this.app.scene.pickPlane(e, storey.elevation * M);
    if (!p) return null;
    const l = this.app.toLocal(building, p);
    let x = l.x, z = l.z;
    // magnet to wall ends
    let best = null, bestD = 20;
    for (const w of storey.walls)
      for (const end of [w.a, w.b]) {
        const d = Math.hypot(end[0] - x, end[1] - z);
        if (d < bestD) {
          bestD = d;
          best = end;
        }
      }
    if (best) return [best[0], best[1]];
    const snap = this.app.state.snap ? this.app.project.grid.snap : 1;
    x = Math.round(x / snap) * snap;
    z = Math.round(z / snap) * snap;
    if (this.chain && e.shiftKey) {
      if (Math.abs(x - this.chain[0]) > Math.abs(z - this.chain[1])) z = this.chain[1];
      else x = this.chain[0];
    }
    return [x, z];
  }
  wallClick(e) {
    const p = this.wallPoint(e);
    if (!p) return;
    if (!this.chain) {
      this.chain = p;
      return;
    }
    const len = Math.hypot(p[0] - this.chain[0], p[1] - this.chain[1]);
    if (len < 10) return;
    this.app.checkpoint();
    const storey = this.app.storey();
    const last = storey.walls[storey.walls.length - 1];
    storey.walls.push({
      id: uid("w"), name: "", a: this.chain, b: p, thickness: last?.thickness ?? 20, height: null,
      material: last?.material ?? null, tint: last?.tint ?? "#f2ede4", outerMaterial: null, outerTint: null, locked: false, openings: [],
    });
    this.chain = p;
    this.app.changed({ rebuild: "building" });
  }
  wallGhost(e) {
    const p = this.wallPoint(e);
    if (!p) return this.clearGhost();
    const storey = this.app.storey(), building = this.app.building();
    const group = new THREE.Group();
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), ghostMaterial("#008f7d"));
    dot.position.set(p[0] * M, storey.elevation * M + 0.05, p[1] * M);
    group.add(dot);
    if (this.chain) {
      const dx = p[0] - this.chain[0], dz = p[1] - this.chain[1];
      const len = Math.hypot(dx, dz);
      if (len > 1) {
        const h = storey.height * M;
        const box = new THREE.Mesh(new THREE.BoxGeometry(len * M, h, 0.2), ghostMaterial("#008f7d"));
        box.position.set(((this.chain[0] + p[0]) / 2) * M, storey.elevation * M + h / 2, ((this.chain[1] + p[1]) / 2) * M);
        box.rotation.y = -Math.atan2(dz, dx);
        group.add(box);
        this.app.showMeasure(`${Math.round(len)} cm`);
      }
    }
    this.app.applyBuildingTransform(group, building);
    this.setGhost(group);
  }

  // ---------------------------------------------------------- openings

  wallUnderPointer(e) {
    const storey = this.app.storey(), building = this.app.building();
    const group = this.app.buildingGroup(building.id);
    if (!group) return null;
    const meshes = [];
    group.traverse((o) => {
      if (o.userData.kind === "wall" && o.userData.storeyId === storey.id) meshes.push(o);
    });
    const hit = this.app.scene.pickObjects(e, meshes, false)[0];
    if (!hit) return null;
    const wall = storey.walls.find((w) => w.id === hit.object.userData.id);
    if (!wall) return null;
    const l = this.app.toLocal(building, hit.point);
    const near = nearestOnWall(wall, l.x, l.z);
    return { wall, u: near.u, point: hit.point };
  }
  pendingOpening(wall, u) {
    const preset = this.app.state.pendingPreset;
    const p = OPENING_PRESETS[preset];
    const snap = this.app.state.snap ? this.app.project.grid.snap : 1;
    const op = { id: uid("op"), preset, type: p.type, offset: Math.round((u - p.width / 2) / snap) * snap, width: p.width, height: p.height, sill: p.sill, flip: false, frameColor: "#776750", leafColor: "#b99673", glassColor: "#bcd8e6", locked: false };
    clampOpening(op, wall);
    return op;
  }
  openingClick(e) {
    const hit = this.wallUnderPointer(e);
    if (!hit) return;
    if (isLocked(this.app.project, hit.wall.id)) return this.app.toast(this.app.t("lockedItem"));
    const op = this.pendingOpening(hit.wall, hit.u);
    const storey = this.app.storey();
    const overlaps = hit.wall.openings.some((o) => op.offset < o.offset + o.width && o.offset < op.offset + op.width);
    if (overlaps) return this.app.toast(this.app.t("openingOverlap"));
    const H = wallHeight(hit.wall, storey);
    op.height = Math.min(op.height, H - op.sill - 5);
    this.app.checkpoint();
    hit.wall.openings.push(op);
    this.app.changed({ rebuild: "building" });
    this.app.select(op.id, { keepTool: true });
  }
  openingGhost(e) {
    const hit = this.wallUnderPointer(e);
    if (!hit) return this.clearGhost();
    const op = this.pendingOpening(hit.wall, hit.u);
    const storey = this.app.storey(), building = this.app.building();
    const box = new THREE.Mesh(new THREE.BoxGeometry(op.width * M, op.height * M, (hit.wall.thickness + 6) * M), ghostMaterial("#008f7d"));
    const dx = hit.wall.b[0] - hit.wall.a[0], dz = hit.wall.b[1] - hit.wall.a[1];
    const L = wallLength(hit.wall) || 1;
    const cu = op.offset + op.width / 2;
    box.position.set((hit.wall.a[0] + (dx * cu) / L) * M, (storey.elevation + op.sill + op.height / 2) * M, (hit.wall.a[1] + (dz * cu) / L) * M);
    box.rotation.y = -Math.atan2(dz, dx);
    const group = new THREE.Group();
    group.add(box);
    this.app.applyBuildingTransform(group, building);
    this.setGhost(group);
  }

  // ----------------------------------------------------------- objects

  /** Where a new object would land: {point (world m), storey?, building?, y (cm)}. */
  placeTarget(e) {
    const meshes = [];
    for (const b of this.app.project.buildings) {
      const g = this.app.buildingGroup(b.id);
      g?.traverse((o) => {
        if (o.userData.kind === "floorGroup" && o.visible && o.parent?.visible) meshes.push(o);
      });
    }
    if (this.app.terrain.mesh) meshes.push(this.app.terrain.mesh);
    const hits = this.app.scene.pickObjects(e, meshes, false);
    const hit = hits.find((h) => h.object.visible);
    if (!hit) return null;
    const ud = hit.object.userData;
    if (ud.kind === "floorGroup") {
      const found = this.app.locate(ud.id);
      if (!found) return null;
      return { point: hit.point, building: found.building, storey: found.storey, top: floorTop(found.storey, found.item) };
    }
    return { point: hit.point, building: null, storey: null, top: this.app.terrain.heightAt(hit.point.x * CM, hit.point.z * CM) };
  }
  placeGhost(e) {
    const doc = this.app.state.pendingProp;
    if (!doc) return this.clearGhost();
    const target = this.placeTarget(e);
    if (!target) return this.clearGhost();
    let g = this.ghost.children[0];
    if (!g || g.userData.docId !== doc.id || g.userData.docRef !== doc) {
      g = propObject(doc);
      g.traverse((o) => {
        if (o.isMesh) o.material = ghostMaterial("#008f7d");
      });
      g.userData.docId = doc.id;
      g.userData.docRef = doc;
      this.setGhost(g);
    }
    const snap = this.app.state.snap ? this.app.project.grid.snap * M : 0;
    const sx = snap ? Math.round(target.point.x / snap) * snap : target.point.x;
    const sz = snap ? Math.round(target.point.z / snap) * snap : target.point.z;
    g.position.set(sx, target.top * M, sz);
    g.rotation.set(0, this.app.state.ghostYaw * DEG, 0);
    this.app.scene.requestRender();
  }
  placeClick(e) {
    const doc = this.app.state.pendingProp;
    if (!doc) return;
    const target = this.placeTarget(e);
    if (!target) return;
    const snap = this.app.state.snap ? this.app.project.grid.snap : 0;
    const wx = snap ? Math.round((target.point.x * CM) / snap) * snap : target.point.x * CM;
    const wz = snap ? Math.round((target.point.z * CM) / snap) * snap : target.point.z * CM;
    this.app.addObject(doc, { wx, wz, top: target.top, building: target.building, storey: target.storey, yaw: this.app.state.ghostYaw });
  }
  rotateGhost(delta) {
    this.app.state.ghostYaw = (this.app.state.ghostYaw + delta + 360) % 360;
    if (this.app.state.tab === "stairs") {
      if (this.lastMove) this.stairsGhost(this.lastMove);
      return;
    }
    const g = this.ghost.children[0];
    if (g) {
      g.rotation.y = this.app.state.ghostYaw * DEG;
      this.app.scene.requestRender();
    }
  }

  // ------------------------------------------------------------- notes

  /** Any visible surface under the pointer (world metres). */
  noteTarget(e) {
    const hits = this.app.scene.ray(e).intersectObjects(this.app.scene.world.children, true);
    for (const h of hits) {
      let visible = true;
      for (let p = h.object; p; p = p.parent) if (!p.visible) visible = false;
      if (!visible || h.object.material?.visible === false) continue;
      if (h.object.userData.kind === "terrain" && this.app.terrain.isCut(h.point.x * CM, h.point.z * CM)) continue;
      return h;
    }
    return null;
  }
  noteGhost(e) {
    const hit = this.noteTarget(e);
    if (!hit) return this.clearGhost();
    let dot = this.ghost.children[0];
    if (!dot || dot.userData.kind !== "notePin") {
      dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshBasicMaterial({ color: 0xe0a526, depthTest: false }));
      dot.userData.kind = "notePin";
      dot.renderOrder = 30;
      this.setGhost(dot);
    }
    dot.position.copy(hit.point);
    this.app.scene.requestRender();
  }
  noteClick(e) {
    const hit = this.noteTarget(e);
    if (!hit) return;
    this.app.addNote([hit.point.x * CM, hit.point.y * CM, hit.point.z * CM]);
  }

  // ------------------------------------------------------------ stairs

  /** Stairs about to be placed (building-local yaw = ghost yaw + building rotation). */
  pendingStairs() {
    const storey = this.app.storey(), building = this.app.building();
    const last = storey.stairs[storey.stairs.length - 1];
    return {
      id: uid("sr"), name: "", shape: this.app.state.pendingStairShape, at: [0, 0],
      rotation: (this.app.state.ghostYaw + building.rotation + 360) % 360,
      width: last?.width ?? 100, rise: defaultRise(building, storey), stepHeight: last?.stepHeight ?? 18, treadDepth: last?.treadDepth ?? 28,
      turn: last?.turn ?? "left", material: last?.material ?? "woodFloor", tint: last?.tint ?? null, cutFloorAbove: true, locked: false,
    };
  }
  stairsPoint(e) {
    const storey = this.app.storey(), building = this.app.building();
    const p = this.app.scene.pickPlane(e, storey.elevation * M);
    if (!p) return null;
    const l = this.app.toLocal(building, p);
    const snap = this.app.state.snap ? this.app.project.grid.snap : 1;
    return [Math.round(l.x / snap) * snap, Math.round(l.z / snap) * snap];
  }
  stairsGhost(e) {
    const p = this.stairsPoint(e);
    if (!p) return this.clearGhost();
    const storey = this.app.storey(), building = this.app.building();
    const st = this.pendingStairs();
    st.at = p;
    const key = `${st.shape}|${st.width}|${st.rise}|${st.stepHeight}|${st.treadDepth}|${st.turn}|${st.rotation}|${storey.id}`;
    let outer = this.ghost.children[0];
    if (!outer || outer.userData.key !== key) {
      outer = new THREE.Group();
      outer.userData.key = key;
      outer.add(buildStairs(st, storey, ghostMaterial("#008f7d")));
      this.app.applyBuildingTransform(outer, building);
      this.setGhost(outer);
    }
    outer.children[0].position.set(p[0] * M, storey.elevation * M, p[1] * M);
    this.app.scene.requestRender();
  }
  stairsClick(e) {
    const p = this.stairsPoint(e);
    if (!p) return;
    const st = this.pendingStairs();
    st.at = p;
    this.app.checkpoint();
    this.app.storey().stairs.push(st);
    this.app.changed({ rebuild: "building", buildingId: this.app.building().id });
    this.app.select(st.id, { keepTool: true });
    this.app.toast(this.app.t("placed"));
  }

  // ------------------------------------------------- railings / fences

  /** Railing (building-local, on the active storey's floor), fence / wall / stream (world, on the ground)? */
  get lineKind() {
    if (this.app.state.tab === "outdoor") return "stream";
    if (this.app.state.tab !== "garden") return "railing";
    return this.tool === "siteWall" ? "siteWall" : "fence";
  }
  /** Snapped cm point for the line being drawn: magnet to ends, grid, Shift axis lock. */
  linePoint(e) {
    const fence = this.lineKind !== "railing";
    const storey = this.app.storey(), building = this.app.building();
    let x, z;
    const ends = [];
    if (fence) {
      const hit = this.terrainHit(e) || this.app.scene.pickPlane(e, 0);
      if (!hit) return null;
      x = hit.x * CM;
      z = hit.z * CM;
      for (const f of this.app.project.fences) ends.push(...f.points);
      for (const w of this.app.project.siteWalls) ends.push(...w.points);
    } else {
      const p = this.app.scene.pickPlane(e, (storey.elevation + this.activeOffset()) * M);
      if (!p) return null;
      const l = this.app.toLocal(building, p);
      x = l.x;
      z = l.z;
      for (const w of storey.walls) ends.push(w.a, w.b);
      for (const r of storey.railings) ends.push(...r.points);
    }
    let best = null, bestD = 20;
    for (const end of ends) {
      const d = Math.hypot(end[0] - x, end[1] - z);
      if (d < bestD) {
        bestD = d;
        best = end;
      }
    }
    if (best) return [best[0], best[1]];
    const snap = this.app.state.snap ? this.app.project.grid.snap : 1;
    x = Math.round(x / snap) * snap;
    z = Math.round(z / snap) * snap;
    const last = this.line?.[this.line.length - 1];
    if (last && e.shiftKey) {
      if (Math.abs(x - last[0]) > Math.abs(z - last[1])) z = last[1];
      else x = last[0];
    }
    return [x, z];
  }
  /** The item being drawn, with the pending style. */
  pendingLine(points) {
    if (this.lineKind === "stream") {
      const last = [...this.app.project.outdoor].reverse().find((d) => d.type === "stream");
      return {
        id: uid("d"), name: "", points, type: "stream", material: last?.material ?? DEFAULT_MATERIAL.stream, tint: last?.tint ?? MUD_TINT,
        height: 0, open: false, postSize: 15, depth: last?.depth ?? 25, width: this.app.state.pendingStreamWidth || 120, lights: false, locked: false,
      };
    }
    if (this.lineKind === "siteWall") {
      const last = this.app.project.siteWalls[this.app.project.siteWalls.length - 1];
      return {
        id: uid("sw"), name: "", points, thickness: last?.thickness ?? 20, height: last?.height ?? 200, top: this.app.state.pendingWallTop,
        stepLength: last?.stepLength ?? 100, material: last?.material ?? "plaster", tint: last?.tint ?? null, outerMaterial: last?.outerMaterial ?? null, outerTint: last?.outerTint ?? null, gates: [], locked: false,
      };
    }
    const fence = this.lineKind === "fence";
    const style = fence ? this.app.state.pendingFenceStyle : this.app.state.pendingRailingStyle;
    const list = fence ? this.app.project.fences : this.app.storey().railings;
    const last = [...list].reverse().find((r) => r.style === style);
    const item = {
      id: uid(fence ? "fe" : "rl"), name: "", points, height: last?.height ?? (fence ? 150 : 100), style,
      postSpacing: last?.postSpacing ?? 150, material: last?.material ?? DEFAULT_TEXTURE[style] ?? null, tint: last?.tint ?? null, locked: false,
    };
    if (fence) item.gates = [];
    return item;
  }
  lineClick(e) {
    const p = this.linePoint(e);
    if (!p) return;
    if (!this.line) this.line = [];
    const last = this.line[this.line.length - 1];
    if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < 2) return;
    // clicking the first point again closes the loop and ends
    if (this.line.length >= 3 && Math.hypot(this.line[0][0] - p[0], this.line[0][1] - p[1]) < 15) {
      this.line.push([this.line[0][0], this.line[0][1]]);
      return this.finishLine();
    }
    this.line.push(p);
    this.lineGhost(e);
  }
  /** End the line: a railing or fence when it has at least 2 points. */
  finishLine() {
    const pts = this.line;
    if (!pts) return;
    this.line = null;
    this.clearGhost();
    if (pts.length < 2 || polylineLength(pts) < 5) return this.app.toast(this.app.t("lineNeed2"));
    const kind = this.lineKind;
    const fence = kind !== "railing";
    const item = this.pendingLine(pts.map(([x, z]) => [x, z]));
    this.app.checkpoint();
    if (kind === "stream") {
      this.app.project.outdoor.push(item);
      this.app.changed({ rebuild: "site" });
    } else if (kind === "siteWall") {
      this.app.project.siteWalls.push(item);
      this.app.changed({ rebuild: "site" });
    } else if (fence) {
      this.app.project.fences.push(item);
      this.app.changed({ rebuild: "site" });
    } else {
      this.app.storey().railings.push(item);
      this.app.changed({ rebuild: "building", buildingId: this.app.building().id });
    }
    this.app.select(item.id, { keepTool: true });
    this.app.toast(this.app.t(kind === "stream" ? "placed" : kind === "siteWall" ? "siteWallDone" : fence ? "fenceDone" : "railingDone"));
  }
  /** Stream ghost: the band outline on the ground plus the points. */
  streamGhost(e, p) {
    const pts = [...(this.line || []), p];
    const group = new THREE.Group();
    const lift = 4;
    const v = (q) => new THREE.Vector3(q[0] * M, (this.app.terrain.heightAt(q[0], q[1]) + lift) * M, q[1] * M);
    const mat = ghostMaterial("#008f7d");
    const dotGeo = new THREE.SphereGeometry(0.1, 10, 8);
    for (const q of pts) {
      const dot = new THREE.Mesh(dotGeo, mat);
      dot.position.copy(v(q));
      group.add(dot);
    }
    if (pts.length >= 2) {
      const lineMat = new THREE.LineBasicMaterial({ color: 0x008f7d, depthTest: false });
      const axis = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(v)), lineMat);
      axis.renderOrder = 25;
      group.add(axis);
      const band = streamBand(pts, this.app.state.pendingStreamWidth || 120);
      if (band.length >= 3) {
        const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(band.map(v)), lineMat);
        outline.renderOrder = 25;
        group.add(outline);
      }
      const last = pts[pts.length - 2];
      this.app.showMeasure(`${Math.round(Math.hypot(p[0] - last[0], p[1] - last[1]))} cm · Σ ${Math.round(polylineLength(pts))} cm`);
    }
    this.setGhost(group);
  }
  lineGhost(e) {
    const p = this.linePoint(e);
    if (!p) return this.clearGhost();
    if (this.lineKind === "stream") return this.streamGhost(e, p);
    const fence = this.lineKind !== "railing";
    const storey = this.app.storey(), building = this.app.building();
    const committed = this.line || [];
    const pts = [...committed, p];
    const pending = this.pendingLine(committed);
    const style = pending.style;
    const key = `${this.lineKind}|${style}|${committed.map((q) => q.join(",")).join(";")}`;
    let outer = this.ghost.children[0];
    if (!outer || outer.userData.key !== key) {
      // the committed part as real geometry, rebuilt only when a point is added
      outer = new THREE.Group();
      outer.userData.key = key;
      if (committed.length >= 2) {
        const item = pending;
        const g = this.lineKind === "siteWall"
          ? buildSiteWall(item, this.app.terrain, { ghost: true })
          : fence
          ? buildRailing(item, "fence", { heightAt: (x, z) => this.app.terrain.heightAt(x, z), ghost: ghostMaterial("#008f7d") })
          : buildRailing(item, "railing", { baseY: storey.elevation + railingOffset(item, storey, this.app.project.grid.tile), ghost: ghostMaterial("#008f7d") });
        outer.add(g);
      }
      outer.add(new THREE.Group()); // the moving segment
      if (!fence) this.app.applyBuildingTransform(outer, building);
      this.setGhost(outer);
    }
    const live = outer.children[outer.children.length - 1];
    for (const c of [...live.children]) {
      live.remove(c);
      c.geometry?.dispose?.();
    }
    const baseY = fence ? (x, z) => this.app.terrain.heightAt(x, z) + 2 : () => storey.elevation + this.activeOffset() + 2;
    const mat = ghostMaterial("#008f7d");
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat);
    dot.position.set(p[0] * M, baseY(p[0], p[1]) * M, p[1] * M);
    live.add(dot);
    const last = committed[committed.length - 1];
    if (last) {
      const dx = p[0] - last[0], dz = p[1] - last[1];
      const len = Math.hypot(dx, dz);
      if (len > 1) {
        const h = pending.height * M;
        const y0 = baseY(last[0], last[1]), y1 = baseY(p[0], p[1]);
        const box = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(len, y1 - y0) * M, h, 0.06), mat);
        box.position.set(((last[0] + p[0]) / 2) * M, ((y0 + y1) / 2) * M + h / 2, ((last[1] + p[1]) / 2) * M);
        box.rotation.y = -Math.atan2(dz, dx);
        box.rotation.z = Math.atan2(y1 - y0, len);
        box.rotation.order = "YZX";
        live.add(box);
        this.app.showMeasure(`${Math.round(len)} cm · Σ ${Math.round(polylineLength(pts))} cm`);
      }
    }
    this.app.scene.requestRender();
  }

  // ------------------------------------------------------------- gates

  /** Fence under the pointer: {fence, s (cm along it), point}. */
  /** A fence or site wall under the pointer (both take gates). */
  fenceUnderPointer(e) {
    const meshes = [];
    this.app.siteGroup?.traverse((o) => {
      if ((o.userData.kind === "fence" || o.userData.kind === "siteWall") && o.isMesh && !o.userData.gateLeaf) meshes.push(o);
    });
    const hit = this.app.scene.pickObjects(e, meshes, false)[0];
    if (!hit) return null;
    const id = hit.object.userData.id;
    const fence = this.app.project.fences.find((f) => f.id === id) || this.app.project.siteWalls.find((w) => w.id === id);
    if (!fence) return null;
    const near = nearestOnPolyline(fence.points, hit.point.x * CM, hit.point.z * CM);
    if (!near) return null;
    return { fence, s: near.s, point: hit.point, near };
  }
  pendingGate(fence, s) {
    const type = this.app.state.pendingGateType;
    const width = GATE_WIDTHS[type] ?? 100;
    const snap = this.app.state.snap ? this.app.project.grid.snap : 1;
    const gate = { id: uid("gt"), offset: Math.round((s - width / 2) / snap) * snap, width, type, locked: false };
    return clampGate(gate, fence);
  }
  gateClick(e) {
    const hit = this.fenceUnderPointer(e);
    if (!hit) return;
    if (isLocked(this.app.project, hit.fence.id)) return this.app.toast(this.app.t("lockedItem"));
    const gate = this.pendingGate(hit.fence, hit.s);
    const overlaps = hit.fence.gates.some((g) => gate.offset < g.offset + g.width && g.offset < gate.offset + gate.width);
    if (overlaps) return this.app.toast(this.app.t("gateOverlap"));
    this.app.checkpoint();
    hit.fence.gates.push(gate);
    this.app.changed({ rebuild: "site" });
    this.app.select(gate.id, { keepTool: true });
  }
  gateGhost(e) {
    const hit = this.fenceUnderPointer(e);
    if (!hit) return this.clearGhost();
    const gate = this.pendingGate(hit.fence, hit.s);
    const p0 = pointAlong(hit.fence.points, gate.offset), p1 = pointAlong(hit.fence.points, gate.offset + gate.width);
    const H = hit.fence.height;
    const y = Math.max(this.app.terrain.heightAt(p0.x, p0.z), this.app.terrain.heightAt(p1.x, p1.z));
    const box = new THREE.Mesh(new THREE.BoxGeometry(gate.width * M, H * M, 30 * M), ghostMaterial("#008f7d"));
    box.position.set(((p0.x + p1.x) / 2) * M, (y + H / 2) * M, ((p0.z + p1.z) / 2) * M);
    box.rotation.y = -Math.atan2(p1.z - p0.z, p1.x - p0.x);
    const group = new THREE.Group();
    group.add(box);
    this.setGhost(group);
  }

  // ---------------------------------------------------------- polygons

  /** World cm point on the ground (terrain hit, else the y=0 plane), snapped. */
  groundPoint(e) {
    const hit = this.terrainHit(e) || this.app.scene.pickPlane(e, 0);
    if (!hit) return null;
    const snap = this.app.state.snap ? this.app.project.grid.snap : 1;
    const x = Math.round((hit.x * CM) / snap) * snap, z = Math.round((hit.z * CM) / snap) * snap;
    if (this.poly?.length && e.shiftKey) {
      const last = this.poly[this.poly.length - 1];
      return Math.abs(x - last[0]) > Math.abs(z - last[1]) ? [x, last[1]] : [last[0], z];
    }
    return [x, z];
  }
  polygonClick(e) {
    const p = this.groundPoint(e);
    if (!p) return;
    if (!this.poly) this.poly = [];
    const last = this.poly[this.poly.length - 1];
    if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < 2) return;
    // clicking the first point again closes the shape
    if (this.poly.length >= 3 && Math.hypot(this.poly[0][0] - p[0], this.poly[0][1] - p[1]) < 15) return this.closePolygon();
    this.poly.push(p);
    this.polygonGhost(e);
  }
  closePolygon() {
    const pts = this.poly;
    if (!pts) return;
    if (pts.length < 3) {
      this.app.toast(this.app.t("polygonNeed3"));
      return;
    }
    this.poly = null;
    this.clearGhost();
    const kind = this.app.state.tab === "garden" ? "garden" : "outdoor";
    const id = uid(kind === "garden" ? "g" : "d");
    const item = { id, name: "", points: pts.map(([x, z]) => [x, z]), material: null, tint: null, locked: false };
    if (kind === "garden") item.material = this.app.state.pendingGardenMaterial || DEFAULT_MATERIAL.garden;
    else {
      item.type = this.app.state.pendingOutdoorType;
      item.material = DEFAULT_MATERIAL[item.type];
      item.height = item.type === "pool" ? -150 : item.type === "path" ? 3 : 15;
    }
    this.app.checkpoint();
    (kind === "garden" ? this.app.project.gardenPatches : this.app.project.outdoor).push(item);
    this.app.changed({ rebuild: "site" });
    this.app.select(id, { keepTool: true });
    this.app.toast(this.app.t("placed"));
  }
  polygonGhost(e) {
    const p = this.groundPoint(e);
    if (!p) return this.clearGhost();
    const pts = [...(this.poly || []), p];
    const group = new THREE.Group();
    const lift = 4;
    const v = (q) => new THREE.Vector3(q[0] * M, (this.app.terrain.heightAt(q[0], q[1]) + lift) * M, q[1] * M);
    const dotGeo = new THREE.SphereGeometry(0.1, 10, 8);
    const mat = ghostMaterial("#008f7d");
    for (const q of pts) {
      const dot = new THREE.Mesh(dotGeo, mat);
      dot.position.copy(v(q));
      group.add(dot);
    }
    if (pts.length >= 2) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([...pts, pts[0]].map(v)), new THREE.LineBasicMaterial({ color: 0x008f7d, depthTest: false }));
      line.renderOrder = 25;
      group.add(line);
      const last = pts[pts.length - 2];
      this.app.showMeasure(`${Math.round(Math.hypot(p[0] - last[0], p[1] - last[1]))} cm`);
    }
    if (pts.length >= 3) {
      const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x * M, -z * M)));
      const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), ghostMaterial("#ffffff"));
      fill.geometry.rotateX(-Math.PI / 2);
      fill.material.side = THREE.DoubleSide;
      fill.material.opacity = 0.4;
      fill.material.depthTest = false;
      fill.renderOrder = 24;
      const ys = pts.map((q) => this.app.terrain.heightAt(q[0], q[1]));
      fill.position.y = (Math.max(...ys) + lift) * M;
      group.add(fill);
    }
    this.setGhost(group);
  }
}
export { propBounds };
