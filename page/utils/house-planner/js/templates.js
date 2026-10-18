// Ready-made houses: generated projects (cm) built from rectangular rooms.
import { freshProject, freshStorey, uid, projectChecked, TILE, OPENING_PRESETS } from "./schema.js";
import { mainHouse, mainHouseSingle } from "./samples/main-house.js";
import { hillside } from "./samples/hillside.js";
import { farmhouse } from "./samples/farmhouse.js";
import { cellarAttic } from "./samples/cellar-attic.js";
import { beach } from "./samples/beach.js";
import { mansion } from "./samples/mansion.js";

const TEMPLATES = ["studio", "house2br", "twoStorey", "garageLeisure", "mainHouse", "mainHouseXL", "mainHouseSingle", "mainHouseSingleXL", "mansion", "hillside", "farmhouse", "cellarAttic", "beach"];
export const TEMPLATE_IDS = TEMPLATES;

/** Rooms are {x, z, w, d} rectangles in building cm; walls are deduplicated. */
function addRooms(storey, rooms, { material = "woodFloor" } = {}) {
  const tiles = [];
  const edges = new Map();
  const key = (a, b) => [a, b].map((p) => p.join(",")).sort().join("|");
  for (const r of rooms) {
    for (let z = Math.floor(r.z / TILE); z < Math.ceil((r.z + r.d) / TILE); z++)
      for (let x = Math.floor(r.x / TILE); x < Math.ceil((r.x + r.w) / TILE); x++) tiles.push([x, z]);
    const c = [[r.x, r.z], [r.x + r.w, r.z], [r.x + r.w, r.z + r.d], [r.x, r.z + r.d]];
    c.forEach((a, i) => {
      const b = c[(i + 1) % 4];
      const k = key(a, b);
      if (!edges.has(k)) edges.set(k, { a, b, rooms: [] });
      edges.get(k).rooms.push(r);
    });
  }
  // split shared long edges: walls are per edge as drawn (rooms share whole sides in these templates)
  const seen = new Set();
  storey.floorGroups.push({ id: uid("fg"), name: "", offset: 0, thickness: null, material, tint: null, tiles: tiles.filter(([x, z]) => !seen.has(`${x},${z}`) && seen.add(`${x},${z}`)), locked: false });
  for (const { a, b, rooms: rs } of edges.values()) {
    const wall = { id: uid("w"), name: "", a, b, thickness: rs.length > 1 ? 15 : 20, height: null, material: null, tint: "#f2ede4", outerMaterial: null, outerTint: null, locked: false, openings: [] };
    storey.walls.push(wall);
    for (const r of rs) for (const op of r.openings || []) if (op.side === sideOf(r, a, b)) wall.openings.push(opening(op, a, b, r));
  }
  return storey;
}
function sideOf(r, a, b) {
  if (a[1] === b[1]) return a[1] === r.z ? "n" : "s";
  return a[0] === r.x ? "w" : "e";
}
/** Opening on a side: offset is measured along the wall from its first point. */
function opening(op, a, b, r) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const along = op.at ?? len / 2 - (op.width ?? 90) / 2;
  const preset = op.preset || (op.type === "window" ? "window-casement" : "door-single");
  const width = op.width ?? (op.type === "window" ? 120 : 90);
  const height = op.height ?? (op.type === "window" ? 120 : 210);
  return { id: uid("op"), preset, type: op.type, offset: Math.max(0, Math.min(len - width, along)), width, height, sill: op.type === "window" ? 90 : 0, flip: false, frameColor: "#776750", leafColor: "#b99673", glassColor: "#bcd8e6", locked: false };
}
function objects(storey, list) {
  for (const [prop, x, z, yaw = 0] of list) storey.objects.push({ id: uid("ob"), name: "", prop, inline: null, at: [x, 0, z], rotation: [0, yaw, 0], scale: [1, 1, 1], tint: null, material: null, locked: false });
}

