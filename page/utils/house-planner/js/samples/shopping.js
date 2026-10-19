// Shopping centre: a single-storey mall under a flat roof. A 6 m wide
// gallery runs east-west between two rows of seven shops (7 × 9 m each)
// with glass fronts and sliding doors: bookshop, clothing, café,
// electronics, toy shop, pharmacy and gym on the north side; shoes,
// furniture, pet shop, florist, hair salon, bakery and a bank on the south
// side. The east end holds the food court with two counters and the
// restrooms; a service door at the back of every shop opens on the
// delivery yard. Parking with lamps and tree islands in front, bus stop
// and street beyond. Building coordinates are cm, origin at the north-west corner.
import { floor, ext, inn, column, D, DD, PD, SL, WN, WS, along, corner, put, lights, lot, path, patch, rect, fence, terrain } from "./kit.js";

const H = 420, LEN = 6000, DEP = 2400, SHOP = 700;
const FACADE = { outerMaterial: "plaster", outerTint: "#d9d4c8", tint: "#f4f2ec" };
const GLASS = { colors: { frameColor: "#2b2e33", leafColor: "#9fc4d6", glassColor: "#b7d6e4" } };
const SERVICE = { colors: { frameColor: "#4a4d52", leafColor: "#5e6268" } };
const UNIT = { material: "woodLight" }, STEEL = { material: "metalPlate" };

/**
 * Local frame of shop k (0..6 north row, 7..13 south row): lx runs east from
 * the shop's west wall, lz runs from the glass front (0) to the back wall (880).
 */
function frame(st, k) {
  const north = k < 7, ox = SHOP * (north ? k : k - 7);
  const W = (north ? k === 0 : k === 7) ? 13 : ox + 8, E = (north ? k === 6 : k === 13) ? ox + 687 : ox + 692;
  const z = (lz) => (north ? 892 - lz : 1508 + lz);
  const dir = { back: north ? "n" : "s", front: north ? "s" : "n", left: "w", right: "e" };
  const face = { back: north ? 13 : 2387, front: north ? 892 : 1508, left: W, right: E };
  const yaw = (d) => (typeof d === "number" ? (north ? d : (d + 180) % 360) : dir[d]);
  const f = {
    ox, W, E, x: (lx) => ox + lx, z, dir, H,
    /** Against a wall: side is back/front/left/right, `at` the centre along it (lx for back/front, lz for left/right). */
    A: (prop, side, at, o = {}) => along(st, prop, dir[side], face[side], side === "left" || side === "right" ? z(at) : ox + at, o),
    /** Free placement: lx, lz and the direction the object's back faces. */
    P: (prop, lx, lz, back = "back", y = 0, o = {}) => put(st, prop, ox + lx, z(lz), yaw(back), y, o),
    /** Into a corner: "back-left", "front-right"... */
    C: (prop, q, o = {}) => {
      const [a, b] = q.split("-");
      const quad = `${dir[a]}${dir[b]}`;
      corner(st, prop, face[b], face[a], quad, o);
    },
    floor: (material, tint) => floor(st, ox, north ? 0 : 1500, ox + SHOP, north ? 900 : 2400, material, tint),
    sign: (y = 340) => along(st, "neon-sign", dir.front, face.front, ox + 350, { y }),
    lights: (pts, prop = "downlight") => lights(st, H, pts.map(([lx, lz]) => [ox + lx, z(lz)]), prop),
  };
  return f;
}

