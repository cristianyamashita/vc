// Classical estate after a symmetrical plan: a central block (music room
// opening onto the inner courtyard, grand foyer, dining, study, verandas
// and the porch) between two wings. West wing: game room, family room with
// bar, kitchen with island, pantry, lounge, guest suite, bedroom 3 with its
// bath, service corridor. East wing: master suite with bath and wardrobe,
// gallery, office, library, powder room, gym, pet room, utility. Garages at
// the front corners flank the motor court with its fountain; pool behind.
import { floor, ext, inn, column, D, DD, PS, PD, AR, SL, GD, WN, WS, WP, along, corner, put, lights, lot, path, deck, pool, pond, rect, fence, siteWall, gate, terrain, building } from "./kit.js";

const H = 340;
const CREAM = { outerMaterial: "plaster", outerTint: "#ecdfc4", tint: "#f6f0e4" };
const UNIT = { material: "woodDark" }, MARBLE = { material: "marble" };
const ROOF = { type: "hip", pitch: 28, overhang: 70, material: "roofTiles", tint: "#b4573a" };
const WOOD = { colors: { leafColor: "#4a3426", frameColor: "#2b2e33" } };
const circle = (cx, cz, r, n = 20) => Array.from({ length: n }, (_, i) => [Math.round(cx + r * Math.cos((i / n) * Math.PI * 2)), Math.round(cz + r * Math.sin((i / n) * Math.PI * 2))]);

/** Central block (x 0..1600, z 0..1300): music room on the courtyard, grand foyer, dining, study, verandas, porch. */
function centre(st) {
  floor(st, 0, 300, 1600, 1000, "marble", "#e8e2d6"); floor(st, 400, 0, 1200, 300, "woodFloor", "#8a5a3a");
  floor(st, 0, 300, 500, 900, "woodFloor", "#8a5a3a"); floor(st, 1100, 300, 1600, 900, "woodFloor", "#8a5a3a");
  floor(st, 0, 900, 500, 1300, "stoneTiles", "#d4cfc4"); floor(st, 1100, 900, 1600, 1300, "stoneTiles", "#d4cfc4"); floor(st, 500, 1000, 1100, 1300, "stoneTiles", "#d4cfc4");
  ext(st, [400, 0], [1200, 0], [SL(800, 400, 280)], CREAM); ext(st, [400, 0], [400, 300], [], CREAM); ext(st, [1200, 0], [1200, 300], [], CREAM);
  ext(st, [0, 300], [400, 300], [WN(200, 180, 180, 60)], CREAM); ext(st, [1200, 300], [1600, 300], [WN(1400, 180, 180, 60)], CREAM);
  ext(st, [0, 300], [0, 900], [D(600, 100, WOOD)], CREAM); ext(st, [1600, 300], [1600, 900], [D(600, 100, WOOD)], CREAM);
  ext(st, [0, 900], [500, 900], [WP(250, 240, 220, 30)], CREAM); ext(st, [1100, 900], [1600, 900], [WP(1350, 240, 220, 30)], CREAM);
  ext(st, [500, 900], [500, 1000], [], CREAM); ext(st, [1100, 900], [1100, 1000], [], CREAM);
  ext(st, [500, 1000], [1100, 1000], [DD(800, 200, { height: 280, ...WOOD })], CREAM);
  inn(st, [400, 300], [1200, 300], [AR(800, 300, 300)]); inn(st, [500, 300], [500, 900], [AR(600, 200, 260)]); inn(st, [1100, 300], [1100, 900], [AR(600, 200, 260)]);
  for (const x of [15, 250, 485]) { column(st, x, 1285, 35, CREAM); column(st, 1600 - x, 1285, 35, CREAM); }
  for (const x of [515, 800, 1085]) column(st, x, 1285, 35, CREAM);
  column(st, 15, 1100, 35, CREAM); column(st, 1585, 1100, 35, CREAM);
  // music room
  along(st, "upright-piano", "w", 407, 150); put(st, "stool", 560, 150, "e"); put(st, "armchair", 1010, 200, "n"); put(st, "armchair", 1130, 200, "n"); put(st, "round-rug", 800, 150, "n"); put(st, "chandelier", 800, 150, "n", H);
  // grand foyer
  put(st, "round-rug", 800, 650, "n"); put(st, "round-table", 800, 650, "n"); put(st, "floor-vase", 800, 650, "n", 76); along(st, "console-table", "e", 1092, 450); along(st, "console-table", "w", 507, 450);
  put(st, "houseplant", 545, 945, "n"); put(st, "houseplant", 1050, 945, "n"); put(st, "chandelier", 800, 650, "n", H); put(st, "doormat", 800, 960, "n"); along(st, "picture", "w", 507, 800, { y: 160 }); along(st, "picture", "e", 1092, 800, { y: 160 });
  // dining (0..500 × 300..900)
  put(st, "refectory-table", 250, 600, "n");
  for (const z of [500, 600, 700]) { put(st, "dining-chair", 135, z, "w"); put(st, "dining-chair", 365, z, "e"); }
  put(st, "dining-chair", 250, 415, "n"); put(st, "dining-chair", 250, 785, "s"); along(st, "sideboard", "n", 313, 250); for (const z of [520, 680]) put(st, "chandelier", 250, z, "n", H);
  // study (1100..1600 × 300..900)
  along(st, "desk", "n", 313, 1350); put(st, "office-chair", 1350, 450, "s"); put(st, "laptop", 1350, 360, "n", 75); along(st, "bookshelf", "e", 1592, 420); along(st, "bookshelf", "e", 1592, 780);
  put(st, "armchair-lounge", 1200, 700, "w"); put(st, "armchair-lounge", 1430, 700, "e"); put(st, "side-table", 1315, 700, "n"); put(st, "round-rug", 1315, 700, "n"); put(st, "chandelier", 1350, 600, "n", H);
  // verandas and porch
  put(st, "bench", 250, 1200, "s"); put(st, "bench", 1350, 1200, "s"); for (const x of [100, 400, 1200, 1500]) put(st, "planter", x, 1230, "n");
  put(st, "planter", 570, 1200, "n"); put(st, "planter", 1030, 1200, "n"); for (const x of [700, 900]) along(st, "wall-lantern", "n", 1013, x, { y: 240 });
  lights(st, H, [[250, 1100], [1350, 1100], [800, 1150]], "ceiling-flush");
}

