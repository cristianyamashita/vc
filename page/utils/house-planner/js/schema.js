// Project document: defaults, ids and validators. Every length is in
// centimetres; angles are degrees. Prop documents (catalog objects) keep the
// story-studio / environment-planner format, which is metres.

export const KIND = "housePlannerProject";
export const VERSION = 1;
export const SHAPES = ["box", "rounded", "sphere", "cylinder", "cone", "roundcone", "torus"];
export const TEXTURE_IDS = [
  "grass", "gravel", "sand", "dirt", "rock", "paving", "concrete", "asphalt",
  "woodFloor", "planks", "tiles", "carpet", "rubber", "plaster", "bricks", "metalPlate",
];
export const OPENING_PRESETS = {
  "door-single": { type: "door", width: 90, height: 210, sill: 0 },
  "door-double": { type: "door", width: 160, height: 210, sill: 0 },
  "door-sliding": { type: "door", width: 200, height: 210, sill: 0 },
  "door-garage": { type: "door", width: 240, height: 220, sill: 0 },
  "window-small": { type: "window", width: 60, height: 60, sill: 150 },
  "window-casement": { type: "window", width: 120, height: 120, sill: 90 },
  "window-wide": { type: "window", width: 180, height: 120, sill: 90 },
  "window-picture": { type: "window", width: 240, height: 150, sill: 60 },
};
export const STOREY_PRESETS = [
  { id: "ground", elevation: 0, height: 300 },
  { id: "upper", elevation: null, height: 300 }, // elevation = previous top
  { id: "basement", elevation: -250, height: 250 },
];
export const TILE = 50;

let counter = 0;
export function uid(prefix = "id") {
  counter = (counter + 1) % 1000;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
export function clone(v) {
  return JSON.parse(JSON.stringify(v));
}
export function num(v, min, max, fallback = min) {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    if (fallback === undefined) throw new Error("invalid");
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
}
export function int(v, min, max, fallback) {
  return Math.round(num(v, min, max, fallback));
}
export function color(v, fallback = null) {
  if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 0xffffff)
    return "#" + v.toString(16).padStart(6, "0");
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;
}
export function texture(v, fallback = null) {
  return TEXTURE_IDS.includes(v) ? v : fallback;
}
export function str(v, fallback = "", max = 80) {
  return typeof v === "string" ? v.slice(0, max) : fallback;
}
export function names(v) {
  if (v && typeof v === "object") return { en: str(v.en, ""), pt: str(v.pt, v.en || ""), ja: str(v.ja, v.en || "") };
  const s = str(v, "");
  return { en: s, pt: s, ja: s };
}
function vec2(v, fallback = [0, 0]) {
  return Array.isArray(v) && v.length >= 2 ? [num(v[0], -1e5, 1e5, 0), num(v[1], -1e5, 1e5, 0)] : fallback.slice();
}
function vec3(v, fallback = [0, 0, 0]) {
  return Array.isArray(v) && v.length >= 3
    ? [num(v[0], -1e5, 1e5, 0), num(v[1], -1e5, 1e5, 0), num(v[2], -1e5, 1e5, 0)]
    : fallback.slice();
}

// ------------------------------------------------------------------ fresh

export function freshTerrain(width = 4000, depth = 3000, resolution = 40) {
  return {
    width, depth, resolution,
    heights: new Array((resolution + 1) ** 2).fill(0),
    material: "grass", tint: null, locked: false, flattenUnderBuildings: true,
  };
}
export function freshSun() {
  return { azimuth: 215, elevation: 48, intensity: 1.2, useTime: false, time: 14, latitude: -23.5, month: 6, shadows: true };
}
export function freshStorey(prev, preset = "ground", name = "") {
  const p = STOREY_PRESETS.find((s) => s.id === preset) || STOREY_PRESETS[0];
  const elevation = p.elevation ?? (prev ? prev.elevation + prev.height : 0);
  return {
    id: uid("st"), name, elevation, height: p.height, slabThickness: 20,
    locked: false, visible: true,
    floorGroups: [], walls: [], stairs: [], objects: [],
  };
}
export function freshBuilding(name = "", at = [0, 0]) {
  const ground = freshStorey(null, "ground");
  return { id: uid("b"), name, at, rotation: 0, locked: false, roofShadow: true, storeys: [ground] };
}
export function freshProject(name = "") {
  const b = freshBuilding("", [0, 0]);
  return {
    kind: KIND, version: VERSION, id: uid("p"), name,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    grid: { tile: TILE, snap: 5 },
    terrain: freshTerrain(),
    sun: freshSun(),
    buildings: [b],
    outdoor: [], gardenPatches: [], objects: [],
    view: { cutaway: false, activeBuilding: b.id, activeStorey: b.storeys[0].id, camera: null },
  };
}

