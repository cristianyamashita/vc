// A medium house on three levels: a cellar with laundry, workshop, wine
// cellar and a small cinema; the ground floor with office, living, hall,
// lavatory and an open kitchen-dining room; and an attic under a steep
// gable roof with two bedrooms, a study and a bath. The two U stairs are
// stacked in the hall (the upper one open underneath).
import { freshStorey } from "../schema.js";
import { floor, ext, inn, D, PD, SL, WN, WS, along, corner, put, lights, stairs, rail, lot, path, patch, rect, fence, gate, terrain } from "./kit.js";

const GROUND = 20, H0 = 300, H1 = 250, H2 = 170; // the ground floor sits 20 cm above the lawn
const BRICK = { outerMaterial: "bricksRed", outerTint: "#b87456", tint: "#f1ece2" };
const CELLAR = { outerMaterial: "concrete", tint: "#e3e0d8", material: "concrete" };
const UNIT = { material: "woodLight" };
const WOOD_DOOR = { colors: { leafColor: "#3f5a46", frameColor: "#2b2e33" } };
const KNEE = 110; // cm from the eaves where the attic partitions drop to the knee-wall height

function groundFloor(st) {
  floor(st, 0, 0, 1200, 900, "woodFloor", "#b58a5a");
  floor(st, 450, 0, 750, 900, "stoneTiles", "#cfc9bd");
  floor(st, 750, 0, 1200, 450, "tiles", "#d8d4cc");
  ext(st, [0, 0], [1200, 0], [WN(225, 180), D(600, 100, { height: 220, ...WOOD_DOOR }), WN(997, 180, 80, 130)], BRICK);
  ext(st, [1200, 0], [1200, 900], [WN(500, 180), WN(750, 120)], BRICK);
  ext(st, [1200, 900], [0, 900], [SL(975, 240, 230), D(500, 90, WOOD_DOOR), SL(225, 240, 230)], BRICK);
  ext(st, [0, 900], [0, 0], [WN(750, 150), WN(500, 180), WS(175, 60, 60, 160)], BRICK);
  inn(st, [450, 0], [450, 900], [D(175), PD(600, 160)]); // office and living | hall
  inn(st, [0, 350], [450, 350]);
  inn(st, [750, 0], [750, 900], [D(60), PD(560, 160)]); // hall | lavatory, kitchen-dining
  inn(st, [750, 200], [900, 200]); inn(st, [900, 0], [900, 200]); // lavatory
  // stacked stairs: the upper flight to the attic is open underneath, the cellar flight comes up below it
  stairs(st, [692, 150], 270, { shape: "U", width: 95, rise: H0, turn: "right", rail: "both", railStyle: "wood", base: "open", tint: "#b58a5a" });
  rail(st, [[550, 474], [750, 474]], { height: 100, style: "wood" });
  // ---- office / guest room (0..450 × 0..350)
  along(st, "desk", "n", 13, 225); put(st, "office-chair", 225, 140, "s"); put(st, "laptop", 225, 60, "n", 75); along(st, "sofa-bed", "w", 13, 220);
  along(st, "bookshelf", "s", 342, 300); along(st, "filing-cabinet", "n", 13, 380); put(st, "houseplant", 410, 300, "n"); put(st, "round-rug", 260, 220, "n");
  // ---- living (0..450 × 350..900)
  along(st, "wall-tv", "n", 357, 250, { y: 110 }); along(st, "tv-bench", "n", 357, 250); put(st, "sofa-three-seat", 230, 600, "s"); put(st, "coffee-table", 250, 480, "n");
  put(st, "armchair", 80, 480, "w"); put(st, "rug", 250, 540, "n"); along(st, "bookshelf", "w", 13, 800); put(st, "floor-lamp", 60, 650, "n"); put(st, "houseplant", 400, 860, "n");
  // ---- hall (450..750 × 0..900)
  put(st, "doormat", 600, 60, "n"); put(st, "coat-rack", 700, 860, "n"); along(st, "console-table", "w", 457, 750); along(st, "picture", "w", 457, 750, { y: 150 }); along(st, "shoe-rack", "w", 457, 60);
  // ---- lavatory (750..900 × 0..200)
  along(st, "toilet", "s", 192, 820); along(st, "washbasin-pedestal", "n", 13, 865); along(st, "wall-mirror", "n", 13, 865, { y: 110 });
  // ---- kitchen and dining (750..1200 × 200..900), units along the north and east walls
  corner(st, "kitchen-corner-90", 1187, 13, "ne", UNIT); along(st, "kitchen-stove-60", "n", 13, 1067, UNIT); along(st, "kitchen-sink-80", "n", 13, 997, UNIT);
  along(st, "kitchen-fridge-70", "e", 1187, 140, UNIT); along(st, "kitchen-base-60", "e", 1187, 205, UNIT); along(st, "dishwasher", "e", 1187, 265); along(st, "kitchen-base-60", "e", 1187, 325, UNIT);
  along(st, "kitchen-wall-60", "n", 13, 1067, { y: 145, ...UNIT }); along(st, "kitchen-wall-60", "e", 1187, 205, { y: 145, ...UNIT }); along(st, "kitchen-wall-60", "e", 1187, 325, { y: 145, ...UNIT });
  put(st, "microwave", 1155, 205, "e", 93); put(st, "coffee-machine", 1155, 325, "e", 93); put(st, "kettle", 920, 40, "n", 93); put(st, "kitchen-bin", 925, 60, "n");
  put(st, "dining-table", 975, 640, "n");
  for (const x of [925, 975, 1025]) { put(st, "dining-chair", x, 567, "n"); put(st, "dining-chair", x, 713, "s"); }
  put(st, "sideboard", 1160, 720, "e"); put(st, "houseplant", 1160, 860, "n"); put(st, "houseplant", 790, 870, "n");
  for (const x of [935, 1015]) put(st, "pendant-lamp", x, 640, "n", H0);
  lights(st, H0, [[225, 175], [150, 500], [350, 500], [150, 780], [350, 780], [600, 250], [600, 600], [600, 800], [1000, 150], [1100, 350], [900, 350]]);
  put(st, "ceiling-flush", 825, 100, "n", H0);
  along(st, "wall-lantern", "s", -13, 530, { y: 220 }); along(st, "wall-lantern", "s", -13, 670, { y: 220 }); along(st, "wall-sconce", "n", 913, 400, { y: 230 }); along(st, "wall-sconce", "n", 913, 1100, { y: 230 });
}

