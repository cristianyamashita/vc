// Modern mansion around a pool deck, after a Brazilian plan: three wings
// around the wooden deck with the lap pool. West wing: master suite with
// closet and bath, two junior suites with their baths, kitchen and laundry,
// a covered walkway along the deck. South block: pergola veranda and the
// living room with the entrance. East wing: guest bedroom with bath and
// closet, stairs down to the wine cellar, gourmet room with its counter,
// lavatory, storage, utility and a two-car garage. Flat roofs.
import { freshStorey } from "../schema.js";
import { floor, ext, inn, column, D, DD, PD, SL, GD, WN, WS, WP, along, corner, put, lights, stairs, rail, lot, path, deck, pool, patch, rect, fence, siteWall, gate, terrain, building } from "./kit.js";

const LEVEL = 15, H = 300, CELLAR = 250;
const WHITE = { outerMaterial: "plaster", outerTint: "#f1efe8", tint: "#f7f5f0" };
const WOOD = { outerMaterial: "woodDark", outerTint: "#6a4a32", tint: "#f7f5f0" };
const UNIT = { material: "woodDark" }, MARBLE = { material: "marble" };
const ROOF = { type: "flat", overhang: 40, height: 25, material: "concrete", tint: "#3a3d42", ceiling: true };

/** West wing (x 0..600, z 0..2600): the bedrooms, kitchen and laundry along a covered walkway (x 500..600) on the deck. */
function westWing(st) {
  floor(st, 0, 0, 600, 2600, "woodFloor", "#c9a579");
  floor(st, 0, 650, 300, 950, "tiles", "#d8d4cc"); floor(st, 0, 1350, 500, 1550, "tiles", "#d8d4cc"); floor(st, 0, 1950, 500, 2600, "stoneTiles", "#cfc9bd"); floor(st, 500, 0, 600, 2600, "stoneTiles", "#cfc9bd");
  ext(st, [0, 0], [500, 0], [WN(250, 240, 150, 70)], WHITE);
  ext(st, [0, 2600], [0, 0], [WS(2475), WN(2150, 180, 90, 120), WN(1750, 180), WS(1450), WN(1150, 180), WS(800), WN(225, 180)], WOOD);
  ext(st, [500, 2600], [0, 2600], [WS(250)], WHITE);
  // the walkway's east side: open to the deck (columns) north of the living room, a wall against it to the south
  ext(st, [500, 0], [600, 0], [], WHITE);
  for (const z of [15, 600, 1000, 1400, 1600, 2000, 2400, 2585]) column(st, 590, z, 25, WHITE);
  inn(st, [500, 0], [500, 1600], [D(225), D(800), D(1150)]); inn(st, [500, 1600], [500, 2600], [D(1750), D(2150)]);
  inn(st, [0, 450], [500, 450], [D(400)]); inn(st, [0, 650], [500, 650], [D(150)]); inn(st, [300, 650], [300, 950]); inn(st, [0, 950], [500, 950]);
  inn(st, [0, 1350], [500, 1350], [D(130)]); inn(st, [260, 1350], [260, 1550]); inn(st, [0, 1550], [500, 1550], [D(370)]);
  inn(st, [0, 1950], [500, 1950]); inn(st, [0, 2350], [500, 2350], [D(440)]);
  // master suite (0..500 × 0..450), closet (0..500 × 450..650), bath (0..300 × 650..950)
  along(st, "king-bed", "n", 13, 250); along(st, "nightstand", "n", 13, 100); along(st, "nightstand", "n", 13, 400); put(st, "bedroom-bench", 250, 300, "n"); along(st, "wall-tv", "s", 442, 120, { y: 160 }); along(st, "chest-of-drawers", "s", 442, 120);
  put(st, "rug", 250, 200, "n"); put(st, "table-lamp", 100, 40, "n", 100); put(st, "table-lamp", 400, 40, "n", 100); put(st, "ceiling-flush", 250, 225, "n", H);
  along(st, "closet-rail", "n", 457, 150); along(st, "chest-of-drawers", "w", 13, 590); along(st, "standing-mirror", "e", 492, 530); put(st, "ceiling-flush", 250, 550, "n", H);
  corner(st, "shower-stall", 13, 942, "sw"); along(st, "toilet", "e", 292, 720); along(st, "washbasin-pedestal", "e", 292, 860); along(st, "wall-mirror", "e", 292, 860, { y: 110 }); put(st, "ceiling-flush", 150, 800, "n", H);
  put(st, "houseplant", 350, 700, "n"); along(st, "bench", "s", 942, 400); along(st, "wall-shelves", "e", 492, 750, { y: 150 });
  // junior suite 1 (0..500 × 950..1350) with its bath (0..300 × 1350..1550)
  along(st, "double-bed", "w", 13, 1150); along(st, "nightstand", "w", 13, 1040); along(st, "nightstand", "w", 13, 1260); along(st, "wardrobe", "s", 1342, 380); put(st, "round-rug", 300, 1150, "n"); put(st, "ceiling-flush", 250, 1150, "n", H);
  corner(st, "shower-stall", 13, 1542, "sw"); along(st, "toilet", "e", 252, 1420); along(st, "washbasin-pedestal", "e", 252, 1500); along(st, "wall-mirror", "e", 252, 1500, { y: 110 }); put(st, "ceiling-flush", 130, 1450, "n", H);
  // bath of junior suite 2 (300..500 × 1350..1550) and junior suite 2 (0..500 × 1550..1950)
  corner(st, "shower-stall", 267, 1357, "nw"); along(st, "toilet", "n", 1357, 440); along(st, "washbasin-pedestal", "e", 492, 1500); along(st, "wall-mirror", "e", 492, 1500, { y: 110 }); put(st, "ceiling-flush", 400, 1450, "n", H);
  along(st, "double-bed", "w", 13, 1750); along(st, "nightstand", "w", 13, 1640); along(st, "nightstand", "w", 13, 1860); along(st, "wardrobe", "s", 1942, 150); along(st, "study-desk", "e", 492, 1870); put(st, "chair", 380, 1870, "w"); put(st, "ceiling-flush", 250, 1750, "n", H);
  // kitchen (0..500 × 1950..2350) and laundry (0..500 × 2350..2600)
  corner(st, "kitchen-corner-90", 13, 1957, "nw", UNIT); along(st, "kitchen-stove-60", "n", 1957, 138, UNIT); along(st, "kitchen-sink-80", "n", 1957, 208, UNIT); along(st, "kitchen-base-60", "n", 1957, 278, UNIT); along(st, "kitchen-fridge-70", "n", 1957, 343, UNIT);
  along(st, "kitchen-base-60", "w", 13, 2093, UNIT); along(st, "dishwasher", "w", 13, 2153); along(st, "kitchen-base-60", "w", 13, 2213, UNIT); for (const x of [138, 278]) along(st, "kitchen-wall-60", "n", 1957, x, { y: 145, ...MARBLE });
  put(st, "microwave", 278, 1985, "n", 93); put(st, "coffee-machine", 45, 2213, "w", 93); put(st, "kitchen-table", 250, 2200, "n"); put(st, "chair", 190, 2290, "s"); put(st, "chair", 310, 2290, "s"); put(st, "kitchen-bin", 470, 2000, "e"); put(st, "pendant-lamp", 250, 2200, "n", H);
  along(st, "washing-machine", "s", 2592, 60); along(st, "dryer", "s", 2592, 125); put(st, "drying-rack", 300, 2480, "n"); put(st, "laundry-basket", 460, 2560, "n"); along(st, "wall-shelves", "e", 492, 2420, { y: 150 }); put(st, "ceiling-flush", 250, 2475, "n", H);
  // the walkway
  for (const z of [200, 1000, 1800, 2300]) put(st, "ceiling-flush", 550, z, "n", H); put(st, "houseplant", 550, 60, "n"); put(st, "planter", 545, 2530, "n");
  for (const z of [700, 1500]) along(st, "wall-sconce", "w", 513, z, { y: 240 });
}

