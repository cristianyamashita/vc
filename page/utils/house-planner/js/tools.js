// Pointer tools per editor tab: terrain brushes, tile painting, wall
// drawing, opening placement and object placement. Each tool reads the
// pointer, shows a ghost in the overlay group and writes to the project
// through app.checkpoint() / app.changed().
import * as THREE from "three";
import { M, CM } from "./scene.js";
import { uid, OPENING_PRESETS, wallLength, isLocked } from "./schema.js";
import { tileKey, floorTop } from "./build/slabs.js";
import { nearestOnWall, clampOpening, wallHeight } from "./build/walls.js";
import { propObject, propBounds } from "./props.js";
import { ghostMaterial } from "./materials.js";

export const TAB_TOOLS = {
  terrain: ["select", "raise", "lower", "flatten", "smooth"],
  floors: ["select", "paint", "erase", "rect"],
  walls: ["select", "draw"],
  openings: ["select", "add"],
  stairs: ["select"],
  outdoor: ["select"],
  garden: ["select"],
  objects: ["select", "place"],
};
const DEG = Math.PI / 180;

export class Tools {
  constructor(app) {
    this.app = app;
    this.canvas = app.scene.canvas;
    this.down = null; // {x, y, button, moved}
    this.stroke = null; // per-drag state
    this.chain = null; // wall drawing start [x,z]
    this.ghost = new THREE.Group();
    app.scene.overlay.add(this.ghost);
    this.hoverWall = null;
    this.canvas.addEventListener("pointerdown", (e) => this.onDown(e));
    this.canvas.addEventListener("pointermove", (e) => this.onMove(e));
    this.canvas.addEventListener("pointerup", (e) => this.onUp(e));
    this.canvas.addEventListener("pointerleave", () => this.clearGhost());
    this.canvas.addEventListener("dblclick", () => this.endChain());
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (this.chain) this.endChain();
    });
  }
  get tool() {
    return this.app.state.tool;
  }
  reset() {
    this.chain = null;
    this.stroke = null;
    this.down = null;
    this.clearGhost();
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
    if (e.button !== 0 || this.app.gizmo.dragging || this.app.gizmo.hovering) return;
    if (this.app.state.orbitOverride) return;
    this.down = { x: e.clientX, y: e.clientY, moved: false };
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
        this.wallClick(e);
        break;
      case "openings":
        if (!storey) return;
        this.openingClick(e);
        break;
      case "objects":
        this.placeClick(e);
        break;
    }
  }
  onMove(e) {
    if (this.down && (Math.abs(e.clientX - this.down.x) > 3 || Math.abs(e.clientY - this.down.y) > 3)) this.down.moved = true;
    if (this.app.gizmo.dragging) return;
    const tool = this.tool;
    if (tool === "select") return;
    switch (this.app.state.tab) {
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
        this.wallGhost(e);
        break;
      case "openings":
        this.openingGhost(e);
        break;
      case "objects":
        this.placeGhost(e);
        break;
    }
  }
  onUp(e) {
    if (e.button !== 0) return;
    const down = this.down;
    this.down = null;
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
    const g = this.ghost.children[0];
    if (g) {
      g.rotation.y = this.app.state.ghostYaw * DEG;
      this.app.scene.requestRender();
    }
  }
}
export { propBounds };
