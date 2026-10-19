// Shared kit for the sample houses: walls and openings given by their
// centre, furniture placed by the wall it backs onto (using the real back
// side of each catalog object, so chairs face their table and headboards
// touch the wall), stairs, lights, lot polygons and terrain shaping.
// Building coordinates are cm, x to the east and z to the south; north is -z.
import { uid, freshStorey } from "../schema.js";
import { slab, wall, place, railing } from "../templates.js";
void place;

/** Footprint of each catalog object: [x0, x1, z0, z1, back, top] in cm around its origin. */
export const PROPS = {
  "sofa-two-seat": [-45, 45, -97, 97, "-x", 90],
  "sofa-three-seat": [-45, 45, -127, 127, "-x", 90],
  "sofa-corner": [-83, 84, -130, 130, "-x", 90],
  "sofa-bed": [-46, 45, -103, 103, "-x", 105],
  "armchair": [-43, 43, -56, 56, "-x", 97],
  "armchair-lounge": [-50, 40, -34, 34, "-x", 111],
  "coffee-table": [-55, 55, -35, 35, "-z", 48],
  "side-table": [-22, 22, -22, 22, "-z", 52],
  "console-table": [-17, 18, -60, 60, "-x", 80],
  "tv-bench": [-21, 22, -81, 81, "-x", 51],
  "bookshelf": [-17, 16, -65, 65, "-x", 196],
  "cube-shelf": [-20, 20, -74, 74, "-x", 147],
  "sideboard": [-22, 24, -81, 81, "-x", 81],
  "glass-cabinet": [-20, 22, -45, 45, "-x", 190],
  "rug": [-150, 150, -110, 110, "-z", 5],
  "round-rug": [-90, 90, -90, 90, "-z", 2],
  "floor-cushion": [-28, 28, -28, 28, "-z", 10],
  "game-console": [-14, 15, -17, 17, "-z", 10],
  "laptop": [-17, 17, -22, 22, "-z", 30],
  "houseplant": [-31, 36, -28, 35, "-z", 152],
  "fern": [-72, 70, -68, 68, "-z", 48],
  "double-bed": [-110, 111, -83, 83, "+x", 119],
  "king-bed": [-110, 112, -100, 100, "+x", 125],
  "single-bed": [-103, 106, -48, 48, "+x", 100],
  "bunk-bed": [-103, 103, -50, 56, "+x", 175],
  "child-bed": [-90, 90, -43, 43, "-x", 59],
  "nightstand": [-23, 26, -23, 23, "-z", 100],
  "chest-of-drawers": [-24, 27, -41, 41, "-x", 97],
  "wardrobe": [-83, 83, -33, 38, "-z", 214],
  "sliding-wardrobe": [-32, 34, -101, 101, "-x", 222],
  "table-lamp": [-12, 12, -12, 12, "-z", 46],
  "standing-mirror": [-33, 3, -25, 25, "-x", 170],
  "hammock": [-142, 142, -40, 40, "-z", 156],
  "dining-table": [-90, 90, -45, 45, "-z", 76],
  "dining-chair": [-22, 23, -21, 21, "-x", 91],
  "chair": [-23, 23, -23, 23, "-x", 102],
  "table": [-69, 69, -47, 47, "-z", 78],
  "round-table": [-55, 55, -55, 55, "-z", 76],
  "kitchen-table": [-123, 123, -60, 60, "-z", 83],
  "restaurant-table": [-60, 60, -60, 60, "-z", 78],
  "refectory-table": [-81, 81, -150, 150, "-z", 75],
  "stool": [-18, 18, -18, 18, "-z", 68],
  "bar-stool": [-22, 22, -22, 22, "-z", 80],
  "bar-shelf": [-28, 29, -200, 200, "+x", 246],
  "bar-counter": [-57, 48, -205, 205, "+x", 152],
  "plastic-chair": [-22, 23, -24, 24, "-x", 93],
  "plastic-table": [-36, 36, -36, 36, "-z", 96],
  "kitchen-fridge": [-45, 45, -39, 49, "-z", 196],
  "kitchen-stove": [-54, 54, -38, 45, "-z", 97],
  "kitchen-sink": [-67, 67, -38, 40, "-z", 125],
  "kitchen-counter": [-73, 73, -38, 40, "-z", 94],
  "kitchen-hood": [-65, 65, -40, 40, "-z", 258],
  "cooking-pot": [-27, 27, -22, 22, "-z", 24],
  "bread-basket": [-19, 18, -19, 19, "-z", 12],
  "gas-cylinder": [-18, 18, -18, 18, "-z", 55],
  "chest-freezer": [-42, 42, -82, 82, "-x", 85],
  "toilet": [-38, 36, -24, 24, "-x", 91],
  "bathtub": [-89, 89, -43, 43, "-z", 82],
  "bath-vanity": [-26, 29, -63, 63, "-x", 212],
  "shower-stall": [-55, 55, -55, 55, "-z", 220],
  "shower-glass": [-56, 56, -56, 58, "-z", 204],
  "towel-rail": [0, 14, -37, 37, "-x", 132],
  "bath-mat": [-45, 45, -28, 28, "-z", 2],
  "jacuzzi": [-121, 121, -91, 130, "-z", 84],
  "wash-trough": [-6, 46, -130, 130, "-x", 175],
  "wall-mirror": [-2, 3, -30, 30, "-x", 45],
  "desk": [-39, 42, -80, 80, "-x", 146],
  "study-desk": [-35, 35, -70, 70, "-x", 75],
  "office-chair": [-26, 23, -27, 27, "-x", 108],
  "filing-cabinet": [-27, 31, -47, 47, "-x", 134],
  "whiteboard": [-3, 12, -130, 130, "-x", 220],
  "meeting-table": [-230, 230, -80, 80, "-z", 90],
  "water-cooler": [-18, 22, -18, 18, "-z", 142],
  "toy-blocks": [-31, 31, -11, 11, "-z", 66],
  "plush-bear": [-14, 18, -16, 16, "-z", 46],
  "swing-set": [-175, 175, -52, 52, "-z", 239],
  "slide": [-245, 176, -52, 52, "-z", 196],
  "seesaw": [-168, 166, -32, 32, "-z", 112],
  "sandpit": [-146, 146, -146, 146, "-z", 40],
  "floor-lamp": [-22, 22, -22, 22, "-z", 189],
  "pendant-lamp": [-18, 18, -18, 18, "-z", 58],
  "hanging-bulb": [-15, 15, -15, 15, "-z", 74],
  "string-lights": [-301, 301, -6, 6, "-z", -7],
  "lantern": [-11, 11, -11, 11, "-z", 54],
  "candles": [-21, 21, -21, 21, "-z", 28],
  "lamp": [-24, 24, -24, 24, "-z", 347],
  "tiki-torch": [-10, 10, -10, 10, "-z", 233],
  "desk-lamp": [-8, 34, -8, 8, "-z", 48],
  "wall-sconce": [-9, 9, 0, 22, "-z", 12],
  "wall-lantern": [-8, 8, 0, 24, "-z", 8],
  "ceiling-flush": [-18, 18, -18, 18, "-z", 0],
  "chandelier": [-35, 35, -35, 35, "-z", 0],
  "spot-rail": [-50, 50, -2, 9, "-z", 0],
  "garden-bollard": [-7, 7, -7, 7, "-z", 68],
  "garden-spike": [-4, 4, -1, 11, "-z", 21],
  "picture": [-2, 4, -41, 41, "-x", 31],
  "neon-sign": [-2, 7, -90, 90, "-x", 45],
  "disco-ball": [-25, 25, -25, 25, "-z", 88],
  "bench": [-25, 25, -75, 75, "-x", 98],
  "lounger": [-90, 88, -33, 33, "-z", 54],
  "beach-umbrella": [-132, 132, -132, 132, "-z", 251],
  "pergola": [-185, 185, -145, 145, "-z", 269],
  "bbq-grill": [-89, 111, -40, 44, "-z", 295],
  "campfire": [-65, 65, -69, 64, "-z", 93],
  "flower-bed": [-48, 48, -32, 32, "-z", 32],
  "planter": [-35, 35, -35, 35, "-z", 86],
  "pool": [-322, 322, -222, 222, "-z", 72],
  "tree-swing": [-34, 34, -13, 13, "-z", 0],
  "clothesline": [-4, 4, -154, 154, "-z", 190],
  "wheelbarrow": [-96, 94, -31, 31, "-z", 71],
  "bucket": [-18, 18, -15, 15, "-z", 50],
  "water-tank": [-58, 58, -58, 58, "-z", 108],
  "rock": [-65, 93, -73, 55, "-z", 100],
  "log": [-134, 134, -23, 25, "-z", 54],
  "sand-pile": [-110, 110, -100, 100, "-z", 92],
  "reeds": [-41, 56, -41, 42, "-z", 155],
  "hay-bale": [-78, 78, -88, 88, "-z", 153],
  "trail-sign": [-147, 147, -15, 15, "-z", 220],
  "dirt-patch": [-160, 160, -110, 110, "-z", 8],
  "tree": [-95, 95, -95, 95, "-z", 430],
  "oak-tree": [-358, 357, -369, 361, "-z", 689],
  "big-tree": [-380, 375, -380, 340, "-z", 1005],
  "birch-tree": [-147, 207, -133, 141, "-z", 827],
  "cherry-tree": [-316, 315, -265, 317, "-z", 428],
  "maple-tree": [-254, 257, -247, 269, "-z", 800],
  "palm-tree": [-133, 232, -175, 182, "-z", 504],
  "cypress": [-85, 91, -85, 85, "-z", 860],
  "eucalyptus": [-250, 288, -274, 214, "-z", 1231],
  "ipe-tree": [-270, 244, -235, 289, "-z", 575],
  "araucaria": [-363, 355, -351, 353, "-z", 1201],
  "willow-tree": [-291, 310, -284, 289, "-z", 650],
  "banana-plant": [-105, 103, -106, 112, "-z", 186],
  "bush": [-52, 52, -52, 52, "-z", 101],
  "convertible": [-231, 231, -102, 102, "-z", 143],
  "sedan": [-233, 233, -98, 98, "-z", 125],
  "hatchback": [-203, 203, -96, 96, "-z", 128],
  "suv": [-238, 238, -103, 103, "-z", 164],
  "pickup-truck": [-268, 268, -103, 103, "-z", 154],
  "sports-car": [-223, 223, -103, 103, "-z", 103],
  "scooter": [-93, 82, -32, 32, "-z", 102],
  "bicycle": [-86, 86, -26, 26, "-z", 111],
  "tractor": [-175, 205, -127, 127, "-z", 273],
  "jetski": [-153, 153, -81, 81, "-z", 138],
  "street-sign": [-15, 75, -15, 75, "-z", 300],
  "trash-bin": [-26, 20, -20, 20, "-z", 106],
  "treadmill": [-93, 85, -34, 34, "-z", 127],
  "exercise-bike": [-68, 57, -28, 28, "-z", 103],
  "weight-bench": [-69, 65, -44, 42, "-z", 110],
  "weight-rack": [-48, 48, -21, 21, "-z", 105],
  "volley-net": [-20, 20, -490, 490, "-z", 240],
  "ball": [-16, 16, -16, 16, "-z", 32],
  "pool-table": [-90, 52, -98, 98, "-z", 87],
  "goal": [-170, 7, -373, 373, "-z", 251],
  "gym-mirror": [-7, 12, -200, 200, "-x", 260],
  "cardboard-boxes": [-30, 83, -25, 25, "-z", 110],
  "steel-shelf": [-90, 90, -28, 28, "-z", 200],
  "tool-chest": [-47, 47, -26, 30, "-z", 150],
  "tool-board": [-4, 10, -87, 87, "-z", 112],
  "workbench": [-102, 102, -38, 38, "-z", 176],
  "ladder": [-18, 10, -32, 32, "-z", 300],
  "wooden-barrel": [-31, 32, -33, 31, "-z", 74],
  "bricks": [-23, 26, -48, 48, "-z", 74],
  "planks": [-150, 156, -45, 45, "-z", 56],
  "air-compressor": [-57, 72, -25, 25, "-z", 113],
  "squat-rack": [-110, 110, -70, 70, "-z", 220],
  "dumbbell-rack": [-63, 63, -27, 27, "-z", 108],
  "kettlebell-set": [-48, 48, -20, 20, "-z", 42],
  "yoga-mat": [-30, 30, -90, 90, "-z", 10],
  "exercise-ball": [-32, 32, -32, 32, "-z", 65],
  "foam-roller": [-8, 8, -45, 45, "-z", 15],
  "medicine-ball-rack": [-40, 40, -14, 14, "-z", 106],
  "cue-rack": [-30, 30, 0, 7, "-z", 79],
  "coffee-machine": [-14, 14, -17, 32, "-z", 41],
  "mini-fridge": [-25, 25, -28, 32, "-z", 85],
  "wall-tv": [-80, 80, 0, 8, "-z", 45],
  "wall-shelves": [-60, 60, 0, 25, "-z", 61],
  "slat-panel": [-120, 120, -2, 2, "-z", 260],
  "led-strip": [-100, 100, -2, 2, "-z", 0],
  "downlight": [-5, 5, -5, 5, "-z", 0],
  "washing-machine": [-30, 30, -30, 32, "-z", 85],
  "dryer": [-30, 30, -30, 32, "-z", 85],
  "ironing-board": [-20, 20, -60, 60, "-z", 100],
  "laundry-basket": [-21, 21, -21, 21, "-z", 60],
  "drying-rack": [-52, 52, -26, 26, "-z", 100],
  "microwave": [-25, 25, -19, 20, "-z", 30],
  "dishwasher": [-30, 30, -30, 34, "-z", 85],
  "kitchen-island": [-95, 95, -50, 53, "-z", 118],
  "kitchen-bin": [-16, 16, -16, 20, "-z", 64],
  "kettle": [-10, 12, -9, 9, "-z", 22],
  "toaster": [-14, 14, -8, 10, "-z", 19],
  "dish-rack": [-20, 20, -15, 15, "-z", 23],
  "wine-rack": [-25, 25, -15, 17, "-z", 90],
  "bar-cart": [-31, 31, -20, 20, "-z", 104],
  "bidet": [-18, 18, -25, 25, "-z", 48],
  "washbasin-pedestal": [-28, 28, -22, 22, "-z", 96],
  "dressing-table": [-50, 50, -22, 55, "-z", 138],
  "bedroom-bench": [-60, 60, -20, 20, "-z", 46],
  "fireplace": [-75, 75, -30, 100, "-z", 118],
  "ceiling-fan": [-64, 64, -42, 64, "-z", 0],
  "upright-piano": [-72, 72, -30, 90, "-z", 120],
  "aquarium": [-50, 50, -22, 22, "-z", 123],
  "coat-rack": [-20, 25, -20, 20, "-z", 176],
  "shoe-rack": [-41, 41, -15, 15, "-z", 40],
  "doormat": [-35, 35, -22, 22, "-z", 2],
  "floor-vase": [-18, 17, -15, 15, "-z", 160],
  "printer": [-22, 22, -19, 36, "-z", 24],
  "water-heater": [-25, 25, -25, 25, "-z", 168],
  "breaker-panel": [-18, 18, 0, 12, "-z", 25],
  "ac-outdoor-unit": [-40, 40, -15, 16, "-z", 57],
  "solar-panel": [-86, 86, -51, 51, "-z", 50],
  "mailbox": [-12, 15, -22, 22, "-z", 125],
  "dog-house": [-71, 71, -45, 70, "-z", 88],
  "cat-tree": [-35, 32, -30, 28, "-z", 114],
  "garden-shed": [-110, 110, -85, 85, "-z", 223],
  "bird-bath": [-25, 25, -25, 25, "-z", 84],
  "trampoline": [-125, 125, -125, 125, "-z", 260],
  "toy-chest": [-41, 41, -24, 24, "-z", 65],
  "bike-rack": [-60, 60, -22, 22, "-z", 52],
  "fire-pit": [-60, 60, -30, 30, "-z", 70],
  "outdoor-sofa": [-120, 120, -45, 115, "-z", 92],
  "outdoor-dining-set": [-120, 120, -97, 97, "-z", 94],
  "outdoor-kitchen": [-155, 155, -35, 35, "-z", 235],
  "closet-rail": [-121, 121, 0, 60, "-z", 222],
  "closet-island": [-61, 61, -31, 51, "-z", 108],
  "double-vanity": [-105, 105, -30, 30, "-z", 198],
  "japanese-tub": [-75, 75, -75, 75, "-z", 115],
  "entrance-canopy": [-120, 120, 0, 140, "-z", 266],
  // shops, offices, street and a few more household objects (bounds from the prop documents)
  "sofa": [-47, 46, -114, 114, "-x", 97],
  "ottoman": [-28, 28, -28, 28, "-z", 44],
  "tv": [-20, 20, -70, 70, "-x", 125],
  "crt-tv": [-39, 29, -32, 28, "-x", 96],
  "curtain": [-5, 5, -113, 113, "-x", 155],
  "folding-screen": [-2, 25, -82, 68, "-x", 180],
  "air-conditioner": [-45, 45, 0, 23, "-z", 15],
  "robot-vacuum": [-17, 17, -17, 17, "-z", 10],
  "magazines": [-14, 15, -18, 17, "-z", 10],
  "book": [-8, 8, -11, 11, "-z", 5],
  "old-books": [-13, 12, -9, 9, "-z", 24],
  "iron-bed": [-98, 98, -46, 46, "+x", 117],
  "baby-crib": [-62, 62, -34, 34, "-z", 90],
  "bathroom-cabinet": [-30, 30, 0, 15, "-z", 35],
  "toilet-paper-holder": [-6, 6, 0, 15, "-z", 5],
  "towel-stack": [-40, 44, -15, 15, "-z", 29],
  "bath-stool": [-17, 17, -13, 13, "-z", 30],
  "hairdryer": [-12, 20, -6, 6, "-z", 36],
  "kitchen-board": [-34, 25, -16, 16, "-z", 3],
  "kitchen-step": [-32, 32, -25, 46, "-z", 26],
  "kitchen-child-chair": [-23, 32, -23, 23, "-x", 103],
  "mug": [-4, 6, -4, 4, "-z", 12],
  "dinner-plate": [-14, 14, -14, 14, "-z", 3],
  "salad-bowl": [-22, 22, -20, 20, "-z", 14],
  "pasta-bowl": [-25, 25, -23, 23, "-z", 14],
  "water-glass": [-5, 5, -6, 6, "-z", 15],
  "glass-bottle": [-4, 4, -4, 4, "-z", 32],
  "corkboard": [-2, 5, -60, 60, "-x", 40],
  "blackboard": [-4, 12, -160, 160, "-x", 230],
  "school-desk": [-40, 59, -31, 31, "-x", 89],
  "teacher-desk": [-36, 38, -75, 75, "-x", 88],
  "office-safe": [-30, 35, -30, 30, "-x", 82],
  "wall-clock": [-3, 6, -20, 20, "-x", 20],
  "notebook": [-16, 16, -12, 12, "-z", 4],
  "pencil": [-1, 1, -1, 1, "-z", 7],
  "plush-rabbit": [-15, 18, -16, 16, "-z", 64],
  "kite": [-1, 1, -58, 602, "-z", 25],
  "hula-hoop": [-52, 52, -50, 51, "-z", 1],
  "roundabout": [-125, 125, -125, 125, "-z", 125],
  "spring-rider": [-46, 56, -21, 21, "-z", 92],
  "monkey-bars": [-180, 180, -60, 60, "-z", 205],
  "paper-floor-lamp": [-18, 18, -18, 18, "-z", 142],
  "stone-lantern": [-45, 45, -45, 45, "-z", 158],
  "wall-torch": [-8, 8, 0, 40, "-z", 81],
  "post-cap-light": [-10, 10, -10, 10, "-z", 18],
  "noren": [-2, 2, -75, 75, "-x", 210],
  "shoji-door": [-5, 5, -92, 92, "-x", 210],
  "display-wall": [-6, 6, -151, 151, "-x", 244],
  "mannequin": [-26, 26, -18, 18, "-z", 168],
  "suitcase": [-25, 25, -13, 19, "-z", 124],
  "steamer-trunk": [-52, 56, -33, 35, "-z", 69],
  "backpack": [-17, 30, -22, 22, "-z", 56],
  "fence": [-6, 6, -98, 98, "-x", 110],
  "bamboo-fence": [-7, 7, -106, 106, "-x", 210],
  "ranch-fence": [-127, 127, -7, 7, "-z", 140],
  "wall": [-16, 16, -102, 102, "-x", 118],
  "stump": [-40, 40, -40, 40, "-z", 63],
  "tent": [-128, 129, -140, 140, "-z", 144],
  "lawn-mower": [-32, 32, -30, 72, "-z", 105],
  "satellite-dish": [-10, 54, -36, 36, "-z", 114],
  "pine": [-125, 125, -125, 125, "-z", 500],
  "dead-tree": [-161, 143, -208, 252, "-z", 567],
  "car": [-223, 223, -102, 102, "-z", 155],
  "van": [-253, 253, -106, 106, "-z", 195],
  "motorcycle": [-109, 109, -36, 36, "-z", 110],
  "sport-bike": [-105, 103, -31, 31, "-z", 99],
  "chopper": [-111, 135, -40, 40, "-z", 122],
  "motorhome": [-442, 442, -172, 172, "-z", 269],
  "traffic-light": [-15, 345, -28, 18, "-z", 540],
  "fire-hydrant": [-20, 20, -15, 18, "-z", 72],
  "bus-stop": [-67, 77, -168, 181, "-x", 290],
  "cone": [-21, 21, -21, 21, "-z", 74],
  "barrier": [-8, 8, -122, 122, "-x", 90],
  "sidewalk": [-400, 400, -400, 400, "-z", 18],
  "road": [-400, 400, -350, 350, "-z", 12],
  "crossroad": [-350, 350, -350, 350, "-z", 12],
  "rowing-machine": [-124, 115, -33, 33, "-z", 64],
  "dumbbell": [-17, 17, -10, 10, "-z", 10],
  "barbell": [-4, 4, -98, 98, "-z", 22],
  "basketball-hoop": [-15, 171, -24, 24, "-z", 367],
  "volleyball": [-11, 11, -11, 11, "-z", 23],
  "gym-lockers": [-80, 80, -25, 29, "-z", 180],
  "pallet": [-55, 55, -50, 50, "-z", 14],
  "pallet-rack": [-58, 58, -126, 126, "-x", 320],
  "tool-trolley": [-45, 51, -28, 30, "-z", 100],
  "tyre-stack": [-34, 34, -34, 34, "-z", 83],
  "steel-drum": [-30, 30, -30, 30, "-z", 88],
  "scaffold": [-90, 90, -65, 65, "-z", 300],
  "mixer": [-67, 60, -40, 55, "-z", 157],
  "cement-sack": [-31, 31, -19, 19, "-z", 32],
  "flatpack-stack": [-60, 60, -41, 41, "-z", 89],
  "engine-hoist": [-37, 189, -62, 62, "-z", 195],
  "car-lift": [-152, 152, -118, 118, "-z", 362],
  "fuel-pump": [-40, 40, -47, 47, "-z", 231],
  "gas-meter": [-20, 20, -10, 30, "-z", 25],
};
// Kitchen units generated by build/kitchen.js: front at +z, origin at the back-left-bottom centre.
for (const [unit, w, d] of [["base", 60, 60], ["sink", 80, 60], ["stove", 60, 60], ["fridge", 70, 65], ["corner", 90, 90]])
  PROPS[`kitchen-${unit}-${w}`] = [-w / 2, w / 2, unit === "corner" ? -45 : -d / 2, unit === "corner" ? 45 : d / 2 + 3, "-z", unit === "fridge" ? 180 : 90];