/** South block (x 0..1000, z 0..1000): the pergola veranda on the deck and the living room with the entrance. */
function southBlock(st) {
  floor(st, 0, 0, 1000, 350, "planks", "#b08a5a"); floor(st, 0, 350, 1000, 1000, "stoneTiles", "#e6e2da");
  ext(st, [0, 350], [1000, 350], [SL(500, 400, 260), SL(150, 200, 260)], WHITE);
  ext(st, [1000, 1000], [0, 1000], [DD(500, 180, { height: 260, colors: { leafColor: "#4a3426", frameColor: "#2b2e33" } }), WP(200, 240, 200, 40), WP(800, 240, 200, 40)], WHITE);
  ext(st, [0, 1000], [0, 350], [D(600, 100)], WHITE); ext(st, [1000, 350], [1000, 1000], [D(800, 100)], WHITE);
  ext(st, [0, 0], [0, 350], [], WHITE); ext(st, [1000, 0], [1000, 350], [], WHITE);
  for (const x of [15, 340, 660, 985]) column(st, x, 15, 25, WHITE);
  put(st, "pergola", 500, 175, "n"); put(st, "outdoor-sofa", 350, 240, "s"); put(st, "armchair-lounge", 150, 180, "w"); put(st, "coffee-table", 350, 80, "n"); put(st, "outdoor-dining-set", 750, 175, "n");
  for (const x of [60, 940]) put(st, "planter", x, 80, "n"); for (const x of [250, 750]) put(st, "pendant-lamp", x, 175, "n", 250);
  // living room (0..1000 × 350..1000)
  along(st, "wall-tv", "e", 992, 650, { y: 110 }); along(st, "tv-bench", "e", 992, 650); put(st, "sofa-three-seat", 600, 650, "w"); put(st, "armchair-lounge", 760, 480, "n"); put(st, "armchair-lounge", 760, 820, "s");
  put(st, "coffee-table", 740, 650, "n"); put(st, "rug", 720, 650, "n"); along(st, "bookshelf", "w", 13, 480); along(st, "bookshelf", "w", 13, 850); put(st, "floor-lamp", 940, 940, "n"); put(st, "houseplant", 60, 940, "n");
  put(st, "doormat", 500, 950, "n"); put(st, "coat-rack", 650, 950, "n"); put(st, "console-table", 330, 500, "n"); put(st, "floor-vase", 330, 500, "n", 80);
  lights(st, H, [[250, 500], [750, 500], [250, 850], [750, 850]]); for (const x of [380, 620]) along(st, "wall-lantern", "n", 1013, x, { y: 220 });
}

