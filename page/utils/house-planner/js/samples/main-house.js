// "Main house" samples: a two-storey house (social floor below, suites
// above) and a single-storey mix with a bedroom wing. Both share the social
// block, the terrace with gourmet area, the pool deck and the lot. All
// coordinates are building-local cm unless a `lot` helper converts them.
import { freshStorey, uid } from "../schema.js";
import { slab as rawSlab, wall as rawWall, place, railing as rawRailing, paving as rawPaving } from "../templates.js";
import { yawFor } from "./kit.js";

const H1 = 320, H2 = 300; // storey heights
// ---- scale layer: the XL variants multiply every plan coordinate by S
// (walls, slabs, lot) while furniture keeps its distance to the wall it
// backs onto and its size, so nothing floats away from the walls.
let S = 1;
let ROOMS = []; // rectangles [x0, z0, x1, z1] of the floor being built, unscaled
const ANCHOR = 40, EDGE = 100, ALONG = 150; // cm
// half-depth of a prop measured from its origin towards its back
const DEPTH = { "king-bed": 111, "double-bed": 110, "single-bed": 104, "sofa-corner": 83, "sofa-three-seat": 45, "sofa-two-seat": 45, wardrobe: 36, "sliding-wardrobe": 32, "tv-bench": 21, "kitchen-counter": 38, "kitchen-sink": 38, "kitchen-stove": 38, "kitchen-hood": 40, "kitchen-fridge": 39, toilet: 23, "washbasin-pedestal": 23, "shower-stall": 55, "dressing-table": 23, "closet-rail": 30, "double-vanity": 30, "bar-stool": 21, "dining-chair": 21, "armchair-lounge": 33, nightstand: 23, "bedroom-bench": 20, "shoe-rack": 15, desk: 39, bookshelf: 17, "cube-shelf": 20, "steel-shelf": 28, "washing-machine": 31, dryer: 31, "chest-of-drawers": 24, "console-table": 17, bench: 25, "standing-mirror": 25, "outdoor-kitchen": 35, microwave: 20, "coffee-machine": 20, "office-chair": 27, "ironing-board": 20, "laundry-basket": 21, "wine-rack": 16, "wall-shelves": 12 };
const sc = (v) => v * S;
const slab = (st, x0, z0, x1, z1, m, t) => rawSlab(st, sc(x0), sc(z0), sc(x1), sc(z1), m, t);
const WIDE = new Set(["door-sliding", "window-wide", "window-picture"]);
const wall = (st, a, b, opts = {}) => rawWall(st, [sc(a[0]), sc(a[1])], [sc(b[0]), sc(b[1])], { ...opts, openings: (opts.openings || []).map((o) => ({ ...o, at: sc(o.at), width: WIDE.has(o.preset) && o.width ? Math.round(sc(o.width)) : o.width })) });
const railing = (st, pts, opts) => rawRailing(st, pts.map(([x, z]) => [sc(x), sc(z)]), opts);
const paving = (p, pts, m, t, h) => rawPaving(p, pts, m, t, h);
const roomOf = (x, z) => ROOMS.find(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1) || ROOMS[ROOMS.length - 1];
/** Scaled position of an object: keeps its distance to the wall it backs onto and to nearby edges. */
function scaled(prop, x, z, back) {
  if (S === 1) return [x, z];
  const [x0, z0, x1, z1] = roomOf(x, z);
  const depth = DEPTH[prop] ?? 30;
  const near = (d) => d <= EDGE;
  const axis = (v, lo, hi, anchoredLo, anchoredHi, along) => {
    const dl = v - lo, dh = hi - v;
    if (anchoredLo || (!along && near(dl))) return sc(lo) + dl;
    if (anchoredHi || (!along && near(dh))) return sc(hi) - dh;
    if (along) return dl <= ALONG ? sc(lo) + dl : dh <= ALONG ? sc(hi) - dh : sc(lo) + dl;
    return sc(v);
  };
  const b = typeof back === "string" ? back : null;
  const anchored = b && (b === "n" ? z - z0 - depth <= ANCHOR : b === "s" ? z1 - z - depth <= ANCHOR : b === "w" ? x - x0 - depth <= ANCHOR : x1 - x - depth <= ANCHOR);
  if (!anchored) return [axis(x, x0, x1, false, false, false), axis(z, z0, z1, false, false, false)];
  if (b === "n" || b === "s") return [axis(x, x0, x1, false, false, true), axis(z, z0, z1, b === "n", b === "s", false)];
  return [axis(x, x0, x1, b === "w", b === "e", false), axis(z, z0, z1, false, false, true)];
}
const FACADE = { outerMaterial: "plaster", outerTint: "#3a3d42" };
const STONE = { outerMaterial: "stone", outerTint: "#8c8578" };
const WOOD_DOOR = { leafColor: "#6b4a2e", frameColor: "#2b2e33" };
// the yaw that turns an object's real back side towards a wall comes from the kit (see samples/kit.js)
const put = (st, prop, x, z, back = 0, y = 0) => {
  const [px, pz] = scaled(prop, x, z, back);
  place(st, prop, px, pz, yawFor(prop, back), y);
};
const lights = (st, h, pts, prop = "downlight") => pts.forEach(([x, z]) => place(st, prop, sc(x), sc(z), 0, h));
function slabExcept(st, x0, z0, x1, z1, material, tint, holes = []) {
  const T = 50;
  const tiles = [];
  [x0, z0, x1, z1] = [sc(x0), sc(z0), sc(x1), sc(z1)];
  holes = holes.map((h) => h.map(sc));
  for (let z = Math.floor(z0 / T); z < Math.ceil(z1 / T); z++)
    for (let x = Math.floor(x0 / T); x < Math.ceil(x1 / T); x++) {
      const cx = (x + 0.5) * T, cz = (z + 0.5) * T;
      if (holes.some(([a, b, c, d]) => cx > a && cx < c && cz > b && cz < d)) continue;
      tiles.push([x, z]);
    }
  st.floorGroups.push({ id: uid("fg"), name: "", offset: 0, thickness: null, material, tint, tiles, locked: false });
}
/** Lot object at building-local cm (already scaled by the caller). */
function lotObject(p, b, prop, bx, bz, back = 0, y = 0) {
  p.objects.push({ id: uid("ob"), name: "", prop, inline: null, at: [bx + b.at[0], y, bz + b.at[1]], rotation: [0, yawFor(prop, back), 0], scale: [1, 1, 1], tint: null, material: null, locked: false });
}
const L = (b, pts) => pts.map(([x, z]) => [sc(x) + b.at[0], sc(z) + b.at[1]]);