PROPS["kitchen-corner-90-r"] = PROPS["kitchen-corner-90"];
PROPS["kitchen-wall-60"] = [-30, 30, -17, 20, "-z", 70];

const DIR_YAW = { e: 0, n: 90, w: 180, s: 270 }; // yaw that turns local +x towards that direction
const BACK_YAW = { "+x": 0, "-z": 90, "-x": 180, "+z": 270 }; // yaw of each local back vector
const DEG = Math.PI / 180;
/** Yaw (deg) that turns the object's back towards `back` (n/s/e/w), or the number given. */
export function yawFor(prop, back) {
  if (typeof back === "number") return back;
  const b = PROPS[prop]?.[4] || "-z";
  return (((DIR_YAW[back] - BACK_YAW[b]) % 360) + 360) % 360;
}
/** World extents of an object turned by `yaw`, relative to its origin. */
export function extents(prop, yaw) {
  const [x0, x1, z0, z1] = PROPS[prop] || [-25, 25, -25, 25];
  const c = Math.cos(yaw * DEG), s = Math.sin(yaw * DEG);
  const out = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
    const wx = x * c + z * s, wz = -x * s + z * c;
    out.minX = Math.min(out.minX, wx); out.maxX = Math.max(out.maxX, wx);
    out.minZ = Math.min(out.minZ, wz); out.maxZ = Math.max(out.maxZ, wz);
  }
  return out;
}
/** Placement with an optional finish (texture id / tint) for tintable objects such as kitchen units. */
export function placed(st, prop, x, z, yaw, y = 0, { material = null, tint = null } = {}) {
  st.objects.push({ id: uid("ob"), name: "", prop, inline: null, at: [x, y, z], rotation: [0, yaw, 0], scale: [1, 1, 1], tint, material, locked: false });
}
/** Free placement: the object's back faces `back`. */
export function put(st, prop, x, z, back = "n", y = 0, o = {}) {
  placed(st, prop, x, z, yawFor(prop, back), y, o);
}
/**
 * Against a wall: `side` is the wall the object backs onto (n/s/e/w),
 * `face` the coordinate of that wall's inner face, `at` the centre along it.
 */
