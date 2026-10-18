// Coastal mansion: three wings around a pool courtyard, after a Florida
// plan. North wing: family room between two bedroom suites, all opening
// onto a covered lanai. East wing: master suite with bath and walk-in
// closet, pool bath, study, powder room, great room, dining and kitchen,
// with a covered lanai (summer kitchen) along the pool. South block: foyer
// with the entry porch, bedroom 2 with bath, laundry, pantry, mudroom, a
// two-car and a one-car garage. Lap pool with spa, privacy garden.
import { floor, ext, inn, column, D, DD, PS, PD, SL, GD, WN, WS, WP, along, corner, put, lights, rail, lot, path, deck, pool, pond, patch, rect, fence, siteWall, gate, terrain, building } from "./kit.js";

const H = 320;
const SAND = { outerMaterial: "plaster", outerTint: "#efe6d2", tint: "#f7f3ea" };
const UNIT = { material: "woodLight" }, MARBLE = { material: "marble" };
const ROOF = { type: "hip", pitch: 22, overhang: 70, material: "roofTiles", tint: "#8c7a6a" };

/** North wing (local x 0..1700, z 0..800): bedroom 3, family room, bedroom 4 and the lanai along the pool. */
function northWing(st) {
  floor(st, 0, 0, 1450, 600, "woodFloor", "#d9c3a0");
  floor(st, 0, 0, 250, 250, "tiles", "#d8e2e4"); floor(st, 1200, 0, 1450, 250, "tiles", "#d8e2e4");
  floor(st, 0, 600, 1700, 800, "stoneTiles", "#d4cfc4"); floor(st, 1450, 0, 1700, 600, "stoneTiles", "#d4cfc4");
  ext(st, [0, 0], [1450, 0], [WS(125), WS(350), WN(520, 100, 150, 70), WN(930, 100, 150, 70), WS(1100), WS(1325)], SAND);
  ext(st, [1450, 0], [1450, 600], [WN(425, 180)], SAND);
  ext(st, [1450, 600], [0, 600], [SL(1225, 240, 240), SL(725, 300, 240), SL(225, 240, 240)], SAND);
  ext(st, [0, 600], [0, 0], [WN(425, 180)], SAND);
  inn(st, [0, 250], [450, 250], [D(125), D(350)]); inn(st, [250, 0], [250, 250]);
  inn(st, [450, 0], [450, 600], [D(425)]); inn(st, [1000, 0], [1000, 600], [D(425)]);
  inn(st, [1000, 250], [1450, 250], [D(1100), D(1325)]); inn(st, [1200, 0], [1200, 250]);
  // bedroom 3 and its bath / closet
  along(st, "double-bed", "w", 13, 425); along(st, "nightstand", "w", 13, 300); along(st, "nightstand", "w", 13, 560); along(st, "chest-of-drawers", "e", 442, 300); put(st, "rug", 230, 425, "n");
  corner(st, "shower-stall", 13, 13, "nw"); along(st, "toilet", "e", 242, 100); along(st, "washbasin-pedestal", "n", 13, 190); along(st, "wall-mirror", "n", 13, 190, { y: 110 });
  along(st, "chest-of-drawers", "n", 13, 350); along(st, "shoe-rack", "w", 257, 100); along(st, "wall-shelves", "e", 442, 120, { y: 150 });
  // family room
  along(st, "wall-tv", "n", 13, 725, { y: 110 }); along(st, "tv-bench", "n", 13, 725); put(st, "sofa-three-seat", 725, 250, "s"); put(st, "coffee-table", 725, 150, "n");
  put(st, "armchair", 560, 250, "w"); put(st, "armchair", 890, 250, "e"); put(st, "rug", 725, 220, "n"); put(st, "floor-lamp", 480, 560, "n"); put(st, "houseplant", 950, 540, "n"); put(st, "ceiling-fan", 725, 300, "n", H);
  // bedroom 4 and its bath / closet
  along(st, "double-bed", "e", 1442, 425); along(st, "nightstand", "e", 1442, 300); along(st, "nightstand", "e", 1442, 560); along(st, "chest-of-drawers", "w", 1008, 300); put(st, "rug", 1220, 425, "n");
  corner(st, "shower-stall", 1442, 13, "ne"); along(st, "toilet", "w", 1208, 100); along(st, "washbasin-pedestal", "n", 13, 1260); along(st, "wall-mirror", "n", 13, 1260, { y: 110 });
  along(st, "chest-of-drawers", "n", 13, 1100); along(st, "shoe-rack", "e", 1192, 100);
  // the lanai: columns on the open edges, loungers and an outdoor lounge in the corner
  for (const x of [15, 350, 700, 1050, 1400, 1685]) column(st, x, 785, 30, SAND);
  for (const z of [15, 300]) column(st, 1685, z, 30, SAND);
  put(st, "lounger", 400, 740, "n"); put(st, "lounger", 1000, 740, "n"); put(st, "side-table", 700, 740, "n");
  put(st, "outdoor-sofa", 1575, 150, "e"); put(st, "side-table", 1575, 330, "n"); put(st, "planter", 1570, 470, "n"); put(st, "planter", 60, 750, "n"); put(st, "planter", 1620, 720, "n");
  for (const x of [250, 850, 1575]) put(st, "ceiling-fan", x, 700, "n", H); put(st, "ceiling-fan", 1575, 300, "n", H);
  lights(st, H, [[125, 125], [350, 125], [225, 425], [1100, 125], [1325, 125], [1225, 425], [600, 450], [850, 450]], "ceiling-flush");
  for (const x of [225, 725, 1225]) along(st, "wall-sconce", "n", 613, x, { y: 240 });
}