function shell(st) {
  floor(st, 0, 900, 4900, 1500, "stoneTiles", "#ddd6c8");
  floor(st, 4900, 0, 6000, 1500, "tiles", "#e4dcd0");
  floor(st, 4900, 1500, 6000, 2400, "tiles", "#d8d4cc");
  const backDoors = (zWall) => Array.from({ length: 7 }, (_, k) => D(k * SHOP + 600, 90, SERVICE));
  const highWindows = () => Array.from({ length: 7 }, (_, k) => WS(k * SHOP + 250, 120, 60, 300));
  ext(st, [0, 0], [LEN, 0], [...backDoors(0), ...highWindows(), WS(5150, 120, 60, 300), WS(5500, 120, 60, 300), WS(5850, 120, 60, 300)], FACADE);
  ext(st, [LEN, 0], [LEN, DEP], [WN(350, 180, 150, 120), WN(750, 180, 150, 120), DD(1200, 240, { height: 280, ...GLASS }), D(2100, 100, SERVICE)], FACADE);
  ext(st, [LEN, DEP], [0, DEP], [WS(5900, 60, 60, 220), WS(5500, 60, 60, 220), ...backDoors(DEP), ...highWindows()], FACADE);
  ext(st, [0, DEP], [0, 0], [WN(1950, 240, 60, 300), WN(1400, 120, 280, 20), DD(1200, 240, { height: 280, ...GLASS }), WN(1000, 120, 280, 20), WN(450, 240, 60, 300)], FACADE);
  // glass fronts on the gallery: a sliding door between two show windows per shop
  const fronts = Array.from({ length: 7 }, (_, k) => [WN(k * SHOP + 125, 200, 280, 20), SL(k * SHOP + 350, 200, 300, GLASS), WN(k * SHOP + 575, 200, 280, 20)]).flat();
  inn(st, [0, 900], [4900, 900], fronts, { tint: "#f4f2ec" });
  inn(st, [0, 1500], [4900, 1500], fronts, { tint: "#f4f2ec" });
  for (let k = 1; k <= 7; k++) inn(st, [k * SHOP, 0], [k * SHOP, 900]);
  for (let k = 1; k <= 6; k++) inn(st, [k * SHOP, 1500], [k * SHOP, 2400]);
  // restrooms block: lobby, women's, men's and the storage room with its own door to the yard
  inn(st, [4900, 1500], [4900, 2400]);
  inn(st, [4900, 1500], [5750, 1500], [PD(5100, 160, 280)]);
  inn(st, [5300, 1500], [5300, 2400], [D(1725), D(2175)]);
  inn(st, [5300, 1950], [5750, 1950]);
  inn(st, [5750, 1500], [5750, 2400]);
  // two columns down the gallery
  for (const x of [1750, 3150]) column(st, x, 1200, 40, { tint: "#ebe6de" });
}