// ------------------------------------------------------------- validators

export function terrainChecked(raw = {}) {
  const resolution = int(raw.resolution, 8, 96, 40);
  const out = {
    width: num(raw.width, 200, 50000, 4000),
    depth: num(raw.depth, 200, 50000, 3000),
    resolution,
    heights: [],
    material: texture(raw.material, "grass"),
    tint: color(raw.tint, null),
    locked: !!raw.locked,
    flattenUnderBuildings: raw.flattenUnderBuildings !== false,
  };
  const count = (resolution + 1) ** 2;
  if (Array.isArray(raw.heights) && raw.heights.length === count)
    out.heights = raw.heights.map((h) => num(h, -5000, 5000, 0));
  else out.heights = new Array(count).fill(0);
  return out;
}
export function sunChecked(raw = {}) {
  const d = freshSun();
  return {
    azimuth: num(raw.azimuth, 0, 360, d.azimuth),
    elevation: num(raw.elevation, 2, 90, d.elevation),
    intensity: num(raw.intensity, 0, 3, d.intensity),
    useTime: !!raw.useTime,
    time: num(raw.time, 0, 24, d.time),
    latitude: num(raw.latitude, -70, 70, d.latitude),
    month: int(raw.month, 1, 12, d.month),
    shadows: raw.shadows !== false,
  };
}
export function openingChecked(raw = {}, wallLength = 1e5) {
  const preset = OPENING_PRESETS[raw.preset] ? raw.preset : raw.type === "window" ? "window-casement" : "door-single";
  const p = OPENING_PRESETS[preset];
  return {
    id: str(raw.id, uid("op")),
    preset,
    type: p.type,
    offset: num(raw.offset, 0, wallLength, 0),
    width: num(raw.width, 30, 600, p.width),
    height: num(raw.height, 30, 500, p.height),
    sill: num(raw.sill, 0, 400, p.sill),
    flip: !!raw.flip,
    frameColor: color(raw.frameColor, "#776750"),
    leafColor: color(raw.leafColor, "#b99673"),
    glassColor: color(raw.glassColor, "#bcd8e6"),
    locked: !!raw.locked,
  };
}
export function wallChecked(raw = {}) {
  const a = vec2(raw.a), b = vec2(raw.b);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return {
    id: str(raw.id, uid("w")),
    name: str(raw.name, ""),
    a, b,
    thickness: num(raw.thickness, 5, 100, 20),
    height: raw.height == null ? null : num(raw.height, 30, 1500, 300),
    material: texture(raw.material, null),
    tint: color(raw.tint, "#f2ede4"),
    outerMaterial: texture(raw.outerMaterial, null),
    outerTint: color(raw.outerTint, null),
    flipOuter: !!raw.flipOuter,
    locked: !!raw.locked,
    openings: (Array.isArray(raw.openings) ? raw.openings : []).map((o) => openingChecked(o, len)),
  };
}
export function floorGroupChecked(raw = {}) {
  const seen = new Set();
  const tiles = [];
  for (const t of Array.isArray(raw.tiles) ? raw.tiles : []) {
    if (!Array.isArray(t) || t.length < 2) continue;
    const x = int(t[0], -2000, 2000, 0), z = int(t[1], -2000, 2000, 0);
    const k = `${x},${z}`;
    if (seen.has(k)) continue;
    seen.add(k);
    tiles.push([x, z]);
  }
  return {
    id: str(raw.id, uid("fg")),
    name: str(raw.name, ""),
    offset: num(raw.offset, -500, 500, 0),
    thickness: raw.thickness == null ? null : num(raw.thickness, 2, 100, 20),
    material: texture(raw.material, "woodFloor"),
    tint: color(raw.tint, null),
    tiles,
    locked: !!raw.locked,
  };
}
export function stairsChecked(raw = {}) {
  return {
    id: str(raw.id, uid("sr")),
    name: str(raw.name, ""),
    shape: ["straight", "L", "U"].includes(raw.shape) ? raw.shape : "straight",
    at: vec2(raw.at),
    rotation: num(raw.rotation, -360, 360, 0),
    width: num(raw.width, 60, 300, 100),
    rise: num(raw.rise, 30, 1000, 300),
    stepHeight: num(raw.stepHeight, 10, 25, 18),
    treadDepth: num(raw.treadDepth, 20, 40, 28),
    turn: raw.turn === "right" ? "right" : "left",
    material: texture(raw.material, "woodFloor"),
    tint: color(raw.tint, null),
    cutFloorAbove: raw.cutFloorAbove !== false,
    locked: !!raw.locked,
  };
}
export function placementChecked(raw = {}) {
  if (!raw.prop && !raw.inline) throw new Error("invalid");
  const out = {
    id: str(raw.id, uid("ob")),
    name: str(raw.name, ""),
    prop: raw.inline ? null : str(raw.prop, ""),
    inline: raw.inline ? propChecked(raw.inline) : null,
    at: vec3(raw.at),
    rotation: vec3(raw.rotation),
    scale: Array.isArray(raw.scale) && raw.scale.length === 3
      ? raw.scale.map((s) => num(s, 0.05, 50, 1))
      : [1, 1, 1].map(() => num(raw.scale, 0.05, 50, 1)),
    tint: color(raw.tint, null),
    material: texture(raw.material, null),
    locked: !!raw.locked,
  };
  return out;
}
export function storeyChecked(raw = {}, index = 0) {
  return {
    id: str(raw.id, uid("st")),
    name: str(raw.name, ""),
    elevation: num(raw.elevation, -5000, 50000, index * 300),
    height: num(raw.height, 100, 1500, 300),
    slabThickness: num(raw.slabThickness, 2, 100, 20),
    locked: !!raw.locked,
    visible: raw.visible !== false,
    floorGroups: (Array.isArray(raw.floorGroups) ? raw.floorGroups : []).map(floorGroupChecked),
    walls: (Array.isArray(raw.walls) ? raw.walls : []).map(wallChecked),
    stairs: (Array.isArray(raw.stairs) ? raw.stairs : []).map(stairsChecked),
    objects: (Array.isArray(raw.objects) ? raw.objects : []).map(placementChecked),
  };
}
export function buildingChecked(raw = {}) {
  const storeys = (Array.isArray(raw.storeys) ? raw.storeys : []).map(storeyChecked);
  if (!storeys.length) storeys.push(freshStorey(null, "ground"));
  storeys.sort((a, b) => a.elevation - b.elevation);
  return {
    id: str(raw.id, uid("b")),
    name: str(raw.name, ""),
    at: vec2(raw.at),
    rotation: num(raw.rotation, -360, 360, 0),
    locked: !!raw.locked,
    roofShadow: raw.roofShadow !== false,
    storeys,
  };
}
export function polygonChecked(raw = {}, kind = "outdoor") {
  const points = (Array.isArray(raw.points) ? raw.points : []).map((p) => vec2(p)).slice(0, 200);
  const out = {
    id: str(raw.id, uid(kind === "garden" ? "g" : "d")),
    name: str(raw.name, ""),
    points,
    material: texture(raw.material, kind === "garden" ? "gravel" : "planks"),
    tint: color(raw.tint, null),
    locked: !!raw.locked,
  };
  if (kind === "outdoor") {
    out.type = ["deck", "pool", "path"].includes(raw.type) ? raw.type : "deck";
    out.height = num(raw.height, -300, 300, out.type === "pool" ? -150 : out.type === "path" ? 3 : 15);
  }
  return out;
}
export function projectChecked(raw) {
  if (!raw || raw.kind !== KIND) throw new Error("unsupported");
  const buildings = (Array.isArray(raw.buildings) ? raw.buildings : []).map(buildingChecked);
  if (!buildings.length) buildings.push(freshBuilding("", [0, 0]));
  const ids = new Set();
  const check = (id) => {
    if (ids.has(id)) throw new Error("invalid");
    ids.add(id);
  };
  for (const b of buildings) {
    check(b.id);
    for (const s of b.storeys) {
      check(s.id);
      for (const list of [s.floorGroups, s.walls, s.stairs, s.objects]) for (const it of list) check(it.id);
      for (const w of s.walls) for (const o of w.openings) check(o.id);
    }
  }
  const view = raw.view && typeof raw.view === "object" ? raw.view : {};
  const activeBuilding = buildings.find((b) => b.id === view.activeBuilding) || buildings[0];
  const activeStorey = activeBuilding.storeys.find((s) => s.id === view.activeStorey) || activeBuilding.storeys[0];
  return {
    kind: KIND, version: VERSION,
    id: str(raw.id, uid("p")),
    name: str(raw.name, ""),
    createdAt: str(raw.createdAt, new Date().toISOString(), 40),
    updatedAt: str(raw.updatedAt, new Date().toISOString(), 40),
    grid: { tile: TILE, snap: num(raw.grid?.snap, 1, 100, 5) },
    terrain: terrainChecked(raw.terrain),
    sun: sunChecked(raw.sun),
    buildings,
    outdoor: (Array.isArray(raw.outdoor) ? raw.outdoor : []).map((p) => polygonChecked(p, "outdoor")),
    gardenPatches: (Array.isArray(raw.gardenPatches) ? raw.gardenPatches : []).map((p) => polygonChecked(p, "garden")),
    objects: (Array.isArray(raw.objects) ? raw.objects : []).map(placementChecked),
    view: {
      cutaway: !!view.cutaway,
      activeBuilding: activeBuilding.id,
      activeStorey: activeStorey.id,
      camera: view.camera && Array.isArray(view.camera.pos) && Array.isArray(view.camera.target)
        ? { pos: vec3(view.camera.pos), target: vec3(view.camera.target) }
        : null,
    },
  };
}

