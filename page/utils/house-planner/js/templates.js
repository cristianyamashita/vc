// Ready-made houses: generated projects (cm) built from rectangular rooms.
import { freshProject, freshStorey, uid, projectChecked, TILE, OPENING_PRESETS } from "./schema.js";
import { floor, ext, inn, D, PS, SL, WN, WS, WP, along, corner, put, lights, stairs as makeStairs, rail, lot as lotObject } from "./samples/kit.js";
import { mainHouse, mainHouseSingle } from "./samples/main-house.js";
import { hillside } from "./samples/hillside.js";
import { farmhouse } from "./samples/farmhouse.js";
import { cellarAttic } from "./samples/cellar-attic.js";
import { beach } from "./samples/beach.js";
import { mansion } from "./samples/mansion.js";

const TEMPLATES = ["studio", "house2br", "twoStorey", "garageLeisure", "mainHouse", "mainHouseXL", "mainHouseSingle", "mainHouseSingleXL", "mansion", "hillside", "farmhouse", "cellarAttic", "beach"];
export const TEMPLATE_IDS = TEMPLATES;

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
  place(g, "toilet", 947, 480, 0); place(g, "washbasin-pedestal", 1100, 568, 180); place(g, "wall-mirror", 1100, 590, 90, 110); place(g, "shower-stall", 1285, 535, 180);
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
  place(up, "toilet", 797, 540, 0); place(up, "washbasin-pedestal", 870, 565, 180); place(up, "wall-mirror", 760, 540, 0, 110); place(up, "ceiling-flush", 875, 540, 0, 300);
  place(up, "houseplant", 970, 360, 0); place(up, "ceiling-flush", 875, 160, 0, 300);
  // office
  place(up, "wall-shelves", 1250, 12, 0, 150); place(up, "wall-shelves", 1550, 12, 0, 150); place(up, "sideboard", 1400, 40, 270);
  place(up, "armchair-lounge", 1200, 200, 270); place(up, "armchair-lounge", 1200, 420, 90); place(up, "coffee-table", 1200, 310, 90);
  place(up, "round-rug", 1200, 310, 0); place(up, "desk", 1580, 310, 0); place(up, "office-chair", 1650, 310, 180);
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