function cellar(st) {
  floor(st, 0, 0, 1200, 900, "concrete", "#b5b2aa");
  floor(st, 750, 0, 1200, 600, "tiles", "#d8d4cc");
  floor(st, 750, 600, 1200, 900, "carpet", "#6d5a4a");
  for (const [a, b] of [[[0, 0], [1200, 0]], [[1200, 0], [1200, 900]], [[1200, 900], [0, 900]], [[0, 900], [0, 0]]]) ext(st, a, b, [], CELLAR);
  inn(st, [450, 0], [450, 900], [D(75), D(600)], { tint: "#e3e0d8" }); // workshop, wine cellar | hall
  inn(st, [0, 450], [450, 450], [], { tint: "#e3e0d8" });
  inn(st, [750, 0], [750, 900], [D(530), D(750)], { tint: "#e3e0d8" }); // hall | laundry, cinema
  inn(st, [750, 600], [1200, 600], [], { tint: "#e3e0d8" });
  stairs(st, [692, 150], 270, { shape: "U", width: 95, rise: H1, turn: "right", rail: "both", railStyle: "metal", material: "concrete", tint: "#b5b2aa" });
  // ---- laundry and utility (750..1200 × 0..600)
  along(st, "washing-machine", "n", 13, 800); along(st, "dryer", "n", 13, 865); put(st, "water-heater", 1150, 50, "n"); along(st, "steel-shelf", "e", 1187, 300);
  put(st, "drying-rack", 950, 300, "n"); put(st, "laundry-basket", 940, 60, "n"); along(st, "chest-freezer", "s", 592, 1100); put(st, "ironing-board", 1050, 450, "n");
  along(st, "breaker-panel", "n", 13, 1000, { y: 150 }); put(st, "cardboard-boxes", 900, 560, "n"); put(st, "bucket", 780, 250, "n");
  // ---- small cinema (750..1200 × 600..900)
  along(st, "wall-tv", "n", 607, 975, { y: 110 }); along(st, "tv-bench", "n", 607, 975); put(st, "game-console", 975, 625, "n", 51);
  along(st, "sofa-three-seat", "s", 892, 975); put(st, "rug", 975, 740, "n"); put(st, "mini-fridge", 1160, 650, "e"); put(st, "bar-cart", 1150, 850, "n"); put(st, "floor-cushion", 870, 700, "n");
  put(st, "floor-lamp", 790, 870, "n"); put(st, "neon-sign", 1190, 750, "e", 170);
  // ---- workshop (0..450 × 0..450)
  along(st, "workbench", "n", 13, 225); along(st, "tool-board", "n", 13, 225, { y: 100 }); along(st, "steel-shelf", "w", 13, 250); put(st, "stool", 225, 150, "s");
  put(st, "tool-chest", 100, 380, "n"); along(st, "ladder", "s", 442, 200); put(st, "air-compressor", 360, 400, "n"); put(st, "bricks", 370, 250, "n");
  // ---- wine cellar (0..450 × 450..900)
  for (const z of [550, 610, 670, 730, 790, 850]) along(st, "wine-rack", "w", 13, z);
  for (const x of [100, 160, 220, 280]) along(st, "wine-rack", "s", 887, x);
  put(st, "wooden-barrel", 330, 600, "n"); put(st, "wooden-barrel", 330, 700, "n"); put(st, "wooden-barrel", 405, 790, "n");
  put(st, "round-table", 200, 700, "n"); put(st, "stool", 200, 620, "n"); put(st, "stool", 200, 780, "s"); put(st, "candles", 200, 700, "n", 76);
  // ---- hall
  put(st, "cardboard-boxes", 500, 850, "n");
  lights(st, H1, [[225, 225], [225, 675], [600, 75], [600, 700], [975, 150], [975, 450], [975, 750], [1100, 300]], "hanging-bulb");
}

