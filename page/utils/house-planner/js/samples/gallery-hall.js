// Traced from the supplied “Luxury Home with Gallery Hall” concept plan.
// North is the patio side. Dimensions are estimated (the drawing has no
// dimensions); wall axes follow the planner's 50 cm floor grid. The garden,
// patio and porch are omitted, but their doors remain in the exterior walls.
import { floor, ext, inn, D, DD, SL, GD, WN, WS, along, corner, put, lights } from "./kit.js";

const H = 300;
const FACADE = { outerMaterial: "plaster", outerTint: "#eee7dc", tint: "#f2ece1" };
const WOOD = { colors: { leafColor: "#b69a73", frameColor: "#343632" } };
const door = (c, w = 80, flip = false) => D(c, w, { ...WOOD, flip });

export function galleryHall(_project, building, st) {
  building.at = [-1450, -700];
  st.height = H;

  // Stepped footprint, including the recessed front entrance and garage.
  for (const rect of [
    [0, 50, 450, 1150], [450, 0, 800, 1150],
    [800, 100, 1050, 1150], [1050, 100, 1300, 1100],
    [1300, 100, 2000, 1150], [2000, 100, 2100, 750],
    [2100, 50, 2550, 750], [2550, 100, 2750, 750],
  ]) floor(st, ...rect, "woodFloor", "#c5a16f");
  floor(st, 2000, 750, 2900, 1400, "concrete", "#aaa9a5");
  for (const rect of [
    [0, 300, 150, 650], [150, 350, 450, 650],
    [300, 750, 500, 1000], [350, 1000, 500, 1150],
    [800, 750, 1000, 1150], [1600, 750, 1750, 1150],
  ]) floor(st, ...rect, "tiles", "#e4dfd5");

  // North facade: two small dressing windows, three bedroom windows,
  // living-room glazing, double patio doors and the kitchen windows.
  ext(st, [0, 50], [450, 50], [WN(60, 60), WN(210, 65)], FACADE);
  ext(st, [450, 50], [450, 0], [], FACADE);
  ext(st, [450, 0], [800, 0], [WN(545, 65), WN(645, 105), WN(745, 65)], FACADE);
  ext(st, [800, 0], [800, 100], [], FACADE);
  ext(st, [800, 100], [900, 100], [], FACADE);
  ext(st, [900, 100], [1500, 100], [WN(1015, 80, 170, 50), WN(1190, 220, 170, 50), WN(1390, 90, 170, 50)], FACADE);
  ext(st, [1500, 100], [2100, 100], [DD(1580, 120, WOOD), WN(1810, 220, 170, 50), WN(2010, 80, 170, 50)], FACADE);
  ext(st, [2100, 100], [2100, 50], [], FACADE);
  ext(st, [2100, 50], [2550, 50], [WN(2220, 80, 100, 120), WN(2340, 110, 100, 120), WN(2460, 80, 100, 120)], FACADE);
  ext(st, [2550, 50], [2550, 100], [], FACADE);
  ext(st, [2550, 100], [2750, 100], [WS(2700, 50, 70, 140)], FACADE);
  ext(st, [2750, 100], [2750, 450], [], FACADE);
  ext(st, [2750, 450], [2750, 750], [WN(570, 160, 150, 65)], FACADE);

  // Garage: personnel door at the northeast corner, east window and three
  // individual south-facing vehicle doors, as in the reference.
  ext(st, [2750, 750], [2900, 750], [door(2835, 85, true)], FACADE);
  ext(st, [2900, 750], [2900, 1400], [WN(965, 65, 100, 120)], FACADE);
  ext(st, [2900, 1400], [2000, 1400], [GD(2745, 240), GD(2450, 260), GD(2155, 240)], FACADE);
  ext(st, [2000, 1400], [2000, 1150], [], FACADE);

  // Front windows, the recessed double entrance, and west-side wet-area
  // windows. Bedroom windows stay on the front, not on the side facade.
  ext(st, [2000, 1150], [1750, 1150], [WN(1870, 140, 130, 80)], FACADE);
  ext(st, [1750, 1150], [1600, 1150], [WS(1675, 60, 70, 140)], FACADE);
  ext(st, [1600, 1150], [1300, 1150], [WN(1470, 160, 130, 80)], FACADE);
  ext(st, [1300, 1150], [1300, 1100], [], FACADE);
  ext(st, [1300, 1100], [1050, 1100], [DD(1175, 160, WOOD)], FACADE);
  ext(st, [1050, 1100], [1050, 1150], [], FACADE);
  ext(st, [1050, 1150], [800, 1150], [WS(925, 60, 70, 140)], FACADE);
  ext(st, [800, 1150], [500, 1150], [WN(650, 180, 130, 80)], FACADE);
  ext(st, [500, 1150], [350, 1150], [WS(425, 60, 70, 140)], FACADE);
  ext(st, [350, 1150], [0, 1150], [WN(175, 170, 130, 80)], FACADE);
  ext(st, [0, 1150], [0, 50], [WN(710, 70, 120, 100), WS(415, 75, 70, 150)], FACADE);

  // Primary suite and dressing room. The ensuite is reached through the
  // dressing room; its toilet cubicle has a separate door on the east side.
  inn(st, [450, 50], [450, 550], [door(160, 80, true)], { flipOuter: true });
  inn(st, [450, 550], [450, 650]);
  inn(st, [0, 300], [150, 300]);
  inn(st, [150, 300], [150, 500], [door(435, 75)], { flipOuter: true });
  inn(st, [0, 500], [150, 500]);
  inn(st, [150, 350], [450, 350], [door(210, 80)], { flipOuter: true });
  inn(st, [0, 650], [450, 650], [WN(275, 85, 70, 150)]);
  inn(st, [800, 100], [800, 550]);
  inn(st, [900, 100], [900, 550]);
  // The primary entry projects slightly into the gallery, beside a closet.
  inn(st, [450, 550], [550, 550]);
  inn(st, [550, 550], [550, 650]);
  inn(st, [450, 650], [550, 650], [door(500, 75)]);
  inn(st, [550, 600], [700, 600], [DD(625, 120, WOOD)]);
  inn(st, [700, 600], [700, 550]);
  inn(st, [700, 550], [800, 550], [WN(750, 65, 140, 75)]);
  inn(st, [800, 550], [900, 550], [door(850, 75)]);

  // Living room: central double doors flanked by internal windows. The
  // east glass slider connects to dining, without inventing a solid divide.
  inn(st, [900, 550], [1500, 550], [WN(1015, 140, 150, 65), DD(1190, 140, WOOD), WN(1375, 90, 150, 65)]);
  inn(st, [1500, 100], [1500, 550], [SL(325, 240)]);
  inn(st, [1500, 550], [2000, 550], [WN(1660, 150, 150, 65), WN(1940, 80, 150, 65)]);
  // Small dining vestibule, pantry and family lounge access from the hall.
  inn(st, [2000, 550], [2000, 600]);
  inn(st, [2000, 600], [2150, 600], [door(2075, 85, true)]);
  inn(st, [2150, 450], [2150, 750], [door(675, 90)], { flipOuter: false });
  inn(st, [2550, 100], [2550, 450]);
  inn(st, [2550, 450], [2750, 450], [door(2640, 80)]);

  // Gallery hall and the lower bedroom wing. Doors on this edge swing
  // south into their rooms; each bathroom opens directly from the gallery.
  inn(st, [200, 650], [200, 750]);
  inn(st, [0, 750], [300, 750], [door(90, 75, true), door(250, 75, true)], { flipOuter: true });
  inn(st, [300, 750], [500, 750], [door(445, 75)], { flipOuter: true });
  inn(st, [500, 750], [800, 750], [door(565, 80, true)], { flipOuter: true });
  inn(st, [800, 750], [1050, 750], [door(950, 75)], { flipOuter: true });
  inn(st, [1300, 750], [1600, 750], [door(1540, 80)], { flipOuter: true });
  inn(st, [1600, 750], [1750, 750], [door(1695, 75)], { flipOuter: true });
  inn(st, [1750, 750], [2000, 750], [door(1850, 80, true)], { flipOuter: true });
  inn(st, [2000, 750], [2150, 750], [door(2070, 85)], { flipOuter: true });
  inn(st, [2150, 750], [2750, 750]);
  inn(st, [300, 750], [300, 1000]);
  inn(st, [300, 1000], [350, 1000]);
  inn(st, [350, 1000], [350, 1150]);
  for (const x of [500, 800, 1600, 1750, 2000]) inn(st, [x, 750], [x, 1150]);
  for (const x of [1050, 1300]) inn(st, [x, 750], [x, 1100]);
  // Shower enclosures, with glazed entry doors facing their bathrooms.
  const glassDoor = (c) => SL(c, 85, 205);
  inn(st, [350, 1000], [500, 1000], [glassDoor(445)], { thickness: 8 });
  inn(st, [800, 1000], [1000, 1000], [glassDoor(950)], { thickness: 8 });
  inn(st, [1000, 750], [1000, 1150]);

  // Primary bedroom and dressing furniture, leaving the entry clear.
  along(st, "king-bed", "e", 787, 285);
  for (const z of [145, 425]) along(st, "nightstand", "e", 787, z);
  put(st, "rug", 610, 285, 90);
  along(st, "closet-rail", "w", 13, 180);
  along(st, "wardrobe", "n", 63, 320);
  along(st, "wardrobe", "s", 337, 330);
  put(st, "bedroom-bench", 200, 240);
  along(st, "wardrobe", "n", 113, 850);
  st.objects.at(-1).scale[0] = 0.45; // fit the narrow built-in storage bay
  along(st, "toilet", "n", 313, 75);
  corner(st, "shower-stall", 13, 637, "sw");
  put(st, "bathtub", 270, 565);
  for (const x of [310, 405]) along(st, "washbasin-pedestal", "n", 363, x);
  along(st, "toilet", "e", 437, 595);
  along(st, "wardrobe", "n", 663, 100);

  // Living/dining furniture follows the image's orientations.
  put(st, "rug", 1200, 320);
  put(st, "sofa-two-seat", 1050, 330, "w");
  put(st, "sofa-two-seat", 1380, 330, "e");
  put(st, "armchair", 1075, 180, "n");
  put(st, "armchair", 1375, 180, "n");
  put(st, "armchair-lounge", 1375, 465, "s");
  put(st, "coffee-table", 1210, 330);
  along(st, "wall-tv", "w", 913, 330, { y: 140 });
  put(st, "dining-table", 1750, 320);
  for (const x of [1680, 1750, 1820]) {
    put(st, "dining-chair", x, 240, "n");
    put(st, "dining-chair", x, 400, "s");
  }
  put(st, "dining-chair", 1615, 320, "w");
  put(st, "dining-chair", 1885, 320, "e");
  along(st, "sideboard", "s", 537, 1840);

  // L-shaped kitchen and island, with a separate pantry opening south.
  for (const [prop, x] of [["kitchen-base-60", 2150], ["kitchen-base-60", 2210], ["kitchen-stove-60", 2270], ["kitchen-base-60", 2330], ["kitchen-base-60", 2390], ["kitchen-base-60", 2450]]) along(st, prop, "n", 63, x);
  along(st, "kitchen-base-60", "e", 2537, 155);
  along(st, "kitchen-fridge-70", "e", 2537, 250);
  along(st, "kitchen-base-60", "e", 2537, 365);
  put(st, "kitchen-island", 2220, 325);
  st.objects.at(-1).scale = [1.55, 1, 1.35];
  for (const x of [2120, 2190, 2260, 2330]) put(st, "bar-stool", x, 425, "s");
  along(st, "steel-shelf", "n", 113, 2650);
  along(st, "wall-shelves", "e", 2737, 290, { y: 130 });
  put(st, "rug", 2440, 605);
  put(st, "sofa-three-seat", 2320, 590, "w");
  put(st, "coffee-table", 2470, 610);
  put(st, "armchair", 2630, 620, "e");
  along(st, "tv-bench", "s", 737, 2450);
  along(st, "wall-tv", "s", 737, 2450, { y: 140 });

  // Three secondary bedrooms: bed 3 backs onto the east wall, beds 2 and 4
  // onto the west wall. Their north entrances remain unobstructed.
  for (const [left, right, back] of [[0, 300, "w"], [500, 800, "e"], [1300, 1600, "w"]]) {
    const face = back === "w" ? left + 13 : right - 13;
    along(st, "double-bed", back, face, 985);
    for (const z of [865, 1100]) along(st, "nightstand", back, face, z);
  }
  along(st, "wardrobe", "n", 763, 700);
  along(st, "wardrobe", "n", 763, 1400);
  for (const [left, right, showerLeft] of [[300, 500, 350], [800, 1000, 800]]) {
    along(st, "bath-vanity", "w", left + 13, 850);
    along(st, "toilet", "w", left + 13, 950);
    corner(st, "shower-glass", right - 13, 1137, "se");
    put(st, "bath-mat", (showerLeft + right) / 2, 970);
  }
  along(st, "washing-machine", "w", 1613, 875);
  along(st, "dryer", "w", 1613, 950);
  along(st, "washbasin-pedestal", "w", 1613, 1060);
  put(st, "study-desk", 1845, 1000, "w");
  put(st, "office-chair", 1930, 1000, "e");
  put(st, "laptop", 1845, 1000, "w", 75);
  for (const [prop, x] of [["suv", 2155], ["sedan", 2450], ["sports-car", 2745]]) put(st, prop, x, 1090, 90);

  // Low gallery consoles and indoor planting, clear of all door openings.
  for (const x of [980, 1510, 1840]) along(st, "console-table", "n", 563, x);
  for (const [x, z] of [[495, 90], [980, 465], [1950, 810], [2690, 690], [1720, 1085]]) put(st, "houseplant", x, z);
  lights(st, H, [[200, 190], [620, 280], [270, 440], [1200, 320], [1750, 320], [2240, 300], [2650, 280], [2450, 590], [300, 700], [800, 690], [1300, 690], [1800, 690], [1175, 950], [150, 975], [400, 850], [650, 975], [900, 850], [1450, 975], [1680, 950], [1875, 950], [2155, 1060], [2450, 1060], [2745, 1060]]);
  building.roof = { ...building.roof, type: "flat", overhang: 25, height: 25, material: "concrete", tint: "#67665f", visible: false, ceiling: true };
}
