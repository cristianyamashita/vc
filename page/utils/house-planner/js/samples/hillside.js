// Hillside house: a long sloping lot entered from the side street. At the
// top the garage and leisure building, then a light-stone courtyard, the
// single-storey main house (entrance facing the courtyard, three bedrooms,
// living, dining and open kitchen in marble and dark wood), the pool deck
// with the gourmet area behind it, and a long lawn running down the slope.
import { freshStorey } from "../schema.js";
import { garageLeisureBuilding } from "../templates.js";
import { floor, ext, inn, D, SL, WN, WS, WP, along, corner, put, lights, lot, path, deck, pool, rect, fence, siteWall, gate, terrain, smooth } from "./kit.js";

const LEVEL = 300; // cm: the terrace with the garage, the courtyard, the house and the pool
const H = 300;
const WOOD = { outerMaterial: "woodDark", outerTint: "#5a4030" };
const STONE = { outerMaterial: "stone", outerTint: "#a39a8c" };
const DOOR = { colors: { leafColor: "#4a3426", frameColor: "#2b2e33" } };
const DARK = { material: "woodDark" }, MARBLE = { material: "marble" };

function mainHouse(st) {
  const tiles = "#d8d4cc", stone = "#cfc9bd";
  floor(st, 0, 0, 1800, 1200, "woodFloor", "#c9a579");
  floor(st, 0, 0, 250, 650, "tiles", tiles);
  floor(st, 900, 0, 1200, 300, "stoneTiles", stone);
  floor(st, 1650, 450, 1800, 650, "tiles", tiles);
  floor(st, 1300, 650, 1800, 1200, "stoneTiles", stone);
  // ---- exterior (openings by their centre along the wall)
  ext(st, [0, 0], [1800, 0], [WS(125), WS(350), WN(680, 180), D(1050, 100, { height: 230, ...DOOR }), WN(1350, 150), WN(1650, 150)], STONE);
  ext(st, [1800, 0], [1800, 1200], [WN(225, 150), WS(550), WN(900, 150, 80, 130)]);
  ext(st, [1800, 1200], [0, 1200], [WN(1550, 240, 130, 100), SL(1100, 300, 240), SL(400, 400, 240)]);
  ext(st, [0, 1200], [0, 0], [WP(850), WS(610), WS(225)], WOOD);
  // ---- interior
  inn(st, [250, 0], [250, 450], [D(250)]); // master bath | walk-in closet
  inn(st, [450, 0], [450, 450], [D(250)]); // walk-in closet | master suite
  inn(st, [900, 0], [900, 450], [D(150)]); // master suite | hall
  inn(st, [0, 450], [900, 450]);
  inn(st, [250, 450], [250, 650], [D(550)]); // family bath
  inn(st, [0, 650], [250, 650]);
  inn(st, [1200, 0], [1200, 450], [D(150)]); // hall | bedroom 2
  inn(st, [1500, 0], [1500, 450]); // bedroom 2 | bedroom 3
  inn(st, [1200, 450], [1800, 450], [D(1545)]); // bedroom 3 door
  inn(st, [1650, 450], [1650, 650]); // laundry
  inn(st, [1650, 650], [1800, 650], [D(1725)]);
  // ---- master bath (0..250 × 0..450)
  corner(st, "shower-stall", 13, 13, "nw"); along(st, "toilet", "w", 13, 200); along(st, "bath-vanity", "w", 13, 360);
  along(st, "towel-rail", "e", 242, 100); along(st, "wall-mirror", "w", 13, 360, { y: 110 }); put(st, "bath-mat", 130, 150, "n");
  // ---- walk-in closet (250..450 × 0..450)
  along(st, "chest-of-drawers", "n", 13, 300); along(st, "chest-of-drawers", "n", 13, 400); along(st, "wardrobe", "s", 443, 350);
  along(st, "standing-mirror", "e", 442, 330); along(st, "shoe-rack", "w", 257, 160); put(st, "round-rug", 350, 230, "n"); put(st, "ceiling-flush", 350, 225, "n", H);
  // ---- master suite (450..900 × 0..450)
  along(st, "king-bed", "n", 13, 675); along(st, "nightstand", "n", 13, 530); along(st, "nightstand", "n", 13, 820);
  along(st, "wardrobe", "s", 443, 550); along(st, "dressing-table", "s", 443, 780); put(st, "dining-chair", 780, 330, "n");
  put(st, "rug", 675, 300, "n"); put(st, "table-lamp", 530, 40, "n", 100); put(st, "table-lamp", 820, 40, "n", 100); put(st, "houseplant", 495, 120, "n");
  along(st, "wall-tv", "s", 443, 660, { y: 160 });
  // ---- hall (900..1200 × 0..300)
  put(st, "doormat", 1050, 70, "n"); put(st, "coat-rack", 1160, 50, "n"); along(st, "shoe-rack", "e", 1192, 240); along(st, "picture", "w", 908, 250, { y: 150 });
  // ---- bedroom 2 (1200..1500 × 0..450)
  along(st, "double-bed", "n", 13, 1400); along(st, "nightstand", "n", 13, 1292);
  along(st, "wardrobe", "s", 443, 1400); along(st, "study-desk", "w", 1208, 350); put(st, "dining-chair", 1330, 340, "e"); put(st, "laptop", 1245, 350, "w", 75);
  put(st, "round-rug", 1370, 290, "n");
  // ---- bedroom 3 (1500..1800 × 0..450)
  along(st, "single-bed", "n", 13, 1575); along(st, "single-bed", "n", 13, 1725); along(st, "nightstand", "n", 13, 1650);
  along(st, "wardrobe", "e", 1787, 330); along(st, "bookshelf", "s", 443, 1660); put(st, "round-rug", 1650, 300, "n"); put(st, "toy-chest", 1540, 300, "w");
  // ---- family bath (0..250 × 450..650)
  corner(st, "shower-stall", 13, 458, "nw"); along(st, "washbasin-pedestal", "n", 458, 190); along(st, "toilet", "s", 643, 60);
  along(st, "wall-mirror", "n", 458, 190, { y: 110 }); along(st, "towel-rail", "s", 643, 170);
  // ---- laundry (1650..1800 × 450..650)
  along(st, "washing-machine", "n", 458, 1690); along(st, "dryer", "n", 458, 1755); along(st, "wall-shelves", "e", 1787, 600, { y: 150 });
  // ---- kitchen (1300..1800 × 650..1200): dark wood units along the walls, a marble island
  corner(st, "kitchen-corner-90", 1787, 1187, "se", DARK);
  along(st, "kitchen-stove-60", "e", 1787, 1065, DARK); along(st, "kitchen-base-60", "e", 1787, 1003, DARK); along(st, "kitchen-sink-80", "e", 1787, 930, DARK);
  along(st, "kitchen-base-60", "e", 1787, 858, DARK); along(st, "kitchen-fridge-70", "e", 1787, 790, DARK);
  along(st, "kitchen-base-60", "s", 1187, 1665, DARK); along(st, "dishwasher", "s", 1187, 1605); along(st, "kitchen-base-60", "s", 1187, 1545, DARK);
  along(st, "kitchen-wall-60", "e", 1787, 1003, { y: 145, ...MARBLE }); along(st, "kitchen-wall-60", "e", 1787, 1065, { y: 145, ...MARBLE });
  put(st, "microwave", 1755, 1003, "e", 93); put(st, "coffee-machine", 1760, 858, "e", 93); put(st, "kettle", 1665, 1160, "s", 93); put(st, "toaster", 1545, 1160, "s", 93);
  put(st, "kitchen-island", 1500, 930, "e", 0, MARBLE);
  for (const z of [870, 930, 990]) put(st, "bar-stool", 1405, z, "w");
  for (const z of [870, 930, 990]) put(st, "pendant-lamp", 1500, z, "n", H);
  put(st, "kitchen-bin", 1405, 1060, "w"); put(st, "houseplant", 1330, 1150, "n");
  // ---- dining (900..1300 × 650..1200)
  put(st, "dining-table", 1100, 950, "n");
  for (const x of [1030, 1100, 1170]) { put(st, "dining-chair", x, 877, "n"); put(st, "dining-chair", x, 1023, "s"); }
  put(st, "dining-chair", 985, 950, "w"); put(st, "dining-chair", 1215, 950, "e");
  put(st, "pendant-lamp", 1060, 950, "n", H); put(st, "pendant-lamp", 1140, 950, "n", H);
  along(st, "sideboard", "n", 457, 1400); along(st, "picture", "n", 457, 1400, { y: 150 });
  // ---- living (0..900 × 650..1200, open to the band in front of the suite)
  along(st, "wall-tv", "w", 13, 1080, { y: 110 }); along(st, "tv-bench", "w", 13, 1080);
  put(st, "sofa-corner", 350, 1000, "e"); put(st, "coffee-table", 170, 1000, "n"); put(st, "rug", 220, 1000, "n");
  put(st, "armchair-lounge", 160, 780, "n"); put(st, "armchair-lounge", 360, 760, "n"); put(st, "side-table", 260, 760, "n"); put(st, "floor-lamp", 700, 1160, "n"); put(st, "houseplant", 820, 1150, "n");
  along(st, "bookshelf", "n", 457, 800); along(st, "console-table", "n", 457, 450); put(st, "floor-vase", 560, 475, "n"); along(st, "glass-cabinet", "n", 457, 630);
  // ---- lights
  lights(st, H, [[130, 230], [130, 550], [1725, 550], [1350, 150], [1350, 350], [1650, 150], [1650, 350], [675, 150], [675, 350]], "ceiling-flush");
  put(st, "pendant-lamp", 1050, 150, "n", H);
  lights(st, H, [[150, 800], [450, 800], [750, 800], [150, 1100], [450, 1100], [750, 1100], [550, 550], [1350, 550], [1550, 1100], [1700, 800], [1000, 800], [1200, 800], [1000, 1120], [1200, 1120]]);
  // ---- façade: canopy and lanterns at the entrance, sconces on the pool side
  along(st, "entrance-canopy", "s", -13, 1050); along(st, "wall-lantern", "s", -13, 970, { y: 220 }); along(st, "wall-lantern", "s", -13, 1130, { y: 220 });
  for (const x of [400, 1100, 1550]) along(st, "wall-sconce", "n", 1213, x, { y: 240 });
  put(st, "slat-panel", 1812, 600, "e"); put(st, "houseplant", 1340, -40, "n"); put(st, "houseplant", 760, -40, "n");
}