/** East wing (local x 0..1450, z 0..2300): the lanai strip along the pool (x 0..300) and the main rooms. */
function eastWing(st) {
  floor(st, 300, 0, 1450, 2300, "woodFloor", "#d9c3a0");
  floor(st, 750, 0, 1450, 400, "marble", "#e8e2d6"); floor(st, 300, 500, 550, 800, "tiles", "#d8e2e4"); floor(st, 750, 800, 950, 1000, "tiles", "#d8e2e4"); floor(st, 750, 1700, 1450, 2300, "stoneTiles", "#d4cfc4");
  floor(st, 0, 0, 300, 2300, "stoneTiles", "#d4cfc4");
  ext(st, [300, 0], [1450, 0], [WN(525, 180), WS(900), WS(1300)], SAND);
  ext(st, [1450, 0], [1450, 2300], [WS(200), WS(575), WP(1200, 200, 200, 30), WP(1500, 200, 200, 30), WN(1920, 150, 80, 130)], SAND);
  ext(st, [300, 0], [300, 2300], [SL(250, 240, 240), D(650), WN(1000, 120), D(1150), SL(1475, 240, 240), SL(1900, 240, 240)], SAND);
  // south wall: the south block stands against it; the dining and kitchen pass through
  ext(st, [1450, 2300], [300, 2300], [PD(525, 200, 260), PS(1300)], SAND);
  inn(st, [750, 0], [750, 500], [D(450)]); inn(st, [750, 400], [1450, 400], [D(900)]); inn(st, [1050, 400], [1050, 750], [D(575)]);
  inn(st, [750, 500], [750, 800]); inn(st, [300, 500], [550, 500]); inn(st, [550, 500], [550, 800]); inn(st, [300, 800], [750, 800]); inn(st, [750, 750], [1450, 750]);
  inn(st, [750, 800], [750, 1700], [PD(1475, 200, 260)]); inn(st, [750, 800], [950, 800]); inn(st, [950, 800], [950, 1000]); inn(st, [750, 1000], [950, 1000], [D(850)]);
  inn(st, [300, 1250], [750, 1250], [D(525)]); inn(st, [300, 1700], [750, 1700], [PD(525, 160, 240)]); inn(st, [750, 1700], [750, 2300], [PD(1900, 200, 260)]);
  // master suite (300..750 × 0..500)
  along(st, "king-bed", "n", 13, 525); along(st, "nightstand", "n", 13, 360); along(st, "nightstand", "n", 13, 690); put(st, "bedroom-bench", 525, 290, "n");
  put(st, "armchair", 400, 420, "w"); along(st, "chest-of-drawers", "s", 492, 560); along(st, "wall-tv", "s", 492, 560, { y: 160 }); put(st, "rug", 525, 200, "n"); put(st, "ceiling-fan", 525, 250, "n", H);
  put(st, "table-lamp", 360, 40, "n", 100); put(st, "table-lamp", 690, 40, "n", 100);
  // master bath (750..1450 × 0..400), vestibule and walk-in closet
  along(st, "bathtub", "n", 13, 1100); along(st, "double-vanity", "s", 392, 1250); corner(st, "shower-glass", 1442, 13, "ne"); along(st, "toilet", "w", 757, 100); along(st, "bidet", "w", 757, 200);
  along(st, "towel-rail", "s", 392, 1000); put(st, "bath-mat", 1100, 150, "n"); put(st, "houseplant", 1050, 300, "n"); lights(st, H, [[900, 200], [1250, 200]], "ceiling-flush");
  along(st, "bench", "s", 742, 900); along(st, "picture", "n", 407, 900, { y: 150 }); put(st, "ceiling-flush", 900, 575, "n", H);
  along(st, "closet-rail", "n", 407, 1250); along(st, "closet-rail", "s", 742, 1250); put(st, "closet-island", 1270, 575, "n"); along(st, "standing-mirror", "e", 1442, 575); put(st, "ceiling-flush", 1250, 575, "n", H);
  // pool bath (300..550 × 500..800), study (300..750 × 800..1250), powder room (750..950 × 800..1000)
  corner(st, "shower-stall", 542, 507, "ne"); along(st, "toilet", "e", 542, 720); along(st, "washbasin-pedestal", "s", 792, 380); along(st, "wall-mirror", "s", 792, 380, { y: 110 }); put(st, "ceiling-flush", 425, 650, "n", H);
  along(st, "desk", "n", 807, 525); put(st, "office-chair", 525, 940, "s"); put(st, "laptop", 525, 860, "n", 75); along(st, "bookshelf", "e", 742, 900); along(st, "bookshelf", "e", 742, 1040);
  put(st, "armchair", 380, 950, "w"); put(st, "round-rug", 525, 1050, "n"); put(st, "floor-lamp", 400, 1210, "n"); put(st, "ceiling-flush", 525, 1025, "n", H);
  along(st, "toilet", "n", 807, 800); along(st, "washbasin-pedestal", "e", 942, 900); along(st, "wall-mirror", "e", 942, 900, { y: 110 }); put(st, "ceiling-flush", 850, 900, "n", H);
  // hall / gallery (300..750 × 1250..1700)
  along(st, "console-table", "e", 742, 1630); put(st, "round-rug", 525, 1475, "n"); put(st, "houseplant", 360, 1650, "n"); put(st, "chandelier", 525, 1475, "n", H);
  // great room (750..1450 × 1000..1700), open to the kitchen
  along(st, "wall-tv", "n", 1007, 1200, { y: 110 }); along(st, "tv-bench", "n", 1007, 1200); put(st, "sofa-corner", 1150, 1300, "s"); put(st, "coffee-table", 1150, 1130, "n"); put(st, "rug", 1150, 1250, "n");
  put(st, "armchair", 900, 1300, "w"); put(st, "floor-lamp", 880, 1120, "n"); put(st, "houseplant", 1400, 1660, "n"); put(st, "ceiling-fan", 1100, 1350, "n", H); lights(st, H, [[900, 1600], [1350, 1600]]);
  // dining (300..750 × 1700..2300)
  put(st, "dining-table", 525, 2000, "e");
  for (const z of [1950, 2050]) { put(st, "dining-chair", 455, z, "w"); put(st, "dining-chair", 595, z, "e"); }
  put(st, "dining-chair", 525, 1870, "n"); put(st, "dining-chair", 525, 2130, "s"); along(st, "sideboard", "e", 742, 2200); put(st, "chandelier", 525, 2000, "n", H);
  // kitchen (750..1450 × 1700..2300): units along the east wall, island with stools towards the great room
  along(st, "kitchen-fridge-70", "e", 1442, 1785, UNIT); along(st, "kitchen-base-60", "e", 1442, 1850, UNIT); along(st, "kitchen-sink-80", "e", 1442, 1920, UNIT); along(st, "kitchen-base-60", "e", 1442, 1990, UNIT);
  along(st, "kitchen-stove-60", "e", 1442, 2050, UNIT); along(st, "kitchen-base-60", "e", 1442, 2110, UNIT); along(st, "dishwasher", "e", 1442, 2167); corner(st, "kitchen-corner-90", 1442, 2287, "se", UNIT);
  for (const z of [1850, 1990, 2110]) along(st, "kitchen-wall-60", "e", 1442, z, { y: 145, ...UNIT });
  put(st, "microwave", 1410, 1850, "e", 93); put(st, "coffee-machine", 1410, 2110, "e", 93); put(st, "kitchen-island", 1050, 2000, "e", 0, MARBLE);
  for (const z of [1940, 2000, 2060]) put(st, "bar-stool", 950, z, "w"); for (const z of [1940, 2060]) put(st, "pendant-lamp", 1050, z, "n", H);
  put(st, "kitchen-bin", 790, 2260, "s"); put(st, "houseplant", 800, 1730, "n"); lights(st, H, [[1100, 1800], [1300, 1800]]);
  // the lanai strip: summer kitchen, outdoor dining, columns and fans
  along(st, "outdoor-kitchen", "e", 292, 900); put(st, "outdoor-dining-set", 150, 2160, "n"); put(st, "outdoor-sofa", 150, 450, "n"); put(st, "planter", 60, 60, "n");
  for (const z of [15, 400, 800, 1200, 1600, 2000, 2285]) column(st, 15, z, 30, SAND);
  for (const z of [600, 1400, 2000]) put(st, "ceiling-fan", 150, z, "n", H);
  for (const z of [250, 1475, 1900]) along(st, "wall-sconce", "w", 313, z, { y: 240 });
}