const LIGHT = { outerMaterial: "plaster", outerTint: "#e9e4da" };
const H = 300;
/** Studio flat (7 × 4 m): one room with the bed, a sofa corner and the kitchen along the back wall, bathroom beside. */
function studio(p, b, g) {
  floor(g, 0, 0, 500, 400, "woodFloor", null);
  floor(g, 500, 0, 700, 250, "tiles", "#d8d4cc");
  ext(g, [0, 0], [700, 0], [WN(280, 180), WS(600)], LIGHT);
  ext(g, [700, 0], [700, 250], [], LIGHT);
  ext(g, [700, 250], [500, 250], [], LIGHT);
  ext(g, [500, 250], [500, 400], [], LIGHT);
  ext(g, [500, 400], [0, 400], [D(105)], LIGHT);
  ext(g, [0, 400], [0, 0], [WN(200, 120)], LIGHT);
  inn(g, [500, 0], [500, 250], [D(105)]);
  along(g, "double-bed", "w", 13, 170); along(g, "nightstand", "w", 13, 280); along(g, "wardrobe", "n", 13, 100);
  put(g, "sofa-two-seat", 330, 200, "w"); along(g, "wall-tv", "e", 487, 230, { y: 110 }); put(g, "side-table", 420, 200, "n"); put(g, "round-rug", 300, 200, "n");
  along(g, "kitchen-fridge", "s", 387, 440); along(g, "kitchen-stove", "s", 387, 345); along(g, "kitchen-sink", "s", 387, 225);
  corner(g, "shower-stall", 687, 13, "ne"); along(g, "toilet", "s", 237, 540); along(g, "washbasin-pedestal", "e", 687, 190); along(g, "wall-mirror", "e", 687, 190, { y: 110 });
  put(g, "pendant-lamp", 250, 200, "n", H); put(g, "ceiling-flush", 600, 130, "n", H); put(g, "doormat", 105, 360, "n");
  b.roof.type = "flat";
}
/** 2-bedroom house (8 × 8 m): living, kitchen with a table, hall, bathroom and two bedrooms. */
function house2br(p, b, g) {
  floor(g, 0, 0, 800, 800, "woodFloor", null);
  floor(g, 450, 0, 800, 250, "tiles", "#d8d4cc"); floor(g, 600, 250, 800, 450, "tiles", "#d8d4cc"); floor(g, 450, 250, 600, 450, "stoneTiles", "#cfc9bd");
  ext(g, [0, 0], [800, 0], [D(90), WN(300, 120), WN(625, 120, 100, 120)], LIGHT);
  ext(g, [800, 0], [800, 800], [WS(350), WN(560, 150)], LIGHT);
  ext(g, [800, 800], [0, 800], [WN(600, 150), WN(300, 120)], LIGHT);
  ext(g, [0, 800], [0, 0], [WN(625, 180), WP(225)], LIGHT);
  inn(g, [450, 0], [450, 450], [D(125), PS(400)]); // kitchen door, passage to the hall
  inn(g, [450, 250], [800, 250]); inn(g, [600, 250], [600, 450], [D(350)]);
  inn(g, [0, 450], [800, 450], [D(300), D(525)]); inn(g, [400, 450], [400, 800]);
  // living
  along(g, "wall-tv", "e", 442, 260, { y: 110 }); along(g, "tv-bench", "e", 442, 260); put(g, "sofa-two-seat", 200, 260, "w"); put(g, "coffee-table", 310, 260, "n");
  put(g, "armchair", 230, 80, "n"); put(g, "rug", 270, 260, "n"); put(g, "floor-lamp", 410, 60, "n"); put(g, "houseplant", 40, 410, "n"); put(g, "doormat", 90, 50, "n");
  // kitchen with a table for four
  along(g, "kitchen-fridge-70", "n", 13, 575); along(g, "kitchen-sink-80", "n", 13, 650); along(g, "kitchen-stove-60", "n", 13, 720); along(g, "kitchen-wall-60", "n", 13, 720, { y: 145 });
  put(g, "table", 640, 185, "n"); put(g, "dining-chair", 550, 185, "w"); put(g, "dining-chair", 730, 185, "e"); put(g, "dining-chair", 600, 113, "n"); put(g, "dining-chair", 680, 113, "n");
  put(g, "kettle", 690, 40, "n", 94); put(g, "dish-rack", 580, 40, "n", 94);
  // hall and bathroom
  along(g, "picture", "n", 257, 525, { y: 150 });
  corner(g, "shower-stall", 787, 257, "ne"); along(g, "toilet", "e", 787, 405); along(g, "washbasin-pedestal", "s", 442, 650); along(g, "wall-mirror", "s", 442, 650, { y: 110 });
  // bedrooms
  along(g, "double-bed", "s", 787, 170); along(g, "nightstand", "s", 787, 40); along(g, "nightstand", "s", 787, 300); along(g, "wardrobe", "n", 457, 110);
  along(g, "study-desk", "e", 392, 650); put(g, "dining-chair", 280, 650, "w"); put(g, "rug", 170, 600, "n");
  along(g, "single-bed", "e", 787, 700); along(g, "desk", "n", 457, 700); put(g, "office-chair", 700, 590, "s"); along(g, "wardrobe", "w", 407, 700); along(g, "bookshelf", "s", 787, 540); put(g, "round-rug", 600, 650, "n");
  lights(g, H, [[225, 225], [625, 125], [525, 350], [700, 350], [200, 625], [600, 625]]);
  lotObject(p, "sedan", 1100, 200, 90); lotObject(p, "oak-tree", -500, 900);
  b.roof.type = "hip";
}
/** Two-storey house (8 × 6 m): living with the stairs, dining, kitchen, lavatory and laundry below; two bedrooms, office and bathroom above. */
function twoStorey(p, b, g) {
  floor(g, 0, 0, 800, 600, "woodFloor", null);
  floor(g, 500, 0, 800, 400, "tiles", "#d8d4cc");
  ext(g, [0, 0], [800, 0], [WN(120, 150), WN(650, 120, 100, 120)], LIGHT);
  ext(g, [800, 0], [800, 600], [WS(325), WN(500, 150)], LIGHT);
  ext(g, [800, 600], [0, 600], [WN(650, 180), D(300), WN(430, 120)], LIGHT);
  ext(g, [0, 600], [0, 0], [WN(520, 150), WS(80)], LIGHT);
  inn(g, [500, 0], [500, 400], [D(150), D(325)]); // kitchen and lavatory doors
  inn(g, [500, 250], [800, 250], [D(725)]); inn(g, [650, 250], [650, 400]); inn(g, [500, 400], [800, 400]);
  makeStairs(g, [60, 450], 90, { shape: "U", width: 90, rise: H, turn: "right", rail: "both", railStyle: "wood" });
  // living
  along(g, "wall-tv", "n", 13, 330, { y: 110 }); along(g, "tv-bench", "n", 13, 330); put(g, "sofa-two-seat", 300, 200, "s"); put(g, "coffee-table", 300, 110, "n");
  put(g, "houseplant", 60, 60, "n"); put(g, "rug", 300, 150, "n"); put(g, "floor-lamp", 440, 60, "n"); put(g, "houseplant", 460, 560, "n"); put(g, "doormat", 300, 560, "n"); put(g, "coat-rack", 400, 570, "n");
  // dining
  put(g, "dining-table", 650, 490, "n"); for (const x of [600, 700]) { put(g, "dining-chair", x, 435, "n"); put(g, "dining-chair", x, 545, "s"); }
  put(g, "dining-chair", 545, 490, "w"); put(g, "dining-chair", 755, 490, "e"); put(g, "pendant-lamp", 650, 490, "n", H);
  // kitchen, lavatory, laundry
  along(g, "kitchen-fridge-70", "n", 13, 545); along(g, "kitchen-sink-80", "n", 13, 620); along(g, "kitchen-stove-60", "n", 13, 690); along(g, "kitchen-base-60", "n", 13, 750);
  along(g, "kitchen-wall-60", "n", 13, 750, { y: 145 }); put(g, "microwave", 750, 40, "n", 93); put(g, "kitchen-bin", 770, 110, "e");
  along(g, "toilet", "n", 257, 610); along(g, "washbasin-pedestal", "s", 392, 610); along(g, "wall-mirror", "s", 392, 610, { y: 110 });
  along(g, "washing-machine", "s", 392, 690); along(g, "dryer", "s", 392, 755); along(g, "wall-shelves", "e", 787, 320, { y: 150 });
  lights(g, H, [[300, 150], [300, 450], [650, 125], [575, 325], [725, 325]]);
  // ---- upper floor: landing by the stairs, corridor, two bedrooms, bathroom and office
  const up = freshStorey(g, "upper");
  b.storeys.push(up);
  floor(up, 0, 0, 800, 600, "woodFloor", null);
  floor(up, 320, 400, 520, 600, "tiles", "#d8d4cc");
  ext(up, [0, 0], [800, 0], [WN(440, 150), WN(680, 150)], LIGHT);
  ext(up, [800, 0], [800, 600], [WN(120, 120), WN(500, 150)], LIGHT);
  ext(up, [800, 600], [0, 600], [WN(680, 150), WS(360), WN(100, 150)], LIGHT);
  ext(up, [0, 600], [0, 0], [WN(300, 180), WS(80)], LIGHT);
  inn(up, [200, 0], [200, 450]); inn(up, [320, 0], [320, 300]); inn(up, [560, 0], [560, 300]);
  inn(up, [320, 300], [800, 300], [D(500), D(620)]);
  inn(up, [320, 400], [800, 400], [D(400), D(600)]); inn(up, [320, 400], [320, 600]); inn(up, [520, 400], [520, 600]);
  rail(up, [[15, 338], [105, 338], [105, 450]], { height: 100, style: "wood" });
  along(up, "single-bed", "n", 13, 375); along(up, "nightstand", "n", 13, 450); along(up, "wardrobe", "e", 552, 100); along(up, "bookshelf", "s", 292, 400); put(up, "round-rug", 440, 160, "n");
  along(up, "double-bed", "e", 787, 120); along(up, "chest-of-drawers", "s", 292, 740); put(up, "rug", 680, 120, "e"); put(up, "houseplant", 590, 270, "n");
  corner(up, "shower-stall", 512, 587, "se"); along(up, "toilet", "w", 327, 540); along(up, "washbasin-pedestal", "n", 407, 480); along(up, "wall-mirror", "n", 407, 480, { y: 110 });
  along(up, "desk", "s", 587, 700); put(up, "office-chair", 700, 468, "n"); put(up, "laptop", 700, 550, "s", 75); along(up, "bookshelf", "n", 407, 720); along(up, "filing-cabinet", "s", 587, 575);
  along(up, "bookshelf", "n", 13, 100); put(up, "houseplant", 40, 560, "n"); along(up, "picture", "s", 587, 100, { y: 150 });
  lights(up, H, [[440, 150], [680, 150], [260, 300], [100, 525], [420, 500], [660, 500]]);
  b.roof.type = "gable";
}

export function makeTemplate(id, name) {
  const p = freshProject(name);
  const b = p.buildings[0];
  const g = b.storeys[0];
  if (id === "studio") studio(p, b, g);
  else if (id === "house2br") house2br(p, b, g);
  else if (id === "garageLeisure") return garageLeisure(p, b, g);
  else if (id === "mansion" || id === "hillside" || id === "farmhouse" || id === "cellarAttic" || id === "beach") {
    ({ mansion, hillside, farmhouse, cellarAttic, beach })[id](p, b, g);
    p.view.activeStorey = g.id;
    return projectChecked(p);
  } else if (id.startsWith("mainHouse")) {
    (id.startsWith("mainHouseSingle") ? mainHouseSingle : mainHouse)(p, b, g, { scale: id.endsWith("XL") ? Math.SQRT2 : 1 });
    p.sun = { ...p.sun, city: "saopaulo", latitude: -23.5, useTime: true, time: 17.5, month: 4 };
    p.view.activeStorey = g.id;
    return projectChecked(p);
  } else twoStorey(p, b, g);
  b.roof.material = "roofTiles";
  b.roof.tint = "#c8653f";
  p.view.activeStorey = g.id;
  return projectChecked(p);
}
