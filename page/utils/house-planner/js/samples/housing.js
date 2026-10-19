// Housing estate: four walk-up blocks around a courtyard, two of three
// floors and two of two. Every floor has three identical apartments
// (7 × 9 m: living room, kitchen with a dining corner and the laundry,
// bathroom, two bedrooms) opening on a covered gallery, with the U stairs
// in a hall at the end of the block. The blocks face each other across
// the courtyard with its playground, small football court, benches and
// trees; parking by the street, drying yards and bike racks behind.
// Building coordinates are cm, origin at the north-west corner of the stair hall.
import { freshStorey } from "../schema.js";
import { floor, ext, inn, column, D, PS, SL, WN, WS, along, corner, put, lights, stairs, rail, lot, path, patch, rect, fence, siteWall, gate, terrain, building } from "./kit.js";

const H = 280, LEN = 2450, DEP = 1100, HALL = 350, APT = 700, GAL = 200;
const DOOR = { colors: { leafColor: "#5a4636", frameColor: "#f2efe8" } };
const ROOF = { type: "gable", pitch: 18, overhang: 50, ridgeAxis: "x", material: "fiberCement", tint: "#8a8f94", ceiling: true };
const PALETTE = [
  { outer: "#f2d58a", inner: "#faf6ea", floor: "#c9a378", roof: "#8a8f94" },
  { outer: "#f0b8a0", inner: "#fbf3ee", floor: "#b98b5c", roof: "#7c5a4a" },
  { outer: "#b9d2e6", inner: "#f1f5f8", floor: "#d9c3a0", roof: "#6e7f8c" },
  { outer: "#c9dfb6", inner: "#f3f7ee", floor: "#caa379", roof: "#6f7a60" },
];