/**
 * Social floor: guest room and bath (west), stairs or office box, laundry
 * and pantry (north), open kitchen with island, lavatory, entrance hall
 * (east), living with TV wall and dining, all opening south to the terrace.
 */
function socialFloor(st, { office = false, wingWest = false } = {}) {
  const tiles = "#d8d4cc";
  ROOMS = [[0, 0, 300, 380], [0, 380, 300, wingWest ? 720 : 620], [300, 0, 560, office ? 250 : 380], [560, 0, 700, 250], [700, 0, 840, 250], [840, 0, 1300, 400], [1300, 0, 1450, 280], [1450, 0, 1600, 380], [1100, 380, 1600, 800], [560, 250, 1100, 800], [300, 250, 560, 800], [0, 0, 1600, 800]];
  slabExcept(st, 0, 0, 1600, 800, "woodFloor", "#c9a579", [[0, 380, 300, wingWest ? 720 : 620], [560, 0, 840, 250], [1300, 0, 1450, 280], [1450, 0, 1600, 380]]);
  slab(st, 0, 380, 300, wingWest ? 720 : 620, "tiles", tiles);
  slab(st, 560, 0, 840, 250, "tiles", tiles);
  slab(st, 1300, 0, 1450, 280, "tiles", tiles);
  slab(st, 1450, 0, 1600, 380, "stoneTiles", "#c9c4ba");
  // ---- exterior
  wall(st, [0, 0], [1600, 0], { ...FACADE, thickness: 25, openings: [
    ...(wingWest ? [] : [{ preset: "window-wide", at: 60, width: 180 }]),
    { preset: "window-small", at: 590, width: 60, sill: 160 },
    { preset: "window-wide", at: 900, width: 300, height: 70, sill: 150 },
    { preset: "window-small", at: 1340, width: 60, sill: 160 },
    { preset: "window-small", at: 1495, width: 60, sill: 160 },
  ] });
  wall(st, [1600, 0], [1600, 800], { ...STONE, thickness: 25, openings: [{ preset: "door-single", at: 120, width: 100, height: 240, colors: WOOD_DOOR }] });
  wall(st, [1600, 800], [300, 800], { ...FACADE, thickness: 25, openings: [
    { preset: "door-sliding", at: 60, width: 420, height: 270 },
    { preset: "door-sliding", at: 560, width: 440, height: 270 },
    { preset: "door-sliding", at: 1060, width: 220, height: 270 },
  ] });
  if (wingWest) {
    wall(st, [300, 800], [300, 860], { ...FACADE, thickness: 25 });
    wall(st, [0, 0], [0, 720], { thickness: 15 });
    wall(st, [0, 720], [300, 720], { thickness: 15 });
  } else {
    wall(st, [300, 800], [300, 620], { ...FACADE, thickness: 25, openings: [{ preset: "door-single", at: 45, width: 90, height: 230, colors: WOOD_DOOR }] });
    wall(st, [300, 620], [0, 620], { ...FACADE, thickness: 25, openings: [{ preset: "window-small", at: 120, width: 60, sill: 160 }] });
    wall(st, [0, 620], [0, 0], { ...FACADE, thickness: 25, openings: [{ preset: "window-small", at: 110, width: 60, sill: 160 }, { preset: "window-wide", at: 340, width: 180 }] });
  }
  // ---- interior
  wall(st, [300, 0], [300, wingWest ? 720 : 620], { thickness: 15, openings: [{ preset: "door-single", at: 280 }, { preset: "door-single", at: 440 }] });
  wall(st, [0, 380], [300, 380], { thickness: 15 });
  if (office) {
    wall(st, [560, 0], [560, 250], { thickness: 15 });
    wall(st, [300, 250], [560, 250], { thickness: 15, openings: [{ preset: "door-single", at: 85 }] });
  } else wall(st, [560, 0], [560, 380], { thickness: 15 });
  wall(st, [560, 250], [840, 250], { thickness: 15, openings: [{ preset: "door-single", at: 25 }, { preset: "door-single", at: 165 }] });
  wall(st, [700, 0], [700, 250], { thickness: 15 });
  wall(st, [840, 0], [840, 250], { thickness: 15 });
  wall(st, [1300, 0], [1300, 280], { thickness: 15 });
  wall(st, [1300, 280], [1450, 280], { thickness: 15, openings: [{ preset: "door-single", at: 30 }] });
  wall(st, [1450, 0], [1450, 380], { thickness: 15, openings: [{ preset: "door-single", at: 285 }] });
  wall(st, [1450, 380], [1600, 380], { thickness: 15 });
  // ---- guest room and bath
  put(st, "single-bed", 65, 118, "n"); put(st, "single-bed", 200, 118, "n"); put(st, "wardrobe", 130, 336, "s"); put(st, "round-rug", 150, 240);
  put(st, "shower-stall", 63, 443, "n"); put(st, "toilet", 160, wingWest ? 670 : 570, "s"); put(st, "washbasin-pedestal", 250, wingWest ? 690 : 590, "s");
  // ---- laundry and pantry
  put(st, "washing-machine", 598, 40, "n"); put(st, "dryer", 662, 40, "n"); put(st, "laundry-basket", 670, 115); put(st, "wall-shelves", 630, 12, "n", 160);
  put(st, "wine-rack", 770, 28, "n"); put(st, "cardboard-boxes", 750, 90); put(st, "wall-shelves", 770, 12, "n", 160); put(st, "wall-shelves", 828, 110, "e", 160);
  // ---- kitchen
  put(st, "kitchen-counter", 935, 45, "n"); put(st, "kitchen-sink", 1075, 45, "n"); put(st, "kitchen-stove", 1195, 45, "n"); put(st, "kitchen-hood", 1195, 45, "n");
  put(st, "microwave", 900, 40, "n", 94); put(st, "coffee-machine", 975, 40, "n", 94);
  put(st, "kitchen-fridge", 1255, 190, "e"); put(st, "kitchen-island", 1060, 230);
  for (const x of [990, 1035, 1080, 1125]) put(st, "bar-stool", x, 310, "s");
  for (const x of [1000, 1060, 1120]) place(st, "pendant-lamp", x, 230, 0, H1);
  // ---- lavatory and entrance
  put(st, "toilet", 1340, 50, "n"); put(st, "washbasin-pedestal", 1410, 36, "n");
  put(st, "shoe-rack", 1470, 100, "w"); put(st, "coat-rack", 1565, 60); put(st, "doormat", 1560, 170, "e"); put(st, "houseplant", 1575, 350);
  // ---- living and dining
  put(st, "wall-tv", 1587, 500, "e", 150); put(st, "tv-bench", 1560, 500, "e"); put(st, "sofa-corner", 1180, 520, "w");
  put(st, "coffee-table", 1380, 520); put(st, "rug", 1380, 520); put(st, "armchair-lounge", 1250, 690, "w"); put(st, "floor-lamp", 1120, 690); put(st, "houseplant", 1580, 770);
  put(st, "dining-table", 830, 560); for (const x of [760, 830, 900]) { put(st, "dining-chair", x, 485, "n"); put(st, "dining-chair", x, 635, "s"); }
  for (const x of [790, 870]) place(st, "pendant-lamp", x, 560, 0, H1);
  put(st, "console-table", 580, 550, "w"); put(st, "houseplant", 580, 770);
  if (office) { put(st, "desk", 520, 125, "e"); put(st, "office-chair", 450, 125, "w"); put(st, "bookshelf", 315, 125, "w"); put(st, "laptop", 520, 125, "e", 75); }
  lights(st, H1, [[150, 190], [150, 500], [630, 125], [770, 125], [950, 150], [1200, 300], [1375, 140], [1525, 190], [1200, 450], [1500, 450], [1200, 750], [1500, 750], [650, 400], [1000, 400], [430, 600], [430, 190]]);
  // ---- façade: lanterns and canopy at the entrance, slats on the blind wall
  put(st, "wall-lantern", 1612, 60, "w", 220); put(st, "wall-lantern", 1612, 280, "w", 220); put(st, "entrance-canopy", 1612, 170, "w");
  put(st, "slat-panel", 430, -18);
}

