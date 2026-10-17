// Modular kitchen: generated prop documents (metres, like every prop) for
// base and wall cabinets, a sink unit, a stove unit, a fridge and a corner
// unit. The carcass and doors are white so the placement's finish (texture
// / tint) colours them; countertops, handles and appliances carry `noTint`
// and keep their own colours. Local frame: width along X, front at +Z,
// bottom at y = 0; wall cabinets are placed 145 cm up.
const DEG = Math.PI / 180;
const TOP = "#d7d3cb"; // countertop
const METAL = "#b9bcc0";
const DARK = "#2b2f33";
const PLINTH = "#3a3a3a";
const DOOR = "#ffffff";

export const KITCHEN_UNITS = ["base", "wall", "sink", "stove", "fridge", "corner"];
export const KITCHEN_SIZES = {
  base: { width: 60, depth: 60, height: 90, mount: 0 },
  wall: { width: 60, depth: 35, height: 70, mount: 145 },
  sink: { width: 80, depth: 60, height: 90, mount: 0 },
  stove: { width: 60, depth: 60, height: 90, mount: 0 },
  fridge: { width: 70, depth: 65, height: 180, mount: 0 },
  corner: { width: 90, depth: 90, height: 90, mount: 0 },
};
const NAMES = {
  base: { en: "Base cabinet 60", pt: "Armário base 60", ja: "ベースキャビネット 60" },
  wall: { en: "Wall cabinet 60", pt: "Armário aéreo 60", ja: "吊り戸棚 60" },
  sink: { en: "Sink unit 80", pt: "Módulo pia 80", ja: "シンクユニット 80" },
  stove: { en: "Stove unit 60", pt: "Módulo fogão 60", ja: "コンロユニット 60" },
  fridge: { en: "Fridge 70", pt: "Geladeira 70", ja: "冷蔵庫 70" },
  corner: { en: "Corner unit 90", pt: "Módulo de canto 90", ja: "コーナーユニット 90" },
};
const TAGS = {
  en: ["kitchen", "cabinet", "modular", "cupboard"],
  pt: ["cozinha", "armario", "modular", "modulo"],
  ja: ["キッチン", "キャビネット", "台所", "収納"],
};
export const unitDocId = (unit, mirrored = false) => `kitchen-${unit}-${KITCHEN_SIZES[unit].width}${mirrored ? "-r" : ""}`;