/** One apartment: k = 0..2 along the block, v picks the furniture. */
function apartment(st, k, v, pal) {
  const ox = HALL + APT * k, oz = GAL, last = k === 2;
  const X = (lx) => ox + lx, Z = (lz) => oz + lz;
  const W = ox + 8, E = last ? ox + APT - 13 : ox + APT - 8, N = oz + 13, S = oz + 900 - 13;
  const A = (prop, side, at, o = {}) => along(st, prop, side, { n: N, s: S, w: W, e: E }[side], side === "n" || side === "s" ? X(at) : Z(at), o);
  const P = (prop, lx, lz, back = "n", y = 0, o = {}) => put(st, prop, X(lx), Z(lz), back, y, o);
  floor(st, X(0), Z(0), X(APT), Z(900), "woodFloor", pal.floor);
  floor(st, X(400), Z(0), X(APT), Z(450), "tiles", "#d8d4cc");
  floor(st, X(450), Z(450), X(APT), Z(600), "tiles", "#cfd8d8");
  // interior walls: kitchen, bathroom, the two bedrooms
  inn(st, [X(400), Z(0)], [X(400), Z(450)], [PS(Z(60))]);
  inn(st, [X(400), Z(450)], [X(APT), Z(450)]);
  inn(st, [X(450), Z(450)], [X(450), Z(600)], [D(Z(495), 70, DOOR)]);
  inn(st, [X(0), Z(600)], [X(APT), Z(600)], [D(X(290), 80, DOOR), D(X(410), 80, DOOR)]);
  inn(st, [X(350), Z(600)], [X(350), Z(900)]);
  // ---- living (0..400 × 0..450 plus the circulation strip 0..450 × 450..600): sofa on the west wall, TV on the kitchen wall
  A(v.sofa === "three" ? "sofa-three-seat" : "sofa-two-seat", "w", 300); along(st, "tv-bench", "e", X(392), Z(300)); along(st, "wall-tv", "e", X(392), Z(300), { y: 110 });
  P("coffee-table", 200, 300, "n"); P("rug", 220, 300, "n"); P("armchair", 250, 150, "n");
  P("floor-lamp", 40, 480, "n"); along(st, "bookshelf", "s", Z(592), X(120)); A("picture", "w", 500, { y: 150 }); P("doormat", 120, 40, "n");
  // ---- kitchen (400..700 × 0..450): units along the east wall, table on the living wall, laundry at the south end
  A("kitchen-fridge-70", "e", 60, { material: v.units }); A("kitchen-sink-80", "e", 140, { material: v.units }); A("kitchen-stove-60", "e", 210, { material: v.units }); A("kitchen-base-60", "e", 270, { material: v.units });
  A("kitchen-wall-60", "e", 140, { y: 145, material: v.units }); A("kitchen-wall-60", "e", 210, { y: 145, material: v.units }); A("kitchen-hood", "e", 210);
  A("washing-machine", "e", 335); P("drying-rack", 630, 410, "s"); P("kitchen-bin", 560, 420, "s");
  P("microwave", 650, 270, "n", 93); P("kettle", 650, 140, "n", 93);
  along(st, "table", "w", X(408), Z(300)); P("dining-chair", 457, 190, "n"); P("dining-chair", 457, 410, "s");
  // ---- bathroom (450..700 × 450..600): shower stall in the north-east corner, toilet and basin on the south wall
  corner(st, "shower-stall", E, Z(458), "ne");
  along(st, "toilet", "s", Z(592), X(last ? 550 : 558)); along(st, "washbasin-pedestal", "s", Z(592), X(490)); along(st, "wall-mirror", "s", Z(592), X(490), { y: 110 });
  put(st, "towel-rail", X(500), Z(458), "n", 110); P("bath-mat", 520, 520, "n");
  // ---- bedroom 1 (0..350 × 600..900)
  if (v.bed1 === "king") along(st, "king-bed", "n", Z(608), X(110));
  else if (v.bed1 === "iron") { along(st, "iron-bed", "n", Z(608), X(110)); along(st, "chest-of-drawers", "w", W, Z(840)); }
  else { along(st, "double-bed", "n", Z(608), X(110)); along(st, "nightstand", "n", Z(608), X(218)); put(st, "table-lamp", X(218), Z(632), "n", 100); }
  along(st, "wardrobe", "e", X(342), Z(800)); P("round-rug", 260, 660, "n"); along(st, "picture", "w", W, Z(750), { y: 150 });
  // ---- bedroom 2 (350..700 × 600..900): kids' room with a bunk, a single bed, or the home office
  if (v.bed2 === "bunk") { along(st, "bunk-bed", "e", E, Z(750)); along(st, "study-desk", "s", S, X(440)); P("chair", 440, 780, "n"); along(st, "chest-of-drawers", "w", X(358), Z(760)); P("toy-chest", 600, 640, "n"); P("plush-bear", 600, 640, "n", 65); }
  else if (v.bed2 === "single") { along(st, "single-bed", "e", E, Z(750)); along(st, "study-desk", "s", S, X(440)); P("chair", 440, 780, "n"); along(st, "chest-of-drawers", "w", X(358), Z(760)); P("laptop", 440, 850, "s", 75); }
  else { along(st, "sofa-bed", "e", E, Z(740)); along(st, "desk", "w", X(358), Z(790)); P("office-chair", 495, 790, "e"); P("laptop", 400, 790, "w", 75); P("printer", 400, 840, "w", 75); }
  along(st, "picture", "e", E, Z(650), { y: 150 });
  lights(st, H, [[X(200), Z(230)], [X(220), Z(525)], [X(550), Z(200)], [X(575), Z(525)], [X(175), Z(750)], [X(525), Z(750)]], "ceiling-flush");
}

/** Walls, floors and openings shared by every floor of a block; `ground` tells the ground floor from the others. */
function shell(st, pal, ground) {
  const FACADE = { outerMaterial: "plaster", outerTint: pal.outer, tint: pal.inner };
  floor(st, 0, 0, HALL, DEP, "tiles", "#cfc9bd");
  floor(st, HALL, 0, LEN, GAL, "concrete", "#c3bfb6");
  // stair hall: north wall with a window, west wall, south wall with the back door on the ground floor
  ext(st, [0, 0], [HALL, 0], [WN(175, 120, 120, 100)], FACADE);
  ext(st, [0, DEP], [0, 0], [WN(800, 120, 120, 100)], FACADE);
  ext(st, [HALL, DEP], [0, DEP], ground ? [D(175, 100, DOOR)] : [WS(175, 100, 60, 180)], FACADE);
  inn(st, [HALL, GAL], [HALL, DEP]);
  // apartments: gallery wall with the front doors and kitchen windows, party walls, back wall with the bedroom windows, east wall
  const front = [], back = [];
  for (let k = 0; k < 3; k++) {
    const ox = HALL + APT * k;
    front.push(D(ox + 120, 90, DOOR), WN(ox + 550, 120, 120, 100));
    back.push(WN(ox + 175, 120, 120, 90), WN(ox + 525, 120, 120, 90));
    if (k) inn(st, [ox, GAL], [ox, DEP]);
  }
  ext(st, [HALL, GAL], [LEN, GAL], front, FACADE);
  ext(st, [LEN, GAL], [LEN, DEP], [WS(GAL + 225, 60, 60, 230)], FACADE);
  ext(st, [LEN, DEP], [HALL, DEP], back, FACADE);
  // columns on the open edge of the gallery
  for (let x = HALL + APT / 2; x < LEN; x += APT / 2) column(st, x, 12, 25, FACADE);
  column(st, LEN - 12, 12, 25, FACADE);
  for (let k = 0; k < 3; k++) { const ox = HALL + APT * k; put(st, "doormat", ox + 120, 60, "n"); put(st, "planter", ox + 600, 150, "n"); }
  lights(st, H, [[HALL + 350, 100], [HALL + 1050, 100], [HALL + 1750, 100], [175, 750]], "ceiling-flush");
}