/** West wing (x 0..1500, z 0..2500): game room, family room with bar, kitchen, pantry, service corridor, guest suite, lounge, bedroom 3. */
function westWing(st) {
  floor(st, 0, 0, 1500, 2500, "woodFloor", "#8a5a3a");
  floor(st, 0, 750, 700, 1450, "stoneTiles", "#cfc9bd"); floor(st, 450, 1450, 700, 2500, "stoneTiles", "#cfc9bd"); floor(st, 0, 2200, 450, 2500, "tiles", "#d8d4cc"); floor(st, 1200, 2200, 1500, 2500, "tiles", "#d8d4cc");
  floor(st, 700, 1150, 1500, 1450, "marble", "#e8e2d6"); floor(st, 1200, 1450, 1500, 2200, "marble", "#e8e2d6");
  ext(st, [0, 0], [1500, 0], [WN(350, 180, 180, 60), WN(900, 180, 180, 60), WN(1300, 180, 180, 60)], CREAM);
  ext(st, [1500, 0], [1500, 2500], [SL(575, 300, 260), WN(1300, 150, 180, 60), WN(2350, 120)], CREAM);
  ext(st, [1500, 2500], [0, 2500], [WS(1350), WN(950, 180), WN(575, 100, 60, 200), WS(225)], CREAM);
  ext(st, [0, 2500], [0, 0], [WN(2350, 120), WN(1975, 180), WS(1600), WN(1100, 180, 100, 120), WN(375, 180, 180, 60)], CREAM);
  inn(st, [700, 0], [700, 1150], [D(650, 90, WOOD), D(1060, 90, WOOD)]); inn(st, [0, 750], [700, 750]);
  inn(st, [700, 1150], [1500, 1150], [D(1100, 90, WOOD)]); inn(st, [700, 1150], [700, 1450], [D(1300, 90, WOOD)]);
  inn(st, [0, 1450], [700, 1450], [D(150, 90, WOOD), D(500, 90, WOOD)]); inn(st, [450, 1450], [450, 2500], [D(1600, 90, WOOD), D(1975, 90, WOOD)]);
  inn(st, [0, 1750], [450, 1750]); inn(st, [0, 2200], [450, 2200], [D(100, 90, WOOD)]);
  inn(st, [700, 1450], [700, 2500], [PD(1700, 160, 260), D(2200, 90, WOOD)]); inn(st, [700, 1450], [1200, 1450]); inn(st, [700, 1950], [1200, 1950]);
  inn(st, [1200, 1450], [1200, 2500], [PD(1700, 160, 260)]); inn(st, [1200, 2200], [1500, 2200], [D(1350, 90, WOOD)]);
  // game room (0..700 × 0..750)
  put(st, "pool-table", 330, 375, "n"); along(st, "cue-rack", "n", 13, 150, { y: 120 }); put(st, "restaurant-table", 580, 200, "n"); put(st, "bar-stool", 490, 200, "w"); put(st, "bar-stool", 670, 200, "e");
  along(st, "bar-cart", "s", 742, 450); put(st, "houseplant", 60, 690, "n"); for (const z of [300, 450]) put(st, "pendant-lamp", 330, z, "n", H);
  // family room (700..1500 × 0..1150) with the bar
  along(st, "wall-tv", "n", 13, 1100, { y: 110 }); along(st, "tv-bench", "n", 13, 1100); put(st, "sofa-corner", 1100, 400, "s"); put(st, "coffee-table", 1100, 240, "n"); put(st, "rug", 1100, 330, "n");
  put(st, "armchair", 1350, 400, "e"); along(st, "bar-shelf", "w", 707, 300); put(st, "bar-counter", 820, 300, "w"); for (const z of [200, 300, 400]) put(st, "bar-stool", 920, z, "e");
  put(st, "houseplant", 1445, 1090, "n"); put(st, "floor-lamp", 1450, 60, "n"); put(st, "chandelier", 1100, 550, "n", H); lights(st, H, [[850, 1000], [1300, 1000]]);
  // kitchen (0..700 × 750..1450)
  corner(st, "kitchen-corner-90", 13, 757, "nw", UNIT); along(st, "kitchen-fridge-70", "n", 757, 138, UNIT); along(st, "kitchen-base-60", "n", 757, 203, UNIT); along(st, "kitchen-sink-80", "n", 757, 273, UNIT); along(st, "kitchen-base-60", "n", 757, 343, UNIT); along(st, "kitchen-stove-60", "n", 757, 403, UNIT); along(st, "kitchen-base-60", "n", 757, 463, UNIT);
  along(st, "kitchen-base-60", "w", 13, 893, UNIT); along(st, "dishwasher", "w", 13, 953); along(st, "kitchen-base-60", "w", 13, 1013, UNIT);
  for (const x of [203, 343, 463]) along(st, "kitchen-wall-60", "n", 757, x, { y: 145, ...UNIT }); put(st, "microwave", 203, 785, "n", 93); put(st, "coffee-machine", 463, 785, "n", 93);
  put(st, "kitchen-island", 400, 1100, "n", 0, MARBLE); for (const x of [340, 400, 460]) put(st, "bar-stool", x, 1210, "s"); for (const x of [340, 460]) put(st, "pendant-lamp", x, 1100, "n", H);
  put(st, "kitchen-bin", 60, 1400, "w"); put(st, "houseplant", 660, 1400, "n");
  // gallery and corridor
  along(st, "console-table", "s", 1442, 900); put(st, "round-rug", 1350, 1300, "n"); along(st, "picture", "e", 1492, 1300, { y: 160 }); put(st, "houseplant", 1445, 1400, "n"); put(st, "chandelier", 1100, 1300, "n", H); put(st, "chandelier", 1350, 1850, "n", H);
  along(st, "washing-machine", "s", 2492, 520); along(st, "dryer", "s", 2492, 585); along(st, "wall-shelves", "e", 692, 2400, { y: 150 }); lights(st, H, [[575, 1700], [575, 2100]], "ceiling-flush");
  // pantry (0..450 × 1450..1750), guest suite (0..450 × 1750..2200), bath 2 (0..450 × 2200..2500)
  along(st, "steel-shelf", "n", 1457, 330); along(st, "steel-shelf", "s", 1742, 225); along(st, "wine-rack", "w", 13, 1600); put(st, "ceiling-flush", 225, 1600, "n", H);
  along(st, "double-bed", "w", 13, 1975); along(st, "nightstand", "w", 13, 1850); along(st, "nightstand", "w", 13, 2100); along(st, "wardrobe", "s", 2192, 330); put(st, "rug", 230, 1975, "n"); put(st, "ceiling-flush", 225, 1975, "n", H);
  corner(st, "shower-stall", 13, 2492, "sw"); along(st, "toilet", "e", 442, 2300); along(st, "washbasin-pedestal", "e", 442, 2420); along(st, "wall-mirror", "e", 442, 2420, { y: 110 }); put(st, "ceiling-flush", 225, 2350, "n", H);
  // lounge (700..1200 × 1450..1950) with the wine corner
  put(st, "sofa-two-seat", 850, 1700, "w"); put(st, "sofa-two-seat", 1050, 1700, "e"); put(st, "coffee-table", 950, 1700, "n"); put(st, "round-rug", 950, 1700, "n");
  for (const x of [760, 820, 880, 940]) along(st, "wine-rack", "n", 1457, x); along(st, "glass-cabinet", "n", 1457, 1100); put(st, "chandelier", 950, 1700, "n", H);
  // bedroom 3 (700..1200 × 1950..2500) and bath 3 (1200..1500 × 2200..2500)
  along(st, "double-bed", "s", 2492, 1000); along(st, "nightstand", "s", 2492, 870); along(st, "nightstand", "s", 2492, 1130); along(st, "wardrobe", "n", 1957, 1000); along(st, "study-desk", "e", 1192, 2100); put(st, "chair", 1080, 2100, "w"); put(st, "rug", 1000, 2250, "n"); put(st, "ceiling-flush", 950, 2200, "n", H);
  corner(st, "shower-stall", 1492, 2492, "se"); along(st, "toilet", "w", 1207, 2300); along(st, "washbasin-pedestal", "e", 1492, 2300); along(st, "wall-mirror", "e", 1492, 2300, { y: 110 }); put(st, "ceiling-flush", 1350, 2350, "n", H);
  along(st, "wall-sconce", "w", 1513, 575, { y: 250 });
}

