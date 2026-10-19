// Village: two blocks of twelve lots (10 × 20 m) on a grid of streets with
// sidewalks, lamps and trees. Twenty-four single-storey houses built from
// three plans: A (2 bedrooms, 9 × 11.5 m), B (3 bedrooms with a laundry,
// 10 × 12 m) and C (open living and kitchen, 3 bedrooms, 10 × 11 m). Each
// house gets its own façade and roof colours, floor, furniture (sofas,
// beds, a kids' room, a study or a guest room) and garden: driveway and
// car, fence and gate, trees, clothesline, barbecue, dog house, swing...
// The houses on the south row are turned around to face their own street.
// Building coordinates are cm, origin at the north-west corner of each house, front to the north.
import { floor, ext, inn, D, PD, PS, WN, WS, along, corner, put, lights, lot, path, patch, rect, fence, siteWall, gate, terrain, building } from "./kit.js";

const H = 290, LOT_W = 1300, LOT_D = 2600, SETBACK = 450, STREET = 1000;
const OX = -8300, OZ = -2600; // world offset of the grid origin (north-west corner of the first block)
const FACADES = ["#f3e7c9", "#e9d3b3", "#cfe0ea", "#f2c9b8", "#dfe6cf", "#f5efe4", "#e6cfd9", "#d8d2c4"];
const ROOFS = [{ material: "roofTiles", tint: "#c8653f" }, { material: "roofTiles", tint: "#9a5a44" }, { material: "fiberCement", tint: "#8a8f94" }, { material: "roofTiles", tint: "#b7784f" }, { material: "fiberCement", tint: "#6e7f8c" }];
const FLOORS = ["#c9a378", "#b98b5c", "#d9c3a0", "#caa379", "#a8784f"];
const UNITS = ["woodLight", "woodDark", "plaster", "woodLight"];
const WOOD = { colors: { leafColor: "#5a4636", frameColor: "#f2efe8" } };

/** Faces and helpers for a house of width w and depth d (interior walls 15, exterior 25). */
function frame(st, w, d) {
  return {
    W: 13, E: w - 13, N: 13, S: d - 13,
    A: (prop, side, face, at, o = {}) => along(st, prop, side, face, at, o),
    P: (prop, x, z, back = "n", y = 0, o = {}) => put(st, prop, x, z, back, y, o),
  };
}