export function along(st, prop, side, face, at, { gap = 2, y = 0, ...o } = {}) {
  const yaw = yawFor(prop, side);
  const e = extents(prop, yaw);
  let x, z;
  if (side === "n") { z = face + gap - e.minZ; x = at - (e.minX + e.maxX) / 2; }
  else if (side === "s") { z = face - gap - e.maxZ; x = at - (e.minX + e.maxX) / 2; }
  else if (side === "w") { x = face + gap - e.minX; z = at - (e.minZ + e.maxZ) / 2; }
  else { x = face - gap - e.maxX; z = at - (e.minZ + e.maxZ) / 2; }
  placed(st, prop, Math.round(x), Math.round(z), yaw, y, o);
}
const CORNER_YAW = { nw: 0, sw: 90, se: 180, ne: 270 };
/** Into a corner: the object's -x and -z sides touch the wall faces at fx and fz. */
export function corner(st, prop, fx, fz, q, { gap = 2, y = 0, ...o } = {}) {
  const yaw = CORNER_YAW[q];
  const e = extents(prop, yaw);
  const x = q.endsWith("w") ? fx + gap - e.minX : fx - gap - e.maxX;
  const z = q.startsWith("n") ? fz + gap - e.minZ : fz - gap - e.maxZ;
  placed(st, prop, Math.round(x), Math.round(z), yaw, y, o);
}
export function lights(st, h, pts, prop = "downlight") {
  for (const [x, z] of pts) place(st, prop, x, z, 0, h);
}

