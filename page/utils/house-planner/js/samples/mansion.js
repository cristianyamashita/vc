// Mansion: a 32 × 14 m block on three floors plus a roof terrace, a four-car
// garage and a big lot. Ground floor: library, music room, double-height
// entrance hall with the grand stairs, kitchen with island, pantry, laundry,
// lavatory, service hall, formal living with fireplace, dining for eight,
// winter-garden gallery, family room and games room. First floor: master
// suite with closet and bath, four suites with baths, gym, family lounge,
// balconies. Second floor: home cinema, study, three guest suites, kids'
// playroom, office, bar lounge. Roof: pool, pergola, outdoor kitchen. Lot:
// forecourt with fountain, main pool with deck, kids' pool, lap pool,
// jacuzzi, gourmet pavilion, playground, football lawn.
import { freshStorey } from "../schema.js";
import { floor, floorExcept, ext, inn, column, D, DD, PD, AR, SL, GD, WN, WS, WP, along, corner, put, lights, stairs, rail, lot, path, deck, pool, pond, patch, rect, fence, siteWall, gate, terrain } from "./kit.js";

const H0 = 350, H1 = 320, H2 = 320;
const W = 3200, DEPTH = 1400;
const CREAM = { outerMaterial: "plaster", outerTint: "#ece6d8", tint: "#f5f1e8" };
const STONE = { outerMaterial: "stone", outerTint: "#b9b0a0", tint: "#f5f1e8" };
const DARK = { material: "woodDark" }, MARBLE = { material: "marble" };
const WOOD_DOOR = { colors: { leafColor: "#4a3426", frameColor: "#2b2e33" } };
const STAIR = { shape: "U", width: 140, turn: "left", rail: "both", railStyle: "metal", material: "marble", tint: "#e8e2d6" };
const STAIR_AT = [1630, 150]; // the grand stairs in the hall, stacked on every floor

/** Mirror helpers for the east wing: x' = x0 + x1 - x, sides swap. */
const mirror = (x0, x1, on) => ({ x: (x) => (on ? x0 + x1 - x : x), s: (side) => (on ? { e: "w", w: "e", n: "n", s: "s", ne: "nw", nw: "ne", se: "sw", sw: "se" }[side] : side) });

/** A suite in the north band (x0..x1 × 0..600) with its bath in the corner by the corridor side. */
function northSuite(st, x0, x1, east, wardrobeSouth = true) {
  const m = mirror(x0, x1, east);
  const bx0 = x0, bx1 = x0 + 250; // bath x range (before mirroring)
  inn(st, [m.x(bx1), 0], [m.x(bx1), 300]); inn(st, [m.x(bx0), 300], [m.x(bx1), 300], [D(m.x(bx0 + 150))]);
  // bed against the far wall, nightstands, wardrobe, armchair
  along(st, "double-bed", m.s("e"), m.x(x1 - 8), 420); along(st, "nightstand", m.s("e"), m.x(x1 - 8), 300); along(st, "nightstand", m.s("e"), m.x(x1 - 8), 540);
  if (wardrobeSouth) along(st, "wardrobe", "s", 592, m.x(x0 + 150));
  put(st, "armchair", m.x(x0 + 60), 430, m.s("w")); put(st, "rug", m.x(x0 + 310), 420, "n"); put(st, "table-lamp", m.x(x1 - 30), 300, "n", 100);
  put(st, "ceiling-flush", m.x(x0 + 300), 450, "n", H1);
  // bath: shower in the outer corner, toilet and basin
  corner(st, "shower-stall", m.x(bx0 + 7), 13, m.s("nw")); along(st, "toilet", m.s("e"), m.x(bx1 - 8), 150); along(st, "washbasin-pedestal", m.s("w"), m.x(bx0 + 7), 200);
  along(st, "wall-mirror", m.s("w"), m.x(bx0 + 7), 200, { y: 110 }); put(st, "ceiling-flush", m.x(bx0 + 125), 220, "n", H1);
}
/** A suite in the south band (x0..x1 × 720..1400) with its bath in the corner by the corridor side. */
function southSuite(st, x0, x1, east) {
  const m = mirror(x0, x1, east);
  const bx0 = x0, bx1 = x0 + 250;
  inn(st, [m.x(bx1), 1100], [m.x(bx1), 1400]); inn(st, [m.x(bx0), 1100], [m.x(bx1), 1100], [D(m.x(bx0 + 150))]);
  along(st, "double-bed", m.s("e"), m.x(x1 - 8), 950); along(st, "nightstand", m.s("e"), m.x(x1 - 8), 830); along(st, "nightstand", m.s("e"), m.x(x1 - 8), 1070);
  along(st, "wardrobe", "n", 727, m.x(x0 + 150)); put(st, "armchair", m.x(x0 + 60), 900, m.s("w")); put(st, "rug", m.x(x0 + 310), 950, "n");
  put(st, "table-lamp", m.x(x1 - 30), 830, "n", 100); put(st, "ceiling-flush", m.x(x0 + 300), 950, "n", H1);
  corner(st, "shower-stall", m.x(bx0 + 7), 1392, m.s("sw")); along(st, "toilet", m.s("e"), m.x(bx1 - 8), 1250); along(st, "washbasin-pedestal", m.s("w"), m.x(bx0 + 7), 1200);
  along(st, "wall-mirror", m.s("w"), m.x(bx0 + 7), 1200, { y: 110 }); put(st, "ceiling-flush", m.x(bx0 + 125), 1250, "n", H1);
}