// ---- free-form helpers (cm, building-local) for the larger samples
function tiles(x0, z0, x1, z1) {
  const out = [];
  for (let z = Math.floor(z0 / TILE); z < Math.ceil(z1 / TILE); z++) for (let x = Math.floor(x0 / TILE); x < Math.ceil(x1 / TILE); x++) out.push([x, z]);
  return out;
}
export function slab(storey, x0, z0, x1, z1, material, tint = null) {
  storey.floorGroups.push({ id: uid("fg"), name: "", offset: 0, thickness: null, material, tint, tiles: tiles(x0, z0, x1, z1), locked: false });
}
const DARK_OPENING = { frameColor: "#2b2e33", leafColor: "#3a3d42", glassColor: "#a9c9d9" };
export function wall(storey, a, b, { thickness = 20, tint = "#ebe6de", material = null, outerMaterial = null, outerTint = null, skirting = true, openings = [], flipOuter = false } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ops = openings.map((o) => {
    const p = OPENING_PRESETS[o.preset];
    const width = o.width ?? p.width;
    return { id: uid("op"), preset: o.preset, type: p.type, offset: Math.max(0, Math.min(len - width, o.at)), width, height: o.height ?? p.height, sill: o.sill ?? p.sill, flip: !!o.flip, ...DARK_OPENING, ...(o.colors || {}), locked: false };
  });
  storey.walls.push({ id: uid("w"), name: "", a, b, thickness, height: null, material, tint, outerMaterial, outerTint, skirting, trim: true, flipOuter, locked: false, openings: ops });
}
export function place(storey, prop, x, z, yaw = 0, y = 0) {
  storey.objects.push({ id: uid("ob"), name: "", prop, inline: null, at: [x, y, z], rotation: [0, yaw, 0], scale: [1, 1, 1], tint: null, material: null, locked: false });
}
export function railing(storey, points, { height = 110, style = "glass" } = {}) {
  storey.railings.push({ id: uid("rl"), name: "", points, height, style, postSpacing: 150, material: null, tint: null, locked: false });
}
export function paving(p, points, material, tint = null, height = 3) {
  p.outdoor.push({ id: uid("d"), name: "", type: "path", points, material, tint, height, open: false, postSize: 15, depth: 80, width: 120, lights: false, locked: false });
}

