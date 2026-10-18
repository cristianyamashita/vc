// Farmhouse: a large single-storey house in the Spanish / Mexican style, a
// veranda with columns and low walls all around under one big hip roof of
// clay tiles. Great room with a fireplace, dining for ten, farmhouse
// kitchen with pantry and laundry, master suite, two bedrooms and a bath
// off a hallway. Outside: gravel drive, barn, paddock, pond and old trees.
import { freshStorey } from "../schema.js";
import { floor, ext, inn, column, D, DD, PD, AR, WN, WS, GD, along, corner, put, lights, lot, path, pond, patch, rect, fence, gate, terrain, smooth, rail } from "./kit.js";

const H = 320;
const OCHRE = { outerMaterial: "plaster", outerTint: "#e6d6b4", tint: "#f4ecdc" };
const WOOD = { colors: { leafColor: "#5a3a22", frameColor: "#4a3020" } };
const RUSTIC = { material: "woodLight" };

function house(st) {
  const terracotta = "#b8663f", wood = "#a8763f", bath = "#d8d4cc";
  floor(st, 0, 0, 2600, 1800, "tiles", terracotta); // veranda and core
  floor(st, 550, 300, 2300, 1500, "woodFloor", wood);
  floor(st, 300, 900, 1000, 1500, "tiles", "#c9b08a"); // kitchen
  floor(st, 300, 300, 550, 600, "tiles", bath); // master bath
  floor(st, 1750, 700, 2300, 950, "tiles", bath); // bath 2
  floor(st, 1600, 300, 1750, 1500, "tiles", terracotta); // hallway
  // ---- core walls (exterior, 25 cm)
  ext(st, [300, 300], [2300, 300], [WS(425), WN(650, 180), D(800, 90, WOOD), WN(1100, 120, 150, 80), DD(1300, 160, { height: 240, ...WOOD }), WN(1500, 120, 150, 80), WN(1875, 180)], OCHRE);
  ext(st, [2300, 300], [2300, 1500], [WN(500, 180), WS(825), WN(1100, 180), D(1400, 90, WOOD)], OCHRE);
  ext(st, [2300, 1500], [300, 1500], [WN(2025, 150), DD(1300, 160, { height: 240, ...WOOD }), WN(850, 150, 90, 120), D(650, 90, WOOD), WS(425)], OCHRE);
  ext(st, [300, 1500], [300, 300], [WS(1375), WN(1075, 180), WS(750), WS(450)], OCHRE);
  // ---- interior
  inn(st, [1000, 300], [1000, 1500], [D(500, 90, WOOD), PD(1200, 160)]); // master | sala, kitchen | dining
  inn(st, [1000, 900], [1600, 900], [AR(1300, 200)]); // sala | dining
  inn(st, [1600, 300], [1600, 1500], [D(600, 90, WOOD), D(1200, 90, WOOD)]); // hallway
  inn(st, [1750, 300], [1750, 1500], [D(500, 90, WOOD), D(825, 90, WOOD), D(1225, 90, WOOD)]);
  inn(st, [1750, 700], [2300, 700]); inn(st, [1750, 950], [2300, 950]);
  inn(st, [300, 900], [1000, 900], [D(425, 90, WOOD)]); // master, pantry | kitchen
  inn(st, [550, 300], [550, 900], [D(450, 90, WOOD)]); // master bath | suite, pantry
  inn(st, [300, 600], [550, 600]); // master bath | pantry
  inn(st, [550, 1250], [550, 1500], [D(1375, 90, WOOD)]); inn(st, [300, 1250], [550, 1250]); // laundry
  // ---- veranda: columns on the edge, low walls between them, open at the doors
  for (const x of [20, 340, 660, 980, 1620, 1940, 2260, 2580]) { column(st, x, 20, 30, OCHRE); column(st, x, 1780, 30, OCHRE); }
  for (const z of [460, 900, 1340]) { column(st, 20, z, 30, OCHRE); column(st, 2580, z, 30, OCHRE); }
  for (const pts of [[[35, 20], [1150, 20]], [[1450, 20], [2565, 20]], [[35, 1780], [1150, 1780]], [[1450, 1780], [2565, 1780]], [[20, 35], [20, 1300]], [[20, 1500], [20, 1765]], [[2580, 35], [2580, 1300]], [[2580, 1500], [2580, 1765]]])
    rail(st, pts, { height: 85, style: "masonry" });
  // ---- sala (1000..1600 × 300..900)
  along(st, "fireplace", "e", 1592, 750); put(st, "sofa-three-seat", 1250, 720, "w"); put(st, "armchair", 1380, 540, "n"); put(st, "coffee-table", 1380, 720, "n");
  put(st, "rug", 1340, 700, "n"); along(st, "upright-piano", "w", 1007, 750); put(st, "stool", 1160, 750, "w"); put(st, "houseplant", 1050, 350, "n");
  along(st, "picture", "e", 1592, 450, { y: 150 }); put(st, "chandelier", 1300, 620, "n", H); put(st, "side-table", 1460, 560, "n"); put(st, "table-lamp", 1460, 560, "n", 52);
  // ---- dining (1000..1600 × 900..1500)
  put(st, "refectory-table", 1300, 1200, "e");
  for (const x of [1190, 1263, 1337, 1410]) { put(st, "dining-chair", x, 1085, "n"); put(st, "dining-chair", x, 1315, "s"); }
  put(st, "dining-chair", 1115, 1200, "w"); put(st, "dining-chair", 1485, 1200, "e");
  along(st, "sideboard", "w", 1007, 1000); along(st, "glass-cabinet", "e", 1592, 1000); put(st, "houseplant", 1560, 1460, "n");
  for (const x of [1225, 1375]) put(st, "pendant-lamp", x, 1200, "n", H);
  // ---- kitchen (300..1000 × 900..1500): rustic units along the north and east walls, a big table in the middle
  along(st, "kitchen-fridge-70", "n", 907, 535, RUSTIC); along(st, "kitchen-base-60", "n", 907, 600, RUSTIC); along(st, "kitchen-sink-80", "n", 907, 670, RUSTIC);
  along(st, "kitchen-base-60", "n", 907, 740, RUSTIC); along(st, "kitchen-stove-60", "n", 907, 800, RUSTIC); along(st, "kitchen-base-60", "n", 907, 860, RUSTIC);
  corner(st, "kitchen-corner-90-r", 992, 907, "ne", RUSTIC); along(st, "kitchen-base-60", "e", 992, 1027, RUSTIC); along(st, "kitchen-base-60", "e", 992, 1087, RUSTIC);
  for (const x of [600, 740, 860]) along(st, "kitchen-wall-60", "n", 907, x, { y: 145, ...RUSTIC });
  put(st, "cooking-pot", 800, 940, "n", 93); put(st, "bread-basket", 960, 1027, "e", 93); put(st, "dish-rack", 740, 945, "n", 93); put(st, "kettle", 600, 945, "n", 93);
  put(st, "kitchen-table", 700, 1250, "n");
  for (const x of [630, 700, 770]) put(st, "chair", x, 1157, "n");
  for (const x of [700, 770]) put(st, "chair", x, 1343, "s");
  put(st, "chair", 860, 1250, "e"); put(st, "bread-basket", 700, 1250, "n", 83); put(st, "houseplant", 940, 1450, "n");
  for (const x of [630, 770]) put(st, "pendant-lamp", x, 1250, "n", H);
  // ---- pantry (300..550 × 600..900) and laundry (300..550 × 1250..1500)
  along(st, "steel-shelf", "w", 307, 750); along(st, "wine-rack", "n", 612, 450); put(st, "wooden-barrel", 505, 690, "n"); put(st, "cardboard-boxes", 455, 775, "n");
  along(st, "washing-machine", "s", 1492, 350); along(st, "dryer", "s", 1492, 415); put(st, "laundry-basket", 340, 1300, "n"); along(st, "wall-shelves", "n", 1257, 450, { y: 150 });
  // ---- master suite (550..1000 × 300..900) and bath (300..550 × 300..600)
  along(st, "king-bed", "s", 892, 775); along(st, "nightstand", "s", 892, 625); along(st, "nightstand", "s", 892, 925);
  along(st, "wardrobe", "w", 557, 750); along(st, "dressing-table", "e", 992, 640); put(st, "chair", 880, 640, "w"); put(st, "armchair", 660, 560, "n");
  put(st, "rug", 775, 600, "n"); put(st, "ceiling-fan", 775, 600, "n", H); put(st, "table-lamp", 625, 870, "n", 100); put(st, "table-lamp", 925, 870, "n", 100);
  along(st, "bathtub", "w", 307, 450); along(st, "toilet", "n", 312, 500); along(st, "washbasin-pedestal", "s", 592, 480); along(st, "wall-mirror", "s", 592, 480, { y: 110 });
  along(st, "towel-rail", "e", 542, 350);
  // ---- bedroom 2 (1750..2300 × 300..700), bath 2 (700..950), bedroom 3 (950..1500)
  along(st, "double-bed", "s", 692, 2025); along(st, "nightstand", "s", 692, 1890); along(st, "nightstand", "s", 692, 2160); along(st, "wardrobe", "n", 312, 2150);
  along(st, "study-desk", "e", 2292, 600); put(st, "chair", 2180, 600, "w"); put(st, "round-rug", 2000, 520, "n"); put(st, "ceiling-fan", 2025, 500, "n", H);
  along(st, "toilet", "s", 942, 1900); along(st, "washbasin-pedestal", "n", 707, 1900); along(st, "wall-mirror", "n", 707, 1900, { y: 110 }); corner(st, "shower-stall", 2292, 707, "ne"); put(st, "bath-mat", 2000, 830, "n");
  along(st, "single-bed", "n", 957, 1850); along(st, "single-bed", "n", 957, 2000); along(st, "nightstand", "n", 957, 1925); along(st, "wardrobe", "s", 1492, 1870);
  along(st, "study-desk", "e", 2292, 1270); put(st, "chair", 2180, 1270, "w"); along(st, "bookshelf", "s", 1492, 2200); put(st, "round-rug", 1925, 1250, "n"); put(st, "ceiling-fan", 2025, 1200, "n", H);
  // ---- hallway and lights
  put(st, "houseplant", 1675, 345, "n"); put(st, "houseplant", 1675, 1455, "n"); along(st, "picture", "w", 1607, 900, { y: 150 });
  lights(st, H, [[1675, 500], [1675, 900], [1675, 1300], [425, 450], [425, 750], [425, 1375], [1900, 825], [2025, 825]], "ceiling-flush");
  lights(st, H, [[1150, 500], [1450, 500], [1150, 1050], [1450, 1050], [1150, 1400], [1450, 1400], [650, 1050], [850, 1050], [650, 1450], [850, 1450], [700, 450], [900, 450], [700, 780], [900, 780], [1900, 450], [2150, 450], [1900, 1100], [2150, 1100], [1900, 1400], [2150, 1400]]);
  // ---- veranda furniture and lanterns
  put(st, "armchair", 950, 160, "s"); put(st, "armchair", 1650, 160, "s"); put(st, "side-table", 1050, 150, "n"); put(st, "side-table", 1550, 150, "n");
  put(st, "bench", 150, 1000, "w"); put(st, "hammock", 2450, 900, "e"); put(st, "outdoor-dining-set", 1800, 1650, "n"); put(st, "bench", 700, 1680, "s");
  for (const [x, z] of [[120, 120], [2480, 120], [120, 1680], [2480, 1680], [1180, 120], [1420, 120], [1180, 1680], [1420, 1680]]) put(st, "planter", x, z, "n");
  for (const x of [1200, 1400]) along(st, "wall-lantern", "s", 287, x, { y: 220 });
  for (const x of [1200, 1400, 650]) along(st, "wall-lantern", "n", 1513, x, { y: 220 });
  along(st, "wall-lantern", "w", 2313, 1250, { y: 220 }); along(st, "wall-lantern", "e", 287, 800, { y: 220 });
  for (const x of [500, 1300, 2100]) { put(st, "ceiling-flush", x, 150, "n", H); put(st, "ceiling-flush", x, 1650, "n", H); }
  for (const z of [600, 1200]) { put(st, "ceiling-flush", 150, z, "n", H); put(st, "ceiling-flush", 2450, z, "n", H); }
  put(st, "doormat", 1300, 230, "n"); put(st, "doormat", 1300, 1570, "n");
}

