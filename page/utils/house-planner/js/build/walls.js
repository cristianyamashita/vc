// Walls with openings, without CSG: the wall is split into boxes around each
// hole (full spans, lintels, sills) merged into one mesh, and the door or
// window itself is drawn as frame + leaf (vertex-coloured) + glass. Light
// passes through the hole and the glass (which casts no shadow).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaceMaterial, glassMaterial } from "../materials.js";
import { M } from "../scene.js";
import { wallLength } from "../schema.js";
import { tileKey } from "./slabs.js";

const FRAME = 6; // cm
const MATERIAL_INVISIBLE = new THREE.MeshBasicMaterial({ visible: false });

export function wallHeight(wall, storey) {
  return wall.height ?? storey.height;
}
export function wallAngle(wall) {
  return Math.atan2(wall.b[1] - wall.a[1], wall.b[0] - wall.a[0]);
}
/** Clamp an opening so it stays inside the wall. */
export function clampOpening(op, wall) {
  const len = wallLength(wall);
  op.width = Math.min(op.width, Math.max(30, len));
  op.offset = Math.max(0, Math.min(len - op.width, op.offset));
  return op;
}
/**
 * Which side of the wall faces outdoors: +1 for local +Z (the right of
 * a→b seen from above), −1 for local −Z. The side over a floor tile of the
 * storey is the inside; with none or both, +Z. `flipOuter` swaps.
 */
export function outerSide(wall, storey, tile = 50) {
  const tiles = new Set();
  for (const fg of storey.floorGroups) for (const [x, z] of fg.tiles) tiles.add(tileKey(x, z));
  let side = 1;
  if (tiles.size) {
    const L = wallLength(wall) || 1;
    const dx = (wall.b[0] - wall.a[0]) / L, dz = (wall.b[1] - wall.a[1]) / L;
    const mx = (wall.a[0] + wall.b[0]) / 2, mz = (wall.a[1] + wall.b[1]) / 2;
    const reach = wall.thickness / 2 + Math.min(40, tile * 0.6);
    const over = (sign) => tiles.has(tileKey(Math.floor((mx - dz * sign * reach) / tile), Math.floor((mz + dx * sign * reach) / tile)));
    const plus = over(1), minus = over(-1);
    if (plus && !minus) side = -1;
    else if (minus && !plus) side = 1;
  }
  return wall.flipOuter ? -side : side;
}
/** How far each end extends to meet other walls' ends at a corner. */
export function cornerExtension(wall, walls) {
  const ext = [0, 0];
  for (const other of walls) {
    if (other === wall) continue;
    for (const [i, end] of [wall.a, wall.b].entries())
      for (const oend of [other.a, other.b])
        if (Math.hypot(end[0] - oend[0], end[1] - oend[1]) < 1.5) ext[i] = Math.max(ext[i], other.thickness / 2);
  }
  return ext;
}
function box(w, h, d, x, y, z, color, list) {
  const g = new THREE.BoxGeometry(w * M, h * M, d * M);
  g.translate(x * M, y * M, z * M);
  if (color) {
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  }
  list.push(g);
  return g;
}

/**
 * Build one wall as a Group in building-local metres. userData kinds:
 * wall (the solid), opening (hit box per opening).
 */