function attic(st) {
  floor(st, 0, 0, 1200, 900, "woodFloor", "#c9a579");
  floor(st, 550, 550, 750, 900, "tiles", "#d8d4cc");
  // knee walls along the eaves, gable walls at the ends (the roof closes the triangles)
  ext(st, [0, 0], [1200, 0], [WS(225, 80, 80, 60), WS(975, 80, 80, 60)], BRICK);
  ext(st, [1200, 0], [1200, 900], [WS(150, 70, 80, 60), WS(750, 70, 80, 60)], BRICK);
  ext(st, [1200, 900], [0, 900], [WS(975, 80, 80, 60), WS(225, 80, 80, 60)], BRICK);
  ext(st, [0, 900], [0, 0], [WS(600, 70, 80, 60), WS(450, 70, 80, 60)], BRICK);
  // partitions: full height in the middle, knee-wall height near the eaves
  for (const x of [450, 750]) {
    inn(st, [x, 0], [x, KNEE], [], { height: H2 });
    inn(st, [x, KNEE], [x, 900 - KNEE], x === 450 ? [D(165), D(700)] : [D(165)], { height: 250 });
    inn(st, [x, 900 - KNEE], [x, 900], [], { height: H2 });
  }
  inn(st, [0, 500], [450, 500], [], { height: 250 });
  inn(st, [550, 550], [750, 550], [], { height: 250 });
  inn(st, [550, 550], [550, 900 - KNEE], [D(700)], { height: 250 }); inn(st, [550, 900 - KNEE], [550, 900], [], { height: H2 });
  rail(st, [[550, 474], [750, 474]], { height: 100, style: "wood" });
  rail(st, [[550, 150], [550, 474]], { height: 100, style: "wood" });
  // ---- bedroom A (0..450 × 0..500)
  along(st, "double-bed", "w", 13, 300); along(st, "nightstand", "w", 13, 190); along(st, "nightstand", "w", 13, 410); along(st, "chest-of-drawers", "n", 13, 300);
  put(st, "rug", 300, 300, "e"); put(st, "table-lamp", 40, 190, "n", 100); put(st, "houseplant", 400, 440, "n");
  // ---- study (0..450 × 500..900)
  along(st, "desk", "w", 13, 700); put(st, "office-chair", 140, 700, "e"); put(st, "laptop", 60, 700, "w", 75); along(st, "bookshelf", "n", 507, 250);
  put(st, "armchair", 300, 820, "s"); put(st, "floor-lamp", 400, 820, "n"); put(st, "round-rug", 250, 700, "n");
  // ---- bedroom B (750..1200 × 0..900)
  along(st, "king-bed", "e", 1187, 450); along(st, "nightstand", "e", 1187, 300); along(st, "nightstand", "e", 1187, 600);
  along(st, "chest-of-drawers", "n", 13, 950); along(st, "chest-of-drawers", "n", 13, 1050); put(st, "standing-mirror", 1150, 150, "e");
  put(st, "armchair-lounge", 850, 760, "w"); put(st, "side-table", 850, 680, "n"); along(st, "study-desk", "s", 887, 1000); put(st, "chair", 1000, 760, "n");
  put(st, "rug", 980, 450, "n"); put(st, "table-lamp", 1160, 300, "n", 100); put(st, "houseplant", 790, 60, "n");
  // ---- bath (550..750 × 550..900) and landing
  corner(st, "shower-stall", 742, 557, "ne"); along(st, "toilet", "e", 742, 720); along(st, "washbasin-pedestal", "w", 557, 820); along(st, "wall-mirror", "w", 557, 820, { y: 110 });
  put(st, "bath-mat", 660, 820, "n"); put(st, "houseplant", 480, 60, "n"); along(st, "picture", "n", 13, 600, { y: 140 });
  lights(st, 250, [[225, 250], [225, 700], [975, 250], [975, 700], [650, 720], [600, 75], [500, 600]], "ceiling-flush");
}

