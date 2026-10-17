// Catalog objects ("props"): JSON documents made of primitive parts in
// metres, the format shared with story-studio and the Environment Planner.
// Parts are baked into one vertex-coloured geometry per opacity bucket, so a
// chair with forty parts is one or two draw calls.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { surfaceMaterial, partGlassMaterial } from "./materials.js";
import { propChecked } from "./schema.js";

export const ASSET_ROOT = new URL("../../../assets/house-planner/", import.meta.url).href;
export const GLASS_OPACITY = 0.7;

export const catalog = { categories: {}, props: [] }; // manifest entries + custom
const docs = new Map(); // id -> prop document
const loading = new Map();
export const customIds = new Set();

export async function loadCatalog(customDocs = []) {
  try {
    const res = await fetch(`${ASSET_ROOT}manifest.json`);
    const m = await res.json();
    catalog.categories = m.categories || {};
    catalog.props = (m.props || []).map((p) => ({ ...p, custom: false }));
  } catch {
    catalog.props = [];
  }
  catalog.categories.custom = { en: "My objects", pt: "Meus objetos", ja: "マイオブジェクト" };
  for (const doc of customDocs) registerCustom(doc);
  return catalog;
}
export function registerCustom(doc) {
  docs.set(doc.id, doc);
  customIds.add(doc.id);
  const entry = { id: doc.id, name: doc.name, category: doc.category || "custom", tags: doc.tags, custom: true, parts: doc.source.boxes.length };
  const i = catalog.props.findIndex((p) => p.id === doc.id);
  if (i >= 0) catalog.props[i] = entry;
  else catalog.props.push(entry);
  geometryCache.delete(doc.id);
  glowCache.delete(doc.id);
}
export function invalidateGeometry(id) {
  geometryCache.delete(id);
  glowCache.delete(id);
}
export function unregisterCustom(id) {
  docs.delete(id);
  customIds.delete(id);
  catalog.props = catalog.props.filter((p) => p.id !== id);
  geometryCache.delete(id);
  glowCache.delete(id);
}
export function getPropDoc(id) {
  const d = docs.get(id);
  if (d) return Promise.resolve(d);
  if (loading.has(id)) return loading.get(id);
  const entry = catalog.props.find((p) => p.id === id);
  if (!entry?.file) return Promise.resolve(null);
  const p = fetch(`${ASSET_ROOT}${entry.file}`)
    .then((r) => r.json())
    .then((raw) => {
      const doc = propChecked({ ...raw, category: entry.category, tags: entry.tags });
      docs.set(id, doc);
      return doc;
    })
    .catch(() => null)
    .finally(() => loading.delete(id));
  loading.set(id, p);
  return p;
}
export const propDocSync = (id) => docs.get(id) || null;