function gallery(st) {
  // seats and planters down the middle, leaving 2 m on each side
  for (const x of [1050, 2450, 3850]) {
    put(st, "bench", x, 1130, "n"); put(st, "bench", x, 1270, "s");
    put(st, "planter", x - 150, 1200, "n"); put(st, "planter", x + 150, 1200, "n");
  }
  for (const x of [350, 1750, 3150, 4550]) { put(st, "houseplant", x - 120, 1200, "n"); put(st, "trash-bin", x + 120, 1200, "n"); }
  put(st, "doormat", 60, 1200, "e"); put(st, "water-cooler", 4800, 960, "n");
  for (let x = 350; x < 4900; x += 700) { put(st, "pendant-lamp", x, 1050, "n", H); put(st, "pendant-lamp", x, 1350, "n", H); }
  lights(st, H, [[1050, 1200], [2450, 1200], [3850, 1200]], "chandelier");
  // food court (4900..6000 × 0..1500): two counters along the north wall, tables in the middle, exit to the east
  floor(st, 4900, 0, 6000, 160, "tiles", "#cfc9bd");
  for (const [x0, name] of [[4900, "pizza"], [5450, "burger"]]) {
    void name;
    along(st, "kitchen-stove-60", "n", 13, x0 + 70, STEEL); along(st, "kitchen-sink-80", "n", 13, x0 + 150, STEEL); along(st, "kitchen-fridge-70", "n", 13, x0 + 230, STEEL);
    along(st, "kitchen-base-60", "n", 13, x0 + 300, STEEL); along(st, "kitchen-wall-60", "n", 13, x0 + 300, { y: 145, ...STEEL }); along(st, "kitchen-hood", "n", 13, x0 + 70, { y: 0 });
    put(st, "bar-counter", x0 + 240, 260, "s"); put(st, "coffee-machine", x0 + 300, 40, "n", 93); put(st, "neon-sign", x0 + 240, 60, "s", 330);
  }
  put(st, "mini-fridge", 5420, 40, "n"); put(st, "kitchen-bin", 5420, 110, "n");
  for (const [x, z] of [[5100, 520], [5450, 520], [5100, 870], [5450, 870], [5100, 1220], [5450, 1220]]) {
    put(st, "restaurant-table", x, z, "n");
    put(st, "plastic-chair", x, z - 85, "n"); put(st, "plastic-chair", x, z + 85, "s"); put(st, "plastic-chair", x - 85, z, "w"); put(st, "plastic-chair", x + 85, z, "e");
    put(st, "pendant-lamp", x, z, "n", H);
  }
  put(st, "trash-bin", 5900, 400, "n"); put(st, "trash-bin", 5900, 1000, "n"); put(st, "houseplant", 5940, 60, "n"); put(st, "planter", 5800, 700, "n");
  put(st, "doormat", 5940, 1200, "e"); along(st, "picture", "e", 5987, 500, { y: 170 }); along(st, "picture", "e", 5987, 900, { y: 170 });
  lights(st, H, [[5000, 300], [5500, 300], [5900, 300], [5800, 1400]]);
  // restrooms: lobby with a bench and mirror, women's and men's, storage with steel shelves
  put(st, "bench", 5100, 2300, "s"); along(st, "wall-mirror", "e", 5292, 2200, { y: 120 }); put(st, "trash-bin", 4950, 2340, "n"); put(st, "houseplant", 5250, 1560, "n");
  along(st, "toilet", "n", 1508, 5450); along(st, "toilet", "n", 1508, 5560); along(st, "toilet", "n", 1508, 5670);
  along(st, "washbasin-pedestal", "s", 1942, 5450); along(st, "washbasin-pedestal", "s", 1942, 5560); along(st, "wall-mirror", "s", 1942, 5500, { y: 110 }); along(st, "towel-rail", "e", 5742, 1800);
  along(st, "toilet", "s", 2387, 5450); along(st, "toilet", "s", 2387, 5560); along(st, "toilet", "s", 2387, 5670);
  along(st, "washbasin-pedestal", "n", 1958, 5450); along(st, "washbasin-pedestal", "n", 1958, 5560); along(st, "wall-mirror", "n", 1958, 5500, { y: 110 }); along(st, "towel-rail", "e", 5742, 2250);
  along(st, "steel-shelf", "e", 5987, 1650); along(st, "steel-shelf", "e", 5987, 1950); along(st, "steel-shelf", "w", 5758, 1700); put(st, "cardboard-boxes", 5850, 2250, "n"); put(st, "ladder", 5950, 2250, "n");
  put(st, "breaker-panel", 5987, 2340, "e", 150); put(st, "water-heater", 5790, 2330, "n");
  lights(st, H, [[5100, 1950], [5525, 1725], [5525, 2175], [5875, 1950]], "ceiling-flush");
}