/** The garage and leisure building alone (18 × 6 m, origin at its north-west corner): also used on the hillside lot. */
export function garageLeisureBuilding(b, g) {
  const FACADE = { outerMaterial: "plaster", outerTint: "#3a3d42" };
  const STONE = { outerMaterial: "stone", outerTint: "#8c8578" };
  g.height = 320;
  // ---- ground floor: garage | stair hall | gym with lavatory, shower, entry and kitchenette
  slab(g, 0, 0, 750, 600, "concrete", "#b9b6ad");
  slab(g, 750, 0, 900, 600, "stoneTiles", "#c9c4ba");
  slab(g, 900, 0, 1800, 420, "rubber", "#3f4247");
  slab(g, 900, 420, 1350, 600, "tiles", "#d8d4cc");
  slab(g, 1350, 420, 1500, 600, "stoneTiles", "#c9c4ba");
  slab(g, 1500, 420, 1800, 600, "woodFloor", null);
  wall(g, [0, 0], [1800, 0], { ...FACADE, openings: [{ preset: "window-wide", at: 1050, width: 180, height: 60, sill: 220 }, { preset: "window-wide", at: 1450, width: 180, height: 60, sill: 220 }] });
  wall(g, [1800, 0], [1800, 600], FACADE);
  wall(g, [1800, 600], [1500, 600], FACADE);
  wall(g, [1500, 600], [1350, 600], { ...FACADE, openings: [{ preset: "door-single", at: 30, width: 90, height: 230, colors: { leafColor: "#6b4a2e", frameColor: "#2b2e33" } }] });
  wall(g, [1350, 600], [900, 600], STONE);
  wall(g, [900, 600], [750, 600], { ...FACADE, openings: [{ preset: "door-single", at: 30, width: 90, height: 230, colors: { leafColor: "#6b4a2e" } }] });
  wall(g, [750, 600], [0, 600], { ...FACADE, openings: [{ preset: "door-garage", at: 75, width: 600, height: 250, colors: { leafColor: "#2f3236" } }] });
  wall(g, [0, 600], [0, 0], FACADE);
  wall(g, [750, 0], [750, 600], { thickness: 15, openings: [{ preset: "door-single", at: 505 }] });
  wall(g, [900, 0], [900, 600], { thickness: 15, openings: [{ preset: "door-single", at: 75 }] });
  wall(g, [900, 420], [1800, 420], { thickness: 15, openings: [{ preset: "door-single", at: 80 }, { preset: "door-sliding", at: 300, width: 90 }, { preset: "door-single", at: 480 }, { preset: "door-double", at: 660 }] });
  wall(g, [1150, 420], [1150, 600], { thickness: 10 });
  wall(g, [1350, 420], [1350, 600], { thickness: 10 });
  wall(g, [1500, 420], [1500, 600], { thickness: 10 });
  g.stairs.push({ id: uid("sr"), name: "", shape: "straight", at: [825, 580], rotation: 90, width: 100, rise: 320, stepHeight: 17.8, treadDepth: 28, turn: "left", material: "stoneTiles", tint: "#c9c4ba", cutFloorAbove: true, railing: "both", railingStyle: "metal", base: "open", locked: false });
  // garage
  place(g, "suv", 190, 300, 90); place(g, "sports-car", 400, 300, 90); place(g, "sedan", 600, 270, 90);
  place(g, "tool-chest", 50, 60, 90); place(g, "steel-shelf", 40, 220, 90); place(g, "tool-board", 10, 420, 0);
  for (const x of [190, 400, 600]) for (const z of [150, 450]) place(g, "downlight", x, z, 0, 320);
  for (const x of [295, 500]) place(g, "led-strip", x, 300, 90, 320);
  // gym
  place(g, "squat-rack", 1120, 110, 0); place(g, "weight-bench", 1010, 250, 90); place(g, "dumbbell-rack", 1330, 35, 0);
  place(g, "weight-rack", 1470, 30, 0); place(g, "treadmill", 1480, 200, 90); place(g, "exercise-bike", 1620, 200, 90);
  place(g, "yoga-mat", 1700, 120, 0); place(g, "exercise-ball", 1700, 230, 0); place(g, "medicine-ball-rack", 1520, 390, 180);
  place(g, "kettlebell-set", 1745, 300, 0); place(g, "foam-roller", 1780, 160, 0);
  place(g, "wall-tv", 1792, 180, 270, 170); place(g, "water-cooler", 1770, 30, 0);
  place(g, "houseplant", 935, 35, 0); place(g, "houseplant", 1770, 395, 0);
  for (const x of [1100, 1500]) place(g, "spot-rail", x, 200, 0, 320);
  place(g, "downlight", 1350, 100, 0, 320); place(g, "downlight", 1350, 300, 0, 320);
  // lavatory, shower, entry hall, kitchenette
  place(g, "toilet", 947, 480, 0); place(g, "washbasin-pedestal", 1100, 568, 0); place(g, "wall-mirror", 1100, 590, 90, 110); place(g, "shower-stall", 1285, 535, 180);
  place(g, "ceiling-flush", 1025, 510, 0, 320); place(g, "ceiling-flush", 1250, 510, 0, 320);
  place(g, "planter", 1460, 575, 0); place(g, "ceiling-flush", 1425, 510, 0, 320);
  place(g, "kitchen-sink", 1580, 560, 180); place(g, "kitchen-fridge", 1750, 555, 180); place(g, "coffee-machine", 1660, 585, 180, 94);
  place(g, "ceiling-flush", 1650, 510, 0, 320);
  // ---- upper floor: living + bar + pool table | stair hall and lavatory | office, with a glass balcony in front
  const up = freshStorey(g, "upper");
  b.storeys.push(up);
  slab(up, 0, 0, 1800, 600, "woodFloor", "#c9a579");
  slab(up, 750, 480, 1000, 600, "stoneTiles", "#c9c4ba");
  slab(up, 0, 600, 1800, 700, "concrete", "#b9b6ad");
  wall(up, [0, 0], [1800, 0], { ...FACADE, openings: [{ preset: "window-wide", at: 160, width: 420, height: 50, sill: 230 }, { preset: "window-wide", at: 1250, width: 300, height: 50, sill: 230 }] });
  wall(up, [1800, 0], [1800, 600], FACADE);
  wall(up, [1800, 600], [1000, 600], { ...FACADE, openings: [{ preset: "door-sliding", at: 50, width: 300, height: 250 }, { preset: "door-sliding", at: 450, width: 300, height: 250 }] });
  wall(up, [1000, 600], [750, 600], { ...FACADE, openings: [{ preset: "window-small", at: 95, width: 60, height: 60, sill: 170 }] });
  wall(up, [750, 600], [0, 600], { ...FACADE, openings: [{ preset: "door-sliding", at: 50, width: 300, height: 250 }, { preset: "door-sliding", at: 400, width: 300, height: 250 }] });
  wall(up, [0, 600], [0, 0], FACADE);
  wall(up, [750, 0], [750, 600], { thickness: 15, openings: [{ preset: "door-single", at: 120 }] });
  wall(up, [1000, 0], [1000, 600], { thickness: 15, openings: [{ preset: "door-single", at: 120 }] });
  wall(up, [750, 480], [1000, 480], { thickness: 10, openings: [{ preset: "door-single", at: 155 }] });
  railing(up, [[0, 700], [1800, 700]]);
  railing(up, [[0, 600], [0, 700]]);
  railing(up, [[1800, 600], [1800, 700]]);
  // living, bar and pool table
  place(up, "wall-tv", 8, 300, 90, 160); place(up, "tv-bench", 40, 300, 0); place(up, "sofa-corner", 250, 330, 0);
  place(up, "coffee-table", 130, 330, 90); place(up, "rug", 230, 330, 90);
  place(up, "pool-table", 540, 320, 0); place(up, "cue-rack", 740, 320, 270, 150);
  place(up, "bar-shelf", 430, 28, 90); place(up, "bar-counter", 430, 100, 90);
  for (const x of [330, 430, 530]) place(up, "bar-stool", x, 165, 0);
  place(up, "mini-fridge", 690, 30, 0); place(up, "coffee-machine", 710, 30, 180, 85); place(up, "kitchen-sink", 150, 40, 0);
  place(up, "houseplant", 40, 40, 0); place(up, "houseplant", 700, 560, 0);
  for (const z of [240, 320, 400]) place(up, "pendant-lamp", 540, z, 0, 300);
  for (const x of [150, 400]) place(up, "downlight", x, 200, 0, 300);
  for (const x of [150, 400]) place(up, "downlight", x, 450, 0, 300);
  // hall and lavatory
  place(up, "toilet", 797, 540, 0); place(up, "washbasin-pedestal", 870, 565, 0); place(up, "wall-mirror", 760, 540, 0, 110); place(up, "ceiling-flush", 875, 540, 0, 300);
  place(up, "houseplant", 970, 360, 0); place(up, "ceiling-flush", 875, 160, 0, 300);
  // office
  place(up, "wall-shelves", 1250, 12, 0, 150); place(up, "wall-shelves", 1550, 12, 0, 150); place(up, "sideboard", 1400, 40, 90);
  place(up, "armchair-lounge", 1200, 200, 180); place(up, "armchair-lounge", 1200, 420, 0); place(up, "coffee-table", 1200, 310, 90);
  place(up, "round-rug", 1200, 310, 0); place(up, "desk", 1580, 310, 0); place(up, "office-chair", 1650, 310, 270);
  place(up, "laptop", 1570, 310, 90, 74); place(up, "filing-cabinet", 1745, 60, 270);
  place(up, "houseplant", 1040, 40, 0); place(up, "houseplant", 1050, 560, 0); place(up, "houseplant", 1760, 560, 0);
  for (const x of [1200, 1550]) for (const z of [170, 430]) place(up, "downlight", x, z, 0, 300);
  // balcony
  place(up, "slat-panel", 875, 640, 0); place(up, "planter", 60, 650, 0); place(up, "planter", 1740, 650, 0);
  place(up, "planter", 1060, 650, 0); place(up, "houseplant", 1740, 650, 0, 20);
  for (const x of [200, 550, 1200, 1600]) place(up, "downlight", x, 650, 0, 300);
  // ---- façade lights
  place(g, "wall-lantern", 1320, 230, 0, 611); place(g, "wall-lantern", 1530, 230, 0, 611);
  for (const x of [300, 450]) place(g, "downlight", x, 625, 0, 320);
  for (const x of [1100, 1250, 1650]) place(g, "downlight", x, 625, 0, 320);
  b.roof = { ...b.roof, type: "flat", overhang: 30, height: 25, material: "concrete", tint: "#2f3236", ceiling: true };
}
/** Garage for three cars and a gym below, office and games room with a balcony above, on its own lot. */
function garageLeisure(p, b, g) {
  b.at = [-900, -500];
  garageLeisureBuilding(b, g);
  // ---- the lot (lot coordinates: building origin is at (-900, -500))
  paving(p, [[-900, 110], [-150, 110], [-150, 700], [-900, 700]], "concrete", "#b9b6ad");
  paving(p, [[440, 110], [610, 110], [610, 700], [440, 700]], "stoneTiles", "#c9c4ba");
  paving(p, [[-2000, 700], [2000, 700], [2000, 850], [-2000, 850]], "paving", "#bfbab0", 6);
  paving(p, [[-2000, 850], [2000, 850], [2000, 1500], [-2000, 1500]], "asphalt", null, 2);
  const lot = (prop, x, z, yaw = 0) => p.objects.push({ id: uid("ob"), name: "", prop, inline: null, at: [x, 0, z], rotation: [0, yaw, 0], scale: [1, 1, 1], tint: null, material: null, locked: false });
  lot("ipe-tree", -1150, 380); lot("tree", 180, 300); lot("tree", 820, 330); lot("ipe-tree", 1200, 450);
  lot("bush", 200, 420); lot("bush", 740, 450); lot("bush", 850, 560); lot("bush", 960, 430); lot("bush", -1150, 500);
  lot("planter", 400, 200); lot("planter", 650, 200); lot("houseplant", 400, 200, 0); lot("houseplant", 650, 200, 0);
  lot("garden-spike", -1000, 240); lot("garden-spike", 230, 240); lot("garden-spike", 880, 250);
  lot("street-sign", 1700, 760, 180); lot("trash-bin", -1500, 780, 0);
  p.sun = { ...p.sun, city: "saopaulo", latitude: -23.5, useTime: true, time: 17.5, month: 4 };
  p.view.activeStorey = g.id;
  return projectChecked(p);
}