/** Fills building b (at/rotation already set) with `floors` storeys. */
function block(p, b, floors, pal) {
  b.roof = { ...b.roof, ...ROOF, tint: pal.roof };
  let prev = null;
  for (let f = 0; f < floors; f++) {
    const st = f === 0 ? b.storeys[0] : freshStorey(prev, "upper");
    if (f) b.storeys.push(st);
    st.height = H;
    shell(st, pal, f === 0);
    if (f === 0) {
      // the hall: U stairs climbing south, mailboxes, bike rack and the meters
      stairs(st, [290, 150], 270, { shape: "U", width: 100, rise: H, turn: "right", rail: "both", railStyle: "metal", material: "concrete", tint: "#b9b6ad" });
      for (const z of [560, 620, 680]) along(st, "mailbox", "w", 13, z);
      along(st, "bike-rack", "e", 342, 700); put(st, "bicycle", 250, 700, 90);
      along(st, "bench", "w", 13, 900); put(st, "houseplant", 300, 1050, "n"); put(st, "trash-bin", 60, 1040, "n");
      put(st, "breaker-panel", 342, 900, "e", 150); along(st, "corkboard", "e", 342, 520, { y: 140 }); along(st, "water-heater", "e", 342, 980);
    } else {
      // landing: the stair well is cut from this floor; railings guard it
      stairs(st, [290, 150], 270, { shape: "U", width: 100, rise: H, turn: "right", rail: "both", railStyle: "metal", material: "concrete", tint: "#b9b6ad" });
      rail(st, [[138, 120], [138, 450], [342, 450]], { height: 100, style: "metal" });
      rail(st, [[245, 258], [342, 258]], { height: 100, style: "metal" });
      rail(st, [[HALL, 8], [LEN - 20, 8]], { height: 100, style: "metal" });
      along(st, "bench", "w", 13, 800); put(st, "houseplant", 300, 1050, "n"); along(st, "corkboard", "e", 342, 700, { y: 140 });
    }
    if (f === floors - 1) st.stairs.length = 0; // the top floor has no flight going up
    const V = [
      { sofa: "two", bed1: "double", bed2: "bunk", units: "woodLight" },
      { sofa: "three", bed1: "king", bed2: "office", units: "woodDark" },
      { sofa: "two", bed1: "iron", bed2: "single", units: "plaster" },
      { sofa: "three", bed1: "double", bed2: "single", units: "woodLight" },
      { sofa: "two", bed1: "king", bed2: "bunk", units: "woodDark" },
    ];
    for (let k = 0; k < 3; k++) apartment(st, k, V[(f * 3 + k + PALETTE.indexOf(pal)) % V.length], pal);
    prev = st;
  }
  return b;
}

