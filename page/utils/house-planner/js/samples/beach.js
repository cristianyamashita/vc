// Beach house: a light single-storey house on a lawn above the beach, all
// glass towards the sea. Open living and kitchen with an island, master
// suite with its bath, two bedrooms, a second bath, laundry and a hall. A
// wide deck on posts with steps down to the sand, a boardwalk to the water,
// umbrellas, palms and the sea itself below the lawn.
import { freshStorey } from "../schema.js";
import { floor, ext, inn, D, SL, WN, WS, WP, along, corner, put, lights, stairs, lot, path, deck, pond, patch, rect, fence, gate, terrain, smooth } from "./kit.js";

const LAWN = 150, H = 300;
const WHITE = { outerMaterial: "plaster", outerTint: "#f3f1ea", tint: "#f7f5ef" };
const UNIT = { material: "woodLight" };
const LIGHT_DOOR = { colors: { leafColor: "#3b7fa3", frameColor: "#f0ede6" } };

function house(st) {
  floor(st, 0, 0, 1400, 1000, "woodFloor", "#d9c3a0");
  floor(st, 0, 0, 250, 400, "tiles", "#d8e2e4"); floor(st, 1190, 0, 1400, 400, "tiles", "#d8e2e4"); floor(st, 1040, 0, 1190, 400, "tiles", "#d8d4cc");
  ext(st, [0, 0], [1400, 0], [WS(190), WS(450), WS(650), D(915, 100, { height: 220, ...LIGHT_DOOR }), WS(1115), WS(1350)], WHITE);
  ext(st, [1400, 0], [1400, 1000], [WS(300), WN(900, 180)], WHITE);
  ext(st, [1400, 1000], [0, 1000], [SL(1100, 240, 240), SL(650, 240, 240), WP(410, 240, 170, 60), WN(170, 180, 110, 110)], WHITE);
  ext(st, [0, 1000], [0, 0], [WN(650, 180, 80, 130), WS(300)], WHITE);
  // north band: bath 2 | bedroom 2 | bedroom 3 | hall | laundry | master bath
  inn(st, [0, 400], [790, 400], [D(190), D(385), D(655)]);
  inn(st, [900, 400], [1400, 400], [D(1295)]);
  for (const x of [250, 520, 790]) inn(st, [x, 0], [x, 400]);
  inn(st, [1040, 0], [1040, 400], [D(100)]); inn(st, [1190, 0], [1190, 400]);
  inn(st, [900, 400], [900, 1000], [D(800)]); // living | master suite
  // ---- living and kitchen (0..900 × 400..1000)
  corner(st, "kitchen-corner-90", 13, 407, "nw", UNIT); along(st, "kitchen-fridge-70", "w", 13, 532, UNIT); along(st, "kitchen-base-60", "w", 13, 597, UNIT);
  along(st, "kitchen-sink-80", "w", 13, 667, UNIT); along(st, "kitchen-base-60", "w", 13, 737, UNIT); along(st, "kitchen-stove-60", "w", 13, 797, UNIT); along(st, "kitchen-base-60", "w", 13, 857, UNIT);
  for (const z of [597, 737, 857]) along(st, "kitchen-wall-60", "w", 13, z, { y: 145, ...UNIT });
  put(st, "coffee-machine", 45, 597, "w", 93); put(st, "kettle", 45, 857, "w", 93); put(st, "dish-rack", 45, 737, "w", 93); put(st, "kitchen-bin", 60, 920, "w");
  put(st, "kitchen-island", 300, 650, "e", 0, { material: "marble" });
  for (const z of [600, 650, 700]) put(st, "bar-stool", 400, z, "e");
  for (const z of [600, 700]) put(st, "pendant-lamp", 300, z, "n", H);
  put(st, "round-table", 520, 560, "n"); put(st, "dining-chair", 520, 480, "n"); put(st, "dining-chair", 520, 640, "s"); put(st, "dining-chair", 440, 560, "w"); put(st, "dining-chair", 600, 560, "e");
  put(st, "sofa-corner", 680, 700, "n"); put(st, "coffee-table", 680, 860, "n"); put(st, "rug", 680, 790, "n"); put(st, "armchair-lounge", 460, 820, "n");
  along(st, "wall-tv", "e", 892, 580, { y: 110 }); along(st, "cube-shelf", "e", 892, 500); put(st, "houseplant", 860, 950, "n"); put(st, "floor-lamp", 860, 680, "n");
  put(st, "ceiling-fan", 700, 700, "n", H); lights(st, H, [[150, 500], [150, 900], [560, 500], [450, 900], [800, 500]]);
  // ---- master suite (900..1400 × 400..1000) and its bath (1190..1400 × 0..400)
  along(st, "king-bed", "e", 1387, 650); along(st, "nightstand", "e", 1387, 500); along(st, "nightstand", "e", 1387, 800); along(st, "wardrobe", "n", 407, 1050);
  along(st, "dressing-table", "w", 907, 600); put(st, "dining-chair", 1040, 600, "e"); put(st, "armchair-lounge", 1300, 920, "s"); put(st, "rug", 1150, 650, "n");
  put(st, "table-lamp", 1360, 500, "n", 100); put(st, "ceiling-fan", 1150, 700, "n", H); put(st, "houseplant", 940, 950, "n");
  corner(st, "shower-stall", 1197, 13, "nw"); along(st, "toilet", "e", 1387, 200); along(st, "washbasin-pedestal", "w", 1197, 250); along(st, "wall-mirror", "w", 1197, 250, { y: 110 });
  along(st, "towel-rail", "e", 1387, 330); put(st, "bath-mat", 1300, 230, "n");
  // ---- laundry (1040..1190 × 0..400) and hall (790..1040 × 0..400)
  along(st, "washing-machine", "n", 13, 1155); along(st, "dryer", "s", 392, 1120); put(st, "drying-rack", 1110, 240, "n"); along(st, "wall-shelves", "e", 1182, 200, { y: 150 });
  put(st, "doormat", 915, 60, "n"); along(st, "bench", "w", 797, 250); put(st, "coat-rack", 1010, 300, "n"); put(st, "houseplant", 830, 370, "n"); along(st, "picture", "e", 1032, 250, { y: 150 });
  // ---- bedroom 2 (250..520 × 0..400), bedroom 3 (520..790 × 0..400), bath 2 (0..250 × 0..400)
  along(st, "bunk-bed", "n", 13, 320); along(st, "chest-of-drawers", "e", 512, 300); put(st, "toy-chest", 300, 330, "n"); put(st, "round-rug", 420, 300, "n");
  along(st, "single-bed", "n", 13, 580); along(st, "single-bed", "n", 13, 720); along(st, "nightstand", "n", 13, 650); along(st, "chest-of-drawers", "w", 527, 320); put(st, "round-rug", 680, 310, "n");
  corner(st, "shower-stall", 13, 13, "nw"); along(st, "toilet", "e", 242, 200); along(st, "washbasin-pedestal", "w", 13, 250); along(st, "wall-mirror", "w", 13, 250, { y: 110 }); along(st, "towel-rail", "e", 242, 330);
  lights(st, H, [[125, 250], [385, 200], [655, 200], [915, 200], [1115, 200], [1295, 250], [1150, 550], [1150, 850]], "ceiling-flush");
  // ---- façade lights and the sea-side sconces
  along(st, "wall-lantern", "s", -13, 840, { y: 220 }); along(st, "wall-lantern", "s", -13, 990, { y: 220 });
  for (const x of [280, 900, 1300]) along(st, "wall-sconce", "n", 1013, x, { y: 240 });
}