/** The barn: plank walls, a wide door towards the house, tractor and hay inside. */
function barn(st) {
  floor(st, 0, 0, 800, 600, "concrete", "#a8a49a");
  const PLANKS = { outerMaterial: "planks", outerTint: "#8a5a3a", tint: "#b08a62", material: "planks" };
  ext(st, [0, 0], [800, 0], [WS(200, 80, 60, 200), WS(600, 80, 60, 200)], PLANKS);
  ext(st, [800, 0], [800, 600], [WS(300, 80, 60, 200)], PLANKS);
  ext(st, [800, 600], [0, 600], [WS(200, 80, 60, 200), WS(600, 80, 60, 200)], PLANKS);
  ext(st, [0, 600], [0, 0], [GD(300, 300, 280, { colors: { leafColor: "#6b4226", frameColor: "#4a3020" } })], PLANKS);
  put(st, "tractor", 250, 300, "w"); along(st, "workbench", "n", 13, 600); along(st, "tool-board", "n", 13, 420, { y: 100 });
  put(st, "hay-bale", 690, 490, "n"); put(st, "hay-bale", 690, 300, "n"); put(st, "hay-bale", 690, 395, "n", 78);
  put(st, "wooden-barrel", 60, 540, "n"); put(st, "wooden-barrel", 120, 550, "n"); put(st, "wheelbarrow", 420, 490, "e");
  put(st, "ladder", 400, 40, "n"); put(st, "gas-cylinder", 760, 60, "n");
  lights(st, 350, [[200, 300], [600, 300]], "hanging-bulb");
}