/** Plan A (900 × 1150): living | bedroom 1 in front; corridor with the bathroom and laundry; kitchen-dining and bedroom 2 behind. */
function houseA(st, v) {
  const F = { outerMaterial: "plaster", outerTint: v.facade, tint: "#f6f2ea" };
  const { W, E, N, S, A, P } = frame(st, 900, 1150);
  floor(st, 0, 0, 900, 1150, "woodFloor", v.floor);
  floor(st, 0, 500, 500, 1150, "tiles", "#d8d4cc"); floor(st, 650, 400, 900, 770, "tiles", "#cfd8d8");
  ext(st, [0, 0], [900, 0], [WN(100, 120), D(300, 90, WOOD), WN(700, 150)], F);
  ext(st, [900, 0], [900, 1150], [WN(200, 120), WS(560, 60, 60, 160), WS(695, 60, 60, 160), WN(1060, 150)], F);
  ext(st, [900, 1150], [0, 1150], [WN(700, 150), D(400, 90, WOOD), WN(150, 120)], F);
  ext(st, [0, 1150], [0, 0], [WN(850, 150), WN(250, 150)], F);
  inn(st, [500, 0], [500, 400]); inn(st, [500, 500], [500, 1150]); inn(st, [0, 500], [500, 500], [PD(250, 160)]);
  inn(st, [500, 400], [900, 400], [D(560, 90, WOOD)]);
  inn(st, [650, 400], [650, 770], [D(500, 80, WOOD), D(695, 80, WOOD)]); inn(st, [650, 620], [900, 620]);
  inn(st, [500, 770], [900, 770], [D(575, 90, WOOD)]);
  // living (0..500 × 0..500)
  A(v.sofa, "w", W, 350); A("tv-bench", "e", 492, 250); A("wall-tv", "e", 492, 250, { y: 110 });
  P("coffee-table", 280, 350, "n"); P("rug", 280, 330, "n"); A("bookshelf", "n", N, 420); P("floor-lamp", 60, 60, "n"); P("doormat", 300, 40, "n");
  // kitchen and dining (0..500 × 500..1150): units on the west wall, table in the middle, counter by the back door
  A("kitchen-fridge-70", "w", W, 560, { material: v.units }); A("kitchen-sink-80", "w", W, 640, { material: v.units }); A("kitchen-stove-60", "w", W, 710, { material: v.units }); A("kitchen-base-60", "w", W, 770, { material: v.units });
  A("kitchen-wall-60", "w", W, 640, { y: 145, material: v.units }); A("kitchen-wall-60", "w", W, 770, { y: 145, material: v.units }); A("kitchen-hood", "w", W, 710);
  A("kitchen-counter", "s", S, 150, { material: v.units }); P("microwave", 150, 1100, "n", 94); P("kitchen-bin", 250, 1110, "n"); P("houseplant", 460, 560, "n");
  P("dining-table", 300, 800, "n"); P("dining-chair", 240, 720, "n"); P("dining-chair", 360, 720, "n"); P("dining-chair", 240, 880, "s"); P("dining-chair", 360, 880, "s");
  P("pendant-lamp", 300, 800, "n", H);
  // bedroom 1 (500..900 × 0..400)
  A("double-bed", "e", E, 200); A("nightstand", "e", E, 70); A("nightstand", "e", E, 330); P("table-lamp", 862, 70, "n", 100);
  A("wardrobe", "w", 508, 100); P("round-rug", 620, 280, "n"); A("picture", "n", N, 560, { y: 150 });
  // bathroom (650..900 × 400..620) and laundry (650..900 × 620..770)
  corner(st, "shower-stall", E, 408, "ne"); A("toilet", "s", 612, 830); A("washbasin-pedestal", "s", 612, 720); A("wall-mirror", "s", 612, 720, { y: 110 }); P("towel-rail", 660, 460, "w", 100); P("bath-mat", 760, 560, "n");
  A("washing-machine", "e", E, 660); A("dryer", "e", E, 724); A("wall-shelves", "e", E, 690, { y: 150 });
  // bedroom 2 (500..900 × 770..1150): the kids' room, a student's room or the study
  if (v.bed2 === "kids") { A("bunk-bed", "e", E, 900); A("toy-chest", "n", 778, 700); P("plush-bear", 700, 800, "n", 65); A("wardrobe", "w", 508, 1050); P("round-rug", 650, 1000, "n"); }
  else if (v.bed2 === "study") { A("sofa-bed", "e", E, 900); A("desk", "w", 508, 950); P("office-chair", 650, 950, "e"); P("laptop", 550, 950, "w", 75); A("bookshelf", "n", 778, 700); }
  else { A("single-bed", "e", E, 900); A("study-desk", "s", S, 800); P("chair", 800, 1000, "n"); A("wardrobe", "w", 508, 1050); A("chest-of-drawers", "n", 778, 700); }
  A("picture", "e", E, 1050, { y: 150 });
  lights(st, H, [[250, 250], [250, 800], [700, 200], [575, 580], [775, 510], [775, 695], [700, 960]], "ceiling-flush");
  along(st, "wall-lantern", "n", -13, 400, { y: 230 });
}