/** A part in centimetres → prop part in metres. */
function part(w, h, d, x, y, z, color, extra = {}) {
  const { ry = 0, noTint = false, shape = "box", axis = "y" } = extra;
  return { w: w / 100, h: h / 100, d: d / 100, x: x / 100, y: y / 100, z: z / 100, rx: 0, ry: ry * DEG, rz: 0, shape, axis, color, opacity: 1, locked: false, noTint, material: null };
}
function doc(unit, boxes, mirrored = false) {
  const size = KITCHEN_SIZES[unit];
  if (mirrored) for (const b of boxes) {
    b.x = -b.x;
    b.ry = -b.ry;
  }
  const name = { ...NAMES[unit] };
  if (mirrored) for (const k of Object.keys(name)) name[k] = `${name[k]} ⟲`;
  return {
    kind: "prop", version: 1, id: unitDocId(unit, mirrored), name, category: "kitchen", tags: TAGS,
    kitchen: { unit, ...size, mirrored },
    source: { type: "boxes", boxes },
  };
}
/** Cabinet carcass with plinth, n doors with handles, optional countertop. */
function cabinet(w, d, { doors = 1, top = true, handleY = 82, carcassColor = DOOR, carcassTint = false } = {}) {
  const parts = [];
  parts.push(part(w - 4, 10, d - 6, 0, 5, -3, PLINTH, { noTint: true }));
  parts.push(part(w, 77, d - 1, 0, 48.5, -0.5, carcassColor, { noTint: carcassTint }));
  const dw = (w - 2) / doors - 1;
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + 1 + (dw + 1) * i + dw / 2 + 0.5;
    parts.push(part(dw, 75, 2, x, 48.5, d / 2, DOOR));
    parts.push(part(Math.min(12, dw * 0.5), 1.6, 2.5, x, handleY, d / 2 + 2.2, METAL, { noTint: true }));
  }
  if (top) parts.push(part(w, 3, d + 2, 0, 88.5, 1, TOP, { noTint: true }));
  return parts;
}
function baseDoc() {
  const { width: w, depth: d } = KITCHEN_SIZES.base;
  return doc("base", cabinet(w, d));
}
function wallDoc() {
  const { width: w, depth: d } = KITCHEN_SIZES.wall;
  return doc("wall", [
    part(w, 70, d - 1, 0, 35, -0.5, DOOR),
    part(w - 2, 68, 2, 0, 35, d / 2, DOOR),
    part(12, 1.6, 2.5, 0, 6, d / 2 + 2.2, METAL, { noTint: true }),
  ]);
}
function sinkDoc() {
  const { width: w, depth: d } = KITCHEN_SIZES.sink;
  const parts = cabinet(w, d, { doors: 2 });
  parts.push(
    part(50, 1.2, 40, 0, 90.6, -2, "#e4e6e8", { noTint: true }),
    part(44, 0.8, 34, 0, 91.4, -2, "#8d949a", { noTint: true }),
    part(2.4, 18, 2.4, 0, 99, -24, METAL, { noTint: true, shape: "cylinder" }),
    part(2, 2, 16, 0, 107, -16, METAL, { noTint: true }),
    part(1.6, 4, 1.6, -5, 93, -24, METAL, { noTint: true, shape: "cylinder" }),
  );
  return doc("sink", parts);
}
function stoveDoc() {
  const { width: w, depth: d } = KITCHEN_SIZES.stove;
  const body = "#e9e9e9";
  const parts = [
    part(w - 4, 10, d - 6, 0, 5, -3, PLINTH, { noTint: true }),
    part(w, 80, d - 1, 0, 50, -0.5, body, { noTint: true }),
    part(w - 4, 12, 2, 0, 17, d / 2, body, { noTint: true }), // drawer
    part(w - 4, 40, 2, 0, 44, d / 2, DARK, { noTint: true }), // oven door
    part(w - 20, 20, 0.6, 0, 46, d / 2 + 1.3, "#121518", { noTint: true }), // window
    part(w - 10, 2, 3, 0, 62, d / 2 + 2.5, METAL, { noTint: true }), // oven handle
    part(w - 4, 10, 2, 0, 80, d / 2, DARK, { noTint: true }), // control strip
    part(w, 1.2, d - 6, 0, 90.6, -1, "#1b1e21", { noTint: true }), // cooktop
  ];
  for (const x of [-18, -6, 6, 18]) parts.push(part(3, 3, 1.5, x, 80, d / 2 + 1.5, METAL, { noTint: true, shape: "cylinder", axis: "z" }));
  for (const [x, z] of [[-14, -14], [14, -14], [-14, 12], [14, 12]]) {
    parts.push(part(14, 0.8, 14, x, 91.6, z, "#45494d", { noTint: true, shape: "cylinder" }));
    parts.push(part(16, 0.6, 16, x, 92.3, z, "#2a2d30", { noTint: true, shape: "torus" }));
  }
  return doc("stove", parts);
}
function fridgeDoc() {
  const { width: w, depth: d, height: h } = KITCHEN_SIZES.fridge;
  const body = "#f4f4f2";
  return doc("fridge", [
    part(w - 4, 8, d - 10, 0, 4, -4, PLINTH, { noTint: true }),
    part(w, h - 4, d - 2, 0, 8 + (h - 4) / 2, -1, body, { noTint: true }),
    part(w - 1, 54, 2, 0, h - 2 - 27, d / 2, body, { noTint: true }),
    part(w - 1, h - 68, 2, 0, 8 + (h - 68) / 2, d / 2, body, { noTint: true }),
    part(2, 30, 3, w / 2 - 7, h - 36, d / 2 + 2.5, METAL, { noTint: true }),
    part(2, 40, 3, w / 2 - 7, 100, d / 2 + 2.5, METAL, { noTint: true }),
  ]);
}
/**
 * Diagonal corner unit, 90 × 90: backs on −Z (the hovered wall) and −X
 * (the adjacent wall); the door faces the room on the 45° front.
 */
function cornerDoc(mirrored) {
  const s2 = Math.SQRT2;
  const parts = [
    part(86, 10, 46, 0, 5, -22, PLINTH, { noTint: true }),
    part(46, 10, 36, -22, 5, 23, PLINTH, { noTint: true }),
    part(90, 77, 50, 0, 48.5, -20, DOOR), // back block  x −45..45, z −45..5
    part(50, 77, 40, -20, 48.5, 25, DOOR), // left block  x −45..5,  z 5..45
    part(40 * s2, 77, 20 * s2, 15, 48.5, 15, DOOR, { ry: 45 }), // diagonal filler
    part(52, 75, 2, 25.7, 48.5, 25.7, DOOR, { ry: 45 }), // door on the diagonal
    part(12, 1.6, 2.5, 35.8, 82, 18.8, METAL, { noTint: true, ry: 45 }),
    part(90, 3, 50, 0, 88.5, -20, TOP, { noTint: true }),
    part(50, 3, 40, -20, 88.5, 25, TOP, { noTint: true }),
    part(40 * s2, 3, 20 * s2, 15, 88.5, 15, TOP, { noTint: true, ry: 45 }), // no overhang: stays inside 90 × 90
  ];
  return doc("corner", parts, mirrored);
}
/** Every generated kitchen document, for the catalog and the kitchen tool. */
export function kitchenDocs() {
  return [baseDoc(), wallDoc(), sinkDoc(), stoveDoc(), fridgeDoc(), cornerDoc(false), cornerDoc(true)];
}