function outdoors(p) {
  terrain(p, 4400, 4400, 96, (x, z) => {
    let h = LAWN * (1 - smooth((z - 300) / 400)) - 80 * smooth((z - 700) / 1000) - 20 * smooth((z - 1700) / 300);
    if (z > 750 && z < 1650) h += 6 * Math.sin(x / 180) * Math.sin(z / 150);
    if (z < 250) h += 5 * Math.sin(x / 400) * Math.cos(z / 300);
    return h;
  });
  // the beach and the sea
  patch(p, rect(-2200, 690, 2200, 1750), "sand", "#e2d3ad");
  pond(p, rect(-2200, 1650, 2200, 2200), { depth: 150, height: 20, tint: "#cfbf9a" });
  // deck on posts in front of the house, boardwalk down to the water
  deck(p, rect(-800, 300, 800, 700), { height: LAWN + 2, open: true, tint: "#c9a87a" });
  deck(p, rect(-60, 950, 60, 1550), { height: 50, open: true, tint: "#c9a87a" });
  lot(p, "outdoor-sofa", -450, 400, "n"); lot(p, "outdoor-dining-set", 350, 500); lot(p, "lounger", -600, 600, "n"); lot(p, "lounger", -380, 600, "n");
  lot(p, "fire-pit", -450, 560); for (const x of [-760, 760]) lot(p, "planter", x, 660);
  for (const x of [-700, -350, 350, 700]) lot(p, "garden-bollard", x, 685);
  lot(p, "string-lights", 0, 340, "n", 270); lot(p, "string-lights", 0, 640, "n", 270);
  for (const x of [-120, 120]) { lot(p, "tiki-torch", x, 720); lot(p, "tiki-torch", x, 960); }
  // on the sand
  lot(p, "beach-umbrella", 360, 1150); lot(p, "lounger", 280, 1250, "s"); lot(p, "lounger", 450, 1250, "s"); lot(p, "beach-umbrella", -600, 1300); lot(p, "lounger", -600, 1400, "s");
  lot(p, "campfire", -350, 1050); lot(p, "log", -350, 1180, "n"); lot(p, "sand-pile", -900, 1150); lot(p, "bucket", -800, 1050); lot(p, "ball", 700, 1000);
  lot(p, "volley-net", -1300, 1200, 90); lot(p, "jetski", 800, 1620, 90); lot(p, "rock", 1700, 1500); lot(p, "rock", 1850, 1350); lot(p, "reeds", -1900, 900); lot(p, "reeds", -1750, 820);
  for (const [x, z] of [[-1000, 250], [1000, 250], [-1350, 650], [1350, 700], [-700, 850], [1600, 900], [-1800, 300]]) lot(p, "palm-tree", x, z);
  lot(p, "hammock", -1150, 420, "n", 60); lot(p, "bench", 950, 450, "n");
  for (const [x, z] of [[-1200, 100], [1200, 50], [-600, -1200], [600, -1200], [1400, -600], [-1400, -500]]) lot(p, "bush", x, z);
  lot(p, "banana-plant", -1250, -100); lot(p, "banana-plant", 1300, -300); lot(p, "ipe-tree", -900, -1000); lot(p, "tree", 1050, -1050);
  // the street side: drive and carport, path to the door, the surf shack, white picket fence open to the beach
  path(p, rect(-2200, -1800, 2200, -1500), "asphalt", null, 2);
  path(p, rect(-2200, -1500, 2200, -1350), "paving", "#bfbab0", 6);
  path(p, rect(-70, -1350, 70, -700), "stone", "#d9d3c6", 4);
  path(p, rect(720, -1350, 1080, -720), "gravel", "#d8cdb5", 3);
  lot(p, "pergola", 900, -950); lot(p, "convertible", 900, -950, 90); lot(p, "bike-rack", 400, -1250, "n"); lot(p, "bicycle", 380, -1250, "n"); lot(p, "scooter", 480, -1230, "n");
  lot(p, "garden-shed", -1100, -400, "s"); lot(p, "mailbox", 110, -1320, "n"); lot(p, "lamp", 1500, -1450); lot(p, "lamp", -1500, -1450);
  fence(p, [[-1500, 280], [-1500, -1350], [1500, -1350], [1500, 280]], { style: "picket", height: 100, gates: [gate(1630 + 1500 - 55, "single", "#f0ede6"), gate(1630 + 1500 + 900 - 150, "sliding", "#f0ede6")] });
  for (const [x, z] of [[-200, -800], [200, -800], [-250, -1150], [250, -1150]]) lot(p, "flower-bed", x, z);
}

export function beach(p, b, g) {
  b.at = [-700, -700];
  g.elevation = LAWN;
  g.height = H;
  house(g);
  // the steps from the deck down to the sand belong to a ground-level storey of their own
  const ground = freshStorey(null, "ground");
  ground.elevation = -20;
  ground.foundation.enabled = true;
  stairs(ground, [700, 1652], 90, { shape: "straight", width: 160, rise: LAWN + 20, rail: "both", railStyle: "wood", material: "planks", tint: "#c9a87a" });
  b.storeys.unshift(ground);
  b.roof = { ...b.roof, type: "gable", pitch: 18, overhang: 70, ridgeAxis: "x", material: "fiberCement", tint: "#e8e8e2", ceiling: true };
  outdoors(p);
  p.sun = { ...p.sun, city: "rio", latitude: -22.9, useTime: true, time: 16, month: 1 };
}