/** East wing (x 0..1500, z 0..2500): master suite with bath and wardrobe, gallery, office, library, powder room, gym, pet room, utility. */
function eastWing(st) {
  floor(st, 0, 0, 1500, 2500, "woodFloor", "#8a5a3a");
  floor(st, 750, 0, 1200, 600, "marble", "#e8e2d6"); floor(st, 0, 850, 1500, 1150, "marble", "#e8e2d6"); floor(st, 0, 1150, 500, 2500, "marble", "#e8e2d6"); floor(st, 500, 1750, 1500, 1850, "marble", "#e8e2d6");
  floor(st, 300, 1750, 500, 2050, "tiles", "#d8d4cc"); floor(st, 500, 1850, 1000, 2500, "rubber", "#4a4d52"); floor(st, 1250, 1850, 1500, 2500, "tiles", "#d8d4cc"); floor(st, 1000, 1850, 1250, 2500, "tiles", "#cfc9bd");
  ext(st, [0, 0], [1500, 0], [WN(375, 180, 180, 60), WS(975), WS(1350)], CREAM);
  ext(st, [1500, 0], [1500, 2500], [WS(300), WN(750, 120), WN(1450, 180, 180, 60), WN(2200, 120)], CREAM);
  ext(st, [1500, 2500], [0, 2500], [WS(1375), WS(1125), WN(750, 180, 100, 120), WN(150, 180)], CREAM);
  ext(st, [0, 2500], [0, 0], [D(1000, 100, WOOD), SL(425, 300, 260)], CREAM);
  inn(st, [750, 0], [750, 850], [D(150, 90, WOOD)]); inn(st, [1200, 0], [1200, 600], [D(300, 90, WOOD)]); inn(st, [750, 600], [1500, 600], [D(800, 90, WOOD)]); inn(st, [1000, 600], [1000, 850]);
  inn(st, [0, 850], [1500, 850], [D(375, 90, WOOD), D(1250, 90, WOOD)]); inn(st, [300, 1150], [1500, 1150], [D(600, 90, WOOD), D(1200, 90, WOOD)]); inn(st, [300, 1150], [300, 2050], [D(1900, 90, WOOD)]); inn(st, [900, 1150], [900, 1750]);
  inn(st, [300, 1750], [1500, 1750]); inn(st, [300, 2050], [500, 2050]); inn(st, [500, 1750], [500, 2500], [D(2200, 90, WOOD)]);
  inn(st, [500, 1850], [1500, 1850], [D(1125, 90, WOOD), D(1375, 90, WOOD)]); inn(st, [1000, 1850], [1000, 2500]); inn(st, [1250, 1850], [1250, 2500]);
  // master suite (0..750 × 0..850)
  along(st, "king-bed", "n", 13, 375); along(st, "nightstand", "n", 13, 225); along(st, "nightstand", "n", 13, 525); put(st, "bedroom-bench", 375, 265, "n");
  put(st, "armchair-lounge", 300, 700, "w"); put(st, "armchair-lounge", 480, 700, "e"); put(st, "side-table", 390, 700, "n"); along(st, "dressing-table", "w", 13, 700); put(st, "dining-chair", 130, 700, "e"); put(st, "rug", 375, 450, "n"); put(st, "chandelier", 375, 450, "n", H);
  along(st, "wall-tv", "s", 842, 600, { y: 110 }); along(st, "chest-of-drawers", "s", 842, 600); put(st, "table-lamp", 225, 36, "n", 100); put(st, "table-lamp", 525, 36, "n", 100); put(st, "houseplant", 60, 800, "n");
  // master bath (750..1200 × 0..600) and wardrobe (1200..1500 × 0..600)
  along(st, "bathtub", "n", 13, 950); along(st, "double-vanity", "s", 592, 975); corner(st, "shower-glass", 1192, 13, "ne"); along(st, "toilet", "w", 757, 350); along(st, "bidet", "w", 757, 470);
  put(st, "bath-mat", 975, 350, "n"); along(st, "towel-rail", "e", 1192, 400); lights(st, H, [[875, 300], [1100, 300]], "ceiling-flush");
  along(st, "closet-rail", "n", 13, 1350); along(st, "closet-rail", "s", 592, 1350); along(st, "standing-mirror", "e", 1492, 450); put(st, "chest-of-drawers", 1350, 300, "n"); put(st, "ceiling-flush", 1350, 300, "n", H);
  // cedar closet (750..1000 × 600..850) and utility (1000..1500 × 600..850)
  along(st, "wardrobe", "s", 842, 875); along(st, "wall-shelves", "w", 757, 680, { y: 150 }); put(st, "ceiling-flush", 875, 725, "n", H);
  along(st, "washing-machine", "n", 607, 1300); along(st, "dryer", "n", 607, 1365); along(st, "steel-shelf", "e", 1492, 725); put(st, "ironing-board", 1100, 740, "n"); put(st, "ceiling-flush", 1250, 725, "n", H);
  // gallery (z 850..1150 and x 0..300 down to the hall)
  along(st, "console-table", "n", 857, 600); along(st, "console-table", "n", 857, 1100); put(st, "round-rug", 150, 1000, "n"); along(st, "picture", "n", 857, 750, { y: 160 }); put(st, "houseplant", 1445, 1100, "n");
  for (const x of [300, 750, 1200]) put(st, "chandelier", x, 1000, "n", H); put(st, "chandelier", 150, 1500, "n", H); put(st, "chandelier", 150, 2200, "n", H); put(st, "houseplant", 60, 2450, "n"); put(st, "floor-vase", 400, 2460, "n");
  // office (300..900 × 1150..1750) and library (900..1500 × 1150..1750)
  along(st, "desk", "s", 1742, 600); put(st, "office-chair", 600, 1600, "n"); put(st, "laptop", 600, 1690, "s", 75); along(st, "bookshelf", "w", 307, 1400); along(st, "bookshelf", "w", 307, 1550); along(st, "filing-cabinet", "e", 892, 1300);
  put(st, "armchair", 800, 1500, "e"); put(st, "round-rug", 600, 1400, "n"); put(st, "chandelier", 600, 1450, "n", H);
  for (const z of [1300, 1450, 1600]) along(st, "bookshelf", "e", 1492, z); for (const z of [1300, 1450, 1600]) along(st, "bookshelf", "w", 907, z);
  put(st, "armchair-lounge", 1100, 1450, "w"); put(st, "armchair-lounge", 1300, 1450, "e"); put(st, "side-table", 1200, 1450, "n"); put(st, "round-rug", 1200, 1450, "n"); put(st, "floor-lamp", 1200, 1700, "n"); put(st, "chandelier", 1200, 1450, "n", H);
  // powder room (300..500 × 1750..2050)
  along(st, "toilet", "n", 1757, 420); along(st, "washbasin-pedestal", "s", 2042, 400); along(st, "wall-mirror", "s", 2042, 400, { y: 110 }); put(st, "ceiling-flush", 400, 1900, "n", H);
  // gym (500..1000 × 1850..2500), pet room (1000..1250 × 1850..2500), utility (1250..1500 × 1850..2500)
  put(st, "treadmill", 620, 2000, "e"); put(st, "exercise-bike", 730, 2000, "e"); put(st, "weight-bench", 850, 2300, "n"); along(st, "dumbbell-rack", "s", 2492, 600); put(st, "yoga-mat", 900, 2050, "n"); along(st, "gym-mirror", "e", 992, 2200); along(st, "wall-tv", "n", 1857, 600, { y: 170 });
  along(st, "dog-house", "s", 2492, 1125); put(st, "cat-tree", 1050, 1900, "n"); put(st, "bucket", 1210, 1900, "n"); put(st, "ceiling-flush", 1125, 2175, "n", H);
  along(st, "water-heater", "n", 1857, 1300); along(st, "breaker-panel", "n", 1857, 1420, { y: 150 }); along(st, "steel-shelf", "s", 2492, 1375); put(st, "water-tank", 1420, 2000, "n"); put(st, "ceiling-flush", 1375, 2175, "n", H);
  lights(st, H, [[650, 2000], [850, 2000]], "spot-rail");
  along(st, "wall-sconce", "e", -13, 425, { y: 250 });
}