/** South block (local x 0..2600, z 0..1100): garages, bedroom 2, foyer with the entry porch, laundry, pantry and mudroom. */
function southBlock(st) {
  floor(st, 0, 0, 2600, 700, "woodFloor", "#d9c3a0");
  floor(st, 0, 0, 700, 1100, "concrete", "#b9b6ad"); floor(st, 2150, 300, 2600, 1100, "concrete", "#b9b6ad");
  floor(st, 1150, 0, 1450, 450, "tiles", "#d8e2e4"); floor(st, 1450, 0, 1900, 700, "marble", "#e8e2d6"); floor(st, 1900, 0, 2600, 300, "tiles", "#d8d4cc");
  floor(st, 700, 700, 2150, 1100, "stoneTiles", "#d4cfc4");
  // north wall just south of the east wing's wall; the pool side gets the bedroom's sliding door
  ext(st, [0, 12], [1450, 12], [SL(925, 240, 240), WS(1300)], SAND);
  ext(st, [1450, 12], [2600, 12], [PD(1675, 200, 260), D(2450)], SAND);
  ext(st, [2600, 12], [2600, 1100], [WS(150), WN(700, 120), WN(950, 120)], SAND);
  ext(st, [2600, 1100], [700, 1100], [GD(2375, 260, 240), DD(1675, 160, { height: 240, colors: { leafColor: "#3b6c8a", frameColor: "#f0ede6" } })], SAND);
  ext(st, [700, 1100], [0, 1100], [GD(500, 260, 240), GD(200, 260, 240)], SAND);
  ext(st, [0, 1100], [0, 12], [WN(500, 120, 60, 200)], SAND);
  // the porch is open on the garden side: columns instead of a wall
  inn(st, [700, 12], [700, 1100], [D(575)]); inn(st, [700, 450], [1450, 450], [D(925), D(1300)]); inn(st, [1150, 12], [1150, 450]);
  inn(st, [1450, 12], [1450, 700], [D(575)]); inn(st, [1900, 12], [1900, 700], [D(500)]); inn(st, [1900, 300], [2300, 300], [D(2025)]); inn(st, [2300, 12], [2300, 300], [D(150)]);
  inn(st, [2150, 300], [2150, 700], [D(500)]); inn(st, [700, 700], [1450, 700]); inn(st, [1900, 700], [2150, 700]);
  for (const x of [715, 1075, 1435, 1795, 2135]) column(st, x, 1085, 30, SAND);
  // bedroom 2 (700..1150 × 12..450) and bath 2 (1150..1450 × 12..450)
  along(st, "double-bed", "w", 707, 230); along(st, "nightstand", "w", 707, 100); along(st, "nightstand", "w", 707, 360); along(st, "wardrobe", "e", 1142, 230); put(st, "rug", 930, 230, "n"); put(st, "ceiling-fan", 925, 230, "n", H);
  corner(st, "shower-stall", 1442, 25, "ne"); along(st, "toilet", "w", 1157, 120); along(st, "washbasin-pedestal", "w", 1157, 280); along(st, "wall-mirror", "w", 1157, 280, { y: 110 }); put(st, "ceiling-flush", 1300, 230, "n", H);
  // hall (700..1450 × 450..700), foyer (1450..1900 × 12..700)
  along(st, "console-table", "s", 692, 1100); along(st, "picture", "s", 692, 1100, { y: 150 }); put(st, "ceiling-flush", 1075, 575, "n", H);
  along(st, "console-table", "e", 1892, 250); put(st, "round-rug", 1675, 350, "n"); put(st, "houseplant", 1500, 60, "n"); put(st, "houseplant", 1850, 660, "n"); put(st, "doormat", 1675, 660, "n"); put(st, "chandelier", 1675, 350, "n", H);
  // laundry (1900..2300 × 12..300), pantry (2300..2600 × 12..300), mudroom (1900..2150 × 300..700)
  along(st, "washing-machine", "n", 25, 1960); along(st, "dryer", "n", 25, 2025); put(st, "ironing-board", 2150, 200, "n"); along(st, "drying-rack", "w", 1907, 150); put(st, "laundry-basket", 2240, 80, "n");
  along(st, "steel-shelf", "e", 2592, 150); along(st, "wine-rack", "n", 25, 2360); put(st, "cardboard-boxes", 2400, 240, "n");
  along(st, "bench", "s", 692, 2025); put(st, "coat-rack", 1930, 330, "n"); along(st, "shoe-rack", "e", 2142, 400);
  lights(st, H, [[2100, 150], [2450, 150], [2025, 500]], "ceiling-flush");
  // garages and the porch
  put(st, "suv", 190, 650, 90); put(st, "sports-car", 500, 650, 90); along(st, "workbench", "n", 25, 350); along(st, "tool-board", "n", 25, 350, { y: 100 }); along(st, "steel-shelf", "w", 13, 300);
  put(st, "sedan", 2375, 660, 90); along(st, "tool-chest", "n", 307, 2500); put(st, "bicycle", 2560, 450, 90);
  for (const [x, z] of [[190, 400], [190, 900], [500, 400], [500, 900], [2375, 500], [2375, 1000]]) put(st, "downlight", x, z, "n", H);
  put(st, "bench", 900, 1050, "s"); put(st, "planter", 790, 1050, "n"); put(st, "planter", 2060, 1050, "n"); put(st, "planter", 1300, 1050, "n");
  for (const x of [1560, 1790]) along(st, "wall-lantern", "n", 1113, x, { y: 220 }); for (const x of [900, 1300, 2000]) put(st, "ceiling-flush", x, 900, "n", H);
}