/** Upper floor of the two-storey house: suite 2 and its bath, circulation, walk-in closet, master suite and bath, south balcony. */
function upperFloor(up) {
  const tiles = "#d8d4cc";
  ROOMS = [[0, 0, 300, 380], [0, 380, 300, 700], [300, 0, 640, 700], [640, 0, 1000, 450], [1000, 0, 1600, 450], [640, 450, 760, 700], [760, 450, 1600, 700], [300, 700, 1600, 830], [0, 0, 1600, 830]];
  slabExcept(up, 0, 0, 1600, 700, "woodFloor", "#c9a579", [[0, 380, 300, 700], [640, 450, 1600, 700]]);
  slab(up, 0, 380, 300, 700, "tiles", tiles); slab(up, 640, 450, 1600, 700, "tiles", tiles);
  slab(up, 300, 700, 1600, 830, "concrete", "#b9b6ad");
  wall(up, [0, 0], [1600, 0], { ...FACADE, thickness: 25, openings: [{ preset: "window-wide", at: 60, width: 180 }, { preset: "window-wide", at: 1150, width: 300, height: 80, sill: 160 }] });
  wall(up, [1600, 0], [1600, 700], { ...STONE, thickness: 25, openings: [{ preset: "window-picture", at: 100, width: 240, height: 150, sill: 60 }] });
  wall(up, [1600, 700], [0, 700], { ...FACADE, thickness: 25, flipOuter: true, openings: [{ preset: "door-sliding", at: 1000, width: 220, height: 240 }, { preset: "window-small", at: 740, width: 60, sill: 160 }, { preset: "window-small", at: 90, width: 60, sill: 160 }] });
  wall(up, [0, 700], [0, 0], { ...FACADE, thickness: 25, openings: [{ preset: "window-wide", at: 420, width: 180 }, { preset: "window-small", at: 190, width: 60, sill: 160 }] });
  wall(up, [300, 0], [300, 700], { thickness: 15, openings: [{ preset: "door-single", at: 280 }, { preset: "door-single", at: 560 }] });
  wall(up, [0, 380], [300, 380], { thickness: 15 });
  wall(up, [640, 0], [640, 700], { thickness: 15, openings: [{ preset: "door-single", at: 300 }] });
  wall(up, [1000, 0], [1000, 450], { thickness: 15, openings: [{ preset: "door-single", at: 300 }] });
  wall(up, [640, 450], [1600, 450], { thickness: 15, openings: [{ preset: "door-single", at: 620 }] });
  wall(up, [760, 450], [760, 700], { thickness: 15, openings: [{ preset: "door-single", at: 20 }] });
  railing(up, [[300, 830], [1600, 830]]); railing(up, [[300, 700], [300, 830]]); railing(up, [[1600, 700], [1600, 830]]);
  // suite 2 and bath 2
  put(up, "single-bed", 65, 118, "n"); put(up, "single-bed", 200, 118, "n"); put(up, "sliding-wardrobe", 110, 340, "s"); put(up, "round-rug", 150, 240);
  put(up, "shower-stall", 63, 443, "n"); put(up, "toilet", 70, 645, "s"); put(up, "washbasin-pedestal", 170, 665, "s"); put(up, "washbasin-pedestal", 250, 665, "s"); put(up, "towel-rail", 290, 450, "e", 0);
  // circulation
  put(up, "houseplant", 330, 670); put(up, "console-table", 620, 200, "e"); put(up, "houseplant", 610, 660);
  // closet
  put(up, "closet-rail", 820, 38, "n"); put(up, "sliding-wardrobe", 820, 412, "s"); put(up, "closet-island", 820, 225); put(up, "standing-mirror", 965, 100, "e");
  // master suite
  put(up, "king-bed", 1300, 125, "n"); put(up, "nightstand", 1170, 36, "n"); put(up, "nightstand", 1430, 36, "n"); put(up, "bedroom-bench", 1300, 265, "n");
  put(up, "armchair-lounge", 1540, 380, "e"); put(up, "dressing-table", 1160, 400, "s"); put(up, "rug", 1300, 200); put(up, "houseplant", 1575, 60); put(up, "wall-tv", 1400, 442, "s", 160);
  // master bath
  put(up, "toilet", 700, 645, "s"); put(up, "double-vanity", 980, 660, "s"); put(up, "shower-glass", 1285, 600); put(up, "japanese-tub", 1485, 580); put(up, "bath-mat", 1285, 500); put(up, "houseplant", 1570, 470);
  // balcony
  put(up, "planter", 330, 770); put(up, "planter", 950, 770); put(up, "planter", 1550, 770); put(up, "bench", 1200, 735, "n"); put(up, "slat-panel", 830, 795); put(up, "slat-panel", 1480, 795);
  put(up, "wall-sconce", 700, 712, "n", 220); put(up, "wall-sconce", 1300, 712, "n", 220); put(up, "slat-panel", 820, -18);
  lights(up, H2, [[150, 190], [470, 200], [470, 550], [1150, 150], [1450, 150], [1150, 400], [1450, 400]]);
  lights(up, H2, [[150, 540], [820, 225], [700, 580], [980, 580], [1285, 580], [1485, 580]], "ceiling-flush");
}