/** A garage (w × 700) with its doors on the east (doorsEast) or west wall, towards the motor court. */
function garage(st, w, cars, doorsEast) {
  const d = cars.length * 280 + 160;
  floor(st, 0, 0, w, d, "concrete", "#b9b6ad");
  const doorWall = doorsEast ? [[w, 0], [w, d]] : [[0, d], [0, 0]];
  const otherWall = doorsEast ? [[0, d], [0, 0]] : [[w, 0], [w, d]];
  const far = doorsEast ? 150 : w - 150; // the wall away from the doors
  ext(st, [0, 0], [w, 0], [WS(w / 2, 180, 60, 220)], CREAM); ext(st, [w, d], [0, d], [], CREAM);
  ext(st, doorWall[0], doorWall[1], cars.map((_, i) => GD(200 + i * 280, 260, 240)), CREAM); ext(st, otherWall[0], otherWall[1], [], CREAM);
  cars.forEach((car, i) => put(st, car, w / 2, 200 + i * 280, doorsEast ? 0 : 180)); // nose towards the court
  along(st, "workbench", "n", 13, far); along(st, "tool-chest", "s", d - 13, doorsEast ? 120 : w - 120); along(st, "steel-shelf", "s", d - 13, doorsEast ? 330 : w - 330);
  cars.forEach((_, i) => put(st, "downlight", w / 2, 200 + i * 280, "n", 300));
}