function outdoors(p) {
  terrain(p, 3400, 5800, 96, (x, z) => 3 * Math.sin(x / 500) * Math.cos(z / 700));
  const light = "#d9d4c8";
  // the pool courtyard between the wings
  path(p, rect(-1300, -1300, -150, 1000), "stoneTiles", light);
  pool(p, rect(-1050, -1100, -700, 400), { depth: 150 }); pool(p, rect(-1280, -400, -1080, -200), { depth: 90, tint: "#8fd4ea" });
  for (const z of [-900, -700, -500, 0, 200]) lot(p, "lounger", -1200, z, "w", 3); lot(p, "side-table", -1200, -600, "n", 3); lot(p, "beach-umbrella", -1200, 100, "n", 3);
  for (const z of [-900, -300, 300, 800]) lot(p, "planter", -300, z, "n", 3); lot(p, "planter", -1250, 900, "n", 3); lot(p, "planter", -1250, -1200, "n", 3);
  lot(p, "outdoor-dining-set", -550, 750, "n", 3); lot(p, "fire-pit", -900, 700, "n", 3); lot(p, "outdoor-sofa", -900, 880, "s", 3);
  for (const [x, z] of [[-250, -1250], [-250, 950], [-1250, 500]]) lot(p, "garden-bollard", x, z, "n", 3);
  for (const [x, z] of [[-1200, -1150], [-400, -1150], [-1200, 650]]) lot(p, "palm-tree", x, z);
  // privacy garden by the master suite, side path along the east wall
  patch(p, rect(400, -2100, 1300, -1300), "gravel", "#d6cbb3"); path(p, rect(700, -1900, 1000, -1400), "stone", light, 4);
  lot(p, "bench", 850, -1420, "s", 4); lot(p, "bird-bath", 850, -1700); for (const [x, z] of [[500, -2000], [1200, -2000], [500, -1400], [1200, -1400]]) lot(p, "flower-bed", x, z);
  for (const [x, z] of [[600, -1750], [1100, -1750]]) lot(p, "planter", x, z); lot(p, "palm-tree", 1250, -1600); lot(p, "tree", 650, -1550);
  path(p, rect(1300, -2100, 1400, 2100), "stone", light, 4);
  // the front: drives to both garages, the path to the porch, lawn and palms, the street
  path(p, rect(-1300, 2100, -600, 2600), "paving", "#9a968e", 4); path(p, rect(850, 2100, 1300, 2600), "paving", "#9a968e", 4);
  path(p, rect(-300, 2100, 300, 2600), "stoneTiles", light, 4);
  for (const [x, z] of [[-450, 2250], [450, 2250], [-450, 2450], [450, 2450]]) lot(p, "flower-bed", x, z);
  for (const [x, z] of [[-550, 2350], [550, 2350]]) lot(p, "palm-tree", x, z); for (const z of [2200, 2450]) { lot(p, "garden-bollard", -350, z); lot(p, "garden-bollard", 350, z); }
  path(p, rect(-1700, 2600, 1700, 2700), "paving", "#bfbab0", 6); path(p, rect(-1700, 2700, 1700, 2900), "asphalt", null, 2);
  lot(p, "mailbox", 350, 2630, "n"); lot(p, "lamp", -1500, 2650); lot(p, "lamp", 1500, 2650);
  // side gardens, hedges and the perimeter wall
  for (const [x, z] of [[-1000, -2350], [0, -2350], [-1300, 2350], [1300, 2350]]) lot(p, "palm-tree", x, z);
  for (const [x, z] of [[-1380, -1800], [-1380, -1000], [-1380, 1200], [1380, -800], [1380, 1000], [1380, 1900]]) lot(p, "bush", x, z);
  lot(p, "ipe-tree", 700, -2400); lot(p, "banana-plant", -600, -2380); lot(p, "banana-plant", 1200, 2380);
  siteWall(p, [[-1450, -2550], [1450, -2550], [1450, 2600], [-1450, 2600], [-1450, -2550]], { height: 200, material: "plaster", tint: "#efe6d2", gates: [gate(2900 + 5150 + 1450 - 950 - 150, "sliding"), gate(2900 + 5150 + 1450 + 150 - 55, "single"), gate(2900 + 5150 + 1450 + 1075 - 150, "sliding")] });
  fence(p, [[-1400, -2500], [-1400, 2000]], { style: "hedge", height: 120 }); fence(p, [[1400, -2500], [1400, 2000]], { style: "hedge", height: 120 });
}

export function mansionCoastal(p, b, g) {
  b.at = [-150, -1300];
  g.height = H;
  eastWing(g);
  b.roof = { ...b.roof, ...ROOF };
  const north = building(p, [-1300, -2100], { roof: ROOF, height: H }); northWing(north.storeys[0]);
  const south = building(p, [-1300, 1000], { roof: ROOF, height: H }); southBlock(south.storeys[0]);
  outdoors(p);
  p.sun = { ...p.sun, city: "miami", latitude: 25.8, useTime: true, time: 15, month: 3 };
}