// ---- the shops. All in the frame of shop k: lx 0..700 west to east, lz 0 at the glass front, 880 at the back wall.
function bookshop(st, k) {
  const f = frame(st, k);
  f.floor("woodFloor", "#b98b5c");
  for (const lz of [200, 340, 480, 620, 760]) f.A("bookshelf", "left", lz);
  for (const lx of [110, 250, 390] ) f.A("bookshelf", "back", lx);
  for (const lz of [620, 760]) f.A("bookshelf", "right", lz);
  f.P("table", 330, 560, "back"); f.P("old-books", 300, 560, "back", 78); f.P("magazines", 365, 560, "back", 78);
  f.P("table", 330, 330, "back"); f.P("book", 310, 330, "back", 78); f.P("old-books", 350, 330, "back", 78);
  f.P("armchair", 640, 300, "right"); f.P("floor-lamp", 650, 390, "back"); f.P("side-table", 640, 200, "back");
  f.P("desk", 560, 120, "front"); f.P("office-chair", 560, 200, "back"); f.P("laptop", 560, 120, "front", 75);
  f.P("round-rug", 330, 450, "back"); f.sign();
  f.lights([[150, 250], [150, 650], [450, 250], [450, 650], [600, 450]]);
}
function clothing(st, k) {
  const f = frame(st, k);
  f.floor("carpet", "#b9b1a4");
  for (const lx of [150, 400] ) f.A("closet-rail", "back", lx);
  for (const lz of [200, 470]) f.A("closet-rail", "left", lz);
  f.A("wall-shelves", "right", 560, { y: 150 }); f.A("wall-mirror", "right", 300, { y: 110 }); f.A("standing-mirror", "right", 400);
  f.P("display-wall", 350, 450, "back"); f.P("mannequin", 290, 410, "front"); f.P("mannequin", 410, 490, "back");
  f.P("mannequin", 110, 80, "front"); f.P("mannequin", 590, 80, "front"); f.P("bench", 350, 200, "back");
  f.P("desk", 560, 580, "right"); f.P("office-chair", 640, 580, "right"); f.P("suitcase", 200, 100, "left");
  f.P("round-rug", 350, 300, "back"); f.sign();
  f.lights([[150, 200], [150, 600], [550, 200], [550, 650], [350, 450]], "spot-rail");
}
function cafe(st, k) {
  const f = frame(st, k);
  f.floor("tiles", "#d7cbb8");
  f.A("kitchen-sink-80", "back", 120, UNIT); f.A("kitchen-base-60", "back", 190, UNIT); f.A("kitchen-fridge-70", "back", 255, UNIT); f.A("kitchen-base-60", "back", 320, UNIT); f.A("kitchen-base-60", "back", 380, UNIT);
  f.P("coffee-machine", 190, 850, "back", 93); f.P("toaster", 320, 850, "back", 93); f.P("kettle", 380, 850, "back", 93); f.A("wall-shelves", "back", 350, { y: 150 });
  f.P("bar-counter", 300, 640, "front"); for (const lx of [150, 250, 350, 450]) f.P("bar-stool", lx, 540, "front");
  f.A("glass-cabinet", "right", 820); f.P("mini-fridge", 640, 700, "right"); f.P("kitchen-bin", 40, 800, "left");
  for (const [lx, lz] of [[180, 330], [520, 330], [180, 130], [520, 130]]) {
    f.P("round-table", lx, lz, "back"); f.P("dining-chair", lx - 80, lz, "left"); f.P("dining-chair", lx + 80, lz, "right"); f.P("dining-chair", lx, lz + 80, "back");
  }
  f.P("houseplant", 650, 420, "back"); f.A("picture", "left", 450, { y: 160 }); f.sign();
  for (const [lx, lz] of [[180, 330], [520, 330], [180, 130], [520, 130]]) f.P("pendant-lamp", lx, lz, "back", H);
  f.lights([[300, 700], [550, 750]]);
}
function electronics(st, k) {
  const f = frame(st, k);
  f.floor("tiles", "#bfbdb8");
  for (const lz of [250, 450, 650]) { f.A("wall-tv", "left", lz, { y: 120 }); f.A("tv-bench", "left", lz); }
  f.P("radio", 40, 650, "left", 51); f.P("game-console", 40, 250, "left", 51);
  for (const lx of [120, 300, 480]) f.A("cube-shelf", "back", lx); f.P("laptop", 480, 840, "back", 147);
  f.P("table", 350, 330, "back"); f.P("laptop", 300, 330, "back", 78); f.P("laptop", 400, 330, "front", 78);
  f.P("table", 350, 580, "back"); f.P("crt-tv", 320, 580, "left", 78); f.P("game-console", 400, 580, "back", 78);
  f.A("tv", "right", 300); f.A("tv", "right", 500); f.A("wall-shelves", "right", 700, { y: 140 }); f.P("printer", 650, 700, "right");
  f.P("desk", 560, 120, "front"); f.P("office-chair", 560, 200, "back"); f.P("laptop", 560, 120, "front", 75);
  f.sign(); f.lights([[150, 200], [150, 600], [550, 450], [350, 450]], "spot-rail");
}
function toys(st, k) {
  const f = frame(st, k);
  f.floor("carpet", "#cfae8a");
  for (const lx of [100, 250, 400]) f.A("cube-shelf", "back", lx); f.P("plush-bear", 100, 840, "back", 147); f.P("plush-rabbit", 250, 840, "back", 147); f.P("ball", 400, 840, "back", 147);
  for (const lz of [250, 450, 650]) f.A("cube-shelf", "left", lz); f.P("toy-blocks", 40, 450, "left", 147);
  f.P("table", 350, 400, "back"); f.P("toy-blocks", 320, 400, "back", 78); f.P("plush-bear", 390, 400, "front", 78);
  f.P("toy-chest", 350, 600, "back"); f.P("rug", 350, 230, "back"); f.P("floor-cushion", 300, 230, "back"); f.P("floor-cushion", 400, 230, "back"); f.P("ball", 350, 230, "back");
  f.A("cube-shelf", "right", 750); f.P("plush-rabbit", 650, 750, "right", 147); f.P("cardboard-boxes", 600, 560, "right"); f.P("spring-rider", 630, 300, "front"); f.P("child-bed", 600, 130, "front");
  f.sign(); f.lights([[150, 250], [150, 650], [550, 250], [550, 650], [350, 450]]);
}
function pharmacy(st, k) {
  const f = frame(st, k);
  f.floor("tiles", "#e3e2dd");
  for (const lx of [100, 280, 460]) f.A("steel-shelf", "back", lx);
  f.P("kitchen-counter", 160, 640, "back", 0, { material: "plaster", tint: "#f3f3ef" }); f.P("kitchen-counter", 310, 640, "back", 0, { material: "plaster", tint: "#f3f3ef" });
  f.P("office-chair", 160, 760, "back"); f.P("laptop", 310, 640, "back", 94);
  for (const lz of [280, 460]) { f.P("steel-shelf", 260, lz, "back"); f.P("steel-shelf", 440, lz, "back"); }
  f.A("steel-shelf", "left", 250); f.A("steel-shelf", "left", 450); f.A("glass-cabinet", "right", 620); f.A("glass-cabinet", "right", 720);
  f.P("water-cooler", 640, 300, "right"); f.P("chair", 640, 200, "right"); f.P("chair", 640, 130, "right"); f.P("houseplant", 40, 80, "left");
  f.A("wall-clock", "right", 450, { y: 190 }); f.sign();
  f.lights([[130, 500], [350, 200], [350, 500], [350, 750], [600, 500]], "ceiling-flush");
}
function gym(st, k) {
  const f = frame(st, k);
  f.floor("rubber", "#45484d");
  f.A("gym-mirror", "left", 400, { gap: 4 });
  for (const lz of [225, 415, 605]) f.P("treadmill", 110, lz, "left"); f.P("exercise-bike", 110, 760, "left");
  f.A("dumbbell-rack", "back", 200); f.A("weight-rack", "back", 320); f.A("kettlebell-set", "back", 420); f.P("squat-rack", 470, 650, "back");
  f.P("weight-bench", 280, 640, "back"); f.P("rowing-machine", 300, 420, "back");
  f.P("yoga-mat", 420, 250, "back"); f.P("yoga-mat", 520, 250, "back"); f.P("exercise-ball", 600, 420, "back"); f.P("foam-roller", 600, 320, "back"); f.P("medicine-ball-rack", 350, 150, "back");
  f.A("gym-lockers", "right", 500); f.A("gym-lockers", "right", 700); f.A("water-cooler", "right", 290);
  f.P("desk", 560, 120, "front"); f.P("office-chair", 560, 200, "back"); f.A("wall-clock", "right", 150, { y: 190 }); f.A("wall-tv", "back", 350, { y: 220 });
  f.sign(); f.lights([[150, 250], [150, 650], [450, 250], [450, 650], [600, 450]], "spot-rail");
}
function shoes(st, k) {
  const f = frame(st, k);
  f.floor("woodFloor", "#caa379");
  for (const lx of [100, 200, 300, 400, 500]) for (const y of [0, 45, 90, 135]) f.A("shoe-rack", "back", lx, { y });
  for (const lz of [250, 350, 450, 550, 650, 750]) for (const y of [0, 45, 90]) f.A("shoe-rack", "left", lz, { y });
  f.A("wall-shelves", "back", 300, { y: 190 }); f.A("wall-shelves", "left", 500, { y: 150 });
  f.P("bench", 300, 420, "back"); f.P("bench", 300, 300, "front"); f.P("rug", 300, 360, "back"); f.P("standing-mirror", 60, 110, "left"); f.P("standing-mirror", 655, 110, "right");
  f.A("cube-shelf", "right", 760); f.A("cube-shelf", "right", 600); f.P("cardboard-boxes", 590, 440, "right");
  f.P("desk", 560, 120, "front"); f.P("office-chair", 560, 200, "back"); f.P("houseplant", 480, 790, "back");
  f.sign(); f.lights([[150, 250], [150, 650], [450, 250], [450, 650], [600, 450]], "spot-rail");
}
function furniture(st, k) {
  const f = frame(st, k);
  f.floor("concrete", "#c6c2b8");
  f.P("sofa-three-seat", 60, 400, "left"); f.P("coffee-table", 230, 400, "back"); f.P("rug", 230, 400, "back"); f.P("floor-lamp", 60, 560, "back"); f.P("armchair-lounge", 230, 230, "front"); f.P("side-table", 330, 230, "back");
  f.A("tv-bench", "back", 150); f.A("wall-tv", "back", 150, { y: 110 }); f.A("sideboard", "back", 320); f.A("bookshelf", "back", 470);
  f.P("double-bed", 580, 640, "right"); f.P("nightstand", 650, 530, "right"); f.P("nightstand", 650, 750, "right"); f.P("table-lamp", 650, 530, "right", 100);
  f.A("wardrobe", "right", 320); f.P("dressing-table", 600, 160, "front");
  f.P("dining-table", 350, 640, "back"); f.P("dining-chair", 290, 600, "left"); f.P("dining-chair", 290, 680, "left"); f.P("dining-chair", 410, 600, "right"); f.P("dining-chair", 410, 680, "right");
  f.P("desk", 450, 180, "front"); f.P("office-chair", 450, 260, "back"); f.P("laptop", 450, 180, "front", 75);
  f.P("pendant-lamp", 350, 640, "back", H); f.sign(); f.lights([[150, 400], [150, 750], [550, 450], [550, 750], [350, 200]], "spot-rail");
}
function petshop(st, k) {
  const f = frame(st, k);
  f.floor("tiles", "#d6d8d2");
  f.A("steel-shelf", "back", 110); f.A("steel-shelf", "back", 300); f.A("steel-shelf", "left", 250); f.A("steel-shelf", "left", 450); f.A("steel-shelf", "left", 650);
  f.P("table", 350, 330, "back"); f.P("aquarium", 320, 330, "back", 78); f.P("aquarium", 420, 330, "back", 78);
  f.P("table", 350, 560, "back"); f.P("cat-tree", 350, 560, "back", 78);
  f.P("dog-house", 480, 760, "back"); f.P("cat-tree", 240, 760, "back"); f.P("plush-bear", 40, 80, "left"); f.P("bucket", 580, 700, "back");
  f.A("wash-trough", "right", 540); f.P("towel-rail", 690, 420, "right", 100); f.P("laundry-basket", 630, 320, "right");
  f.P("desk", 560, 120, "front"); f.P("office-chair", 560, 200, "back"); f.P("houseplant", 650, 230, "right");
  f.sign(); f.lights([[150, 250], [150, 650], [450, 250], [450, 650], [600, 450]]);
}
function florist(st, k) {
  const f = frame(st, k);
  f.floor("stoneTiles", "#bfb7a8");
  for (const lx of [100, 220, 340, 460]) f.A("planter", "back", lx); f.P("houseplant", 540, 700, "back");
  for (const lz of [250, 400, 550]) f.A("planter", "left", lz); f.P("houseplant", 50, 130, "left");
  f.P("table", 350, 420, "back"); f.P("houseplant", 300, 420, "back", 78); f.P("fern", 400, 420, "back", 78);
  f.P("flower-bed", 350, 650, "back"); f.P("flower-bed", 350, 230, "back");
  f.A("steel-shelf", "right", 640); f.P("fern", 610, 450, "right"); f.P("bird-bath", 640, 280, "right"); f.P("wheelbarrow", 120, 740, "back");
  f.P("desk", 560, 120, "front"); f.P("office-chair", 560, 200, "back"); f.P("bucket", 665, 150, "right"); f.P("bucket", 665, 100, "right");
  f.sign(); f.lights([[150, 250], [150, 650], [450, 250], [450, 650], [600, 450]]);
}
function salon(st, k) {
  const f = frame(st, k);
  f.floor("tiles", "#e9e4dc");
  for (const lz of [250, 400, 550, 700]) { f.A("wall-mirror", "left", lz, { y: 110 }); f.A("dressing-table", "left", lz); f.P("chair", 130, lz, "right"); }
  for (const lz of [600, 760]) { f.A("washbasin-pedestal", "right", lz); f.P("chair", 600, lz, "left"); f.A("wall-mirror", "right", lz, { y: 110 }); }
  f.A("towel-rail", "right", 440); f.A("wall-shelves", "back", 500, { y: 150 }); f.A("cube-shelf", "back", 150); f.P("hairdryer", 150, 840, "back", 147); f.A("glass-cabinet", "back", 450);
  f.P("bench", 420, 190, "right"); f.P("side-table", 560, 60, "back"); f.P("magazines", 560, 60, "back", 52); f.P("houseplant", 650, 60, "right");
  f.P("desk", 560, 320, "front"); f.P("office-chair", 560, 400, "back"); f.P("trash-bin", 40, 820, "left"); f.A("wall-clock", "right", 300, { y: 190 });
  f.sign(); f.lights([[130, 300], [130, 650], [450, 250], [450, 650], [600, 450]], "ceiling-flush");
}
function bakery(st, k) {
  const f = frame(st, k);
  f.floor("tiles", "#d3c3a8");
  f.A("kitchen-stove-60", "back", 100, UNIT); f.A("kitchen-hood", "back", 100); f.A("kitchen-base-60", "back", 160, UNIT); f.A("kitchen-sink-80", "back", 230, UNIT); f.A("kitchen-fridge-70", "back", 305, UNIT); f.A("kitchen-base-60", "back", 370, UNIT);
  f.P("bread-basket", 160, 850, "back", 93); f.P("cooking-pot", 370, 850, "back", 93); f.A("wall-shelves", "back", 250, { y: 170 }); f.A("steel-shelf", "right", 620);
  f.P("glass-cabinet", 170, 580, "back", 0); f.P("glass-cabinet", 260, 580, "back", 0); f.P("glass-cabinet", 350, 580, "back", 0); f.P("kitchen-counter", 510, 580, "back", 0, UNIT);
  f.P("bread-basket", 480, 580, "back", 94); f.P("coffee-machine", 540, 580, "back", 94); f.P("office-chair", 510, 700, "back");
  for (const [lx, lz] of [[130, 300], [570, 300], [130, 130], [570, 130]]) {
    f.P("round-table", lx, lz, "back"); f.P("dining-chair", lx - 80, lz, "left"); f.P("dining-chair", lx + 80, lz, "right");
  }
  f.P("houseplant", 655, 450, "right"); f.P("trash-bin", 40, 780, "left"); f.sign();
  for (const [lx, lz] of [[130, 300], [570, 300], [130, 130], [570, 130]]) f.P("pendant-lamp", lx, lz, "back", H);
  f.lights([[250, 750], [550, 700]]);
}
function bank(st, k) {
  const f = frame(st, k);
  f.floor("carpet", "#8f9aa6");
  for (const lz of [250, 450, 650]) { f.P("desk", 580, lz, "left"); f.P("office-chair", 655, lz, "right"); f.P("chair", 480, lz - 45, "left"); f.P("chair", 480, lz + 45, "left"); f.P("laptop", 580, lz, "left", 75); }
  f.A("filing-cabinet", "back", 300); f.A("filing-cabinet", "back", 400); f.A("printer", "back", 200); f.A("office-safe", "back", 100);
  f.A("desk", "left", 600); f.P("office-chair", 110, 600, "left"); f.P("laptop", 50, 600, "left", 75);
  for (const lz of [180, 240, 300]) f.P("chair", 100, lz, "left"); f.P("water-cooler", 100, 380, "left"); f.P("houseplant", 50, 80, "left");
  f.P("side-table", 120, 120, "back"); f.P("magazines", 120, 120, "back", 52); f.A("wall-clock", "back", 250, { y: 200 }); f.A("picture", "left", 450, { y: 160 });
  f.sign(); f.lights([[150, 250], [150, 650], [450, 250], [450, 650]], "ceiling-flush");
}