function outdoors(p) {
  terrain(p, 9000, 6600, 30, () => 0);
  // paths along the galleries and between the blocks, the courtyard plaza
  path(p, rect(-3000, -700, 3000, 700), "paving", "#cfc8ba", 4);
  path(p, rect(-250, -1750, 250, -700), "paving", "#cfc8ba", 4); path(p, rect(-250, 700, 250, 1750), "paving", "#cfc8ba", 4);
  path(p, rect(-3000, -1750, -2700, 1750), "paving", "#cfc8ba", 4); path(p, rect(2700, -1750, 3000, 1750), "paving", "#cfc8ba", 4);
  // playground on sand (west half) and the football court (east half)
  patch(p, rect(-2500, -450, -500, 450), "sand", "#e2d3ad");
  lot(p, "swing-set", -2100, -250, "n"); lot(p, "slide", -1100, -250, "n"); lot(p, "sandpit", -2100, 250); lot(p, "seesaw", -1100, 250, "n"); lot(p, "spring-rider", -1500, 0, "n"); lot(p, "roundabout", -700, 250, "n");
  path(p, rect(500, -500, 2600, 500), "concrete", "#a9a7a0", 3);
  lot(p, "goal", 640, 0, 0); lot(p, "goal", 2460, 0, 180); lot(p, "ball", 1500, 100);
  for (const z of [-480, 480]) for (const x of [-1500, 1500]) lot(p, "bench", x, z, z < 0 ? "n" : "s");
  for (const x of [-2850, 2850]) { lot(p, "lamp", x, -500); lot(p, "lamp", x, 500); } lot(p, "lamp", 0, -1000); lot(p, "lamp", 0, 1000);
  for (const [x, z] of [[-2850, -1000], [-2850, 1000], [2850, -1000], [2850, 1000], [0, -1500], [0, 1500]]) lot(p, "ipe-tree", x, z);
  lot(p, "cherry-tree", -100, -300); lot(p, "cherry-tree", 100, 300); lot(p, "trash-bin", -200, -650); lot(p, "trash-bin", 200, 650);
  // behind the blocks: drying yards with clotheslines, gas and water, bike racks by the halls
  for (const x0 of [-2700, 250]) {
    for (const z of [-2000, 2000]) { lot(p, "clothesline", x0 + 700, z, "n"); lot(p, "clothesline", x0 + 1300, z, "n"); lot(p, "clothesline", x0 + 1900, z, "n"); }
    lot(p, "water-tank", x0 + 2300, -2000); lot(p, "water-tank", x0 + 2300, 2000); lot(p, "gas-cylinder", x0 + 100, -1850); lot(p, "gas-cylinder", x0 + 100, 1850);
    lot(p, "bike-rack", x0 + 150, -1900, "n"); lot(p, "bike-rack", x0 + 150, 1900, "n");
  }
  patch(p, rect(-2800, -2300, 2800, -1750), "grass"); patch(p, rect(-2800, 1750, 2800, 2300), "grass");
  for (const [x, z] of [[-1200, -2250], [1200, -2250], [-1200, 2250], [1200, 2250]]) lot(p, "bush", x, z);
  // parking by the west street, gate and fence around the estate
  path(p, rect(-3650, -1750, -3050, 1750), "asphalt", null, 2);
  const cars = ["sedan", "hatchback", "suv", "hatchback", "pickup-truck", "sedan", "hatchback", "van"];
  for (let i = 0; i < 8; i++) if (i !== 3) lot(p, cars[i], -3350, -1400 + i * 400, "n");
  lot(p, "motorcycle", -3350, -200, "n"); lot(p, "scooter", -3200, -100, "n");
  path(p, rect(-4400, -3300, -3650, 3300), "asphalt", null, 2); path(p, rect(-3650, -3300, -3500, -1750), "paving", "#c9c3b7", 6); path(p, rect(-3650, 1750, -3500, 3300), "paving", "#c9c3b7", 6);
  path(p, rect(-3650, -1750, -3050, -1700), "paving", "#c9c3b7", 6);
  siteWall(p, [[-3500, -1950], [-3500, -2600], [3500, -2600], [3500, 2600], [-3500, 2600], [-3500, 1950]], { height: 200, tint: "#e6e1d6", gates: [] });
  lot(p, "mailbox", -3450, -1800, "w"); lot(p, "trash-bin", -3450, 1800); lot(p, "trash-bin", -3450, 1870); lot(p, "street-sign", -3580, 1850, "n"); lot(p, "lamp", -3580, -2500); lot(p, "lamp", -3580, 2500);
  for (const [x, z] of [[-3900, -2900], [-3900, 2900], [3200, -2400], [3200, 2400], [-3200, -2400], [-3200, 2400]]) lot(p, "tree", x, z);
}

export function housing(p, b, g) {
  void g;
  // the north blocks are turned around so that their galleries face the courtyard
  b.at = [-250, -600]; b.rotation = 180; b.name = "Block A";
  block(p, b, 3, PALETTE[0]);
  const make = (at, rotation, name) => { const nb = building(p, at, { height: H, name }); nb.rotation = rotation; return nb; };
  block(p, make([2700, -600], 180, "Block B"), 3, PALETTE[1]);
  block(p, make([-2700, 600], 0, "Block C"), 2, PALETTE[2]);
  block(p, make([250, 600], 0, "Block D"), 2, PALETTE[3]);
  outdoors(p);
  p.sun = { ...p.sun, city: "saopaulo", latitude: -23.5, useTime: true, time: 15.5, month: 3 };
}