/** Bedroom wing of the single-storey mix, west of the social block (x -1300..0). */
function bedroomWing(st) {
  const tiles = "#d8d4cc";
  ROOMS = [[-1300, 0, -700, 500], [-700, 0, -450, 500], [-450, 0, 0, 500], [-1300, 500, -850, 860], [-850, 500, -700, 720], [-700, 500, -350, 720], [-350, 500, 0, 720], [-850, 720, 300, 860], [-1300, 0, 300, 860]];
  slabExcept(st, -1300, 0, 0, 860, "woodFloor", "#c9a579", [[-1300, 500, -850, 860], [-700, 500, -350, 720]]);
  slab(st, -1300, 500, -850, 860, "tiles", tiles); slab(st, -700, 500, -350, 720, "tiles", tiles);
  wall(st, [-1300, 0], [0, 0], { ...FACADE, thickness: 25, openings: [{ preset: "window-wide", at: 150, width: 300, height: 80, sill: 160 }, { preset: "window-wide", at: 970, width: 180 }] });
  wall(st, [-1300, 0], [-1300, 860], { ...STONE, thickness: 25, openings: [{ preset: "window-picture", at: 100, width: 240, height: 150, sill: 60 }, { preset: "window-small", at: 600, width: 60, sill: 160 }] });
  wall(st, [-1300, 860], [300, 860], { ...FACADE, thickness: 25, openings: [{ preset: "window-small", at: 200, width: 60, sill: 160 }, { preset: "door-sliding", at: 700, width: 220, height: 240 }] });
  wall(st, [-1300, 500], [-350, 500], { thickness: 15, openings: [{ preset: "door-single", at: 180 }, { preset: "door-single", at: 480 }, { preset: "door-single", at: 855 }] });
  wall(st, [-850, 720], [0, 720], { thickness: 15, openings: [{ preset: "door-single", at: 50 }, { preset: "door-single", at: 630 }] });
  wall(st, [-700, 0], [-700, 500], { thickness: 15, openings: [{ preset: "door-single", at: 250 }] });
  wall(st, [-450, 0], [-450, 500], { thickness: 15 });
  wall(st, [-850, 500], [-850, 860], { thickness: 15 });
  wall(st, [-700, 500], [-700, 720], { thickness: 15 });
  wall(st, [-350, 500], [-350, 720], { thickness: 15 });
  // master suite, closet and bath
  put(st, "king-bed", -1000, 125, "n"); put(st, "nightstand", -1130, 36, "n"); put(st, "nightstand", -870, 36, "n"); put(st, "bedroom-bench", -1000, 265, "n");
  put(st, "armchair-lounge", -760, 70, "n"); put(st, "dressing-table", -1200, 455, "s"); put(st, "rug", -1000, 200); put(st, "wall-tv", -1000, 492, "s", 160); put(st, "houseplant", -1280, 470);
  put(st, "closet-rail", -575, 38, "n"); put(st, "closet-rail", -575, 462, "s"); put(st, "closet-island", -540, 250);
  put(st, "double-vanity", -1075, 818, "s"); put(st, "toilet", -1270, 540, "n"); put(st, "shower-glass", -1180, 600); put(st, "japanese-tub", -930, 600); put(st, "bath-mat", -1180, 720);
  put(st, "console-table", -722, 580, "e");
  // suite 2 and its bath
  put(st, "single-bed", -330, 118, "n"); put(st, "single-bed", -120, 118, "n"); put(st, "sliding-wardrobe", -225, 460, "s"); put(st, "round-rug", -225, 260);
  put(st, "houseplant", -175, 600); put(st, "chest-of-drawers", -33, 620, "e");
  put(st, "shower-stall", -640, 563, "n"); put(st, "toilet", -520, 672, "s"); put(st, "washbasin-pedestal", -400, 690, "s");
  // corridor
  put(st, "houseplant", -830, 790); put(st, "houseplant", 280, 790); put(st, "picture", -500, 728, "n", 110);
  lights(st, H1, [[-1000, 200], [-1000, 400], [-575, 250], [-225, 200], [-175, 610], [-712, 610], [-700, 790], [-400, 790], [-100, 790], [200, 790]]);
  lights(st, H1, [[-1075, 680], [-525, 610]], "ceiling-flush");
  put(st, "slat-panel", -575, -18); put(st, "wall-lantern", -1312, 700, "e", 220);
}