/** Plan B (1000 × 1200): three bedrooms; living | bedroom 1 in front, bathroom and bedroom 3 off the corridor, kitchen, laundry and bedroom 2 behind. */
function houseB(st, v) {
  const F = { outerMaterial: "plaster", outerTint: v.facade, tint: "#f6f2ea" };
  const { W, E, N, S, A, P } = frame(st, 1000, 1200);
  floor(st, 0, 0, 1000, 1200, "woodFloor", v.floor);
  floor(st, 0, 500, 500, 1200, "tiles", "#d8d4cc"); floor(st, 650, 400, 1000, 600, "tiles", "#cfd8d8");
  ext(st, [0, 0], [1000, 0], [WN(120, 150), D(320, 90, WOOD), WN(750, 180)], F);
  ext(st, [1000, 0], [1000, 1200], [WN(200, 120), WS(560, 60, 60, 160), WN(750, 120)], F);
  ext(st, [1000, 1200], [0, 1200], [WN(750, 150), WS(400, 100, 60, 160), D(150, 90, WOOD)], F);
  ext(st, [0, 1200], [0, 0], [WN(1100, 100), WN(750, 150), WN(250, 150)], F);
  inn(st, [500, 0], [500, 400]); inn(st, [500, 500], [500, 1200]); inn(st, [0, 500], [500, 500], [PD(250, 160)]);
  inn(st, [500, 400], [1000, 400], [D(560, 90, WOOD)]);
  inn(st, [650, 400], [650, 900], [D(500, 80, WOOD), D(750, 90, WOOD)]); inn(st, [650, 600], [1000, 600]);
  inn(st, [500, 900], [1000, 900], [D(575, 90, WOOD)]);
  inn(st, [0, 1000], [500, 1000], [D(380, 90, WOOD)]);
  // living (0..500 × 0..500)
  A(v.sofa, "w", W, 350); A("tv-bench", "e", 492, 250); A("wall-tv", "e", 492, 250, { y: 110 });
  P("coffee-table", 280, 350, "n"); P("rug", 280, 330, "n"); A("console-table", "n", N, 430); P("floor-lamp", 60, 60, "n"); P("doormat", 320, 40, "n");
  if (v.sofa === "sofa-two-seat") P("armchair", 420, 440, "s");
  // kitchen (0..500 × 500..1000): units on the west wall and the south wall, table in the middle
  A("kitchen-fridge-70", "w", W, 560, { material: v.units }); A("kitchen-sink-80", "w", W, 640, { material: v.units }); A("kitchen-stove-60", "w", W, 710, { material: v.units }); A("kitchen-base-60", "w", W, 770, { material: v.units });
  A("kitchen-wall-60", "w", W, 640, { y: 145, material: v.units }); A("kitchen-wall-60", "w", W, 770, { y: 145, material: v.units }); A("kitchen-hood", "w", W, 710);
  A("kitchen-counter", "s", 992, 150, { material: v.units }); P("microwave", 150, 950, "n", 94); P("coffee-machine", 100, 950, "n", 94); P("kitchen-bin", 250, 965, "n");
  P("round-table", 320, 760, "n"); P("dining-chair", 320, 680, "n"); P("dining-chair", 320, 840, "s"); P("dining-chair", 240, 760, "w"); P("dining-chair", 400, 760, "e"); P("pendant-lamp", 320, 760, "n", H);
  // laundry (0..500 × 1000..1200) with the back door
  A("washing-machine", "e", 492, 1050); A("dryer", "e", 492, 1115); A("drying-rack", "w", W, 1100); P("ironing-board", 280, 1120, "n"); P("laundry-basket", 420, 1170, "n"); A("wall-shelves", "n", 1008, 300, { y: 150 });
  // bedroom 1 (500..1000 × 0..400)
  A(v.bed1, "e", E, 200); A("nightstand", "e", E, 70); A("nightstand", "e", E, 330); P("table-lamp", 962, 330, "n", 100);
  A("wardrobe", "w", 508, 100); P("bedroom-bench", 630, 200, 90); P("round-rug", 720, 260, "n");
  // bathroom (650..1000 × 400..600)
  corner(st, "shower-stall", E, 408, "ne"); A("toilet", "s", 592, 800); A("washbasin-pedestal", "s", 592, 710); A("wall-mirror", "s", 592, 710, { y: 110 }); P("towel-rail", 660, 450, "w", 100); P("bath-mat", 760, 520, "n");
  // bedroom 3 (650..1000 × 600..900): a small guest or baby room
  if (v.bed3 === "baby") { A("baby-crib", "e", E, 700); A("chest-of-drawers", "s", 892, 900); P("armchair", 760, 850, "s"); P("round-rug", 800, 750, "n"); }
  else { A("single-bed", "s", 892, 880); A("chest-of-drawers", "n", 608, 900); P("houseplant", 700, 650, "n"); A("picture", "e", E, 700, { y: 150 }); }
  // bedroom 2 (500..1000 × 900..1200)
  if (v.bed2 === "kids") { A("bunk-bed", "e", E, 1050); A("toy-chest", "n", 908, 700); P("plush-bear", 700, 930, "n", 65); A("wardrobe", "w", 508, 1100); P("round-rug", 700, 1080, "n"); }
  else { A("single-bed", "s", S, 780); A("study-desk", "e", E, 1000); P("chair", 870, 1000, "w"); A("wardrobe", "w", 508, 1100); P("laptop", 950, 1000, "e", 75); }
  lights(st, H, [[250, 250], [250, 750], [250, 1100], [750, 200], [575, 650], [825, 500], [825, 750], [750, 1050]], "ceiling-flush");
  along(st, "wall-lantern", "n", -13, 420, { y: 230 });
}