/** East wing (x 0..1100, z 0..2300): guest bedroom with bath and closet, stair hall, gourmet room, corridor, lavatory, storage, utility, garage. */
function eastWing(st) {
  floor(st, 0, 0, 1100, 2300, "stoneTiles", "#e6e2da");
  floor(st, 0, 0, 600, 550, "woodFloor", "#c9a579"); floor(st, 600, 0, 850, 250, "tiles", "#d8d4cc"); floor(st, 200, 1050, 450, 1300, "tiles", "#d8d4cc"); floor(st, 200, 1600, 1100, 2300, "concrete", "#b9b6ad");
  ext(st, [0, 0], [1100, 0], [WN(300, 180), WS(725), WS(975)], WHITE);
  ext(st, [1100, 0], [1100, 2300], [WS(150), WN(800, 240, 100, 120), WS(1200), WS(1450), WS(1950, 180, 60, 220)], WOOD);
  ext(st, [1100, 2300], [0, 2300], [GD(900, 260, 240), GD(600, 260, 240), WS(100)], WHITE);
  ext(st, [0, 1600], [0, 0], [D(1300, 100), SL(800, 300, 260), SL(275, 300, 260)], WHITE);
  ext(st, [12, 2300], [12, 1600], [D(2100, 100)], WHITE); // against the living room's east wall
  inn(st, [600, 0], [600, 550], [D(125), D(400)]); inn(st, [600, 250], [850, 250]); inn(st, [850, 0], [850, 550], [D(450)]);
  inn(st, [0, 550], [1100, 550], [D(350), D(900)]); inn(st, [0, 1050], [1100, 1050], [D(100), D(575)]);
  inn(st, [200, 1050], [200, 2300], [D(1175), D(1450)]); inn(st, [200, 1300], [700, 1300]); inn(st, [450, 1050], [450, 1300]); inn(st, [700, 1050], [700, 1600]);
  inn(st, [200, 1600], [1100, 1600], [D(900)]);
  // guest bedroom (0..600 × 0..550), bath (600..850 × 0..250), closet (600..850 × 250..550), stair hall (850..1100 × 0..550)
  along(st, "double-bed", "n", 13, 300); along(st, "nightstand", "n", 13, 170); along(st, "nightstand", "n", 13, 430); along(st, "study-desk", "s", 542, 120); put(st, "chair", 120, 440, "n"); put(st, "round-rug", 300, 350, "n"); put(st, "ceiling-flush", 300, 275, "n", H);
  corner(st, "shower-stall", 842, 13, "ne"); along(st, "toilet", "s", 242, 650); along(st, "washbasin-pedestal", "s", 242, 780); along(st, "wall-mirror", "s", 242, 780, { y: 110 }); put(st, "ceiling-flush", 725, 125, "n", H);
  along(st, "wardrobe", "n", 257, 725); along(st, "shoe-rack", "s", 537, 680); put(st, "ceiling-flush", 725, 400, "n", H);
  stairs(st, [1040, 60], 270, { shape: "U", width: 80, rise: CELLAR, turn: "right", rail: "both", railStyle: "metal", material: "concrete", tint: "#b5b2aa" });
  rail(st, [[920, 313], [1080, 313]], { height: 100, style: "metal" }); put(st, "houseplant", 1040, 500, "n"); put(st, "ceiling-flush", 975, 400, "n", H);
  // gourmet room (0..1100 × 550..1050): counter along the east wall, big table
  along(st, "outdoor-kitchen", "e", 1092, 830); along(st, "kitchen-fridge", "e", 1092, 620); along(st, "sideboard", "n", 557, 600);
  put(st, "kitchen-table", 500, 800, "n"); for (const x of [400, 500, 600]) { put(st, "chair", x, 707, "n"); put(st, "chair", x, 893, "s"); } put(st, "chair", 340, 800, "w"); put(st, "chair", 660, 800, "e");
  along(st, "wine-rack", "n", 557, 100); along(st, "wine-rack", "n", 557, 160); put(st, "houseplant", 300, 1000, "n"); for (const x of [420, 580]) put(st, "pendant-lamp", x, 800, "n", H); put(st, "ceiling-fan", 900, 800, "n", H);
  // corridor (0..200 × 1050..2300), lavatory (200..450 × 1050..1300), storage (200..700 × 1300..1600), utility (700..1100 × 1050..1600)
  along(st, "picture", "e", 192, 1700, { y: 150 }); put(st, "houseplant", 100, 2240, "n"); along(st, "console-table", "e", 192, 2000); lights(st, H, [[100, 1200], [100, 1700], [100, 2200]], "ceiling-flush");
  along(st, "toilet", "e", 442, 1120); along(st, "washbasin-pedestal", "s", 1292, 400); along(st, "wall-mirror", "s", 1292, 400, { y: 110 }); put(st, "ceiling-flush", 325, 1175, "n", H);
  along(st, "toilet", "e", 692, 1120); along(st, "washbasin-pedestal", "s", 1292, 650); along(st, "wall-mirror", "s", 1292, 650, { y: 110 }); put(st, "ceiling-flush", 575, 1175, "n", H);
  along(st, "steel-shelf", "s", 1592, 350); along(st, "steel-shelf", "s", 1592, 550); put(st, "cardboard-boxes", 300, 1380, "n"); put(st, "ceiling-flush", 450, 1450, "n", H);
  along(st, "water-heater", "n", 1057, 760); along(st, "breaker-panel", "n", 1057, 900, { y: 150 }); put(st, "water-tank", 1000, 1350, "n"); put(st, "ac-outdoor-unit", 780, 1500, "n"); put(st, "ceiling-flush", 900, 1325, "n", H);
  // garage (200..1100 × 1600..2300)
  put(st, "sedan", 600, 1950, 90); put(st, "suv", 900, 1950, 90); along(st, "tool-chest", "n", 1607, 300); along(st, "steel-shelf", "n", 1607, 500); put(st, "bicycle", 300, 2100, 90);
  for (const x of [600, 900]) put(st, "downlight", x, 1950, "n", H);
  for (const z of [275, 800]) along(st, "wall-sconce", "w", -13, z, { y: 240 }); along(st, "entrance-canopy", "n", 2313, 750);
}