export function buildWall(wall, storey, walls, tile = 50, { doorsOpen = false } = {}) {
  const H = wallHeight(wall, storey);
  const T = wall.thickness;
  const L = wallLength(wall);
  const group = new THREE.Group();
  group.position.set(wall.a[0] * M, storey.elevation * M, wall.a[1] * M);
  group.rotation.y = -wallAngle(wall);
  group.userData = { kind: "wallGroup", id: wall.id };
  if (L < 1) return group;
  const [e0, e1] = cornerExtension(wall, walls);
  const solid = [], outer = [], leaf = [], glass = [];
  // Two faces: the wall is split along its length into two half-thickness
  // boxes when the outer side has its own texture or colour.
  const twoFaced = !!(wall.outerMaterial || wall.outerTint);
  const outward = outerSide(wall, storey, tile);
  const side = twoFaced ? outward : 0;
  const swing = -outward; // doors open towards the inside
  const openings = wall.openings
    .map((op) => clampOpening({ ...op }, wall))
    .sort((a, b) => a.offset - b.offset);
  let cursor = -e0;
  const SKIRT = 7, SKIRT_T = 1.2, TRIM = 5;
  const span = (u0, u1, y0, y1) => {
    if (u1 - u0 < 0.1 || y1 - y0 < 0.1) return;
    if (wall.skirting && y0 === 0) for (const s of [-1, 1]) box(u1 - u0, SKIRT, SKIRT_T, (u0 + u1) / 2, SKIRT / 2, s * (T / 2 + SKIRT_T / 2), "#e9e3d8", leaf);
    if (!twoFaced) return box(u1 - u0, y1 - y0, T, (u0 + u1) / 2, (y0 + y1) / 2, 0, null, solid);
    box(u1 - u0, y1 - y0, T / 2, (u0 + u1) / 2, (y0 + y1) / 2, (-side * T) / 4, null, solid);
    box(u1 - u0, y1 - y0, T / 2, (u0 + u1) / 2, (y0 + y1) / 2, (side * T) / 4, null, outer);
  };
  for (const op of openings) {
    const u0 = op.offset, u1 = op.offset + op.width;
    const top = Math.min(H, op.sill + op.height);
    span(cursor, u0, 0, H);
    span(u0, u1, top, H); // lintel
    if (op.sill > 0) span(u0, u1, 0, op.sill);
    cursor = Math.max(cursor, u1);
    leafGeometry(op, T, top - op.sill, leaf, glass, doorsOpen && op.type === "door", swing);
    if (wall.trim)
      for (const s of [-1, 1]) {
        const z = s * (T / 2 + 0.6), h = top - op.sill + TRIM;
        box(TRIM, h, 1.2, u0 - TRIM / 2, op.sill + h / 2 - (op.sill > 0 ? TRIM / 2 : 0), z, op.frameColor, leaf);
        box(TRIM, h, 1.2, u1 + TRIM / 2, op.sill + h / 2 - (op.sill > 0 ? TRIM / 2 : 0), z, op.frameColor, leaf);
        box(op.width + TRIM * 2, TRIM, 1.2, (u0 + u1) / 2, top + TRIM / 2, z, op.frameColor, leaf);
        if (op.sill > 0) box(op.width + TRIM * 2, TRIM, 1.2, (u0 + u1) / 2, op.sill - TRIM / 2, z, op.frameColor, leaf);
      }
    // hit box
    const hit = new THREE.Mesh(new THREE.BoxGeometry(op.width * M, (top - op.sill) * M, (T + 4) * M), MATERIAL_INVISIBLE);
    hit.position.set((u0 + u1) / 2 * M, ((op.sill + top) / 2) * M, 0);
    hit.userData = { kind: "opening", id: op.id, wallId: wall.id, storeyId: storey.id };
    group.add(hit);
  }
  span(cursor, L + e1, 0, H);
  if (solid.length) {
    const geo = mergeGeometries(solid, false);
    solid.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geo, surfaceMaterial({ material: wall.material, tint: wall.tint }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "wall", id: wall.id, storeyId: storey.id };
    group.add(mesh);
  }
  if (outer.length) {
    const geo = mergeGeometries(outer, false);
    outer.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geo, surfaceMaterial({ material: wall.outerMaterial ?? wall.material, tint: wall.outerTint ?? wall.tint }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "wall", id: wall.id, storeyId: storey.id, outer: true };
    group.add(mesh);
  }
  if (leaf.length) {
    const geo = mergeGeometries(leaf, false);
    leaf.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(geo, surfaceMaterial({ vertexColors: true, roughness: 0.6 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: "leaf", wallId: wall.id };
    group.add(mesh);
  }
  for (const { geo, color } of glass) {
    const mesh = new THREE.Mesh(geo, glassMaterial(color));
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = 10;
    mesh.userData = { kind: "glass", wallId: wall.id };
    group.add(mesh);
  }
  return group;
}

/**
 * Frame, leaf and glass for one opening, in the wall's local frame (cm).
 * With `open`, door leaves swing 90° about their hinge towards `swing`
 * (local ±Z); sliding doors slide one panel over the other and garage
 * doors lift under the lintel.
 */
function leafGeometry(op, T, h, leaf, glass, open = false, swing = -1) {
  const cx = op.offset + op.width / 2, y0 = op.sill, w = op.width;
  const fd = Math.min(T, Math.max(8, T * 0.9)); // frame depth
  const fc = op.frameColor, lc = op.leafColor;
  // jambs and head
  box(FRAME, h, fd, cx - w / 2 + FRAME / 2, y0 + h / 2, 0, fc, leaf);
  box(FRAME, h, fd, cx + w / 2 - FRAME / 2, y0 + h / 2, 0, fc, leaf);
  box(w, FRAME, fd, cx, y0 + h - FRAME / 2, 0, fc, leaf);
  const iw = w - FRAME * 2;
  const pane = (pw, ph, px, py, pd = 1.2) => {
    const g = new THREE.BoxGeometry(pw * M, ph * M, pd * M);
    g.translate(px * M, py * M, 0);
    glass.push({ geo: g, color: op.glassColor });
  };
  const dir = op.flip ? -1 : 1;
  if (op.type === "window") {
    box(w, FRAME, fd + 4, cx, y0 + FRAME / 2, 0, fc, leaf); // sill strip
    const ih = h - FRAME * 2;
    pane(iw, ih, cx, y0 + FRAME + ih / 2);
    const bars = op.preset === "window-wide" ? 2 : op.preset === "window-casement" ? 1 : 0;
    for (let i = 1; i <= bars; i++) box(3, ih, fd * 0.6, cx - iw / 2 + (iw * i) / (bars + 1), y0 + FRAME + ih / 2, 0, fc, leaf);
    if (op.preset !== "window-small") box(iw, 3, fd * 0.6, cx, y0 + FRAME + ih / 2, 0, fc, leaf);
    return;
  }
  const ih = h - FRAME; // doors: no bottom frame
  switch (op.preset) {
    case "door-double": {
      const lw = iw / 2 - 1;
      if (open) {
        for (const s of [-1, 1]) {
          box(4, ih - 1, lw, cx + s * (iw / 2 - 2), y0 + ih / 2, (swing * lw) / 2, lc, leaf);
          box(8, 12, 2.5, cx + s * (iw / 2 - 2), y0 + 100, swing * (lw - 8), "#c8c0a8", leaf);
        }
        break;
      }
      box(lw, ih - 1, 4, cx - lw / 2 - 1, y0 + ih / 2, 0, lc, leaf);
      box(lw, ih - 1, 4, cx + lw / 2 + 1, y0 + ih / 2, 0, lc, leaf);
      box(2.5, 12, 6, cx - 8, y0 + 100, 3 * dir, "#c8c0a8", leaf);
      box(2.5, 12, 6, cx + 8, y0 + 100, 3 * dir, "#c8c0a8", leaf);
      break;
    }
    case "door-sliding": {
      const lw = iw / 2 + 2;
      for (const s of [-1, 1]) {
        const px = cx + (s * lw) / 2 - s + (open && s === -dir ? dir * (lw - 2) : 0);
        box(FRAME * 0.7, ih, 3, px - (s * lw) / 2 + (s * FRAME * 0.35), y0 + ih / 2, s * 2.2, fc, leaf);
        box(FRAME * 0.7, ih, 3, px + (s * lw) / 2 - (s * FRAME * 0.35), y0 + ih / 2, s * 2.2, fc, leaf);
        box(lw, FRAME * 0.7, 3, px, y0 + ih - FRAME * 0.35, s * 2.2, fc, leaf);
        box(lw, FRAME * 0.7, 3, px, y0 + FRAME * 0.35, s * 2.2, fc, leaf);
        const g = new THREE.BoxGeometry((lw - FRAME) * M, (ih - FRAME) * M, 0.8 * M);
        g.translate(px * M, (y0 + ih / 2) * M, s * 2.2 * M);
        glass.push({ geo: g, color: op.glassColor });
      }
      break;
    }
    case "door-garage": {
      if (open) {
        box(iw, 4, ih - 1, cx, y0 + ih - 2, (swing * (ih - 1)) / 2, lc, leaf);
        break;
      }
      box(iw, ih - 1, 4, cx, y0 + ih / 2, 0, lc, leaf);
      const rows = 4;
      for (let i = 1; i < rows; i++) box(iw, 1.5, 5, cx, y0 + (ih * i) / rows, 0, "#6b5a46", leaf);
      break;
    }
    default: {
      if (open) {
        const hx = cx - (iw / 2) * dir; // hinge at the jamb opposite the handle
        box(4, ih - 1, iw - 1, hx + 2 * dir, y0 + ih / 2, (swing * (iw - 1)) / 2, lc, leaf);
        box(8, 12, 2.5, hx + 2 * dir, y0 + 100, swing * (iw - 1 - 8), "#c8c0a8", leaf);
        break;
      }
      box(iw - 1, ih - 1, 4, cx, y0 + ih / 2, 0, lc, leaf);
      box(2.5, 12, 6, cx + (iw / 2 - 8) * dir, y0 + 100, 3 * dir, "#c8c0a8", leaf);
      box(2.5, 12, 6, cx + (iw / 2 - 8) * dir, y0 + 100, -3 * dir, "#c8c0a8", leaf);
    }
  }
}

/**
 * How a door swings, for the 2D plan: leaves as {hinge (cm along the
 * wall from a), length, dir (+1 towards b)} and the side (local ±Z) they
 * open to. Sliding and garage doors return no leaves.
 */
export function doorSwing(op, wall, storey, tile = 50) {
  const swing = -outerSide(wall, storey, tile);
  const u0 = op.offset, u1 = op.offset + op.width;
  const leaves = [];
  if (op.preset === "door-double") {
    leaves.push({ hinge: u0, length: op.width / 2, dir: 1 }, { hinge: u1, length: op.width / 2, dir: -1 });
  } else if (op.preset !== "door-sliding" && op.preset !== "door-garage") {
    leaves.push(op.flip ? { hinge: u1, length: op.width, dir: -1 } : { hinge: u0, length: op.width, dir: 1 });
  }
  return { swing, leaves };
}
/** Point on a wall (building-local cm) nearest to p; returns {u, dist}. */
export function nearestOnWall(wall, px, pz) {
  const dx = wall.b[0] - wall.a[0], dz = wall.b[1] - wall.a[1];
  const len2 = dx * dx + dz * dz || 1;
  let u = ((px - wall.a[0]) * dx + (pz - wall.a[1]) * dz) / len2;
  u = Math.max(0, Math.min(1, u));
  const x = wall.a[0] + dx * u, z = wall.a[1] + dz * u;
  return { u: u * Math.sqrt(len2), dist: Math.hypot(px - x, pz - z), x, z };
}
