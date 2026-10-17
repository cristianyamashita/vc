// IndexedDB: HousePlannerDB v1 with `projects`, `props` (custom objects)
// and `thumbs`. Registered in page/utils/backup.html.
import { projectChecked, propChecked, clone, uid, freshBuilding, freshStorey, OPENING_PRESETS, TILE } from "./schema.js";

const DB = "HousePlannerDB";
const DB_VERSION = 1;
let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("props")) db.createObjectStore("props", { keyPath: "id" });
      if (!db.objectStoreNames.contains("thumbs")) db.createObjectStore("thumbs", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
function tx(store, mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req?.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}
export const storeRead = (store, key) => tx(store, "readonly", (s) => s.get(key));
export const storeAll = (store) => tx(store, "readonly", (s) => s.getAll());
export const storeWrite = (store, value) => tx(store, "readwrite", (s) => s.put(value));
export const storeDelete = (store, key) => tx(store, "readwrite", (s) => s.delete(key));

// -------------------------------------------------------------- projects

export async function listProjects() {
  const rows = await storeAll("projects");
  return rows
    .map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt, buildings: r.data?.buildings?.length || 0 }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
export async function loadProject(id) {
  const row = await storeRead("projects", id);
  return row ? projectChecked(row.data) : null;
}
export function saveProject(project) {
  project.updatedAt = new Date().toISOString();
  const snapshot = clone(project);
  return storeWrite("projects", { id: snapshot.id, name: snapshot.name, updatedAt: snapshot.updatedAt, data: snapshot });
}
export const deleteProject = (id) => storeDelete("projects", id);

// ----------------------------------------------------------------- props

export async function listCustomProps() {
  const rows = await storeAll("props");
  return rows.map((r) => r.doc).filter(Boolean);
}
export function saveCustomProp(doc) {
  return storeWrite("props", { id: doc.id, updatedAt: new Date().toISOString(), doc });
}
export const deleteCustomProp = (id) => Promise.all([storeDelete("props", id), storeDelete("thumbs", id)]);

// --------------------------------------------------------- export/import

export function exportProject(project, customProps = []) {
  const used = new Set();
  const visit = (o) => o.prop && used.add(o.prop);
  project.objects.forEach(visit);
  for (const b of project.buildings) for (const s of b.storeys) s.objects.forEach(visit);
  const doc = clone(project);
  doc.customProps = customProps.filter((p) => used.has(p.id));
  return JSON.stringify(doc, null, 1);
}
export function download(text, filename) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function safeFilename(name, suffix) {
  return `house-planner-${(name || "project").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40)}${suffix}.json`;
}

/**
 * Parse an imported JSON text. Returns {project, customProps} for a
 * project or environment-planner file, or {prop} for a single prop.
 */
export function parseImport(text) {
  const raw = JSON.parse(text);
  if (raw?.kind === "housePlannerProject") {
    const customProps = (Array.isArray(raw.customProps) ? raw.customProps : []).map(propChecked);
    return { project: projectChecked(raw), customProps };
  }
  if (raw?.kind === "environmentPlannerProject") return { project: fromEnvironmentPlanner(raw), customProps: [] };
  if (raw?.kind === "prop") return { prop: propChecked(raw) };
  throw new Error("unsupported");
}

// Environment Planner projects are in metres with rectangular rooms.
function fromEnvironmentPlanner(raw) {
  const M = 100;
  const tr = raw.terrain || {};
  const res = Math.min(96, Math.max(8, Math.round(tr.resolution || 32)));
  const terrain = {
    width: (tr.width || 24) * M,
    depth: (tr.depth || 20) * M,
    resolution: res,
    heights: Array.isArray(tr.heights) && tr.heights.length === (res + 1) ** 2 ? tr.heights.map((h) => h * M) : [],
    material: "grass",
  };
  const building = freshBuilding("", [0, 0]);
  building.storeys = [];
  const floors = Array.isArray(raw.floors) && raw.floors.length ? raw.floors : [{ id: "ground", elevation: 0, height: 2.7 }];
  const byFloor = new Map();
  for (const f of floors) {
    const s = freshStorey(null, "ground");
    s.name = f.name || "";
    s.elevation = (f.elevation || 0) * M;
    s.height = (f.height || 2.7) * M;
    byFloor.set(f.id, s);
    building.storeys.push(s);
  }
  const storeyFor = (floorId) => byFloor.get(floorId) || building.storeys[0];
  const sides = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
  for (const room of raw.rooms || []) {
    const s = storeyFor(room.floorId);
    const w = room.w * M, d = room.d * M;
    const x0 = room.x * M - w / 2, z0 = room.z * M - d / 2;
    const tiles = [];
    for (let z = Math.floor(z0 / TILE); z < Math.ceil((z0 + d) / TILE); z++)
      for (let x = Math.floor(x0 / TILE); x < Math.ceil((x0 + w) / TILE); x++) tiles.push([x, z]);
    s.floorGroups.push({ id: uid("fg"), name: room.name || "", offset: (room.y || 0) * M, thickness: null, material: "woodFloor", tint: null, tiles, locked: !!room.locked });
    const corners = [[x0, z0], [x0 + w, z0], [x0 + w, z0 + d], [x0, z0 + d]];
    const sideOf = ["north", "east", "south", "west"];
    corners.forEach((a, i) => {
      const b = corners[(i + 1) % 4];
      const wall = { id: uid("w"), a, b, thickness: (room.thickness || 0.15) * M, height: room.h ? room.h * M : null, tint: room.color || "#f2ede4", locked: !!room.locked, openings: [] };
      for (const op of room.openings || []) {
        if (op.side !== sideOf[i]) continue;
        const preset = op.type === "window" ? "window-casement" : "door-single";
        wall.openings.push({ id: uid("op"), preset, type: op.type, offset: Math.max(0, (op.offset || 0) * M + (i % 2 ? d : w) / 2 - (op.width || 1) * M / 2), width: (op.width || 1) * M, height: (op.height || 2) * M, sill: (op.sill || 0) * M });
      }
      s.walls.push(wall);
    });
  }
  for (const wall of raw.walls || []) {
    const s = storeyFor(wall.floorId);
    s.walls.push({ id: uid("w"), a: [wall.a[0] * M, wall.a[1] * M], b: [wall.b[0] * M, wall.b[1] * M], thickness: (wall.thickness || 0.15) * M, height: wall.h ? wall.h * M : null, tint: wall.color || "#f2ede4", locked: !!wall.locked, openings: [] });
  }
  for (const o of raw.objects || []) {
    if (!o.document) continue;
    const s = storeyFor(o.floorId);
    const scale = Array.isArray(o.scale) ? o.scale : [1, 1, 1];
    s.objects.push({ id: uid("ob"), inline: o.document, at: [o.at[0] * M, (o.at[1] || 0) * M - s.elevation, o.at[2] * M], rotation: [o.roll || 0, o.yaw || 0, o.pitch || 0], scale, tint: o.tint || null, locked: !!o.locked });
  }
  return projectChecked({ kind: "housePlannerProject", version: 1, name: raw.name || "", terrain, buildings: [building] });
}