function outdoors(p) {
  terrain(p, 3000, 2600, 60, (x, z) => (z > 700 ? -12 * Math.min(1, (z - 700) / 400) : 0) + 4 * Math.sin(x / 300) * Math.sin(z / 260));
  // street along the north, a path to the front door, the terrace behind the living and dining rooms
  path(p, rect(-1500, -1300, 1500, -1000), "asphalt", null, 2);
  path(p, rect(-1500, -1000, 1500, -850), "paving", "#bfbab0", 6);
  path(p, rect(-60, -850, 60, -450), "stone", "#c9c0ae", 4);
  path(p, rect(640, -850, 960, -200), "gravel", "#c2b59b", 3);
  lot(p, "pergola", 800, -350); lot(p, "hatchback", 800, -350, 90);
  path(p, rect(-560, 450, 560, 800), "stoneTiles", "#cfc9bd");
  lot(p, "outdoor-dining-set", 150, 630); lot(p, "bbq-grill", 450, 500, "n"); lot(p, "lounger", -400, 620, "n"); lot(p, "lounger", -200, 620, "n");
  for (const x of [-520, 520]) lot(p, "planter", x, 480);
  for (const x of [-300, 0, 300]) lot(p, "garden-bollard", x, 820);
  // garden: lawn, flower beds, a shed, old trees, picket fence with a gate at the path
  fence(p, [[-1400, -850], [-1400, 1250], [1400, 1250], [1400, -850], [-1400, -850]], { style: "picket", height: 100, gates: [gate(2100 + 2800 + 1400 - 55, "single", "#f0ede6"), gate(2100 + 2800 + 1400 - 770 - 300, "sliding", "#f0ede6")] });
  lot(p, "garden-shed", -1150, 1050, "s"); lot(p, "bike-rack", -1000, -700, "n"); lot(p, "mailbox", 90, -820, "n"); lot(p, "trash-bin", -150, -800);
  for (const [prop, x, z] of [["maple-tree", -1100, 300], ["birch-tree", 1100, 900], ["cherry-tree", 1050, -600], ["tree", -1000, -500], ["bush", -700, -700], ["bush", 700, -750], ["bush", 1200, 300], ["bush", -1250, 700]]) lot(p, prop, x, z);
  for (const [x, z] of [[-250, -650], [250, -650], [-350, -550], [350, -550]]) lot(p, "flower-bed", x, z);
  patch(p, rect(800, 600, 1300, 1100), "dirt", "#8f7a5c");
  for (const [x, z] of [[900, 700], [1100, 700], [900, 900], [1100, 900], [900, 1050], [1100, 1050]]) lot(p, "flower-bed", x, z);
  lot(p, "bird-bath", -800, 900); lot(p, "wheelbarrow", 1100, 1180, "e"); lot(p, "clothesline", -850, 600, "e"); lot(p, "dog-house", 1250, 1150, "w");
  for (const z of [-700, -500]) { lot(p, "garden-spike", -120, z); lot(p, "garden-spike", 120, z); }
  lot(p, "lamp", 1450, -950); lot(p, "lamp", -1450, -950); lot(p, "street-sign", 1300, -900, 180);
}

export function cellarAttic(p, b, g) {
  b.at = [-600, -450];
  g.elevation = GROUND;
  g.height = H0;
  groundFloor(g);
  const down = freshStorey(null, "basement");
  down.elevation = GROUND - H1; down.height = H1; down.name = ""; down.foundation.enabled = true;
  b.storeys.unshift(down);
  cellar(down);
  const up = freshStorey(g, "attic");
  up.height = H2;
  b.storeys.push(up);
  attic(up);
  b.roof = { ...b.roof, type: "gable", pitch: 38, overhang: 50, ridgeAxis: "x", material: "roofTiles", tint: "#6f4538", ceiling: false };
  outdoors(p);
  p.sun = { ...p.sun, city: "milan", latitude: 45.5, useTime: true, time: 15, month: 9 };
}
