// Ready-made houses: generated projects (cm) built from rectangular rooms.
import { freshProject, freshStorey, uid, projectChecked, TILE } from "./schema.js";

const TEMPLATES = ["studio", "house2br", "twoStorey"];
export const TEMPLATE_IDS = TEMPLATES;

/** Rooms are {x, z, w, d} rectangles in building cm; walls are deduplicated. */
function addRooms(storey, rooms, { material = "woodFloor" } = {}) {
  const tiles = [];
  const edges = new Map();
  const key = (a, b) => [a, b].map((p) => p.join(",")).sort().join("|");
  for (const r of rooms) {
    for (let z = Math.floor(r.z / TILE); z < Math.ceil((r.z + r.d) / TILE); z++)
      for (let x = Math.floor(r.x / TILE); x < Math.ceil((r.x + r.w) / TILE); x++) tiles.push([x, z]);
    const c = [[r.x, r.z], [r.x + r.w, r.z], [r.x + r.w, r.z + r.d], [r.x, r.z + r.d]];
    c.forEach((a, i) => {
      const b = c[(i + 1) % 4];
      const k = key(a, b);
      if (!edges.has(k)) edges.set(k, { a, b, rooms: [] });
      edges.get(k).rooms.push(r);
    });
  }
  // split shared long edges: walls are per edge as drawn (rooms share whole sides in these templates)
  const seen = new Set();
  storey.floorGroups.push({ id: uid("fg"), name: "", offset: 0, thickness: null, material, tint: null, tiles: tiles.filter(([x, z]) => !seen.has(`${x},${z}`) && seen.add(`${x},${z}`)), locked: false });
  for (const { a, b, rooms: rs } of edges.values()) {
    const wall = { id: uid("w"), name: "", a, b, thickness: rs.length > 1 ? 15 : 20, height: null, material: null, tint: "#f2ede4", outerMaterial: null, outerTint: null, locked: false, openings: [] };
    storey.walls.push(wall);
    for (const r of rs) for (const op of r.openings || []) if (op.side === sideOf(r, a, b)) wall.openings.push(opening(op, a, b, r));
  }
  return storey;
}
function sideOf(r, a, b) {
  if (a[1] === b[1]) return a[1] === r.z ? "n" : "s";
  return a[0] === r.x ? "w" : "e";
}
/** Opening on a side: offset is measured along the wall from its first point. */
function opening(op, a, b, r) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const along = op.at ?? len / 2 - (op.width ?? 90) / 2;
  const preset = op.preset || (op.type === "window" ? "window-casement" : "door-single");
  const width = op.width ?? (op.type === "window" ? 120 : 90);
  const height = op.height ?? (op.type === "window" ? 120 : 210);
  return { id: uid("op"), preset, type: op.type, offset: Math.max(0, Math.min(len - width, along)), width, height, sill: op.type === "window" ? 90 : 0, flip: false, frameColor: "#776750", leafColor: "#b99673", glassColor: "#bcd8e6", locked: false };
}
function objects(storey, list) {
  for (const [prop, x, z, yaw = 0] of list) storey.objects.push({ id: uid("ob"), name: "", prop, inline: null, at: [x, 0, z], rotation: [0, yaw, 0], scale: [1, 1, 1], tint: null, material: null, locked: false });
}