function outdoors(p) {
  terrain(p, 7000, 6000, 96, (x, z) => {
    const near = smooth((Math.hypot(Math.max(0, Math.abs(x - 1300) - 1500), Math.max(0, Math.abs(z - 900) - 1100)) - 200) / 1200);
    return -8 + near * (55 * Math.sin(x / 1100) * Math.cos(z / 900) + 25 * Math.sin(z / 500 + 1));
  });
  // dirt road along the north edge, gravel drive to the house and a parking spot, flagstones to the back veranda
  path(p, rect(-3500, -2800, 3500, -2300), "dirt", "#8d7a5e", 2);
  path(p, rect(1050, -2300, 1550, -100), "gravel", "#c2b59b", 3);
  path(p, rect(400, -650, 2600, -100), "gravel", "#c2b59b", 3);
  path(p, rect(2600, -200, 3000, 400), "gravel", "#c2b59b", 3);
  path(p, rect(1200, 1800, 1400, 2300), "stone", "#c9c0ae", 4);
  lot(p, "pickup-truck", 2100, -380, "e"); lot(p, "mailbox", 1600, -2250, "n"); lot(p, "trail-sign", 950, -2200, "n");
  for (const z of [-2000, -1500, -1000, -500]) { lot(p, "garden-bollard", 1000, z); lot(p, "garden-bollard", 1600, z); }
  // paddock with a ranch fence, hay, a water tank and the pond
  fence(p, [[2900, 1200], [5200, 1200], [5200, 3400], [2900, 3400], [2900, 1200]], { style: "ranch", height: 120, gates: [gate(1150, "double", "#6b4226")] });
  for (const [x, z] of [[3300, 1600], [3450, 1600], [3375, 1750]]) lot(p, "hay-bale", x, z);
  lot(p, "water-tank", 4900, 1500); lot(p, "wash-trough", 4900, 2200, "e"); lot(p, "dirt-patch", 4000, 2400); lot(p, "dirt-patch", 3600, 2900); lot(p, "log", 4600, 3100);
  pond(p, [[-2900, 2200], [-2300, 2050], [-1700, 2250], [-1500, 2700], [-1800, 3100], [-2500, 3200], [-3000, 2800]], { depth: 90, height: 12 });
  for (const [x, z] of [[-2950, 2100], [-1450, 2500], [-2400, 3280], [-3080, 2900]]) lot(p, "reeds", x, z);
  lot(p, "bench", -2200, 1900, "s"); lot(p, "rock", -1500, 3050); lot(p, "willow-tree", -3100, 2200);
  // trees, orchard and the yard
  for (const [prop, x, z] of [["oak-tree", -800, 2300], ["big-tree", 3300, -1300], ["eucalyptus", -1500, -1800], ["eucalyptus", -800, -2000], ["araucaria", 3000, 2900], ["ipe-tree", -1800, 400], ["tree", 2500, 2200], ["tree", 1800, 2600], ["cherry-tree", 400, 2600], ["cherry-tree", 900, 2800], ["cherry-tree", 1900, 2900], ["cherry-tree", 2500, 2700], ["cypress", -3300, -2200], ["cypress", -3300, -1600], ["cypress", -3300, -1000], ["cypress", -3300, -400], ["banana-plant", -500, 1950], ["banana-plant", 2800, -700]]) lot(p, prop, x, z);
  for (const x of [-2200, -1700, -1200]) lot(p, "bush", x, -2150);
  lot(p, "clothesline", -450, 1300, "e"); lot(p, "dog-house", -350, 1900, "e"); lot(p, "bird-bath", 3000, -300); lot(p, "wheelbarrow", -500, 500, "n"); lot(p, "chest-freezer", 4200, -200, "n");
  lot(p, "tree-swing", -770, 2350, "n", 240); lot(p, "campfire", 1300, 2550); for (const [x, z] of [[1120, 2650], [1480, 2650]]) lot(p, "log", x, z, "n");
  for (const [x, z] of [[-200, -600], [-200, 2000], [2800, 2000], [2850, -600]]) lot(p, "lantern", x, z, "n", 0);
  lot(p, "tiki-torch", 1150, 2400); lot(p, "tiki-torch", 1450, 2400);
  patch(p, rect(2650, -2200, 3400, -1300), "dirt", "#9a8666"); patch(p, rect(-3300, 500, -2000, 1900), "dirt", "#a08a66");
  for (const [x, z] of [[-2600, 700], [-2300, 1000], [-2800, 1300], [-2500, 1600], [-2200, 1300]]) lot(p, "flower-bed", x, z);
  // the farm gate on the road
  fence(p, [[-3400, -2300], [3400, -2300]], { style: "ranch", height: 120, gates: [gate(3400 - 1300 + 1300 - 120, "double", "#6b4226")] });
}

export function farmhouse(p, b, g) {
  b.at = [0, 0];
  g.height = H;
  house(g);
  b.roof = { ...b.roof, type: "hip", pitch: 25, overhang: 70, ridgeAxis: "x", material: "roofTiles", tint: "#b4573a", ceiling: true };
  const bb = { id: `b_${b.id}barn`, name: "", at: [3000, 100], rotation: 0, locked: false, roofShadow: true, roof: { type: "gable", pitch: 35, overhang: 40, height: 20, ridgeAxis: "x", material: "fiberCement", tint: "#8a8f94", visible: false, locked: false, ceiling: false }, storeys: [freshStorey(null, "ground")] };
  bb.storeys[0].height = 350;
  barn(bb.storeys[0]);
  p.buildings.push(bb);
  outdoors(p);
  p.sun = { ...p.sun, city: "mexico", latitude: 19.4, useTime: true, time: 16, month: 7 };
}