function groundFloor(st) {
  floorExcept(st, 0, 0, W, DEPTH, "marble", "#e8e2d6", [[2000, 0, 3200, 600]]);
  floor(st, 2000, 0, 3200, 600, "tiles", "#d8d4cc");
  floor(st, 0, 0, 900, 600, "woodFloor", "#8a5a3a"); floor(st, 900, 0, 1400, 600, "woodFloor", "#8a5a3a");
  floor(st, 2800, 600, 3200, 1400, "carpet", "#5a4a3c");
  // ---- exterior
  ext(st, [0, 0], [W, 0], [WN(200, 150, 170, 70), WN(450, 150, 170, 70), WN(700, 150, 170, 70), WN(1000, 120, 170, 70), WN(1300, 120, 170, 70), WN(1500, 150, 220, 40), DD(1700, 180, { height: 260, ...WOOD_DOOR }), WN(1900, 150, 220, 40), WN(2267, 120, 100, 120), WN(2457, 120, 100, 120), WS(2750), WS(3050)], STONE);
  ext(st, [W, 0], [W, DEPTH], [WS(150), D(450, 100, WOOD_DOOR), WN(800, 180, 170, 70), WN(1200, 180, 170, 70)], CREAM);
  ext(st, [W, DEPTH], [0, DEPTH], [SL(3000, 200, 260), WP(2700, 150, 220, 30), SL(2400, 300, 260), WP(2100, 200, 220, 30), SL(1850, 240, 260), SL(1550, 240, 260), SL(1150, 240, 260), WP(750, 200, 220, 30), SL(450, 300, 260), WP(150, 200, 220, 30)], CREAM);
  ext(st, [0, DEPTH], [0, 0], [WP(1200, 200, 220, 30), WP(800, 200, 220, 30), WN(300, 180, 170, 70)], CREAM);
  // ---- interior
  inn(st, [900, 0], [900, 600], [D(500, 90, WOOD_DOOR)]); // library | music room
  inn(st, [1400, 0], [1400, 600], [D(300, 90, WOOD_DOOR)]); // music | hall
  inn(st, [2000, 0], [2000, 600], [D(300, 90, WOOD_DOOR)]); // hall | kitchen
  inn(st, [2600, 0], [2600, 600], [D(150, 90, WOOD_DOOR)]); // kitchen | pantry, lavatory
  inn(st, [2900, 0], [2900, 300], [D(150, 90, WOOD_DOOR)]); inn(st, [2800, 300], [2800, 600]);
  inn(st, [2600, 300], [W, 300], [D(3050, 90, WOOD_DOOR)]);
  inn(st, [0, 600], [1400, 600], [D(450, 90, WOOD_DOOR)]); // library, music | living, dining
  inn(st, [1400, 600], [2000, 600], [AR(1700, 300, 300)]); // hall | gallery
  inn(st, [2000, 600], [W, 600], [D(2300, 90, WOOD_DOOR), D(2700, 90, WOOD_DOOR), D(3000, 90, WOOD_DOOR)]);
  inn(st, [900, 600], [900, DEPTH], [PD(1000, 200, 260)]); inn(st, [1400, 600], [1400, DEPTH], [PD(1000, 200, 260)]);
  inn(st, [2000, 600], [2000, DEPTH], [PD(1000, 200, 260)]); inn(st, [2800, 600], [2800, DEPTH], [PD(1000, 160, 240)]);
  stairs(st, STAIR_AT, 270, { ...STAIR, rise: H0 });
  // ---- library (0..900 × 0..600)
  for (const z of [150, 300, 450]) along(st, "bookshelf", "w", 13, z);
  for (const x of [150, 300, 600, 750]) along(st, "bookshelf", "s", 592, x);
  put(st, "desk", 600, 300, "e"); put(st, "office-chair", 510, 300, "w"); put(st, "laptop", 610, 300, "e", 75); put(st, "desk-lamp", 620, 230, "e", 75);
  put(st, "armchair-lounge", 250, 230, "n"); put(st, "armchair-lounge", 250, 390, "s"); put(st, "side-table", 320, 310, "n"); put(st, "round-rug", 250, 310, "n"); put(st, "floor-lamp", 150, 310, "n");
  put(st, "houseplant", 850, 60, "n"); put(st, "chandelier", 450, 300, "n", H0);
  // ---- music room (900..1400 × 0..600)
  along(st, "upright-piano", "w", 907, 300); put(st, "stool", 1080, 300, "e"); put(st, "armchair", 1250, 200, "e"); put(st, "armchair", 1250, 400, "e"); put(st, "side-table", 1300, 300, "n");
  put(st, "round-rug", 1150, 300, "n"); along(st, "cube-shelf", "s", 592, 1100); along(st, "glass-cabinet", "n", 13, 1150); put(st, "chandelier", 1150, 300, "n", H0); put(st, "houseplant", 1360, 560, "n");
  // ---- entrance hall (1400..2000 × 0..600)
  put(st, "doormat", 1700, 50, "n"); along(st, "console-table", "w", 1407, 100); along(st, "console-table", "e", 1992, 100); put(st, "floor-vase", 1440, 180, "n"); put(st, "floor-vase", 1960, 180, "n");
  put(st, "houseplant", 1430, 560, "n"); put(st, "houseplant", 1970, 560, "n"); put(st, "chandelier", 1700, 300, "n", H0 + H1); along(st, "picture", "w", 1407, 450, { y: 160 }); along(st, "picture", "e", 1992, 450, { y: 160 });
  // ---- kitchen (2000..2600 × 0..600): dark wood units, marble island
  corner(st, "kitchen-corner-90", 2007, 13, "nw", DARK); along(st, "kitchen-fridge-70", "n", 13, 2132, DARK); along(st, "kitchen-base-60", "n", 13, 2197, DARK); along(st, "kitchen-sink-80", "n", 13, 2267, DARK);
  along(st, "kitchen-base-60", "n", 13, 2337, DARK); along(st, "kitchen-stove-60", "n", 13, 2397, DARK); along(st, "kitchen-base-60", "n", 13, 2457, DARK); along(st, "kitchen-base-60", "n", 13, 2517, DARK);
  for (const x of [2197, 2337, 2517]) along(st, "kitchen-wall-60", "n", 13, x, { y: 145, ...DARK });
  along(st, "kitchen-base-60", "e", 2592, 240, DARK); along(st, "dishwasher", "e", 2592, 300); along(st, "kitchen-base-60", "e", 2592, 360, DARK); along(st, "kitchen-base-60", "e", 2592, 420, DARK); along(st, "kitchen-base-60", "e", 2592, 480, DARK);
  put(st, "microwave", 2560, 360, "e", 93); put(st, "coffee-machine", 2560, 420, "e", 93); put(st, "toaster", 2560, 480, "e", 93); put(st, "kettle", 2197, 40, "n", 93); put(st, "cooking-pot", 2397, 40, "n", 93);
  put(st, "kitchen-island", 2300, 330, "n", 0, MARBLE); for (const x of [2240, 2300, 2360]) put(st, "bar-stool", x, 440, "s");
  for (const x of [2240, 2360]) put(st, "pendant-lamp", x, 330, "n", H0);
  put(st, "kitchen-bin", 2560, 560, "e"); put(st, "houseplant", 2040, 560, "n"); lights(st, H0, [[2100, 300], [2500, 150], [2500, 500]]);
  // ---- pantry (2600..2900 × 0..300), laundry (2900..3200 × 0..300), lavatory (2600..2800 × 300..600), service hall (2800..3200 × 300..600)
  along(st, "steel-shelf", "n", 13, 2750); along(st, "steel-shelf", "s", 292, 2750); along(st, "wine-rack", "w", 2607, 250);
  along(st, "washing-machine", "n", 13, 2950); along(st, "dryer", "n", 13, 3015); along(st, "washing-machine", "n", 13, 3080); put(st, "ironing-board", 3150, 150, "n"); put(st, "drying-rack", 2955, 230, "n"); put(st, "laundry-basket", 3160, 250, "n");
  along(st, "toilet", "n", 307, 2650); along(st, "washbasin-pedestal", "e", 2792, 400); along(st, "wall-mirror", "e", 2792, 400, { y: 110 });
  along(st, "shoe-rack", "w", 2807, 450); put(st, "coat-rack", 2850, 560, "n"); put(st, "doormat", 3130, 450, "e"); along(st, "bench", "n", 307, 2900);
  lights(st, H0, [[2750, 150], [3050, 150], [2700, 450], [3000, 450]], "ceiling-flush");
  // ---- formal living (0..900 × 600..1400)
  along(st, "fireplace", "w", 13, 1000); put(st, "sofa-three-seat", 350, 850, "n"); put(st, "sofa-three-seat", 350, 1150, "s"); put(st, "coffee-table", 350, 1000, "n"); put(st, "rug", 350, 1000, "n");
  put(st, "armchair-lounge", 650, 850, "e"); put(st, "armchair-lounge", 650, 1150, "e"); put(st, "side-table", 750, 1000, "n"); put(st, "table-lamp", 750, 1000, "n", 52);
  along(st, "console-table", "n", 607, 700); put(st, "floor-vase", 590, 640, "n"); put(st, "houseplant", 60, 1360, "n"); put(st, "houseplant", 60, 640, "n"); put(st, "floor-lamp", 850, 1360, "n");
  put(st, "chandelier", 350, 850, "n", H0); put(st, "chandelier", 350, 1150, "n", H0); along(st, "picture", "n", 607, 200, { y: 160 });
  // ---- dining (900..1400 × 600..1400)
  put(st, "refectory-table", 1150, 950, "n");
  for (const z of [850, 950, 1050]) { put(st, "dining-chair", 1035, z, "w"); put(st, "dining-chair", 1265, z, "e"); }
  put(st, "dining-chair", 1150, 765, "n"); put(st, "dining-chair", 1150, 1135, "s");
  along(st, "sideboard", "n", 607, 1150); along(st, "glass-cabinet", "n", 607, 1330); put(st, "houseplant", 1360, 1360, "n");
  for (const z of [870, 1030]) put(st, "chandelier", 1150, z, "n", H0);
  // ---- gallery / winter garden (1400..2000 × 600..1400)
  put(st, "sofa-two-seat", 1550, 1000, "w"); put(st, "sofa-two-seat", 1850, 1000, "e"); put(st, "coffee-table", 1700, 1000, "n"); put(st, "round-rug", 1700, 1000, "n");
  put(st, "houseplant", 1700, 1370, "n"); put(st, "fern", 1490, 760, "n"); put(st, "fern", 1910, 760, "n"); put(st, "planter", 1500, 1300, "n"); put(st, "planter", 1900, 1300, "n");
  put(st, "chandelier", 1700, 1000, "n", H0); lights(st, H0, [[1500, 800], [1900, 800], [1500, 1250], [1900, 1250]]);
  // ---- family room (2000..2800 × 600..1400)
  along(st, "wall-tv", "n", 607, 2500, { y: 110 }); along(st, "tv-bench", "n", 607, 2500); put(st, "game-console", 2500, 630, "n", 51);
  put(st, "sofa-corner", 2500, 900, "s"); put(st, "coffee-table", 2500, 740, "n"); put(st, "rug", 2500, 800, "n"); put(st, "armchair", 2250, 900, "w"); put(st, "armchair", 2700, 1200, "e");
  along(st, "cube-shelf", "w", 2007, 750); along(st, "aquarium", "w", 2007, 1250); put(st, "floor-lamp", 2250, 1250, "n"); put(st, "houseplant", 2750, 1360, "n");
  lights(st, H0, [[2200, 800], [2600, 800], [2200, 1200], [2600, 1200]]);
  // ---- games room (2800..3200 × 600..1400)
  put(st, "pool-table", 3000, 1000, "n"); along(st, "cue-rack", "w", 2807, 700, { y: 120 }); put(st, "restaurant-table", 3050, 1270, "n"); put(st, "bar-stool", 2990, 1270, "w"); put(st, "bar-stool", 3110, 1270, "e");
  put(st, "bar-cart", 3150, 700, "n"); along(st, "wine-rack", "n", 607, 3100); along(st, "neon-sign", "n", 607, 2900, { y: 200 }); put(st, "houseplant", 2850, 1360, "n");
  for (const z of [930, 1070]) put(st, "pendant-lamp", 3000, z, "n", H0); put(st, "ceiling-flush", 3050, 1270, "n", H0);
  // ---- lights and façade
  lights(st, H0, [[200, 150], [700, 150], [200, 450], [700, 450], [1000, 150], [1300, 450], [1500, 150], [1900, 150], [1500, 500], [1900, 500]]);
  lights(st, H0, [[200, 750], [700, 750], [200, 1250], [700, 1250], [1000, 750], [1300, 750], [1000, 1250], [1300, 1250]]);
  along(st, "entrance-canopy", "s", -13, 1700); for (const x of [1480, 1920]) along(st, "wall-lantern", "s", -13, x, { y: 240 });
  for (const x of [300, 950, 1300, 1700, 2100, 2600, 3000]) along(st, "wall-sconce", "n", 1413, x, { y: 260 });
  for (const x of [1450, 1950]) put(st, "houseplant", x, -60, "n");
}