function outdoors(p) {
  terrain(p, 6200, 6000, 96, (x, z) => 3 * Math.sin(x / 600) * Math.cos(z / 500));
  const light = "#d9d4c8";
  // inner courtyard between the wings and the pool beyond it
  path(p, rect(-800, -1600, 800, -500), "stoneTiles", light); path(p, rect(-800, -500, -400, -200), "stoneTiles", light); path(p, rect(400, -500, 800, -200), "stoneTiles", light);
  pond(p, circle(0, -1050, 160, 16), { depth: 40, height: 15, tint: "#8fa6b8" }); lot(p, "bird-bath", 0, -1050);
  for (const [x, z] of [[-650, -1450], [650, -1450], [-650, -650], [650, -650]]) lot(p, "planter", x, z, "n", 3); for (const [x, z] of [[-650, -1450], [650, -1450]]) lot(p, "houseplant", x, z, "n", 3);
  lot(p, "bench", -600, -1050, "w", 3); lot(p, "bench", 600, -1050, "e", 3); lot(p, "outdoor-sofa", 0, -1500, "n", 3); for (const [x, z] of [[-300, -1400], [300, -1400], [-300, -700], [300, -700]]) lot(p, "flower-bed", x, z, "n", 3);
  for (const [x, z] of [[-750, -1550], [750, -1550], [-750, -550], [750, -550]]) lot(p, "garden-bollard", x, z, "n", 3);
  path(p, rect(-1200, -2600, 1200, -1600), "stoneTiles", light);
  for (const r of [rect(-900, -2500, -700, -1800), rect(700, -2500, 900, -1800), rect(-700, -2500, 700, -2400), rect(-700, -1900, 700, -1800)]) deck(p, r, { height: 12 });
  pool(p, rect(-700, -2400, 700, -1900), { depth: 160 }); pool(p, circle(-1000, -2250, 180, 16), { depth: 90, tint: "#8fd4ea" });
  for (const x of [-300, -100, 100, 300, 500]) lot(p, "lounger", x, -1700, "n", 3); lot(p, "beach-umbrella", 0, -1700, "n", 3); lot(p, "beach-umbrella", 400, -1700, "n", 3);
  lot(p, "outdoor-kitchen", 1000, -2550, "n", 3); lot(p, "outdoor-dining-set", 1000, -2300, "n", 3); lot(p, "pergola", 1000, -2300, "n", 3); for (const x of [880, 1120]) lot(p, "pendant-lamp", x, -2300, "n", 250, 3);
  for (const [x, z] of [[-1150, -2550], [1150, -2550]]) lot(p, "planter", x, z, "n", 3);
  // the motor court with its fountain, the drive and the street, lawns and old trees
  path(p, rect(-1600, 800, 1400, 2000), "paving", "#8a8680", 4); pond(p, circle(0, 1400, 220, 20), { depth: 40, height: 15, tint: "#8fa6b8" }); lot(p, "bird-bath", 0, 1400);
  path(p, rect(-300, 2000, 300, 2500), "paving", "#8a8680", 4); path(p, rect(-3100, 2500, 3100, 2600), "paving", "#bfbab0", 6); path(p, rect(-3100, 2600, 3100, 2900), "asphalt", null, 2);
  lot(p, "convertible", 500, 1100, 0, 4); lot(p, "sedan", -500, 1100, 180, 4);
  for (const [x, z] of circle(0, 1400, 330, 10)) lot(p, "flower-bed", x, z, "n", 4);
  for (const x of [-1500, -900, 900, 1500]) lot(p, "lamp", x, 2050); for (const [x, z] of [[-700, 2200], [700, 2200], [-1200, 2300], [1200, 2300]]) lot(p, "bush", x, z);
  for (const [prop, x, z] of [["oak-tree", -2200, -2300], ["oak-tree", 2200, -2300], ["big-tree", -2550, 2400], ["big-tree", 2550, 2400], ["maple-tree", -2600, -300], ["maple-tree", 2600, -300], ["cypress", -2000, 2200], ["cypress", 2000, 2200], ["cypress", -2550, 500], ["cypress", 2550, 500], ["palm-tree", -1300, -2300], ["palm-tree", 1300, -2300]]) lot(p, prop, x, z);
  for (const [x, z] of [[-2500, -1500], [2500, -1500], [-2500, 1200], [2500, 1200], [-2500, -900], [2500, -900], [-1800, -2600], [1800, -2600]]) lot(p, "bush", x, z);
  for (const [x, z] of [[-2500, -1800], [2500, -1800], [-2500, 800], [2500, 800]]) lot(p, "flower-bed", x, z);
  lot(p, "mailbox", 350, 2450, "n"); lot(p, "street-sign", -600, 2540, 180);
  siteWall(p, [[-2800, -2700], [2800, -2700], [2800, 2500], [-2800, 2500], [-2800, -2700]], { height: 220, material: "stone", tint: "#b9b0a0", gates: [gate(5600 + 5200 + 2800 - 150, "sliding"), gate(5600 + 5200 + 2800 + 450 - 55, "single")] });
  fence(p, [[-2750, -2650], [-2750, 2450]], { style: "hedge", height: 150 }); fence(p, [[2750, -2650], [2750, 2450]], { style: "hedge", height: 150 }); fence(p, [[-2750, -2650], [2750, -2650]], { style: "hedge", height: 150 });
}

export function mansionEstate(p, b, g) {
  b.at = [-800, -500];
  g.height = H;
  centre(g);
  b.roof = { ...b.roof, ...ROOF };
  const west = building(p, [-2300, -1700], { roof: ROOF, height: H }); westWing(west.storeys[0]);
  const east = building(p, [800, -1700], { roof: ROOF, height: H }); eastWing(east.storeys[0]);
  const g2 = building(p, [-2300, 1000], { roof: ROOF, height: 300 }); garage(g2.storeys[0], 700, ["suv", "sedan"], true);
  const g3 = building(p, [1400, 1000], { roof: ROOF, height: 300 }); garage(g3.storeys[0], 900, ["sports-car", "convertible", "suv"], false);
  outdoors(p);
  p.sun = { ...p.sun, city: "losangeles", latitude: 34.1, useTime: true, time: 15.5, month: 5 };
}