/** Terrace with the gourmet area, outdoor lounge, pool deck with a bigger pool, and the lot (wall, gates, path, carport, street, garden). */
function outdoors(p, b, { wingWest = false } = {}) {
  const tiles = "#c9c4ba";
  ROOMS = [[-1300, 0, 1600, 900]];
  paving(p, L(b, [[300, 800], [1650, 800], [1650, 1150], [300, 1150]]), "stoneTiles", tiles);
  paving(p, L(b, wingWest ? [[-1300, 860], [300, 860], [300, 1250], [-1300, 1250]] : [[-60, 620], [300, 620], [300, 1150], [-60, 1150]]), "stoneTiles", tiles);
  paving(p, L(b, [[300, 1150], [700, 1150], [700, 1450], [300, 1450]]), "stoneTiles", tiles);
  // the deck wraps the pool as four strips (a deck polygon has no holes)
  for (const pts of [[[700, 1150], [1650, 1150], [1650, 1250], [700, 1250]], [[700, 1600], [1650, 1600], [1650, 1700], [700, 1700]], [[700, 1250], [800, 1250], [800, 1600], [700, 1600]], [[1500, 1250], [1650, 1250], [1650, 1600], [1500, 1600]]])
    p.outdoor.push({ id: uid("d"), name: "", type: "deck", points: L(b, pts), material: "planks", tint: "#b08a5a", height: 15, open: false, postSize: 15, depth: 80, width: 120, lights: false, locked: false });
  p.outdoor.push({ id: uid("d"), name: "", type: "pool", points: L(b, [[800, 1250], [1500, 1250], [1500, 1600], [800, 1600]]), material: "azulejo", tint: "#6fc3e0", height: -150, open: false, postSize: 15, depth: 80, width: 120, lights: true, locked: false });
  // gourmet area under a pergola: outdoor kitchen against the house wall, big table
  const gx = sc(wingWest ? -200 : 120), gz = sc(wingWest ? 860 : 620) + 70, gy = gz + 122;
  lotObject(p, b, "pergola", gx + 10, gy); lotObject(p, b, "outdoor-kitchen", gx, gz, "n"); lotObject(p, b, "outdoor-dining-set", gx, gy + 110);
  lotObject(p, b, "planter", gx - 180, gy + 220); lotObject(p, b, "planter", gx + 200, gy + 220);
  for (const x of [gx - 120, gx + 120]) lotObject(p, b, "pendant-lamp", x, gy + 110, 0, 250);
  // lounge by the pool and loungers on the deck
  lotObject(p, b, "outdoor-sofa", sc(500), sc(1150) + 110, "n"); lotObject(p, b, "fire-pit", sc(500), sc(1150) + 250); lotObject(p, b, "planter", sc(300) + 30, sc(1450) - 20); lotObject(p, b, "planter", sc(700) - 30, sc(1450) - 20);
  const dx = sc(1650) - 60;
  lotObject(p, b, "lounger", dx, sc(1250) + 80, "e"); lotObject(p, b, "lounger", dx, sc(1250) + 250, "e"); lotObject(p, b, "side-table", dx, sc(1250) + 165); lotObject(p, b, "planter", sc(700) + 40, sc(1700) - 40);
  for (const x of [sc(700) + 20, sc(1650) - 20]) lotObject(p, b, "garden-bollard", x, sc(1700) - 10);
  for (const x of [400, 900, 1400]) lotObject(p, b, "wall-sconce", sc(x), sc(800) + 12, "s", 230); // on the south façade
  // lot: wall with two gates on the east, path to the entrance, carport, street
  const W = sc(wingWest ? 2350 : 1650), D = sc(wingWest ? 1500 : 1300);
  const entryZ = sc(170) + b.at[1]; // lot z of the entrance door
  const north = 2 * W;
  p.siteWalls.push({ id: uid("sw"), name: "", points: [[-W, -D], [W, -D], [W, D], [-W, D], [-W, -D]], thickness: 20, height: 220, top: "straight", stepLength: 100, material: "stone", tint: "#8c8578", outerMaterial: null, outerTint: null, locked: false, gates: [
    { id: uid("gt"), offset: north + (entryZ - 55 + D), width: 110, type: "single", open: 0, material: null, tint: "#3a3d42", locked: false },
    { id: uid("gt"), offset: north + (entryZ + 300 + D), width: 300, type: "sliding", open: 0, material: null, tint: "#3a3d42", locked: false },
  ] });
  const hx = sc(1600) + b.at[0]; // lot x of the house's east wall
  paving(p, [[hx, entryZ - 70], [W, entryZ - 70], [W, entryZ + 70], [hx, entryZ + 70]], "stoneTiles", tiles);
  paving(p, [[hx + 100, entryZ + 250], [W, entryZ + 250], [W, entryZ + 650], [hx + 100, entryZ + 650]], "concrete", "#b9b6ad");
  const cx = hx + 350, cz = entryZ + 450;
  lotObject(p, b, "pergola", cx - b.at[0], cz - b.at[1]); lotObject(p, b, "sedan", cx - b.at[0], cz - b.at[1]);
  for (const x of [hx + 150, hx + 450, hx + 750]) p.objects.push({ id: uid("ob"), name: "", prop: "garden-bollard", inline: null, at: [x, 0, entryZ - 90], rotation: [0, 0, 0], scale: [1, 1, 1], tint: null, material: null, locked: false });
  p.objects.push({ id: uid("ob"), name: "", prop: "mailbox", inline: null, at: [W - 40, 0, entryZ - 110], rotation: [0, 0, 0], scale: [1, 1, 1], tint: null, material: null, locked: false });
  paving(p, [[W, -D - 100], [W + 100, -D - 100], [W + 100, D + 100], [W, D + 100]], "paving", "#bfbab0", 6);
  paving(p, [[W + 100, -D - 100], [W + 250, -D - 100], [W + 250, D + 100], [W + 100, D + 100]], "asphalt", null, 2);
  // garden: hedges along the wall (not the gate side), trees and bushes
  const hedge = (pts) => p.fences.push({ id: uid("fe"), name: "", points: pts, height: 120, style: "hedge", postSpacing: 150, material: null, tint: null, gates: [], locked: false });
  hedge([[W - 50, -D + 50], [-W + 50, -D + 50], [-W + 50, D - 50], [W - 50, D - 50]]);
  const tree = (prop, x, z) => p.objects.push({ id: uid("ob"), name: "", prop, inline: null, at: [x, 0, z], rotation: [0, 0, 0], scale: [1, 1, 1], tint: null, material: null, locked: false });
  tree("tree", -W + 200, -D + 300); tree("birch-tree", -W + 250, D - 350); tree("tree", -W + 900, D - 200); tree("cypress", W - 250, D - 250); tree("tree", W - 700, -D + 200); tree("birch-tree", hx - 300, -D + 250);
  tree("tree", 0, D - 200); tree("cypress", hx + 50, D - 300);
  if (S > 1) { tree("tree", -W + 600, -D + 250); tree("ipe-tree", -W + 500, 0); tree("birch-tree", W - 500, D - 600); }
  for (const [x, z] of [[hx + 60, entryZ + 120], [hx + 60, entryZ - 160], [W - 200, entryZ - 200], [W - 200, entryZ + 150]]) tree("bush", x, z);
  for (const [x, z] of [[-W + 200, -D + 300], [-W + 250, D - 350], [W - 250, D - 250], [0, D - 200]]) tree("garden-spike", x + 90, z + 90);
}