function firstFloor(st) {
  floorExcept(st, 0, 0, W, DEPTH, "woodFloor", "#c9a579", [[0, 0, 900, 600], [900, 0, 1150, 300], [900, 1100, 1150, 1400], [2250, 0, 2500, 300], [2250, 1100, 2500, 1400], [2500, 0, 3200, 600]]);
  floor(st, 400, 0, 900, 600, "tiles", "#d8d4cc"); floor(st, 0, 0, 400, 600, "carpet", "#b8a994");
  for (const [x0, z0, x1, z1] of [[900, 0, 1150, 300], [900, 1100, 1150, 1400], [2250, 0, 2500, 300], [2250, 1100, 2500, 1400]]) floor(st, x0, z0, x1, z1, "tiles", "#d8d4cc");
  floor(st, 2500, 0, 3200, 600, "rubber", "#4a4d52");
  floor(st, 0, DEPTH, 900, DEPTH + 200, "concrete", "#b9b6ad"); floor(st, 1400, DEPTH, 2000, DEPTH + 200, "concrete", "#b9b6ad");
  ext(st, [0, 0], [W, 0], [WS(200), WS(800), WN(1275, 180), WS(1080), WN(1500, 150), WN(1900, 150), WS(2320), WN(2125, 180), WN(2900, 180, 100, 120), WN(3100, 180, 100, 120)], CREAM);
  ext(st, [W, 0], [W, DEPTH], [WN(300, 180), WN(900, 180), WN(1200, 180)], CREAM);
  ext(st, [W, DEPTH], [0, DEPTH], [WN(3100, 150), SL(2850, 240, 240), WS(2320), WP(2125, 200, 200, 30), SL(1700, 240, 240), WP(1275, 200, 200, 30), WS(1080), WP(750, 200, 200, 30), SL(450, 240, 240), WP(150, 200, 200, 30)], CREAM);
  ext(st, [0, DEPTH], [0, 0], [WN(1050, 180), WS(300)], CREAM);
  // corridor branches and the wing walls
  inn(st, [1400, 0], [1400, 600]); inn(st, [1400, 720], [1400, DEPTH]); inn(st, [2000, 0], [2000, 600]); inn(st, [2000, 720], [2000, DEPTH]);
  inn(st, [0, 600], [1400, 600], [D(200, 90, WOOD_DOOR), D(650, 90, WOOD_DOOR), D(1200, 90, WOOD_DOOR)]); inn(st, [0, 720], [1400, 720], [D(450, 90, WOOD_DOOR), D(1200, 90, WOOD_DOOR)]);
  inn(st, [2000, 600], [W, 600], [D(2200, 90, WOOD_DOOR), D(2700, 90, WOOD_DOOR)]); inn(st, [2000, 720], [W, 720], [D(2200, 90, WOOD_DOOR), D(2700, 90, WOOD_DOOR)]);
  inn(st, [400, 0], [400, 600]); inn(st, [900, 0], [900, 600]); inn(st, [900, 720], [900, DEPTH]); inn(st, [2500, 0], [2500, 600]); inn(st, [2500, 720], [2500, DEPTH]);
  stairs(st, STAIR_AT, 270, { ...STAIR, rise: H1, base: "open" });
  rail(st, [[1560, 346], [1560, 542], [1840, 542], [1840, 150]], { height: 100, style: "metal" }); rail(st, [[1560, 346], [1700, 346]], { height: 100, style: "metal" });
  rail(st, [[0, DEPTH + 200], [900, DEPTH + 200]]); rail(st, [[0, DEPTH], [0, DEPTH + 200]]); rail(st, [[900, DEPTH], [900, DEPTH + 200]]);
  rail(st, [[1400, DEPTH + 200], [2000, DEPTH + 200]]); rail(st, [[1400, DEPTH], [1400, DEPTH + 200]]); rail(st, [[2000, DEPTH], [2000, DEPTH + 200]]);
  // ---- master suite (0..900 × 720..1400), closet (0..400 × 0..600) and bath (400..900 × 0..600)
  along(st, "king-bed", "w", 13, 1060); along(st, "nightstand", "w", 13, 910); along(st, "nightstand", "w", 13, 1210); put(st, "bedroom-bench", 330, 1060, "e");
  along(st, "wall-tv", "e", 892, 1060, { y: 110 }); put(st, "armchair-lounge", 760, 850, "e"); put(st, "armchair-lounge", 760, 1270, "e"); put(st, "side-table", 820, 1060, "n");
  along(st, "dressing-table", "n", 727, 700); put(st, "dining-chair", 700, 870, "s"); put(st, "rug", 300, 1060, "n"); put(st, "chandelier", 450, 1060, "n", H1); put(st, "houseplant", 60, 1360, "n");
  put(st, "table-lamp", 40, 910, "n", 100); put(st, "table-lamp", 40, 1210, "n", 100);
  along(st, "closet-rail", "w", 13, 300); along(st, "closet-rail", "e", 392, 300); put(st, "closet-island", 200, 300, "n"); along(st, "standing-mirror", "n", 13, 100); along(st, "chest-of-drawers", "n", 13, 300);
  put(st, "ceiling-flush", 200, 150, "n", H1); put(st, "ceiling-flush", 200, 450, "n", H1);
  along(st, "double-vanity", "n", 13, 650); along(st, "bathtub", "w", 407, 300); along(st, "toilet", "e", 892, 150); along(st, "bidet", "e", 892, 240); corner(st, "shower-glass", 892, 592, "se");
  along(st, "towel-rail", "w", 407, 480); put(st, "bath-mat", 650, 300, "n"); put(st, "houseplant", 450, 560, "n"); lights(st, H1, [[550, 300], [800, 300]], "ceiling-flush");
  // ---- suites 2 and 3 (west), 4 and 5 (east)
  northSuite(st, 900, 1400, false); southSuite(st, 900, 1400, false); northSuite(st, 2000, 2500, true); southSuite(st, 2000, 2500, true);
  // ---- family lounge (2500..3200 × 720..1400)
  along(st, "wall-tv", "w", 2507, 1100, { y: 110 }); put(st, "sofa-corner", 2750, 1100, "e"); put(st, "coffee-table", 2590, 1100, "e"); put(st, "rug", 2680, 1100, "n");
  along(st, "bookshelf", "n", 727, 2900); along(st, "cube-shelf", "n", 727, 3080); put(st, "round-table", 3050, 1050, "n"); put(st, "dining-chair", 2970, 1050, "w"); put(st, "dining-chair", 3130, 1050, "e");
  put(st, "bar-cart", 3150, 800, "n"); put(st, "houseplant", 2550, 1360, "n"); put(st, "floor-lamp", 3150, 1360, "n"); lights(st, H1, [[2700, 900], [3000, 900], [2700, 1300], [3000, 1300]]);
  // ---- gym (2500..3200 × 0..600)
  put(st, "treadmill", 2580, 200, "e"); put(st, "exercise-bike", 2680, 200, "e"); put(st, "weight-bench", 2850, 250, "n"); along(st, "dumbbell-rack", "s", 592, 2900); put(st, "yoga-mat", 3050, 300, "n");
  put(st, "exercise-ball", 3120, 450, "n"); along(st, "gym-mirror", "e", 3192, 300); put(st, "water-cooler", 2540, 560, "n"); along(st, "wall-tv", "n", 13, 2700, { y: 170 }); put(st, "kettlebell-set", 2560, 450, "n");
  along(st, "squat-rack", "n", 13, 2850); lights(st, H1, [[2650, 300], [3000, 300]], "spot-rail");
  // ---- corridor, sitting area and the balconies
  along(st, "console-table", "n", 13, 1480); along(st, "console-table", "n", 13, 1920); put(st, "houseplant", 1430, 1370, "n"); put(st, "houseplant", 1970, 1370, "n");
  put(st, "sofa-two-seat", 1500, 1000, "w"); put(st, "sofa-two-seat", 1900, 1000, "e"); put(st, "coffee-table", 1700, 1000, "n"); put(st, "round-rug", 1700, 1000, "n");
  along(st, "picture", "n", 13, 1700, { y: 160 }); lights(st, H1, [[1480, 300], [1920, 300], [1500, 700], [1900, 700], [1700, 1250]]);
  for (const x of [300, 600]) put(st, "lounger", x, 1500, "n"); put(st, "side-table", 450, 1500, "n"); put(st, "planter", 60, 1540, "n"); put(st, "planter", 840, 1540, "n");
  put(st, "bench", 1700, 1540, "s"); put(st, "planter", 1450, 1540, "n"); put(st, "planter", 1950, 1540, "n");
  for (const x of [450, 1700]) along(st, "wall-sconce", "n", 1413, x, { y: 240 });
  for (const x of [2300, 2900]) along(st, "wall-sconce", "n", 1413, x, { y: 240 });
}

