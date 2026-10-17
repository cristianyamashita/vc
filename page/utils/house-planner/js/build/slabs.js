// Floor slabs: a floor group is a set of square tiles painted on a storey.
// Each tile becomes a box and the boxes are merged into one mesh per group;
// the triplanar material hides the seams. Coordinates are building-local.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surfaceMaterial } from "../materials.js";
import { M } from "../scene.js";

export function tileKey(x, z) {
  return `${x},${z}`;
}
export function tileSet(fg) {
  return new Set(fg.tiles.map(([x, z]) => tileKey(x, z)));
}
/** Top surface (cm, building-relative) of a floor group. */
export function floorTop(storey, fg) {
  return storey.elevation + fg.offset;
}
export function floorThickness(storey, fg) {
  return fg.thickness ?? storey.slabThickness;
}
/** Mesh for one floor group, or null when it has no tiles. */
export function buildFloorGroup(fg, storey, tile) {
  if (!fg.tiles.length) return null;
  const t = tile * M, thick = floorThickness(storey, fg) * M;
  const top = floorTop(storey, fg) * M;
  const parts = fg.tiles.map(([x, z]) => {
    const g = new THREE.BoxGeometry(t, thick, t);
    g.translate((x + 0.5) * t, top - thick / 2, (z + 0.5) * t);
    return g;
  });
  const geo = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(geo, surfaceMaterial({ material: fg.material, tint: fg.tint, offset: 2 }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { kind: "floorGroup", id: fg.id, storeyId: storey.id };
  return mesh;
}
/** Bounding box (cm, building-local) of every tile on every storey. */
export function buildingFootprint(building, tile) {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const s of building.storeys)
    for (const fg of s.floorGroups)
      for (const [x, z] of fg.tiles) {
        minX = Math.min(minX, x * tile);
        minZ = Math.min(minZ, z * tile);
        maxX = Math.max(maxX, (x + 1) * tile);
        maxZ = Math.max(maxZ, (z + 1) * tile);
      }
  if (!Number.isFinite(minX)) return null;
  return { minX, minZ, maxX, maxZ };
}
/** Tiles covered by a rectangle of building-local cm (inclusive corners). */
export function tilesInRect(x0, z0, x1, z1, tile) {
  const out = [];
  const ax = Math.floor(Math.min(x0, x1) / tile), bx = Math.floor(Math.max(x0, x1) / tile);
  const az = Math.floor(Math.min(z0, z1) / tile), bz = Math.floor(Math.max(z0, z1) / tile);
  for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) out.push([x, z]);
  return out;
}
/** Connected components of a tile list (4-neighbourhood). */
export function splitTiles(tiles) {
  const left = new Set(tiles.map(([x, z]) => tileKey(x, z)));
  const groups = [];
  while (left.size) {
    const start = left.values().next().value;
    left.delete(start);
    const stack = [start], group = [];
    while (stack.length) {
      const k = stack.pop();
      const [x, z] = k.split(",").map(Number);
      group.push([x, z]);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = tileKey(x + dx, z + dz);
        if (left.has(nk)) {
          left.delete(nk);
          stack.push(nk);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}