function outdoors(p) {
  terrain(p, 15000, 9000, 30, () => 0);
  // sidewalk and the parking lot south of the mall, drop-off plaza at the west entrance, delivery yard at the back
  path(p, rect(-3400, 400, 3400, 600), "paving", "#c9c3b7", 6);
  path(p, rect(-3400, 600, 3400, 3000), "asphalt", null, 2);
  path(p, rect(-5000, 3000, 4000, 3150), "paving", "#c9c3b7", 6);
  path(p, rect(-4600, -2400, -3000, 500), "paving", "#c9c3b7", 6);
  path(p, rect(-5000, -3000, -4600, 3600), "asphalt", null, 2);
  path(p, rect(-5000, 3150, 4000, 3850), "asphalt", null, 2);
  path(p, rect(3000, -2200, 4000, 300), "concrete", "#b5b1a8", 3);
  path(p, rect(-3000, -2800, 3000, -2000), "concrete", "#b5b1a8", 3);
  patch(p, rect(-5000, 3850, 4000, 4300), "gravel", "#cfc6b4");
  // cars in two double rows, lamps and trees on the islands
  const cars = ["sedan", "hatchback", "suv", "pickup-truck", "hatchback", "sedan", "van", "sports-car", "sedan", "suv", "hatchback", "convertible"];
  let i = 0;
  for (const [z, back] of [[850, "n"], [1400, "s"], [2100, "n"], [2650, "s"]]) {
    for (let x = -2900; x <= 2900; x += 330) {
      if (i++ % 5 === 2) continue;
      lot(p, cars[i % cars.length], x, z, back === "n" ? 90 : 270);
    }
  }
  for (const x of [-2200, -900, 400, 1700]) { lot(p, "lamp", x, 1750); lot(p, "ipe-tree", x + 650, 1750); patch(p, rect(x + 500, 1650, x + 800, 1850), "grass"); }
  for (const x of [-1400, 0, 1400]) lot(p, "trash-bin", x, 520);
  lot(p, "bicycle", 2500, 440, "n"); lot(p, "bicycle", 2680, 440, "n"); lot(p, "scooter", 2900, 460, "n");
  lot(p, "street-sign", 3300, 3050, "n"); lot(p, "traffic-light", -4450, 3000, "n"); lot(p, "fire-hydrant", -3350, 520); lot(p, "cone", -3000, 2950); lot(p, "cone", -2800, 2950);
  // the west entrance plaza
  lot(p, "entrance-canopy", -3020, -800, "e", 0); lot(p, "doormat", -3100, -800, "e");
  for (const z of [-1700, -1300, -300, 100]) lot(p, "planter", -3300, z);
  lot(p, "bench", -3600, -1100, "w"); lot(p, "bench", -3600, -500, "w"); lot(p, "trash-bin", -3400, -1500); lot(p, "lamp", -3900, -2000); lot(p, "lamp", -3900, 300);
  lot(p, "bus-stop", -4450, -1000, "w"); lot(p, "sedan", -4800, 600, 90); lot(p, "mailbox", -3400, 200, "w");
  for (const z of [-2200, -1500, -800, -100]) lot(p, "cherry-tree", -4200, z);
  // delivery yard behind the shops
  lot(p, "van", -1800, -2400, 90); lot(p, "pickup-truck", 1500, -2400, 90); lot(p, "pallet", 600, -2200); lot(p, "cardboard-boxes", 450, -2200, "n"); lot(p, "pallet", 750, -2200);
  for (const x of [-2600, -1200, 2200]) lot(p, "trash-bin", x, -2150); lot(p, "steel-drum", 2600, -2250); lot(p, "steel-drum", 2680, -2250); lot(p, "water-tank", 3600, -2100);
  for (const x of [-2500, -1500, -500, 500, 1500, 2500]) lot(p, "ac-outdoor-unit", x, -2030, "s"); lot(p, "lamp", -2900, -2700); lot(p, "lamp", 2900, -2700);
  fence(p, [[-3100, -2900], [4100, -2900], [4100, 300]], { style: "masonry", height: 220 });
  for (const [x, z] of [[-4000, -2700], [4300, -2700], [4300, 2000], [-4400, 1500], [3500, 500]]) lot(p, "eucalyptus", x, z);
  for (const [x, z] of [[-3900, 700], [-3800, 1500], [3600, 1000], [3600, 2000]]) lot(p, "bush", x, z);
}

export function shopping(p, b, g) {
  b.at = [-3000, -2000];
  b.name = "Shopping";
  g.height = H;
  shell(g);
  gallery(g);
  [bookshop, clothing, cafe, electronics, toys, pharmacy, gym].forEach((fn, k) => fn(g, k));
  [shoes, furniture, petshop, florist, salon, bakery, bank].forEach((fn, k) => fn(g, 7 + k));
  b.roof = { ...b.roof, type: "flat", pitch: 0, overhang: 30, height: 60, material: "concrete", tint: "#b6b3ab", ceiling: true };
  outdoors(p);
  p.sun = { ...p.sun, city: "saopaulo", latitude: -23.5, useTime: true, time: 14, month: 9 };
}