// ---- walls and openings. An opening is given by the absolute coordinate of
// its centre along the wall (x on an east-west wall, z on a north-south one).
export const FACADE = { outerMaterial: "plaster", outerTint: "#e9e4da" };
const op = (preset, c, width, height, sill, extra = {}) => ({ preset, c, width, height, sill, ...extra });
export const D = (c, w = 90, o = {}) => op("door-single", c, w, o.height ?? 210, 0, o);
export const DD = (c, w = 160, o = {}) => op("door-double", c, w, o.height ?? 220, 0, o);
export const SL = (c, w = 240, h = 230, o = {}) => op("door-sliding", c, w, h, 0, o);
export const GD = (c, w = 260, h = 220, o = {}) => op("door-garage", c, w, h, 0, o);
export const PS = (c, w = 90, h = 210) => op("passage-single", c, w, h, 0);
export const PD = (c, w = 160, h = 220) => op("passage-double", c, w, h, 0);
export const AR = (c, w = 160, h = 240) => op("arch-double", c, w, h, 0);
export const WN = (c, w = 120, h = 120, sill = 90, o = {}) => op(w >= 180 ? "window-wide" : "window-casement", c, w, h, sill, o);
export const WS = (c, w = 60, h = 60, sill = 160) => op("window-small", c, w, h, sill);
export const WP = (c, w = 240, h = 150, sill = 60) => op("window-picture", c, w, h, sill);
function resolve(a, b, openings) {
  const horiz = a[1] === b[1];
  return openings.map(({ c, width, ...o }) => {
    const rel = horiz ? (c - a[0]) * Math.sign(b[0] - a[0]) : (c - a[1]) * Math.sign(b[1] - a[1]);
    return { ...o, width, at: rel - width / 2 };
  });
}
/** Exterior wall (25 cm). */
export function ext(st, a, b, openings = [], o = {}) {
  wall(st, a, b, { thickness: 25, ...FACADE, ...o, openings: resolve(a, b, openings) });
}
/** Interior wall (15 cm). */
export function inn(st, a, b, openings = [], o = {}) {
  wall(st, a, b, { thickness: 15, ...o, openings: resolve(a, b, openings) });
}
/** Square column (a short thick wall segment). */
export function column(st, x, z, size = 30, o = {}) {
  wall(st, [x - size / 2, z], [x + size / 2, z], { thickness: size, skirting: false, ...o });
}
export const floor = slab;
/** Slab over a rectangle minus the rectangles in `holes` (all cm). */
export function floorExcept(st, x0, z0, x1, z1, material, tint, holes = []) {
  const T = 50, tiles = [];
  for (let z = Math.floor(z0 / T); z < Math.ceil(z1 / T); z++)
    for (let x = Math.floor(x0 / T); x < Math.ceil(x1 / T); x++) {
      const cx = (x + 0.5) * T, cz = (z + 0.5) * T;
      if (holes.some(([a, b, c, d]) => cx > a && cx < c && cz > b && cz < d)) continue;
      tiles.push([x, z]);
    }
  st.floorGroups.push({ id: uid("fg"), name: "", offset: 0, thickness: null, material, tint, tiles, locked: false });
}
export function stairs(st, at, rotation, { shape = "U", width = 100, rise = 300, turn = "right", rail = "both", railStyle = "wood", material = "woodFloor", tint = null, base = "solid", stepHeight = 17.5 } = {}) {
  st.stairs.push({ id: uid("sr"), name: "", shape, at, rotation, width, rise, stepHeight, treadDepth: 28, turn, material, tint, cutFloorAbove: true, railing: rail, railingStyle: railStyle, base, locked: false });
}
export const rail = railing;