// Prop documents (metres). Unknown part fields are kept; renderers ignore them.
export function propChecked(raw) {
  if (!raw || raw.kind !== "prop" || raw.version !== 1 || raw.source?.type !== "boxes") throw new Error("unsupported");
  if (!Array.isArray(raw.source.boxes) || raw.source.boxes.length > 4000) throw new Error("limits");
  const d = clone(raw);
  d.id = String(raw.id || uid("prop")).replace(/[^a-zA-Z0-9_.-]/g, "-").slice(0, 64);
  d.name = names(raw.name || d.id);
  d.category = str(raw.category, "custom", 32);
  d.tags = raw.tags && typeof raw.tags === "object"
    ? { en: tagList(raw.tags.en), pt: tagList(raw.tags.pt), ja: tagList(raw.tags.ja) }
    : { en: [], pt: [], ja: [] };
  d.source.boxes = raw.source.boxes.map((b) => ({
    ...b,
    w: num(b.w, 0.001, 200, 0.1), h: num(b.h, 0.001, 200, 0.1), d: num(b.d, 0.001, 200, 0.1),
    x: num(b.x, -200, 200, 0), y: num(b.y, -200, 200, 0), z: num(b.z, -200, 200, 0),
    rx: num(b.rx, -7, 7, 0), ry: num(b.ry, -7, 7, 0), rz: num(b.rz, -7, 7, 0),
    shape: SHAPES.includes(b.shape) ? b.shape : "box",
    axis: ["x", "y", "z"].includes(b.axis) ? b.axis : "y",
    color: color(b.color, "#b9b1a0"),
    opacity: num(b.opacity, 0.05, 1, 1),
    locked: !!b.locked,
  }));
  return d;
}
function tagList(v) {
  if (typeof v === "string") v = v.split(/[,\s]+/);
  return Array.isArray(v) ? v.map((t) => str(t, "", 32).trim().toLowerCase()).filter(Boolean).slice(0, 24) : [];
}

