// First-person walk mode: the perspective camera stands at eye height on
// the active storey (or on the ground outside), WASD / arrows move it,
// dragging (or pointer lock after a double-click) looks around. Movement
// is tested in world centimetres against the walls of the storey the
// walker is on, passes through doors, climbs stairs step by step and
// refuses drops (floor edges, pools).
import * as THREE from "three";
import { M, CM } from "./scene.js";
import { stairsBoxes } from "./build/stairs.js";
import { floorTop, tileKey } from "./build/slabs.js";
import { wallLength } from "./schema.js";

const DEG = Math.PI / 180;
export const EYE = 165; // cm above the floor
const CLEAR = 20; // cm kept from walls
const SPEED = 150; // cm/s
const RUN = 320;
const STEP_UP = 45; // cm the walker can climb in one move (a riser)
const STEP_DOWN = 60; // cm it can drop
const MOVE_KEYS = { w: "f", W: "f", ArrowUp: "f", s: "b", S: "b", ArrowDown: "b", a: "l", A: "l", ArrowLeft: "l", d: "r", D: "r", ArrowRight: "r" };

export class Walk {
  constructor(app) {
    this.app = app;
    this.scene = app.scene;
    this.canvas = app.scene.canvas;
    this.active = false;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.drag = null;
    this.feet = { x: 0, z: 0, y: 0 }; // world cm
    this.eyeY = 0; // smoothed, world cm
    this.building = null;
    this.storey = null;
    this.canvas.addEventListener("pointerdown", (e) => {
      if (!this.active || e.button !== 0) return;
      this.drag = { x: e.clientX, y: e.clientY };
      this.canvas.setPointerCapture?.(e.pointerId);
    });
    this.canvas.addEventListener("pointermove", (e) => {
      if (!this.active) return;
      if (document.pointerLockElement === this.canvas) return this.look(e.movementX, e.movementY);
      if (!this.drag) return;
      this.look(e.clientX - this.drag.x, e.clientY - this.drag.y);
      this.drag = { x: e.clientX, y: e.clientY };
    });
    const end = () => (this.drag = null);
    this.canvas.addEventListener("pointerup", end);
    this.canvas.addEventListener("pointercancel", end);
    this.canvas.addEventListener("dblclick", () => {
      if (this.active && document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.();
    });
    document.addEventListener("keyup", (e) => this.keys.delete(MOVE_KEYS[e.key] || e.key));
    window.addEventListener("blur", () => this.keys.clear());
    this.scene.onTick = (dt) => this.tick(dt);
  }

  // ------------------------------------------------------------ enter/exit

  enter() {
    if (this.active) return;
    const app = this.app;
    this.building = app.building();
    this.storey = app.storey();
    this.active = true;
    this.keys.clear();
    this.drag = null;
    app.tools.reset();
    app.gizmo.control.detach();
    app.gizmo.highlight.visible = false;
    app.showMeasure("");
    this.scene.setWalking(true);
    app.gizmo.setCamera(this.scene.camera);
    this.place();
    this.canvas.focus?.();
    this.scene.requestRender();
  }
  exit() {
    if (!this.active) return;
    this.active = false;
    this.keys.clear();
    this.drag = null;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
    this.scene.setWalking(false);
    const app = this.app;
    app.gizmo.setCamera(this.scene.camera);
    const found = app.state.selection && app.locate(app.state.selection);
    if (found && app.state.tool === "select") app.attachSelection(found);
    this.scene.requestRender();
  }
  /** Keydown while walking. Returns true when the key was used. */
  key(e) {
    if (e.key === "Escape") {
      this.app.setView("3d");
      return true;
    }
    const k = MOVE_KEYS[e.key];
    if (k) this.keys.add(k);
    else if (e.key === "Shift") this.keys.add("Shift");
    else return false;
    return true;
  }

  // ----------------------------------------------------------------- start

  /** Start outside an exterior door facing it, or on the storey's floor. */
  place() {
    const b = this.building, s = this.storey;
    const tiles = new Set();
    for (const fg of s.floorGroups) for (const [x, z] of fg.tiles) tiles.add(tileKey(x, z));
    const tile = this.app.project.grid.tile;
    const over = (x, z) => tiles.has(tileKey(Math.floor(x / tile), Math.floor(z / tile)));
    let start = null, look = null;
    for (const w of s.walls) {
      const L = wallLength(w);
      if (L < 1) continue;
      const dx = (w.b[0] - w.a[0]) / L, dz = (w.b[1] - w.a[1]) / L;
      for (const op of w.openings) {
        if (op.type !== "door") continue;
        const u = op.offset + op.width / 2;
        const mx = w.a[0] + dx * u, mz = w.a[1] + dz * u;
        for (const side of [1, -1]) {
          // local +Z of the wall = (-dz, dx)
          const nx = -dz * side, nz = dx * side;
          const reach = w.thickness / 2 + 40;
          if (over(mx + nx * reach, mz + nz * reach) || !over(mx - nx * reach, mz - nz * reach)) continue;
          const d = w.thickness / 2 + 180;
          const cand = [mx + nx * d, mz + nz * d];
          // only when the ground outside is level with this storey
          const ground = this.app.terrain.heightAt(...this.toWorld(cand[0], cand[1]));
          if (Math.abs(ground - s.elevation) > 60) continue;
          start = cand;
          look = [mx, mz];
          break;
        }
        if (start) break;
      }
      if (start) break;
    }
    if (!start) {
      if (tiles.size) {
        let cx = 0, cz = 0;
        for (const fg of s.floorGroups) for (const [x, z] of fg.tiles) {
          cx += (x + 0.5) * tile;
          cz += (z + 0.5) * tile;
        }
        start = [cx / tiles.size, cz / tiles.size];
      } else start = [0, 0];
      look = [start[0], start[1] - 100];
    }
    const p = this.toWorld(start[0], start[1]), l = this.toWorld(look[0], look[1]);
    this.feet.x = p[0];
    this.feet.z = p[1];
    this.feet.y = this.support(p[0], p[1], s.elevation + 100) ?? s.elevation;
    this.eyeY = this.feet.y + EYE;
    this.yaw = Math.atan2(-(l[0] - p[0]), -(l[1] - p[1]));
    this.pitch = 0;
    this.applyCamera();
  }

  // ------------------------------------------------------------- geometry

  /** Building-local cm -> world cm. */
  toWorld(lx, lz) {
    const b = this.building, c = Math.cos(b.rotation * DEG), s = Math.sin(b.rotation * DEG);
    return [b.at[0] + lx * c + lz * s, b.at[1] - lx * s + lz * c];
  }
  /** World cm -> building-local cm. */
  toLocal(wx, wz) {
    const b = this.building, c = Math.cos(b.rotation * DEG), s = Math.sin(b.rotation * DEG);
    const dx = wx - b.at[0], dz = wz - b.at[1];
    return [dx * c - dz * s, dx * s + dz * c];
  }
  /**
   * Height (world cm) of what the walker would stand on at a world point:
   * the highest stair step or floor of the building at most STEP_UP above
   * `cur`, else the ground. Null over a pool.
   */
  support(wx, wz, cur) {
    const b = this.building, tile = this.app.project.grid.tile;
    const [lx, lz] = this.toLocal(wx, wz);
    let best = null;
    const consider = (h) => {
      if (h <= cur + STEP_UP && (best === null || h > best)) best = h;
    };
    for (const s of b.storeys) {
      if (!s.visible) continue;
      const tx = Math.floor(lx / tile), tz = Math.floor(lz / tile);
      for (const fg of s.floorGroups) {
        if (!fg.tiles.some(([x, z]) => x === tx && z === tz)) continue;
        if (this.app.stairWells(b, s, fg)?.has(tileKey(tx, tz))) continue;
        consider(floorTop(s, fg));
      }
      for (const st of s.stairs) {
        const c = Math.cos(st.rotation * DEG), sn = Math.sin(st.rotation * DEG);
        const dx = lx - st.at[0], dz = lz - st.at[1];
        const sx = dx * c - dz * sn, sz = dx * sn + dz * c;
        for (const box of stairsBoxes(st)) {
          if (sx < box.x0 - 2 || sx > box.x1 + 2 || sz < box.z0 - 2 || sz > box.z1 + 2) continue;
          consider(s.elevation + box.top);
        }
      }
    }
    if (best !== null) return best;
    const terrain = this.app.terrain;
    if (terrain.isCut(wx, wz)) return null;
    return terrain.heightAt(wx, wz);
  }
  /** The storey of the building whose floor the walker stands on. */
  storeyAt(h) {
    const b = this.building;
    let best = null;
    for (const s of b.storeys) if (h >= s.elevation - 30 && (!best || s.elevation > best.elevation)) best = s;
    return best || b.storeys[0];
  }
  /** Is a world point within CLEAR of a wall of the current storey (doors excepted)? */
  blocked(wx, wz) {
    const [px, pz] = this.toLocal(wx, wz);
    for (const w of this.storey.walls) {
      const L = wallLength(w);
      if (L < 1) continue;
      const dx = (w.b[0] - w.a[0]) / L, dz = (w.b[1] - w.a[1]) / L;
      const u = (px - w.a[0]) * dx + (pz - w.a[1]) * dz;
      const half = w.thickness / 2;
      if (u < -half - CLEAR || u > L + half + CLEAR) continue;
      const d = Math.abs(-(px - w.a[0]) * dz + (pz - w.a[1]) * dx);
      if (d >= half + CLEAR) continue;
      // at the ends only the corner square counts
      if (u < 0 && Math.hypot(u, Math.max(0, d - half)) > CLEAR && d > half) continue;
      if (u > L && Math.hypot(u - L, Math.max(0, d - half)) > CLEAR && d > half) continue;
      const door = w.openings.some((op) => op.type === "door" && u >= op.offset + 8 && u <= op.offset + op.width - 8);
      if (!door) return true;
    }
    return false;
  }

  // --------------------------------------------------------------- frames

  look(dx, dy) {
    this.yaw -= dx * 0.004;
    this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - dy * 0.004));
    this.applyCamera();
    this.scene.requestRender();
  }
  applyCamera() {
    const cam = this.scene.perspective;
    cam.position.set(this.feet.x * M, this.eyeY * M, this.feet.z * M);
    cam.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }
  tick(dt) {
    if (!this.active) return;
    const k = this.keys;
    const f = (k.has("f") ? 1 : 0) - (k.has("b") ? 1 : 0), r = (k.has("r") ? 1 : 0) - (k.has("l") ? 1 : 0);
    let moved = false;
    if (f || r) {
      const speed = (k.has("Shift") ? RUN : SPEED) * dt;
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
      let mx = fx * f + rx * r, mz = fz * f + rz * r;
      const len = Math.hypot(mx, mz) || 1;
      mx = (mx / len) * speed;
      mz = (mz / len) * speed;
      const tryMove = (nx, nz) => {
        if (this.blocked(nx, nz)) return false;
        const h = this.support(nx, nz, this.feet.y);
        if (h === null || h < this.feet.y - STEP_DOWN) return false;
        this.feet.x = nx;
        this.feet.z = nz;
        this.feet.y = h;
        return true;
      };
      moved = tryMove(this.feet.x + mx, this.feet.z + mz) || tryMove(this.feet.x + mx, this.feet.z) || tryMove(this.feet.x, this.feet.z + mz);
      if (moved) {
        const s = this.storeyAt(this.feet.y);
        if (s !== this.storey) {
          this.storey = s;
          this.app.setActive(this.building.id, s.id);
        }
      }
    }
    const target = this.feet.y + EYE;
    if (Math.abs(target - this.eyeY) > 0.05) {
      this.eyeY += (target - this.eyeY) * Math.min(1, dt * 10);
      moved = true;
    }
    if (moved) {
      this.applyCamera();
      this.scene.requestRender();
    }
  }
}