/** Wine cellar under the stair hall and the guest closet (x 600..1100, z 0..550). */
function cellar(st) {
  floor(st, 600, 0, 1100, 550, "concrete", "#b5b2aa");
  const C = { outerMaterial: "concrete", tint: "#e3e0d8", material: "concrete" };
  ext(st, [600, 0], [1100, 0], [], C); ext(st, [1100, 0], [1100, 550], [], C); ext(st, [1100, 550], [600, 550], [], C); ext(st, [600, 550], [600, 0], [], C);
  stairs(st, [1040, 60], 270, { shape: "U", width: 80, rise: CELLAR, turn: "right", rail: "both", railStyle: "metal", material: "concrete", tint: "#b5b2aa" });
  for (const z of [100, 160, 220, 280, 340, 400, 460]) along(st, "wine-rack", "w", 613, z);
  for (const x of [700, 760, 820]) along(st, "wine-rack", "s", 537, x);
  put(st, "wooden-barrel", 900, 450, "n"); put(st, "wooden-barrel", 980, 480, "n"); put(st, "round-table", 760, 380, "n"); put(st, "stool", 760, 300, "n"); put(st, "stool", 760, 460, "s"); put(st, "candles", 760, 380, "n", 76);
  lights(st, CELLAR, [[700, 150], [700, 400], [950, 350]], "hanging-bulb");
}

