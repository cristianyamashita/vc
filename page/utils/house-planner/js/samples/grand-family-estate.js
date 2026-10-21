// Single-storey family estate based on the supplied 412 m² floor plan.
// The pool, entertaining terrace, garden and drive are omitted; the attached
// three-car garage remains part of the house.
import { floor, ext, inn, D, GD, WN, along, corner, put, lights } from "./kit.js";

const H = 320;
const FACADE = { outerMaterial: "plaster", outerTint: "#e7e0d5", tint: "#f3eee4" };
const WOOD = { colors: { leafColor: "#59402d", frameColor: "#2b2e33" } };

/** Fill one building with the estate plan, in building-local centimetres. */
export function grandFamilyEstate(_project, building, storey) {
  const st = storey;
  // Keep the full 34 × 14 m footprint centred on the sample's default terrain.
  building.at = [-1700, -700];
  building.name = "Grand Family Estate with Entertaining Wing";
  st.height = H;

  // Approximate 412 m² footprint: primary suite, open-plan core, two guest
  // suites, the bedroom/service wing and an attached three-car garage.
  floor(st, 0, 0, 600, 800, "woodFloor", "#c9a579");
  floor(st, 600, 300, 2300, 800, "woodFloor", "#c9a579");
  floor(st, 2300, 0, 3400, 800, "woodFloor", "#c9a579");
  floor(st, 0, 800, 2600, 1350, "woodFloor", "#c9a579");
  floor(st, 2600, 800, 3400, 1400, "concrete", "#aaa9a4");
  // Wet and utility areas sit over the timber floor finish.
  floor(st, 0, 0, 220, 430, "tiles", "#d8d4cc");
  floor(st, 3000, 0, 3400, 400, "tiles", "#d8d4cc");
  floor(st, 3000, 400, 3400, 800, "tiles", "#d8d4cc");
  floor(st, 400, 950, 650, 1350, "tiles", "#d8d4cc");
  floor(st, 1050, 950, 1300, 1350, "tiles", "#d8d4cc");
  floor(st, 2200, 1100, 2600, 1350, "stoneTiles", "#c9c4ba");
  floor(st, 2100, 400, 2300, 750, "stoneTiles", "#c9c4ba");

  // Stepped perimeter follows the house footprint while omitting the pool,
  // outdoor terrace, planting and driveway shown in the reference image.
  ext(st, [0, 0], [600, 0], [WN(300, 220, 150, 100)], FACADE);
  ext(st, [600, 0], [600, 300], [], FACADE);
  ext(st, [600, 300], [2300, 300], [WN(1050, 360, 180, 70), WN(1900, 320, 180, 70)], FACADE);
  ext(st, [2300, 300], [2300, 0], [], FACADE);
  ext(st, [2300, 0], [3400, 0], [WN(2700, 220, 150, 100), WN(3160, 220, 150, 100)], FACADE);
  ext(st, [3400, 0], [3400, 800], [WN(200, 180, 120, 100), WN(600, 180, 120, 100)], FACADE);
  ext(st, [3400, 800], [3400, 1400], [], FACADE);
  ext(st, [3400, 1400], [2600, 1400], [GD(3270, 230), GD(3000, 230), GD(2730, 230)], FACADE);
  ext(st, [2600, 1400], [2600, 1350], [], FACADE);
  ext(st, [2600, 1350], [0, 1350], [WN(2050, 180, 130, 100), WN(1530, 180, 130, 100), WN(900, 180, 130, 100), WN(200, 180, 130, 100)], FACADE);
  ext(st, [0, 1350], [0, 0], [WN(200, 180, 130, 100), WN(1120, 180, 130, 100)], FACADE);

  // Primary suite: ensuite, bedroom and walk-in robe.
  inn(st, [220, 0], [220, 430], [D(270, 80, WOOD)]);
  inn(st, [0, 430], [600, 430], [D(475, 90, WOOD)]);
  inn(st, [600, 300], [600, 800], [D(625, 90, WOOD)]);
  inn(st, [0, 800], [600, 800], [D(500, 90, WOOD)]);
  corner(st, "shower-stall", 207, 13, "ne");
  along(st, "bathtub", "w", 13, 220);
  along(st, "toilet", "s", 417, 80);
  along(st, "washbasin-pedestal", "s", 417, 170);
  along(st, "wall-mirror", "s", 417, 170, { y: 110 });
  along(st, "king-bed", "n", 13, 410);
  along(st, "nightstand", "n", 13, 260);
  along(st, "nightstand", "n", 13, 555);
  along(st, "wardrobe", "s", 417, 500);
  put(st, "rug", 410, 230);
  along(st, "closet-rail", "w", 13, 600);
  along(st, "closet-rail", "e", 587, 600);
  put(st, "dressing-table", 380, 620, "s");
  put(st, "ceiling-fan", 400, 230, "n", H);

  // Guest wing has a narrow shared passage, two bedrooms and two ensuites.
  inn(st, [2300, 300], [2300, 800], [D(565, 90, WOOD)]);
  inn(st, [2300, 800], [2600, 800], [D(2450, 90, WOOD)]);
  inn(st, [2425, 0], [2425, 800], [D(190, 80, WOOD), D(610, 80, WOOD)]);
  inn(st, [3000, 0], [3000, 800], [D(200, 80, WOOD), D(600, 80, WOOD)]);
  inn(st, [2425, 400], [3400, 400]);
  along(st, "double-bed", "n", 13, 2710);
  along(st, "nightstand", "n", 13, 2585);
  along(st, "nightstand", "n", 13, 2835);
  along(st, "wardrobe", "s", 387, 2700);
  put(st, "round-rug", 2700, 220);
  corner(st, "shower-stall", 3387, 13, "ne");
  along(st, "toilet", "e", 3387, 300);
  along(st, "washbasin-pedestal", "s", 387, 3220);
  along(st, "wall-mirror", "s", 387, 3220, { y: 110 });
  along(st, "double-bed", "n", 413, 2710);
  along(st, "nightstand", "n", 413, 2585);
  along(st, "nightstand", "n", 413, 2835);
  along(st, "wardrobe", "s", 787, 2700);
  put(st, "round-rug", 2700, 620);
  corner(st, "shower-stall", 3387, 413, "ne");
  along(st, "toilet", "e", 3387, 700);
  along(st, "washbasin-pedestal", "s", 787, 3220);
  along(st, "wall-mirror", "s", 787, 3220, { y: 110 });

  // Open living, dining and kitchen core; the pantry is enclosed at its east end.
  inn(st, [2100, 400], [2100, 750], [D(575, 80, WOOD)]);
  inn(st, [2100, 400], [2300, 400]);
  inn(st, [2100, 750], [2300, 750]);
  along(st, "wall-tv", "w", 612, 560, { y: 145 });
  along(st, "tv-bench", "w", 612, 560);
  put(st, "sofa-corner", 980, 570, "w");
  put(st, "coffee-table", 1050, 560);
  put(st, "rug", 1050, 570);
  put(st, "armchair-lounge", 1130, 700, "w");
  put(st, "side-table", 1210, 700);
  put(st, "dining-table", 1510, 560);
  for (const x of [1435, 1510, 1585]) {
    put(st, "dining-chair", x, 480, "n");
    put(st, "dining-chair", x, 640, "s");
  }
  along(st, "sideboard", "s", 787, 1510);
  along(st, "kitchen-fridge-70", "n", 313, 1780);
  along(st, "kitchen-base-60", "n", 313, 1850);
  along(st, "kitchen-sink-80", "n", 313, 1920);
  along(st, "dishwasher", "n", 313, 2000);
  along(st, "kitchen-stove-60", "n", 313, 2070);
  along(st, "kitchen-hood", "n", 313, 2070);
  put(st, "kitchen-island", 1930, 570);
  for (const x of [1850, 1930, 2010]) put(st, "bar-stool", x, 665, "s");
  for (const x of [1850, 2010]) put(st, "pendant-lamp", x, 570, "n", H);
  along(st, "steel-shelf", "e", 2287, 495);
  along(st, "steel-shelf", "e", 2287, 655);
  put(st, "wine-rack", 2160, 465, "n");

  // Hall behind the private rooms; three bedrooms, two shared baths, family
  // lounge, office and laundry.
  inn(st, [600, 800], [2300, 800], [D(900, 90, WOOD), D(1510, 90, WOOD), D(2050, 90, WOOD)]);
  inn(st, [0, 950], [400, 950], [D(200, 90, WOOD)]);
  inn(st, [400, 950], [650, 950]);
  inn(st, [650, 950], [1050, 950], [D(850, 90, WOOD)]);
  inn(st, [1050, 950], [1300, 950]);
  inn(st, [1300, 950], [1700, 950], [D(1500, 90, WOOD)]);
  inn(st, [1700, 950], [2200, 950], [D(1950, 90, WOOD)]);
  inn(st, [2200, 950], [2600, 950], [D(2400, 90, WOOD)]);
  for (const x of [400, 650, 1050, 1300]) {
    const doors = (x === 400 || x === 650 || x === 1050 || x === 1300) ? [D(1130, 80, WOOD)] : [];
    inn(st, [x, 950], [x, 1350], doors);
  }
  inn(st, [1700, 800], [1700, 1350], [D(1110, 90, WOOD)]);
  inn(st, [2200, 800], [2200, 1350], [D(1010, 90, WOOD)]);
  inn(st, [2200, 1150], [2600, 1150], [D(2400, 80, WOOD)]);
  inn(st, [2600, 800], [2600, 1350], [D(1170, 90, WOOD)]);
  // The guest wing and garage meet along this wall, with no door between them.
  inn(st, [2600, 800], [3400, 800]);

  // Bedrooms and bathrooms.
  for (const [x, c] of [[0, 200], [650, 850], [1300, 1500]]) {
    along(st, "double-bed", "s", 1337, x + 210);
    along(st, "nightstand", "s", 1337, x + 105);
    along(st, "nightstand", "s", 1337, x + 315);
    along(st, "wardrobe", "n", 963, x + 210);
    put(st, "round-rug", x + 210, 1110);
    put(st, "ceiling-fan", x + 210, 1110, "n", H);
  }
  for (const [left, right] of [[400, 650], [1050, 1300]]) {
    corner(st, "shower-stall", right - 13, 963, "ne");
    along(st, "toilet", "s", 1337, left + 70);
    along(st, "washbasin-pedestal", "s", 1337, right - 70);
    along(st, "wall-mirror", "s", 1337, right - 70, { y: 110 });
  }
  // Family lounge, office and laundry.
  put(st, "sofa-three-seat", 1940, 1110, "w");
  put(st, "coffee-table", 2025, 1110);
  put(st, "round-rug", 2025, 1110);
  along(st, "wall-tv", "e", 2187, 1110, { y: 145 });
  along(st, "tv-bench", "e", 2187, 1110);
  put(st, "desk", 2400, 1020, "n");
  put(st, "office-chair", 2400, 1080, "s");
  put(st, "laptop", 2400, 1020, "n", 75);
  along(st, "washing-machine", "s", 1337, 2310);
  along(st, "dryer", "s", 1337, 2390);
  along(st, "wall-shelves", "e", 2587, 1240, { y: 150 });

  // Three-car garage. Vehicles and storage stay inside the house; the drive
  // apron and landscaping from the illustration are intentionally omitted.
  put(st, "sedan", 2720, 1100, 90);
  put(st, "sedan", 3000, 1100, 90);
  put(st, "suv", 3280, 1100, 90);
  for (const x of [2720, 3000, 3280]) put(st, "ceiling-flush", x, 1100, "n", H);
  put(st, "steel-shelf", 2650, 850, "n");

  lights(st, H, [[950, 430], [950, 730], [1480, 430], [1480, 730], [1880, 430], [2030, 730], [2360, 150], [2900, 180], [2900, 620], [3300, 180], [3300, 620], [200, 850], [850, 850], [1500, 850], [1950, 850], [2450, 850], [1950, 1290], [2400, 1290]]);

  building.roof = {
    ...building.roof,
    type: "flat",
    pitch: 25,
    overhang: 35,
    height: 25,
    ridgeAxis: "x",
    material: "concrete",
    tint: "#55565a",
    visible: false,
    ceiling: true,
  };
}