/** Plan C (1000 × 1100): open living and kitchen across the front, bathroom and three bedrooms behind a short corridor. */
function houseC(st, v) {
  const F = { outerMaterial: "plaster", outerTint: v.facade, tint: "#f6f2ea" };
  const { W, E, N, S, A, P } = frame(st, 1000, 1100);
  floor(st, 0, 0, 1000, 1100, "woodFloor", v.floor);
  floor(st, 550, 0, 1000, 450, "tiles", "#d8d4cc"); floor(st, 750, 450, 1000, 600, "tiles", "#cfd8d8");
  ext(st, [0, 0], [1000, 0], [WN(150, 180, 150, 60), D(380, 90, WOOD), WN(800, 150)], F);
  ext(st, [1000, 0], [1000, 1100], [D(380, 90, WOOD), WN(850, 120)], F);
  ext(st, [1000, 1100], [0, 1100], [WN(720, 120), WN(500, 150), WN(175, 150)], F);
  ext(st, [0, 1100], [0, 0], [WN(850, 120), WN(250, 180, 150, 60)], F);
  inn(st, [0, 450], [750, 450]); inn(st, [750, 450], [750, 600], [D(500, 70, WOOD)]); inn(st, [750, 600], [1000, 600]);
  inn(st, [0, 600], [750, 600], [D(280, 90, WOOD), D(420, 90, WOOD), D(705, 90, WOOD)]);
  inn(st, [350, 600], [350, 1100]); inn(st, [650, 600], [650, 1100]);
  // living (0..550 × 0..450): sofa facing the TV on the west wall
  A("tv-bench", "w", W, 250); A("wall-tv", "w", W, 250, { y: 110 }); P(v.sofa, 300, 250, "e"); P("coffee-table", 180, 250, "n"); P("rug", 190, 250, "n");
  P("armchair", 160, 60, "n"); P("floor-lamp", 60, 420, "n"); A("bookshelf", "s", 442, 150); P("houseplant", 520, 400, "n"); P("doormat", 380, 40, "n");
  // kitchen (550..1000 × 0..450): units along the north and east walls, island with stools, side door to the yard
  A("kitchen-fridge-70", "n", N, 600, { material: v.units }); A("kitchen-base-60", "n", N, 665, { material: v.units }); A("kitchen-sink-80", "n", N, 735, { material: v.units }); A("kitchen-base-60", "n", N, 805, { material: v.units }); corner(st, "kitchen-corner-90", E, N, "ne", { material: v.units });
  A("kitchen-stove-60", "e", E, 150, { material: v.units }); A("kitchen-base-60", "e", E, 210, { material: v.units }); A("kitchen-hood", "e", E, 150);
  A("kitchen-wall-60", "n", N, 665, { y: 145, material: v.units }); A("kitchen-wall-60", "n", N, 805, { y: 145, material: v.units }); P("coffee-machine", 665, 40, "n", 93); P("kettle", 805, 40, "n", 93);
  P("kitchen-island", 720, 290, "n", 0, { material: "marble" }); P("bar-stool", 660, 390, "s"); P("bar-stool", 720, 390, "s"); P("bar-stool", 780, 390, "s");
  P("pendant-lamp", 680, 290, "n", H); P("pendant-lamp", 760, 290, "n", H); P("kitchen-bin", 580, 420, "n"); A("wall-shelves", "e", E, 300, { y: 150 });
  // bathroom (750..1000 × 450..600)
  corner(st, "shower-stall", E, 458, "ne", { gap: 0 }); A("toilet", "s", 592, 852); A("washbasin-pedestal", "s", 592, 790); A("wall-mirror", "s", 592, 790, { y: 110 }); P("towel-rail", 800, 460, "n", 110); P("bath-mat", 820, 520, "n");
  // bedroom 1 (0..350 × 600..1100)
  A(v.bed1, "s", S, 170); A("nightstand", "s", S, 300); P("table-lamp", 300, 1070, "n", 100); A("wardrobe", "e", 342, 900); P("round-rug", 180, 820, "n"); A("picture", "w", W, 850, { y: 150 });
  // bedroom 2 (350..650 × 600..1100)
  if (v.bed2 === "kids") { A("bunk-bed", "w", 358, 950); A("toy-chest", "e", 642, 700); P("plush-rabbit", 620, 700, "n", 65); A("chest-of-drawers", "e", 642, 1000); P("round-rug", 500, 850, "n"); }
  else { A("single-bed", "s", S, 420); A("study-desk", "e", 642, 750); P("chair", 525, 750, "w"); A("chest-of-drawers", "n", 608, 560); P("laptop", 606, 750, "e", 75); }
  // bedroom 3 (650..1000 × 600..1100): guest room or home office
  if (v.bed3 === "office") { A("desk", "s", S, 870); P("office-chair", 870, 960, "n"); P("laptop", 870, 1050, "s", 75); A("bookshelf", "w", 658, 900); A("filing-cabinet", "n", 608, 800); P("houseplant", 940, 660, "n"); }
  else { A("single-bed", "e", E, 950); A("wardrobe", "w", 658, 950); A("chest-of-drawers", "s", S, 800); P("houseplant", 940, 660, "n"); }
  lights(st, H, [[275, 225], [775, 100], [875, 525], [175, 850], [500, 850], [825, 850], [400, 525]], "ceiling-flush");
  along(st, "wall-lantern", "n", -13, 480, { y: 230 });
}