/** Language-independent search over names and tags. */
export function searchCatalog(query, category = "all") {
  const q = fold(query);
  return catalog.props.filter((p) => {
    if (category !== "all" && p.category !== category) return false;
    if (!q) return true;
    const hay = [p.id, ...Object.values(p.name || {}), ...Object.values(p.tags || {}).flat()].map(fold).join(" ");
    return hay.includes(q);
  });
}
function fold(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// --------------------------------------------------------------- geometry

/** Unit shape scaled to w/h/d, before the part's own placement. */
export function shapeGeometry(b) {
  let g;
  switch (b.shape) {
    case "sphere": g = new THREE.SphereGeometry(0.5, 14, 10); break;
    case "cylinder": g = new THREE.CylinderGeometry(0.5, 0.5, 1, 18); break;
    case "cone": g = new THREE.ConeGeometry(0.5, 1, 18); break;
    case "roundcone":
      g = new THREE.LatheGeometry(
        [[0, -0.5], [0.36, -0.5], [0.5, -0.42], [0.49, -0.34], [0.2, 0.36], [0.1, 0.48], [0, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)),
        18,
      );
      break;
    case "torus": {
      const tube = Math.max(0.05, Math.min(0.8, b.tube ?? 0.25));
      g = new THREE.TorusGeometry(0.5 - tube / 2, tube / 2, 8, 20);
      g.rotateX(Math.PI / 2);
      g.scale(1, 1 / tube, 1);
      break;
    }
    case "rounded": g = new RoundedBoxGeometry(1, 1, 1, 2, 0.09); break;
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  if (["cylinder", "cone", "roundcone", "torus"].includes(b.shape)) {
    if (b.axis === "x") g.rotateZ(-Math.PI / 2);
    if (b.axis === "z") g.rotateX(Math.PI / 2);
  }
  g.scale(b.w, b.h, b.d);
  return g;
}
export function partMatrix(b) {
  const e = new THREE.Euler(b.rx || 0, b.ry || 0, b.rz || 0, "YXZ");
  return new THREE.Matrix4().compose(new THREE.Vector3(b.x || 0, b.y || 0, b.z || 0), new THREE.Quaternion().setFromEuler(e), new THREE.Vector3(1, 1, 1));
}
function partGeometry(b) {
  const g = shapeGeometry(b);
  g.applyMatrix4(partMatrix(b));
  const c = new THREE.Color(b.color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

const geometryCache = new Map(); // id -> {opaque, glass:[{opacity, geo}], bounds}
const inlineCache = new WeakMap();

/** Baked geometry buckets for a prop document. */
export function propGeometry(doc) {
  const builtin = !!doc.id && docs.get(doc.id) === doc;
  const cached = builtin ? geometryCache.get(doc.id) : inlineCache.get(doc);
  if (cached) return cached;
  const opaque = [], glassBuckets = new Map();
  for (const b of doc.source.boxes) {
    if (b.hole) continue;
    const g = partGeometry(b);
    const op = b.opacity ?? 1;
    if (op >= 1) opaque.push(g);
    else {
      const key = Math.round(op * 20) / 20;
      if (!glassBuckets.has(key)) glassBuckets.set(key, []);
      glassBuckets.get(key).push(g);
    }
  }
  const out = { opaque: null, glass: [], bounds: new THREE.Box3() };
  const uniform = (list) => list.map((g) => (g.index ? g.toNonIndexed() : g));
  if (opaque.length) {
    out.opaque = mergeGeometries(uniform(opaque), false);
    opaque.forEach((g) => g.dispose());
    out.opaque.computeBoundingBox();
    out.bounds.union(out.opaque.boundingBox);
  }
  for (const [opacity, list] of glassBuckets) {
    const geo = mergeGeometries(uniform(list), false);
    list.forEach((g) => g.dispose());
    geo.computeBoundingBox();
    out.bounds.union(geo.boundingBox);
    out.glass.push({ opacity, geo });
  }
  if (out.bounds.isEmpty()) out.bounds.set(new THREE.Vector3(-0.1, 0, -0.1), new THREE.Vector3(0.1, 0.1, 0.1));
  if (builtin) geometryCache.set(doc.id, out);
  else inlineCache.set(doc, out);
  return out;
}

/** A Group of meshes for a placement. tint multiplies the baked colours. */
export function propObject(doc, { tint = null, material = null } = {}) {
  const { opaque, glass } = propGeometry(doc);
  const group = new THREE.Group();
  if (opaque) {
    const mesh = new THREE.Mesh(opaque, surfaceMaterial({ material, tint, vertexColors: true, roughness: 0.8 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  for (const { opacity, geo } of glass) {
    const mesh = new THREE.Mesh(geo, partGlassMaterial(opacity));
    mesh.castShadow = opacity >= GLASS_OPACITY;
    mesh.receiveShadow = true;
    mesh.renderOrder = 10;
    group.add(mesh);
  }
  return group;
}
export function propBounds(doc) {
  return propGeometry(doc).bounds;
}

// ------------------------------------------------------------- lighting

/** Parts that read as a bulb, shade or flame: near white, or warm yellow / orange. */
export function isBulbPart(b) {
  if (b.hole) return false;
  const { h, s, l } = new THREE.Color(b.color || "#ffffff").getHSL({});
  return (l >= 0.72 && s <= 0.45) || (h >= 0.04 && h <= 0.2 && l >= 0.5 && s >= 0.3);
}
const glowCache = new Map();
const inlineGlow = new WeakMap();
/**
 * Baked geometry of the bulb parts (slightly inflated so it draws over the
 * part itself) and their centre, for the night glow and point light. Null
 * when the object has no bulb-like part.
 */
export function propGlow(doc) {
  const builtin = !!doc.id && docs.get(doc.id) === doc;
  const cached = builtin ? glowCache.get(doc.id) : inlineGlow.get(doc);
  if (cached !== undefined) return cached;
  const parts = doc.source.boxes.filter(isBulbPart);
  let out = null;
  if (parts.length) {
    const geos = parts.map((b) => {
      const g = shapeGeometry({ ...b, w: b.w * 1.04 + 0.004, h: b.h * 1.04 + 0.004, d: b.d * 1.04 + 0.004 });
      g.applyMatrix4(partMatrix(b));
      return g.index ? g.toNonIndexed() : g;
    });
    const geo = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    geo.computeBoundingBox();
    const centre = geo.boundingBox.getCenter(new THREE.Vector3());
    out = { geo, centre };
  }
  if (builtin) glowCache.set(doc.id, out);
  else inlineGlow.set(doc, out);
  return out;
}
export function invalidateGlow(id) {
  glowCache.delete(id);
}