function secondFloor(st) {
  floorExcept(st, 0, 0, W, DEPTH, "woodFloor", "#c9a579", [[0, 600, 900, 1400], [0, 0, 250, 300], [900, 0, 1150, 300], [900, 1100, 1150, 1400], [2250, 0, 2500, 300], [2250, 1100, 2500, 1400]]);
  floor(st, 0, 600, 900, DEPTH, "carpet", "#4a3f4a");
  for (const [x0, z0, x1, z1] of [[0, 0, 250, 300], [900, 0, 1150, 300], [900, 1100, 1150, 1400], [2250, 0, 2500, 300], [2250, 1100, 2500, 1400]]) floor(st, x0, z0, x1, z1, "tiles", "#d8d4cc");
  floor(st, 1400, DEPTH, 2000, DEPTH + 200, "concrete", "#b9b6ad");
  ext(st, [0, 0], [W, 0], [WS(125), WN(375, 150), WN(700, 180), WS(1080), WN(1275, 180), WN(1500, 150), WN(1900, 150), WN(2125, 180), WS(2320), WN(2700, 180), WN(3050, 180)], CREAM);
  ext(st, [W, 0], [W, DEPTH], [WN(300, 180), WN(1000, 240, 150, 80)], CREAM);
  ext(st, [W, DEPTH], [0, DEPTH], [WN(3050, 180), WN(2700, 180), WS(2320), WP(2125, 200, 200, 30), SL(1700, 240, 240), WP(1275, 200, 200, 30), WS(1080), WS(700), WS(200)], CREAM);
  ext(st, [0, DEPTH], [0, 0], [WS(1000), WN(300, 150)], CREAM);
  inn(st, [1400, 0], [1400, 600]); inn(st, [1400, 720], [1400, DEPTH]); inn(st, [2000, 0], [2000, 600]); inn(st, [2000, 720], [2000, DEPTH]);
  inn(st, [0, 600], [1400, 600], [D(375, 90, WOOD_DOOR), D(700, 90, WOOD_DOOR), D(1200, 90, WOOD_DOOR)]); inn(st, [0, 720], [1400, 720], [D(150, 90, WOOD_DOOR), D(1200, 90, WOOD_DOOR)]);
  inn(st, [2000, 600], [W, 600], [D(2200, 90, WOOD_DOOR), D(2700, 90, WOOD_DOOR)]); inn(st, [2000, 720], [W, 720], [D(2200, 90, WOOD_DOOR), D(2700, 90, WOOD_DOOR)]);
  inn(st, [500, 0], [500, 600]); inn(st, [900, 0], [900, 600]); inn(st, [900, 720], [900, DEPTH]); inn(st, [2500, 0], [2500, 600]); inn(st, [2500, 720], [2500, DEPTH]);
  stairs(st, STAIR_AT, 270, { ...STAIR, rise: H2, base: "open" });
  rail(st, [[1560, 346], [1560, 542], [1840, 542], [1840, 150]], { height: 100, style: "metal" }); rail(st, [[1560, 346], [1700, 346]], { height: 100, style: "metal" });
  rail(st, [[1400, DEPTH + 200], [2000, DEPTH + 200]]); rail(st, [[1400, DEPTH], [1400, DEPTH + 200]]); rail(st, [[2000, DEPTH], [2000, DEPTH + 200]]);
  // ---- home cinema (0..900 × 720..1400)
  along(st, "wall-tv", "n", 727, 450, { y: 130 }); along(st, "tv-bench", "n", 727, 450); put(st, "sofa-three-seat", 450, 950, "s"); put(st, "sofa-three-seat", 450, 1200, "s");
  put(st, "armchair", 150, 1200, "s"); put(st, "armchair", 750, 1200, "s"); put(st, "floor-cushion", 300, 850, "n"); put(st, "floor-cushion", 600, 850, "n");
  put(st, "mini-fridge", 850, 760, "e"); put(st, "bar-cart", 60, 760, "n"); put(st, "rug", 450, 1070, "n"); along(st, "neon-sign", "e", 892, 1000, { y: 200 }); lights(st, H2, [[250, 1000], [650, 1000]]);
  // ---- guest suite 6 (0..500 × 0..600) with its bath (0..250 × 0..300), study (500..900 × 0..600)
  inn(st, [250, 0], [250, 300]); inn(st, [0, 300], [250, 300], [D(125, 90, WOOD_DOOR)]);
  along(st, "double-bed", "e", 492, 420); along(st, "nightstand", "e", 492, 300); along(st, "nightstand", "e", 492, 540); along(st, "wardrobe", "n", 13, 375); put(st, "armchair", 60, 480, "w"); put(st, "rug", 310, 420, "n");
  corner(st, "shower-stall", 7, 13, "nw"); along(st, "toilet", "e", 242, 150); along(st, "washbasin-pedestal", "w", 7, 200); along(st, "wall-mirror", "w", 7, 200, { y: 110 });
  along(st, "desk", "n", 13, 700); put(st, "office-chair", 700, 140, "s"); put(st, "laptop", 700, 60, "n", 75); along(st, "bookshelf", "w", 507, 300); along(st, "bookshelf", "w", 507, 440);
  along(st, "filing-cabinet", "e", 892, 300); put(st, "armchair", 780, 480, "e"); put(st, "round-rug", 700, 350, "n"); put(st, "houseplant", 860, 60, "n");
  lights(st, H2, [[300, 450], [125, 220], [700, 300]], "ceiling-flush");
  // ---- suites 7 and 8 (west), playroom and suite 9 (east)
  northSuite(st, 900, 1400, false); southSuite(st, 900, 1400, false); southSuite(st, 2000, 2500, true);
  along(st, "bunk-bed", "e", 2492, 120); along(st, "child-bed", "e", 2492, 350); along(st, "toy-chest", "e", 2492, 500); along(st, "bookshelf", "w", 2007, 300);
  put(st, "plastic-table", 2150, 450, "n"); put(st, "plastic-chair", 2080, 450, "w"); put(st, "plastic-chair", 2220, 450, "e"); put(st, "toy-blocks", 2150, 450, "n", 48);
  put(st, "plush-bear", 2100, 150, "n"); put(st, "round-rug", 2200, 300, "n"); put(st, "ceiling-flush", 2250, 300, "n", H2);
  // ---- office (2500..3200 × 0..600) and bar lounge (2500..3200 × 720..1400)
  put(st, "meeting-table", 2850, 300, "n");
  for (const x of [2700, 2850, 3000]) { put(st, "office-chair", x, 150, "n"); put(st, "office-chair", x, 450, "s"); }
  along(st, "whiteboard", "e", 3192, 300); along(st, "filing-cabinet", "n", 13, 2560); along(st, "filing-cabinet", "n", 13, 2660); along(st, "bookshelf", "w", 2507, 300);
  put(st, "printer", 2560, 60, "n", 134); put(st, "water-cooler", 2540, 560, "n"); put(st, "houseplant", 3160, 560, "n"); lights(st, H2, [[2700, 300], [3000, 300]]);
  along(st, "bar-shelf", "e", 3192, 1000); put(st, "bar-counter", 3000, 1000, "e"); for (const z of [880, 1000, 1120]) put(st, "bar-stool", 2900, z, "w");
  put(st, "sofa-corner", 2650, 1000, "w"); put(st, "coffee-table", 2800, 1000, "n"); put(st, "round-rug", 2740, 1000, "n"); put(st, "disco-ball", 2850, 1000, "n", 280);
  along(st, "neon-sign", "n", 727, 2900, { y: 200 }); put(st, "houseplant", 2550, 1360, "n"); for (const z of [880, 1120]) put(st, "pendant-lamp", 3000, z, "n", H2);
  // ---- corridor, sky lounge and balcony
  along(st, "console-table", "n", 13, 1480); along(st, "console-table", "n", 13, 1920); put(st, "armchair-lounge", 1500, 1000, "w"); put(st, "armchair-lounge", 1900, 1000, "e"); put(st, "side-table", 1700, 1000, "n");
  put(st, "round-rug", 1700, 1000, "n"); put(st, "houseplant", 1430, 1370, "n"); put(st, "houseplant", 1970, 1370, "n"); lights(st, H2, [[1480, 300], [1920, 300], [1500, 700], [1900, 700], [1700, 1250]]);
  put(st, "bench", 1700, 1540, "s"); put(st, "planter", 1450, 1540, "n"); put(st, "planter", 1950, 1540, "n");
}