// ---------------------------------------------------------------- helpers

export function findBuilding(project, id) {
  return project.buildings.find((b) => b.id === id) || null;
}
export function findStorey(project, id) {
  for (const b of project.buildings) {
    const s = b.storeys.find((s) => s.id === id);
    if (s) return { building: b, storey: s };
  }
  return null;
}
/** Locate any item by id. Returns {type, item, building?, storey?, wall?}. */
export function locate(project, id) {
  if (!id) return null;
  if (id === "terrain") return { type: "terrain", item: project.terrain };
  if (id === "sun") return { type: "sun", item: project.sun };
  for (const o of project.objects) if (o.id === id) return { type: "object", item: o, list: project.objects };
  for (const d of project.outdoor) if (d.id === id) return { type: "outdoor", item: d, list: project.outdoor };
  for (const g of project.gardenPatches) if (g.id === id) return { type: "garden", item: g, list: project.gardenPatches };
  for (const building of project.buildings) {
    if (building.id === id) return { type: "building", item: building, building };
    for (const storey of building.storeys) {
      if (storey.id === id) return { type: "storey", item: storey, building, storey };
      for (const fg of storey.floorGroups) if (fg.id === id) return { type: "floorGroup", item: fg, building, storey, list: storey.floorGroups };
      for (const wall of storey.walls) {
        if (wall.id === id) return { type: "wall", item: wall, building, storey, list: storey.walls };
        for (const op of wall.openings) if (op.id === id) return { type: "opening", item: op, building, storey, wall, list: wall.openings };
      }
      for (const s of storey.stairs) if (s.id === id) return { type: "stairs", item: s, building, storey, list: storey.stairs };
      for (const o of storey.objects) if (o.id === id) return { type: "object", item: o, building, storey, list: storey.objects };
    }
  }
  return null;
}
export function isLocked(project, id) {
  const hit = locate(project, id);
  if (!hit) return false;
  return !!(hit.item.locked || hit.wall?.locked || hit.storey?.locked || hit.building?.locked);
}
export function wallLength(w) {
  return Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
}
export function storeyTop(storey) {
  return storey.elevation + storey.height;
}