function outdoors(p) {
  terrain(p, 4200, 3800, 80, () => 0);
  // the deck with the lap pool between the wings
  for (const r of [rect(-750, -1300, 250, -1000), rect(-750, -100, 250, 300), rect(-750, -1000, -400, -100), rect(-100, -1000, 250, -100)]) deck(p, r, { height: 12 });
  pool(p, rect(-400, -1000, -100, -100), { depth: 150 });
  for (const z of [-900, -700, -500]) lot(p, "lounger", 50, z, "e", 12); lot(p, "side-table", 50, -800, "n", 12); lot(p, "beach-umbrella", 50, -600, "n", 12);
  lot(p, "outdoor-dining-set", -550, 0, "n", 12); lot(p, "fire-pit", -200, 100, "n", 12); for (const [x, z] of [[-700, -1250], [200, -1250], [-700, 250], [200, 250]]) lot(p, "planter", x, z, "n", 12);
  for (const z of [-1200, -600, 0]) { lot(p, "garden-bollard", -720, z, "n", 12); lot(p, "garden-bollard", 220, z, "n", 12); }
  // garden strips around the house, the front path, the drive to the garage, the street
  patch(p, rect(-1900, -1800, 1900, -1300), "gravel", "#d6cbb3"); patch(p, rect(-1900, -1300, -1350, 1300), "gravel", "#d6cbb3");
  for (const [x, z] of [[-1000, -1500], [-300, -1500], [500, -1500], [1100, -1500]]) lot(p, "bush", x, z); for (const x of [-1750, 0, 1750]) lot(p, "ipe-tree", x, -1650);
  for (const z of [-900, -300, 300, 900]) lot(p, "bush", -1550, z); lot(p, "palm-tree", -1750, -1100); lot(p, "palm-tree", -1750, 1100); for (const z of [-700, 0, 700]) lot(p, "bush", 1600, z); lot(p, "palm-tree", 1700, 500);
  path(p, rect(-350, 1300, 50, 1700), "stone", "#d9d3c6", 4); for (const [x, z] of [[-550, 1450], [250, 1450]]) lot(p, "flower-bed", x, z); lot(p, "garden-bollard", -400, 1550); lot(p, "garden-bollard", 100, 1550);
  path(p, rect(450, 1000, 1350, 1700), "paving", "#9a968e", 4); lot(p, "hatchback", 1100, 1400, 90, 4);
  path(p, rect(-2100, 1700, 2100, 1800), "paving", "#bfbab0", 6); path(p, rect(-2100, 1800, 2100, 2000), "asphalt", null, 2);
  lot(p, "mailbox", 100, 1660, "n"); lot(p, "lamp", -1800, 1750); lot(p, "lamp", 1800, 1750); lot(p, "trash-bin", 1450, 1650);
  siteWall(p, [[-1950, -1850], [1950, -1850], [1950, 1700], [-1950, 1700], [-1950, -1850]], { height: 220, material: "plaster", tint: "#f1efe8", gates: [gate(3900 + 3550 + 1950 + 150 - 55, "single"), gate(3900 + 3550 + 1950 - 900 - 150, "sliding")] });
  fence(p, [[-1900, -1800], [1900, -1800]], { style: "hedge", height: 120 });
}

export function mansionCourtyard(p, b, g) {
  b.at = [250, -1300];
  g.elevation = LEVEL; g.height = H;
  eastWing(g);
  const down = freshStorey(null, "basement"); down.elevation = LEVEL - CELLAR; down.height = CELLAR; down.foundation.enabled = true; b.storeys.unshift(down); cellar(down);
  b.roof = { ...b.roof, ...ROOF };
  const west = building(p, [-1350, -1300], { roof: ROOF, height: H }); west.storeys[0].elevation = LEVEL; westWing(west.storeys[0]);
  const south = building(p, [-750, 300], { roof: ROOF, height: H }); south.storeys[0].elevation = LEVEL; southBlock(south.storeys[0]);
  outdoors(p);
  p.sun = { ...p.sun, city: "saopaulo", latitude: -23.5, useTime: true, time: 15, month: 11 };
}