/** The roof terrace: deck in the middle, a pool, pergola with the outdoor kitchen, loungers, glass railing all around. */
function rooftop(st) {
  floorExcept(st, 0, 0, W, DEPTH, "concrete", "#9a9a94", [[600, 200, 2600, 1200]]);
  floor(st, 600, 200, 2600, 1200, "planks", "#b08a5a");
  rail(st, [[1560, 346], [1560, 542], [1840, 542], [1840, 150]], { height: 110, style: "glass" }); rail(st, [[1560, 346], [1700, 346]], { height: 110, style: "glass" });
  rail(st, [[0, 0], [W, 0], [W, DEPTH], [0, DEPTH], [0, 0]], { height: 110, style: "glass" });
  put(st, "pool", 2200, 700, "n"); for (const x of [1850, 2060, 2270, 2480]) put(st, "lounger", x, 1020, "s"); put(st, "side-table", 1955, 1110, "n"); put(st, "side-table", 2165, 1110, "n");
  put(st, "pergola", 1000, 450, "n"); put(st, "outdoor-dining-set", 1000, 450, "n"); put(st, "outdoor-kitchen", 1000, 260, "n"); for (const x of [880, 1120]) put(st, "pendant-lamp", x, 450, "n", 250);
  put(st, "outdoor-sofa", 1000, 900, "n"); put(st, "fire-pit", 1000, 1080, "n"); put(st, "armchair-lounge", 760, 1000, "w"); put(st, "armchair-lounge", 1240, 1000, "e");
  for (const [x, z] of [[650, 250], [2550, 250], [650, 1150], [2550, 1150], [1500, 250], [1500, 1150]]) put(st, "planter", x, z, "n");
  for (const x of [300, 2900]) for (const z of [300, 700, 1100]) put(st, "planter", x, z, "n");
  for (const x of [700, 1300, 1900, 2500]) put(st, "garden-bollard", x, 1230, "n"); for (const x of [700, 1300, 1900, 2500]) put(st, "garden-bollard", x, 170, "n");
  put(st, "string-lights", 1000, 700, "n", 260); put(st, "solar-panel", 300, 1300, "n"); put(st, "solar-panel", 2900, 1300, "n"); put(st, "ac-outdoor-unit", 3100, 100, "n"); put(st, "ac-outdoor-unit", 100, 100, "n");
}

