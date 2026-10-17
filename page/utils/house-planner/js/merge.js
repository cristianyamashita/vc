// Merging one project into another: templates and saved projects can be
// added as extra buildings beside the current ones. With `extendTerrain`
// the other lot is attached to the right edge of this one so the two
// terrains become one wide lot; otherwise the lot only grows when the new
// content would fall outside it. Everything is in cm.
import { projectChecked } from "./schema.js";
import { buildingFootprint } from "./build/slabs.js";
import { planeHeight } from "./terrain.js";

const DEG = Math.PI / 180;
export const GAP = 300; // cm between the current content and the added one
const MARGIN = 200; // cm of ground kept around content when the lot grows

/** Bilinear grid height (cm, without the slope plane) of a terrain document. */
export function gridHeightAt(t, x, z) {
  const n = t.resolution;
  const u = Math.max(0, Math.min(n, (x / t.width + 0.5) * n));
  const v = Math.max(0, Math.min(n, (z / t.depth + 0.5) * n));
  const ix = Math.min(n - 1, Math.floor(u)), iz = Math.min(n - 1, Math.floor(v));
  const fx = u - ix, fz = v - iz, k = iz * (n + 1) + ix;
  const h = t.heights;
  const h00 = h[k], h10 = h[k + 1], h01 = h[k + n + 1], h11 = h[k + n + 2];
  return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}
const inside = (t, x, z) => Math.abs(x) <= t.width / 2 && Math.abs(z) <= t.depth / 2;

/** Bounds (world cm) of the buildings and lot items, or null when empty. */
export function contentBounds(p, tile) {
  let b = null;
  const add = (x, z) => {
    b = b ? { minX: Math.min(b.minX, x), maxX: Math.max(b.maxX, x), minZ: Math.min(b.minZ, z), maxZ: Math.max(b.maxZ, z) } : { minX: x, maxX: x, minZ: z, maxZ: z };
  };
  for (const bd of p.buildings) {
    const f = buildingFootprint(bd, tile);
    if (!f) {
      add(bd.at[0], bd.at[1]);
      continue;
    }
    const c = Math.cos(bd.rotation * DEG), s = Math.sin(bd.rotation * DEG);
    for (const [lx, lz] of [[f.minX, f.minZ], [f.maxX, f.minZ], [f.maxX, f.maxZ], [f.minX, f.maxZ]]) add(bd.at[0] + lx * c - lz * s, bd.at[1] + lx * s + lz * c);
  }
  for (const list of [p.outdoor, p.gardenPatches, p.fences, p.siteWalls]) for (const item of list) for (const [x, z] of item.points) add(x, z);
  for (const o of p.objects) add(o.at[0], o.at[2]);
  return b;
}
/** Move every lot-placed thing of a project. */
export function shiftProject(p, dx, dz) {
  if (!dx && !dz) return;
  for (const b of p.buildings) {
    b.at[0] += dx;
    b.at[1] += dz;
  }
  for (const list of [p.outdoor, p.gardenPatches, p.fences, p.siteWalls]) for (const item of list) item.points = item.points.map(([x, z]) => [x + dx, z + dz]);
  for (const list of [p.objects, p.notes, p.lights]) for (const o of list) {
    o.at[0] += dx;
    o.at[2] += dz;
  }
}
/** A terrain document of a new size (still centred) with heights from `sample(x, z)`. */
function sampledTerrain(base, width, depth, resolution, sample, slope = { direction: 0, percent: 0 }) {
  const heights = new Array((resolution + 1) ** 2);
  for (let z = 0; z <= resolution; z++)
    for (let x = 0; x <= resolution; x++) heights[z * (resolution + 1) + x] = Math.round(sample((x / resolution - 0.5) * width, (z / resolution - 0.5) * depth) * 10) / 10;
  return { ...base, width, depth, resolution, heights, slope: { ...slope } };
}
const cell = (t) => t.width / t.resolution;
const resolutionFor = (width, size) => Math.max(8, Math.min(96, Math.round(width / size)));

/**
 * `target` plus `source`: the source buildings and lot items go to the
 * right of the current content. Returns a checked copy; the inputs are
 * left untouched.
 */
export function mergeProject(target, source, { extendTerrain = false, tile = 50 } = {}) {
  const T = structuredClone(target), S = structuredClone(source);
  const tt = T.terrain, st = S.terrain;
  if (extendTerrain) {
    const width = Math.min(50000, tt.width + st.width), depth = Math.max(tt.depth, st.depth);
    const edge = -width / 2 + tt.width; // the source lot begins here
    // both slopes are baked into the heights; the wide lot starts level
    const sample = (x, z) => {
      if (x <= edge) {
        const sx = x + st.width / 2;
        return inside(tt, sx, z) ? gridHeightAt(tt, sx, z) + planeHeight(tt, sx, z) : 0;
      }
      const sx = x - tt.width / 2;
      return inside(st, sx, z) ? gridHeightAt(st, sx, z) + planeHeight(st, sx, z) : 0;
    };
    shiftProject(T, -st.width / 2, 0);
    shiftProject(S, tt.width / 2, 0);
    T.terrain = sampledTerrain(tt, width, depth, resolutionFor(width, Math.min(cell(tt), cell(st))), sample);
  } else {
    const tb = contentBounds(T, tile), sb = contentBounds(S, tile);
    shiftProject(S, tb && sb ? tb.maxX + GAP - sb.minX : 0, 0);
    const nb = contentBounds(S, tile);
    if (nb) {
      const width = Math.max(tt.width, 2 * (Math.max(Math.abs(nb.minX), Math.abs(nb.maxX)) + MARGIN));
      const depth = Math.max(tt.depth, 2 * (Math.max(Math.abs(nb.minZ), Math.abs(nb.maxZ)) + MARGIN));
      if (width > tt.width || depth > tt.depth)
        T.terrain = sampledTerrain(tt, Math.min(50000, width), Math.min(50000, depth), resolutionFor(Math.max(width, depth), cell(tt)), (x, z) => (inside(tt, x, z) ? gridHeightAt(tt, x, z) : 0), tt.slope);
    }
  }
  T.buildings.push(...S.buildings);
  for (const key of ["outdoor", "gardenPatches", "fences", "siteWalls", "objects", "notes", "lights"]) T[key].push(...(S[key] || []));
  T.updatedAt = new Date().toISOString();
  return projectChecked(T);
}