const PLANS = { A: { fn: houseA, w: 900, d: 1150 }, B: { fn: houseB, w: 1000, d: 1200 }, C: { fn: houseC, w: 1000, d: 1100 } };

/** Garden of lot (block, i, row): lx runs east from the lot's west edge, lz from the street into the lot; row 1 lots are mirrored to face south. */
function garden(p, block, i, row, plan, v, n) {
  const x0 = OX + block * (6 * LOT_W + STREET) + i * LOT_W, z0 = OZ + row * LOT_D;
  const X = (lx) => x0 + (row ? LOT_W - lx : lx), Z = (lz) => z0 + (row ? LOT_D - lz : lz);
  const flip = { n: "s", s: "n", e: "w", w: "e" };
  const L = (prop, lx, lz, back = "n", y = 0) => lot(p, prop, X(lx), Z(lz), typeof back === "number" ? (row ? back + 180 : back) % 360 : row ? flip[back] : back, y);
  const R = (ax, az, bx, bz) => rect(Math.min(X(ax), X(bx)), Math.min(Z(az), Z(bz)), Math.max(X(ax), X(bx)), Math.max(Z(az), Z(bz)));
  const front = SETBACK, back = SETBACK + plan.d, side = (plan.w >= 1000 ? 60 : 100) + plan.w;
  // driveway on the east side of the house, path to the door, lawn
  path(p, R(side + 20, 0, LOT_W - 20, front + 300), "concrete", "#c3bfb6", 3);
  path(p, R(220, 0, 320, front), "paving", "#cfc8ba", 4);
  if (n % 3 !== 1) L(["sedan", "hatchback", "suv", "pickup-truck", "convertible", "sports-car", "van"][n % 7], (side + LOT_W) / 2, front + 20, 90);
  // front fence with a gate for people and the car
  const fx0 = X(0), fx1 = X(LOT_W), fz = Z(0);
  const style = ["picket", "masonry", "hedge", "picket"][n % 4];
  if (style === "masonry") siteWall(p, [[Math.min(fx0, fx1), fz], [Math.max(fx0, fx1), fz]], { height: 150, tint: v.facade, gates: [gate(row ? LOT_W - 320 : 220, "single"), gate(row ? 40 : LOT_W - 320, "double")] });
  else fence(p, [[Math.min(fx0, fx1), fz], [Math.max(fx0, fx1), fz]], { style, height: style === "hedge" ? 120 : 110, gates: style === "hedge" ? [] : [gate(row ? LOT_W - 320 : 220, "single", "#f0ede6"), gate(row ? 40 : LOT_W - 320, "double", "#f0ede6")] });
  L("mailbox", 180, 30, "n"); L("flower-bed", 100, 250, "n"); if (n % 2) L("bush", 60, 120); else L("flower-bed", 100, 120, "n");
  if (n % 4 === 0) L("tree", 110, 320); if (n % 4 === 2) L("cherry-tree", 120, 360);
  // back garden
  const g0 = back + 80;
  const items = [
    () => { L("clothesline", 200, g0 + 250, "e"); L("water-tank", 900, g0 + 100); L("bbq-grill", 700, g0 + 250, "s"); L("plastic-table", 500, g0 + 450); L("plastic-chair", 500, g0 + 380, "n"); L("plastic-chair", 500, g0 + 520, "s"); L("ipe-tree", 250, g0 + 700); },
    () => { L("dog-house", 850, g0 + 150, "n"); L("swing-set", 450, g0 + 300, "n"); L("sandpit", 450, g0 + 650); L("clothesline", 150, g0 + 400, "e"); L("tree", 850, g0 + 700); L("ball", 700, g0 + 500); },
    () => { L("garden-shed", 820, g0 + 700, "s"); L("flower-bed", 200, g0 + 500, "n"); L("flower-bed", 200, g0 + 650, "n"); L("wheelbarrow", 500, g0 + 650, "n"); L("clothesline", 150, g0 + 250, "e"); L("outdoor-dining-set", 550, g0 + 250, "n"); },
    () => { L("pergola", 500, g0 + 250, "n"); L("outdoor-sofa", 500, g0 + 300, "n"); L("fire-pit", 500, g0 + 500, "n"); L("clothesline", 900, g0 + 300, "e"); L("banana-plant", 150, g0 + 650); L("palm-tree", 850, g0 + 700); },
    () => { L("trampoline", 350, g0 + 350, "n"); L("dog-house", 880, g0 + 120, "n"); L("clothesline", 150, g0 + 700, "e"); L("bench", 800, g0 + 650, "s"); L("maple-tree", 500, g0 + 750); L("bird-bath", 850, g0 + 400); },
    () => { L("pool", 400, g0 + 400); L("lounger", 850, g0 + 300, "n"); L("lounger", 850, g0 + 500, "n"); L("beach-umbrella", 850, g0 + 400); L("clothesline", 150, g0 + 750, "e"); L("planter", 850, g0 + 700); },
  ];
  items[n % items.length]();
  if (n % 3 === 0) L("ac-outdoor-unit", 40, front + 300, "w");
  patch(p, R(0, back + 20, LOT_W, LOT_D), "grass", ["#86a65a", "#7f9e55", "#8da85f"][n % 3]);
}