function garage(st) {
  floor(st, 0, 0, 1300, 700, "concrete", "#b9b6ad");
  ext(st, [0, 0], [1300, 0], [WS(300, 180, 60, 220), WS(900, 180, 60, 220)], CREAM);
  ext(st, [1300, 0], [1300, 700], [D(350, 100, WOOD_DOOR)], CREAM);
  ext(st, [1300, 700], [0, 700], [], CREAM);
  ext(st, [0, 700], [0, 0], [GD(200, 260, 240, { colors: { leafColor: "#2f3236" } }), GD(500, 260, 240, { colors: { leafColor: "#2f3236" } })], CREAM);
  put(st, "suv", 360, 200, 0); put(st, "sedan", 960, 200, 0); put(st, "sports-car", 360, 500, 0); put(st, "convertible", 960, 500, 0);
  along(st, "tool-chest", "s", 687, 1230); along(st, "steel-shelf", "n", 13, 1200); along(st, "tool-board", "s", 687, 1100, { y: 90 }); along(st, "bike-rack", "n", 13, 660); put(st, "bicycle", 660, 150, 90);
  for (const x of [360, 960]) for (const z of [200, 500]) put(st, "downlight", x, z, "n", 300);
}

function outdoors(p) {
  terrain(p, 7000, 5800, 96, (x, z) => 5 * Math.sin(x / 700) * Math.cos(z / 600) - (z > 2000 ? (z - 2000) * 0.02 : 0));
  const light = "#d9d4c8";
  // the street along the north, the gate, the drive and the forecourt with a fountain
  path(p, rect(-3500, -2900, 3500, -2600), "asphalt", null, 2); path(p, rect(-3500, -2600, 3500, -2500), "paving", "#bfbab0", 6);
  path(p, rect(-250, -2500, 250, -1150), "paving", "#8a8680", 4);
  const circle = (cx, cz, r, n = 20) => Array.from({ length: n }, (_, i) => [Math.round(cx + r * Math.cos((i / n) * Math.PI * 2)), Math.round(cz + r * Math.sin((i / n) * Math.PI * 2))]);
  path(p, circle(0, -1650, 580), "paving", "#8a8680", 4);
  pond(p, circle(0, -1650, 170, 16), { depth: 40, height: 15, tint: "#8fa6b8" }); lot(p, "bird-bath", 0, -1650);
  path(p, rect(250, -1850, 1900, -1450), "paving", "#8a8680", 4); path(p, rect(1300, -2000, 1900, -1300), "paving", "#8a8680", 4);
  lot(p, "convertible", 450, -1450, 180); lot(p, "sedan", -450, -1450, 0);
  for (const z of [-2300, -2000, -1700, -1400]) { lot(p, "cypress", -700, z); lot(p, "cypress", 700, z); lot(p, "garden-bollard", -300, z); lot(p, "garden-bollard", 300, z); }
  for (const [x, z] of circle(0, -1650, 420, 12)) lot(p, "flower-bed", x, z);
  for (const x of [-1100, 1100]) lot(p, "lamp", x, -1200);
  lot(p, "mailbox", 330, -2450, "n"); lot(p, "big-tree", -2600, -1800); lot(p, "oak-tree", 2800, -900); lot(p, "ipe-tree", -2200, -1300); lot(p, "maple-tree", 1200, -2200);
  for (const [x, z] of [[-2300, -800], [-2100, -2200], [2200, -800], [-1500, -2300], [1600, -2300]]) lot(p, "bush", x, z);
  // terrace behind the house, main pool with its deck, kids' pool, jacuzzi, lap pool
  path(p, rect(-1700, 400, 1700, 850), "stoneTiles", light);
  for (const r of [rect(-1000, 850, -800, 1850), rect(800, 850, 1000, 1850), rect(-800, 850, 800, 1000), rect(-800, 1700, 800, 1850)]) deck(p, r, { height: 12 });
  pool(p, rect(-800, 1000, 800, 1700), { depth: 170 });
  path(p, rect(1000, 850, 1700, 1850), "stoneTiles", light); pool(p, rect(1050, 1000, 1500, 1400), { depth: 60, tint: "#8fd4ea" }); lot(p, "jacuzzi", 1350, 1620, "n"); lot(p, "beach-umbrella", 1150, 1620);
  path(p, rect(-2750, 850, -2050, 2250), "stoneTiles", light); pool(p, rect(-2600, 950, -2200, 2150), { depth: 150 });
  for (const x of [-600, -350, -100, 150, 400, 650]) lot(p, "lounger", x, 1780, "s");
  lot(p, "beach-umbrella", -225, 1780); lot(p, "beach-umbrella", 525, 1780); for (const x of [-900, 900]) for (const z of [950, 1750]) lot(p, "planter", x, z);
  for (const x of [-1400, -800, 0, 800, 1400]) lot(p, "wall-sconce", x, 412, "s", 260);
  lot(p, "outdoor-sofa", -1400, 600, "n"); lot(p, "outdoor-sofa", -1400, 1300, "s"); lot(p, "fire-pit", -1400, 950); lot(p, "armchair-lounge", -1650, 950, "w"); lot(p, "armchair-lounge", -1150, 950, "e");
  lot(p, "outdoor-dining-set", 1300, 600); for (const [x, z] of [[-2000, 500], [-2000, 2200], [2000, 500]]) lot(p, "palm-tree", x, z);
  for (const [x, z] of [[-1000, 1950], [1000, 1950], [-1800, 1950]]) lot(p, "palm-tree", x, z);
  // gourmet pavilion on the east, football lawn and playground beyond
  deck(p, rect(1900, 950, 2700, 1650), { height: 15 });
  lot(p, "pergola", 2300, 1300); lot(p, "outdoor-kitchen", 2300, 1010, "n"); lot(p, "outdoor-dining-set", 2300, 1360); lot(p, "bbq-grill", 2600, 1050, "n");
  for (const x of [2180, 2420]) lot(p, "pendant-lamp", x, 1360, "n", 250); lot(p, "string-lights", 2300, 1600, "n", 250);
  patch(p, rect(1800, 1900, 3200, 2600), "grass", "#5e8a3c"); lot(p, "goal", 1850, 2250, 0); lot(p, "goal", 3150, 2250, 180); lot(p, "ball", 2500, 2250);
  lot(p, "swing-set", -2900, 2400); lot(p, "slide", -2200, 2450, 0); lot(p, "sandpit", -1500, 2400); lot(p, "seesaw", -2900, 2650, 0); lot(p, "trampoline", -1000, 2500);
  for (const z of [1000, 1600, 2200]) lot(p, "garden-bollard", 1800, z); for (const x of [-2900, -1900]) lot(p, "garden-bollard", x, 800);
  path(p, rect(1700, 500, 1800, 2600), "stone", light, 4); path(p, rect(-1900, 850, -1800, 2600), "stone", light, 4);
  lot(p, "garden-shed", 3000, 1000, "w"); lot(p, "bench", -1350, 2300, "s"); lot(p, "willow-tree", -2800, 400); lot(p, "big-tree", 3000, 2900); lot(p, "oak-tree", -2900, -200); lot(p, "ipe-tree", 2900, 300);
  for (const [x, z] of [[-3000, 1200], [-3000, 2900], [3000, 1700], [2200, 2800], [-500, 2700], [500, 2750]]) lot(p, "bush", x, z);
  // site wall with the gates, hedges inside
  const L = 3300, N = -2500, S = 2900;
  siteWall(p, [[-L, N], [L, N], [L, S], [-L, S], [-L, N]], { height: 240, material: "stone", tint: "#a8a090", gates: [gate(L - 150, "sliding"), gate(L - 400 - 55, "single")] });
  fence(p, [[-L + 60, N + 60], [-L + 60, S - 60], [L - 60, S - 60], [L - 60, N + 60], [500, N + 60]], { style: "hedge", height: 150 });
  fence(p, [[-L + 60, N + 60], [-500, N + 60]], { style: "hedge", height: 150 });
}

export function mansion(p, b, g) {
  b.at = [-1600, -1000];
  g.height = H0;
  groundFloor(g);
  const f1 = freshStorey(g, "upper"); f1.height = H1; b.storeys.push(f1); firstFloor(f1);
  const f2 = freshStorey(f1, "upper"); f2.height = H2; b.storeys.push(f2); secondFloor(f2);
  const top = freshStorey(f2, "upper"); top.height = 300; top.name = ""; b.storeys.push(top); rooftop(top);
  b.roof = { ...b.roof, type: "none" };
  const gb = { id: `b_${b.id}garage`, name: "", at: [1900, -2200], rotation: 0, locked: false, roofShadow: true, roof: { type: "flat", pitch: 30, overhang: 40, height: 25, ridgeAxis: "x", material: "concrete", tint: "#2f3236", visible: false, locked: false, ceiling: true }, storeys: [freshStorey(null, "ground")] };
  gb.storeys[0].height = 300;
  garage(gb.storeys[0]);
  p.buildings.push(gb);
  outdoors(p);
  p.sun = { ...p.sun, city: "rio", latitude: -22.9, useTime: true, time: 16, month: 2 };
}