/** The lot: terraces, courtyard, pool deck with the gourmet area, the long lawn, the side street. */
function outdoors(p) {
  const H2 = (x, z) => {
    let h = z <= -3600 ? LEVEL + (-3600 - z) * 0.25 : z <= 500 ? LEVEL : LEVEL - 450 * smooth((z - 500) / 3300);
    if (z > 700 && Math.abs(x) < 1300) h += 12 * Math.sin(x / 260) * Math.sin(z / 330);
    return h;
  };
  terrain(p, 4600, 8600, 96, H2);
  const light = "#ece7dc";
  // courtyard of light stones between the garage and the house, driveway to the side gate
  path(p, rect(-1150, -2700, 1150, -1900), "stoneTiles", light);
  path(p, rect(1150, -2550, 1300, -2050), "stoneTiles", light);
  path(p, rect(950, -1900, 1070, -700), "stoneTiles", light); // side path to the pool deck
  lot(p, "sedan", 300, -2280, 90, 3); lot(p, "planter", -1080, -2000, "n", 3); lot(p, "planter", -1080, -2620, "n", 3); lot(p, "ipe-tree", -1100, -2300);
  for (const z of [-2650, -2450, -2250, -2050]) lot(p, "garden-bollard", 1120, z);
  lot(p, "mailbox", 1270, -2600, "e");
  // terrace, pool and the wooden deck around it, gourmet corner under a pergola, lounge with a fire pit
  path(p, rect(-1000, -700, 1000, -350), "stoneTiles", light);
  for (const r of [rect(-1000, -350, -300, 250), rect(500, -350, 1000, 250), rect(-300, -350, 500, -300), rect(-300, 100, 500, 250)]) deck(p, r, { height: 12 });
  pool(p, rect(-300, -300, 500, 100));
  const PAVING = LEVEL + 3, DECK = LEVEL + 10; // tops of the terrace paving and of the wooden deck
  lot(p, "pergola", -700, -520, "n", 0, PAVING); lot(p, "outdoor-kitchen", -700, -650, "n", 0, PAVING); lot(p, "outdoor-dining-set", -700, -470, "n", 0, PAVING);
  for (const x of [-820, -580]) lot(p, "pendant-lamp", x, -470, "n", 250, PAVING);
  lot(p, "outdoor-sofa", 700, -640, "n", 0, PAVING); lot(p, "fire-pit", 700, -430, "n", 0, PAVING); lot(p, "armchair-lounge", 920, -520, "e", 0, PAVING); lot(p, "armchair-lounge", 480, -520, "w", 0, PAVING);
  lot(p, "lounger", -100, 180, "n", 0, DECK); lot(p, "lounger", 150, 180, "n", 0, DECK); lot(p, "side-table", 25, 180, "n", 0, DECK); lot(p, "beach-umbrella", 25, 110, "n", 0, DECK);
  for (const [x, z] of [[-960, -320], [960, -320], [-960, 220], [960, 220]]) lot(p, "planter", x, z, "n", 0, DECK);
  for (const x of [-700, 0, 700]) lot(p, "garden-bollard", x, 262, "n", 0, DECK);
  // the long lawn running down the hill: stepping stones, trees along the walls, a corner to sit at the bottom
  for (let z = 420; z < 3700; z += 130) path(p, rect(-45, z, 45, z + 80), "stone", "#d9d3c6", 4);
  for (const [prop, x, z] of [["ipe-tree", -1100, 900], ["tree", -1100, 1500], ["cypress", -1120, 2000], ["birch-tree", -1050, 2600], ["oak-tree", -1000, 3300], ["tree", 1100, 800], ["cypress", 1120, 1300], ["ipe-tree", 1050, 1900], ["tree", 1100, 2500], ["birch-tree", 1050, 3100]]) lot(p, prop, x, z);
  for (const [x, z] of [[-900, 1200], [-950, 2300], [-900, 2900], [900, 1000], [950, 1600], [900, 2200], [950, 2800], [-400, 3500], [400, 3500]]) lot(p, "bush", x, z);
  for (const z of [900, 1700, 2500, 3300]) { lot(p, "garden-spike", -150, z); lot(p, "garden-spike", 150, z); }
  lot(p, "bench", 0, 3880, "s"); lot(p, "campfire", 0, 3650); lot(p, "swing-set", 850, 3450); lot(p, "garden-shed", -1050, 3850, "s"); lot(p, "trampoline", -600, 3100);
  // site wall with the sliding and pedestrian gates on the east side, hedges inside the long sides
  const W = 1300, N = -4100, S = 4100;
  siteWall(p, [[-W, N], [W, N], [W, S], [-W, S], [-W, N]], { height: 220, material: "plaster", tint: "#d9d2c4", gates: [gate(2 * W + (-2550 - N) - 55, "single"), gate(2 * W + (-2250 - N) - 150, "sliding")] });
  fence(p, [[-1250, -1850], [-1250, 4050], [1250, 4050], [1250, -1850]], { style: "hedge", height: 110 });
  fence(p, [[-1250, -4050], [-1250, -2750]], { style: "hedge", height: 110 });
  for (const [x, z] of [[-1150, -3900], [-700, -3950], [700, -3950], [1150, -3900]]) lot(p, "bush", x, z);
  lot(p, "tree", 1150, -3700); lot(p, "tree", -1150, -3700);
  // the street along the east side
  path(p, rect(1300, -4300, 1480, 4300), "paving", "#bfbab0", 6);
  path(p, rect(1480, -4300, 2250, 4300), "asphalt", null, 2);
  for (const z of [-3400, -2000, -600, 800, 2200, 3600]) lot(p, "lamp", 1400, z);
  lot(p, "street-sign", 1390, -2850, 90, 6); lot(p, "trash-bin", 1400, -2700, "n", 6); lot(p, "hatchback", 1800, -3300, 90, 2);
}

export function hillside(p, b, g) {
  // the main house below the courtyard
  b.at = [-900, -1900];
  g.elevation = LEVEL;
  g.height = H;
  mainHouse(g);
  b.roof = { ...b.roof, type: "flat", overhang: 60, height: 30, material: "concrete", tint: "#2f3236", ceiling: true };
  // the garage and leisure building at the top of the lot, its garage door facing the courtyard
  const gb = { id: `b_${b.id}g`, name: "", at: [-900, -3300], rotation: 0, locked: false, roofShadow: true, roof: { ...b.roof }, storeys: [freshStorey(null, "ground")] };
  gb.storeys[0].elevation = LEVEL;
  garageLeisureBuilding(gb, gb.storeys[0]);
  p.buildings.push(gb);
  outdoors(p);
  p.sun = { ...p.sun, city: "saopaulo", latitude: -23.5, useTime: true, time: 15.5, month: 10 };
}