/** Another building on the lot (one ground storey) with its own roof: wings around a courtyard get separate roofs. */
export function building(p, at, { roof = {}, height = 300, name = "" } = {}) {
  const b = { id: uid("b"), name, at, rotation: 0, locked: false, roofShadow: true, roof: { type: "hip", pitch: 25, overhang: 60, height: 20, ridgeAxis: "x", material: "roofTiles", tint: "#c8653f", visible: false, locked: false, ceiling: true, ...roof }, storeys: [freshStorey(null, "ground")] };
  b.storeys[0].height = height;
  p.buildings.push(b);
  return b;
}
// ---- lot (world cm)
/** Terrain height (cm) at world cm, like Terrain.heightAt: bilinear over the stored heights plus the slope plane. */
export function groundAt(p, x, z) {
  const t = p.terrain;
  if (!t?.heights?.length) return 0;
  const n = t.resolution;
  const u = Math.max(0, Math.min(n, (x / t.width + 0.5) * n)), v = Math.max(0, Math.min(n, (z / t.depth + 0.5) * n));
  const ix = Math.min(n - 1, Math.floor(u)), iz = Math.min(n - 1, Math.floor(v));
  const fx = u - ix, fz = v - iz, k = iz * (n + 1) + ix;
  const h = t.heights, h00 = h[k], h10 = h[k + 1], h01 = h[k + n + 1], h11 = h[k + n + 2];
  const base = fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  const sl = t.slope;
  const plane = sl?.percent ? -(x * Math.sin(sl.direction * DEG) - z * Math.cos(sl.direction * DEG)) * (sl.percent / 100) : 0;
  return base + plane;
}
/**
 * Object on the lot: `y` is its height above the ground at (x, z), or
 * above `level` (an absolute cm height, e.g. the top of a deck) when given.
 */