function streets(p) {
  terrain(p, 22000, 9400, 44, () => 0);
  const bw = 6 * LOT_W, x0 = OX, x1 = OX + bw, x2 = OX + bw + STREET, x3 = x2 + bw, z0 = OZ, z1 = OZ + 2 * LOT_D;
  const road = (a, b, c, d) => path(p, rect(a, b, c, d), "asphalt", null, 2);
  const walk = (a, b, c, d) => path(p, rect(a, b, c, d), "paving", "#c9c3b7", 6);
  // three north-south and two east-west streets, 10 m wide with 2 m sidewalks
  for (const [a, b] of [[x0 - STREET, x0], [x1, x2], [x3, x3 + STREET]]) { road(a + 200, z0 - STREET, b - 200, z1 + STREET); walk(a, z0 - STREET, a + 200, z1 + STREET); walk(b - 200, z0 - STREET, b, z1 + STREET); }
  for (const [a, b] of [[z0 - STREET, z0], [z1, z1 + STREET]]) { road(x0 - STREET + 200, a + 200, x3 + STREET - 200, b - 200); walk(x0 - STREET, a, x3 + STREET, a + 200); walk(x0 - STREET, b - 200, x3 + STREET, b); }
  // lamps, trees and street furniture on the sidewalks
  for (const x of [x0 + 500, x0 + 2500, x0 + 4500, x2 + 500, x2 + 2500, x2 + 4500]) { lot(p, "lamp", x, z0 - 100); lot(p, "lamp", x, z1 + 100); lot(p, "tree", x + 1000, z0 - 100); lot(p, "tree", x + 1000, z1 + 100); }
  for (const z of [z0 + 500, z0 + 1500, z0 + 2500, z0 + 3500]) { lot(p, "lamp", x1 + 100, z); lot(p, "lamp", x3 + 100, z); lot(p, "tree", x0 - 100, z); lot(p, "tree", x2 - 100, z + 400); }
  lot(p, "street-sign", x1 + 100, z0 - 100, "n"); lot(p, "street-sign", x3 + 100, z1 + 100, "n"); lot(p, "bus-stop", x1 + 100, z0 + 2000, "e"); lot(p, "trash-bin", x1 + 100, z0 + 1800); lot(p, "fire-hydrant", x0 - 100, z0 + 1000);
  lot(p, "traffic-light", x1 + 100, z1 + 100, "n"); lot(p, "trash-bin", x3 + 100, z0 - 100); lot(p, "bicycle", x0 + 3000, z0 - 100, "n");
  for (const [x, z] of [[x0 + 1500, z0 - 650], [x2 + 4000, z1 + 650], [x0 - 650, z0 + 3000]]) lot(p, "hatchback", x, z, "n");
  lot(p, "van", x2 + 1500, z1 + 650, "n"); lot(p, "sedan", x3 + 650, z0 + 1000, 90); lot(p, "motorcycle", x1 + 300, z0 + 3000, 90);
  // beyond the streets
  for (const [x, z] of [[x0 - 1800, z0 - 1600], [x1 + 500, z0 - 1700], [x3 + 1800, z1 + 1600], [x0 + 2000, z1 + 1700], [x3 + 1800, z0 - 1500], [x0 - 1800, z1 + 1500]]) lot(p, "oak-tree", x, z);
  patch(p, rect(x0 - STREET - 2500, z0 - STREET - 1500, x0 - STREET, z1 + STREET + 1500), "grass", "#7f9e55");
}