export function makeTemplate(id, name) {
  const p = freshProject(name);
  const b = p.buildings[0];
  const g = b.storeys[0];
  if (id === "studio") {
    addRooms(g, [
      { x: 0, z: 0, w: 500, d: 400, openings: [{ type: "door", side: "s", at: 60 }, { type: "window", side: "n", width: 180 }] },
      { x: 500, z: 0, w: 200, d: 250, openings: [{ type: "door", side: "w", at: 100 }, { type: "window", side: "n", width: 60, preset: "window-small" }] },
    ]);
    objects(g, [["sofa", 140, 300, 180], ["tv", 140, 30, 0], ["double-bed", 380, 100, 90], ["kitchen-fridge", 460, 360, 180], ["kitchen-stove", 360, 360, 180], ["kitchen-sink", 250, 360, 180], ["toilet", 650, 40, 0], ["shower-stall", 560, 60, 0], ["bath-vanity", 650, 200, 180]]);
    b.roof.type = "flat";
  } else if (id === "house2br") {
    addRooms(g, [
      { x: 0, z: 0, w: 450, d: 450, openings: [{ type: "door", side: "s", at: 60 }, { type: "window", side: "w", width: 180, at: 120 }] }, // living
      { x: 450, z: 0, w: 350, d: 300, openings: [{ type: "door", side: "w", at: 40 }, { type: "window", side: "n", width: 120 }] }, // kitchen
      { x: 450, z: 300, w: 350, d: 150, openings: [{ type: "door", side: "w", at: 30 }, { type: "window", side: "e", width: 60, preset: "window-small" }] }, // bathroom
      { x: 0, z: 450, w: 400, d: 350, openings: [{ type: "door", side: "n", at: 280 }, { type: "window", side: "s", width: 150 }] }, // bedroom 1
      { x: 400, z: 450, w: 400, d: 350, openings: [{ type: "door", side: "n", at: 40 }, { type: "window", side: "s", width: 150 }] }, // bedroom 2
    ]);
    objects(g, [["sofa", 120, 300, 180], ["coffee-table", 200, 220, 0], ["tv", 120, 30, 0], ["dining-table", 330, 150, 0], ["kitchen-fridge", 760, 40, 270], ["kitchen-stove", 760, 160, 270], ["kitchen-sink", 760, 250, 270], ["toilet", 760, 340, 270], ["bath-vanity", 500, 420, 180], ["double-bed", 200, 650, 180], ["wardrobe", 60, 500, 90], ["single-bed", 600, 650, 180], ["desk", 720, 500, 90]]);
    p.objects.push({ id: uid("ob"), name: "", prop: "sedan", inline: null, at: [1100, 0, 200], rotation: [0, 90, 0], scale: [1, 1, 1], tint: null, material: null, locked: false }, { id: uid("ob"), name: "", prop: "oak-tree", inline: null, at: [-500, 0, 900], rotation: [0, 0, 0], scale: [1, 1, 1], tint: null, material: null, locked: false });
    b.roof.type = "hip";
  } else {
    addRooms(g, [
      { x: 0, z: 0, w: 500, d: 500, openings: [{ type: "door", side: "s", at: 60 }, { type: "window", side: "w", width: 240, preset: "window-picture", at: 130 }] }, // living
      { x: 500, z: 0, w: 300, d: 350, openings: [{ type: "door", side: "w", at: 40 }, { type: "window", side: "n", width: 120 }] }, // kitchen
      { x: 500, z: 350, w: 300, d: 150, openings: [{ type: "door", side: "w", at: 30 }, { type: "window", side: "e", width: 60, preset: "window-small" }] }, // wc
    ]);
    objects(g, [["sofa-three-seat", 150, 330, 180], ["coffee-table", 250, 250, 0], ["tv", 150, 30, 0], ["dining-table", 380, 150, 90], ["kitchen-fridge", 760, 40, 270], ["kitchen-stove", 760, 160, 270], ["kitchen-sink", 760, 260, 270], ["toilet", 760, 400, 270]]);
    g.stairs.push({ id: uid("sr"), name: "", shape: "L", at: [60, 440], rotation: 0, width: 100, rise: 300, stepHeight: 18, treadDepth: 28, turn: "left", material: "woodFloor", tint: null, cutFloorAbove: true, locked: false });
    const up = freshStorey({ elevation: 0, height: 300 }, "upper");
    b.storeys.push(up);
    addRooms(up, [
      { x: 0, z: 0, w: 400, d: 250, openings: [{ type: "door", side: "s", at: 40 }, { type: "window", side: "n", width: 150 }] }, // bedroom 1
      { x: 400, z: 0, w: 400, d: 250, openings: [{ type: "door", side: "s", at: 300 }, { type: "window", side: "n", width: 150 }] }, // bedroom 2
      { x: 0, z: 250, w: 300, d: 250, openings: [] }, // hall
      { x: 300, z: 250, w: 250, d: 250, openings: [{ type: "door", side: "w", at: 60 }, { type: "window", side: "s", width: 60, preset: "window-small" }] }, // bathroom
      { x: 550, z: 250, w: 250, d: 250, openings: [{ type: "door", side: "w", at: 60 }, { type: "window", side: "s", width: 120 }] }, // office
    ]);
    objects(up, [["double-bed", 200, 120, 0], ["wardrobe", 60, 200, 90], ["single-bed", 600, 120, 0], ["desk", 700, 400, 90], ["office-chair", 640, 400, 270], ["toilet", 330, 460, 180], ["bath-vanity", 500, 300, 0]]);
    b.roof.type = "gable";
  }
  b.roof.material = "roofTiles";
  b.roof.tint = "#c8653f";
  p.view.activeStorey = g.id;
  return projectChecked(p);
}