export function lot(p, prop, x, z, back = "n", y = 0, level = null) {
  const at = Math.round(((level ?? groundAt(p, x, z)) + y) * 10) / 10;
  p.objects.push({ id: uid("ob"), name: "", prop, inline: null, at: [x, at, z], rotation: [0, yawFor(prop, back), 0], scale: [1, 1, 1], tint: null, material: null, locked: false });
}
export function poly(p, type, points, material, tint = null, extra = {}) {
  p.outdoor.push({ id: uid("d"), name: "", type, points, material, tint, height: 3, open: false, postSize: 15, depth: 80, width: 120, lights: false, locked: false, ...extra });
}
export const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
export const path = (p, pts, material = "paving", tint = null, height = 3) => poly(p, "path", pts, material, tint, { height });
export const deck = (p, pts, { material = "planks", tint = "#b08a5a", height = 15, open = false } = {}) => poly(p, "deck", pts, material, tint, { height, open });
export const pool = (p, pts, { tint = "#6fc3e0", depth = 150, material = "azulejo" } = {}) => poly(p, "pool", pts, material, tint, { height: -depth, lights: true });
export const pond = (p, pts, { tint = null, depth = 80, height = 10, material = "dirt" } = {}) => poly(p, "pond", pts, material, tint, { depth, height });
export function patch(p, pts, material = "sand", tint = null) {
  p.gardenPatches.push({ id: uid("g"), name: "", type: "garden", points: pts, material, tint, height: 1, open: false, postSize: 15, depth: 80, width: 120, lights: false, locked: false });
}
export function fence(p, pts, { style = "picket", height = 110, gates = [] } = {}) {
  p.fences.push({ id: uid("fe"), name: "", points: pts, height, style, postSpacing: 200, material: null, tint: null, gates, locked: false });
}
export function siteWall(p, pts, { height = 200, material = "plaster", tint = "#e9e4da", gates = [] } = {}) {
  p.siteWalls.push({ id: uid("sw"), name: "", points: pts, thickness: 20, height, top: "straight", stepLength: 100, material, tint, outerMaterial: null, outerTint: null, locked: false, gates });
}
export const gate = (offset, type = "single", tint = "#3a3d42") => ({ id: uid("gt"), offset, width: { single: 110, double: 240, sliding: 300 }[type], type, open: 0, material: null, tint, locked: false });
/** Terrain of width × depth cm sampled from fn(x, z) -> height cm. */
export function terrain(p, width, depth, resolution, fn, material = "grass") {
  const n = resolution, heights = new Array((n + 1) ** 2);
  for (let z = 0; z <= n; z++)
    for (let x = 0; x <= n; x++) heights[z * (n + 1) + x] = Math.round(fn((x / n - 0.5) * width, (z / n - 0.5) * depth) * 10) / 10;
  p.terrain = { ...p.terrain, width, depth, resolution, heights, material, slope: { direction: 0, percent: 0 } };
}
export const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