export function village(p, b, g) {
  const order = ["A", "B", "C", "A", "C", "B", "B", "A", "C", "C", "A", "B", "C", "A", "B", "A", "B", "C", "A", "C", "B", "C", "B", "A"];
  let n = 0;
  for (let block = 0; block < 2; block++) for (let row = 0; row < 2; row++) for (let i = 0; i < 6; i++) {
    const plan = PLANS[order[n]];
    const v = {
      facade: FACADES[n % FACADES.length], floor: FLOORS[n % FLOORS.length], units: UNITS[n % UNITS.length],
      sofa: ["sofa-two-seat", "sofa-three-seat"][n % 2],
      bed1: ["double-bed", "king-bed", "double-bed"][n % 3], bed2: ["kids", "student", "study"][n % 3], bed3: ["baby", "guest", "office"][(n >> 1) % 3],
    };
    const x0 = OX + block * (6 * LOT_W + STREET) + i * LOT_W, z0 = OZ + row * LOT_D;
    const m = plan.w >= 1000 ? 60 : 100;
    const at = row ? [x0 + LOT_W - m, z0 + LOT_D - SETBACK] : [x0 + m, z0 + SETBACK];
    const roof = { ...ROOFS[n % ROOFS.length], type: n % 5 === 4 ? "hip" : "gable", pitch: n % 5 === 4 ? 25 : 30, overhang: 50, ridgeAxis: n % 2 ? "z" : "x", height: 20, ceiling: true };
    let house;
    if (n === 0) { b.at = at; b.rotation = row ? 180 : 0; b.roof = { ...b.roof, ...roof }; b.name = "House 1"; house = b; g.height = H; plan.fn(g, v); }
    else { house = building(p, at, { roof, height: H, name: `House ${n + 1}` }); house.rotation = row ? 180 : 0; plan.fn(house.storeys[0], v); }
    garden(p, block, i, row, plan, v, n);
    n++;
  }
  streets(p);
  p.sun = { ...p.sun, city: "saopaulo", latitude: -23.5, useTime: true, time: 16, month: 10 };
}