/** The two-storey main house: social floor below, suites above. `scale` > 1 enlarges every room (XL: twice the floor area). */
export function mainHouse(p, b, g, { scale = 1 } = {}) {
  S = scale;
  b.at = [-sc(1100), -sc(1000)];
  g.height = H1;
  socialFloor(g);
  g.stairs.push({ id: uid("sr"), name: "", shape: "U", at: [sc(365), sc(370)], rotation: 90, width: Math.round(110 * Math.min(S, 1.2)), rise: H1, stepHeight: 17.8, treadDepth: 28, turn: "right", material: "woodFloor", tint: "#c9a579", cutFloorAbove: true, railing: "both", railingStyle: "metal", base: "solid", locked: false });
  const up = freshStorey(g, "upper");
  up.height = H2;
  b.storeys.push(up);
  upperFloor(up);
  b.roof = { ...b.roof, type: "flat", overhang: 60, height: 30, material: "concrete", tint: "#2f3236", ceiling: true };
  p.terrain.width = Math.round(sc(4000)); p.terrain.depth = Math.round(sc(2800)); p.terrain.resolution = 60; p.terrain.heights = new Array(61 * 61).fill(0);
  outdoors(p, b);
  S = 1;
}
/** The single-storey mix: the social block plus a bedroom wing to the west. */
export function mainHouseSingle(p, b, g, { scale = 1 } = {}) {
  S = scale;
  b.at = [-sc(150), -sc(1100)];
  g.height = H1;
  socialFloor(g, { office: true, wingWest: true });
  bedroomWing(g);
  b.roof = { ...b.roof, type: "flat", overhang: 60, height: 30, material: "concrete", tint: "#2f3236", ceiling: true };
  p.terrain.width = Math.round(sc(5200)); p.terrain.depth = Math.round(sc(3400)); p.terrain.resolution = 72; p.terrain.heights = new Array(73 * 73).fill(0);
  outdoors(p, b, { wingWest: true });
  S = 1;
}