export function makeTemplate(id, name) {
  const p = freshProject(name);
  const b = p.buildings[0];
  const g = b.storeys[0];
  if (id === "studio") {
    addRooms(g, [
      { x: 0, z: 0, w: 500, d: 400, openings: [{ type: "door", side: "s", at: 60 }, { type: "window", side: "n", width: 180 }] },
      { x: 500, z: 0, w: 200, d: 250, openings: [{ type: "door", side: "w", at: 100 }, { type: "window", side: "n", width: 60, preset: "window-small" }] },
    ]);
    objects(g, [["sofa", 140, 300, 180], ["tv", 140, 30, 0], ["double-bed", 380, 100, 90], ["kitchen-fridge", 460, 360, 180], ["kitchen-stove", 360, 360, 180], ["kitchen-sink", 250, 360, 180], ["toilet", 650, 40, 0], ["shower-stall", 560, 60, 0], ["bath-vanity", 650, 200, 180]]);
    b.roof.type = "flat";
  } else if (id === "house2br") {
    addRooms(g, [
      { x: 0, z: 0, w: 450, d: 450, openings: [{ type: "door", side: "s", at: 60 }, { type: "window", side: "w", width: 180, at: 120 }] }, // living
      { x: 450, z: 0, w: 350, d: 300, openings: [{ type: "door", side: "w", at: 40 }, { type: "window", side: "n", width: 120 }] }, // kitchen
      { x: 450, z: 300, w: 350, d: 150, openings: [{ type: "door", side: "w", at: 30 }, { type: "window", side: "e", width: 60, preset: "window-small" }] }, // bathroom
      { x: 0, z: 450, w: 400, d: 350, openings: [{ type: "door", side: "n", at: 280 }, { type: "window", side: "s", width: 150 }] }, // bedroom 1
      { x: 400, z: 450, w: 400, d: 350, openings: [{ type: "door", side: "n", at: 40 }, { type: "window", side: "s", width: 150 }] }, // bedroom 2
    ]);
    objects(g, [["sofa", 120, 300, 180], ["coffee-table", 200, 220, 0], ["tv", 120, 30, 0], ["dining-table", 330, 150, 0], ["kitchen-fridge", 760, 40, 270], ["kitchen-stove", 760, 160, 270], ["kitchen-sink", 760, 250, 270], ["toilet", 760, 340, 270], ["bath-vanity", 500, 420, 180], ["double-bed", 200, 650, 180], ["wardrobe", 60, 500, 90], ["single-bed", 600, 650, 180], ["desk", 720, 500, 90]]);
    p.objects.push({ id: uid("ob"), name: "", prop: "sedan", inline: null, at: [1100, 0, 200], rotation: [0, 90, 0], scale: [1, 1, 1], tint: null, material: null, locked: false }, { id: uid("ob"), name: "", prop: "oak-tree", inline: null, at: [-500, 0, 900], rotation: [0, 0, 0], scale: [1, 1, 1], tint: null, material: null, locked: false });
    b.roof.type = "hip";
  } else if (id === "garageLeisure") {
    return garageLeisure(p, b, g);
  } else if (id === "mansion" || id === "hillside" || id === "farmhouse" || id === "cellarAttic" || id === "beach") {
    ({ mansion, hillside, farmhouse, cellarAttic, beach })[id](p, b, g);
    p.view.activeStorey = g.id;
    return projectChecked(p);
  } else if (id.startsWith("mainHouse")) {
    (id.startsWith("mainHouseSingle") ? mainHouseSingle : mainHouse)(p, b, g, { scale: id.endsWith("XL") ? Math.SQRT2 : 1 });
    p.sun = { ...p.sun, city: "saopaulo", latitude: -23.5, useTime: true, time: 17.5, month: 4 };
    p.view.activeStorey = g.id;
    return projectChecked(p);
  } else {
    addRooms(g, [
      { x: 0, z: 0, w: 500, d: 500, openings: [{ type: "door", side: "s", at: 60 }, { type: "window", side: "w", width: 240, preset: "window-picture", at: 130 }] }, // living
      { x: 500, z: 0, w: 300, d: 350, openings: [{ type: "door", side: "w", at: 40 }, { type: "window", side: "n", width: 120 }] }, // kitchen
      { x: 500, z: 350, w: 300, d: 150, openings: [{ type: "door", side: "w", at: 30 }, { type: "window", side: "e", width: 60, preset: "window-small" }] }, // wc
    ]);
    objects(g, [["sofa-three-seat", 150, 330, 180], ["coffee-table", 250, 250, 0], ["tv", 150, 30, 0], ["dining-table", 380, 150, 90], ["kitchen-fridge", 760, 40, 270], ["kitchen-stove", 760, 160, 270], ["kitchen-sink", 760, 260, 270], ["toilet", 760, 400, 270]]);
    g.stairs.push({ id: uid("sr"), name: "", shape: "L", at: [60, 440], rotation: 0, width: 100, rise: 300, stepHeight: 18, treadDepth: 28, turn: "left", material: "woodFloor", tint: null, cutFloorAbove: true, locked: false });
    const up = freshStorey({ elevation: 0, height: 300 }, "upper");
    b.storeys.push(up);
    addRooms(up, [
      { x: 0, z: 0, w: 400, d: 250, openings: [{ type: "door", side: "s", at: 40 }, { type: "window", side: "n", width: 150 }] }, // bedroom 1
      { x: 400, z: 0, w: 400, d: 250, openings: [{ type: "door", side: "s", at: 300 }, { type: "window", side: "n", width: 150 }] }, // bedroom 2
      { x: 0, z: 250, w: 300, d: 250, openings: [] }, // hall
      { x: 300, z: 250, w: 250, d: 250, openings: [{ type: "door", side: "w", at: 60 }, { type: "window", side: "s", width: 60, preset: "window-small" }] }, // bathroom
      { x: 550, z: 250, w: 250, d: 250, openings: [{ type: "door", side: "w", at: 60 }, { type: "window", side: "s", width: 120 }] }, // office
    ]);
    objects(up, [["double-bed", 200, 120, 0], ["wardrobe", 60, 200, 90], ["single-bed", 600, 120, 0], ["desk", 700, 400, 90], ["office-chair", 640, 400, 270], ["toilet", 330, 460, 180], ["bath-vanity", 500, 300, 0]]);
    b.roof.type = "gable";
  }
  b.roof.material = "roofTiles";
  b.roof.tint = "#c8653f";
  p.view.activeStorey = g.id;
  return projectChecked(p);
}
