// Bill of quantities: lengths, areas and counts per building and storey
// (walls and wall faces by material, floors, roof, rooms, openings, stairs,
// railings, objects) and for the site (boundary walls, decks, pools, paths,
// patches, fences, gates, objects). Rows are plain data; the app renders
// them as a table or as CSV. Lengths in m, areas in m², counts in pieces.
import { wallLength, polylineLength, topStorey } from "./schema.js";
import { polygonArea } from "./geom.js";
import { roofRect } from "./build/roof.js";
import { wallHeight, clampOpening } from "./build/walls.js";
import { tileKey } from "./build/slabs.js";

const DEG = Math.PI / 180;
export const COLUMNS = ["building", "storey", "category", "item", "material", "quantity", "unit"];

/**
 * Compute the rows: [{building, storey, category (i18n key suffix), item,
 * material, quantity, unit ("m" | "m2" | "pcs")}]. `names` gives the
 * display strings: t, textureName(id), objectName(o), buildingName(b, i),
 * storeyName(s, i), roomName(room, storey); `roomsOf(storey)` returns the
 * detected [{face, room}] and `wellTiles(b, s, fg)` the tile keys cut by stairs.
 */
export function computeQuantities(project, names) {
  const { t, textureName, objectName, buildingName, storeyName, roomName, roomsOf, wellTiles } = names;
  const tile = project.grid.tile;
  const rows = new Map();
  const add = (building, storey, category, item, material, unit, qty) => {
    if (!(qty > 0)) return;
    const key = [building, storey, category, item, material, unit].join("\u0001");
    const row = rows.get(key) || { building, storey, category, item, material, quantity: 0, unit };
    row.quantity += qty;
    rows.set(key, row);
  };
  const mat = (id) => (id ? textureName(id) : t("solidColor"));
  const site = t("site");

  project.buildings.forEach((b, bi) => {
    const bn = buildingName(b, bi);
    b.storeys.forEach((s, si) => {
      const sn = storeyName(s, si);
      for (const { face, room } of roomsOf(s)) add(bn, sn, "rooms", roomName(room, s), "", "m2", face.area / 1e4);
      for (const w of s.walls) {
        const L = wallLength(w);
        if (L < 1) continue;
        const H = wallHeight(w, s);
        let holes = 0;
        for (const raw of w.openings) {
          const op = clampOpening({ ...raw }, w);
          holes += op.width * Math.max(0, Math.min(H, op.sill + op.height) - op.sill);
        }
        const faceArea = Math.max(0, L * H - holes) / 1e4;
        add(bn, sn, "walls", "", mat(w.material), "m", L / 100);
        add(bn, sn, "wallFacesInner", "", mat(w.material), "m2", faceArea);
        add(bn, sn, "wallFacesOuter", "", mat(w.outerMaterial ?? w.material), "m2", faceArea);
        for (const op of w.openings) add(bn, sn, op.type === "door" ? "doors" : "windows", t(op.preset), "", "pcs", 1);
      }
      for (const fg of s.floorGroups) {
        const skip = wellTiles?.(b, s, fg);
        const n = skip?.size ? fg.tiles.filter(([x, z]) => !skip.has(tileKey(x, z))).length : fg.tiles.length;
        add(bn, sn, "floors", "", mat(fg.material), "m2", (n * tile * tile) / 1e4);
      }
      for (const st of s.stairs) add(bn, sn, "stairs", t(`shape_${st.shape}`), "", "pcs", 1);
      for (const r of s.railings) add(bn, sn, "railings", t(`style_${r.style}`), "", "m", polylineLength(r.points) / 100);
      for (const o of s.objects) add(bn, sn, "objects", objectName(o), "", "pcs", 1);
    });
    const roof = b.roof, rect = roof && roof.type !== "none" ? roofRect(b, tile) : null;
    if (rect) {
      const w = rect.maxX - rect.minX + 2 * roof.overhang, d = rect.maxZ - rect.minZ + 2 * roof.overhang;
      const slope = roof.type === "flat" ? 1 : 1 / Math.cos(roof.pitch * DEG);
      const top = topStorey(b);
      add(bn, top ? storeyName(top, b.storeys.indexOf(top)) : "", "roof", t(`roof_${roof.type}`), mat(roof.material), "m2", (w * d * slope) / 1e4);
      const sn = top ? storeyName(top, b.storeys.indexOf(top)) : "";
      if (roof.type !== "flat") for (const rw of roof.windows || []) add(bn, sn, "windows", t("roofWindow"), "", "pcs", 1);
      if (roof.type === "gable" || roof.type === "shed") for (const ew of roof.endWindows || []) add(bn, sn, "windows", t("gableWindow"), "", "pcs", 1);
    }
  });
  for (const w of project.siteWalls || []) add(site, "", "siteWalls", "", mat(w.material), "m", polylineLength(w.points) / 100);
  for (const p of project.outdoor) if (p.points.length >= 3) add(site, "", "outdoor", t(p.type), mat(p.material), "m2", Math.abs(polygonArea(p.points)) / 1e4);
  for (const p of project.gardenPatches) if (p.points.length >= 3) add(site, "", "garden", "", mat(p.material), "m2", Math.abs(polygonArea(p.points)) / 1e4);
  for (const f of project.fences) add(site, "", "fences", t(`style_${f.style}`), "", "m", polylineLength(f.points) / 100);
  for (const host of [...project.fences, ...(project.siteWalls || [])]) for (const g of host.gates || []) add(site, "", "gates", t(`gate_${g.type}`), "", "pcs", 1);
  for (const o of project.objects) add(site, "", "objects", objectName(o), "", "pcs", 1);
  return [...rows.values()];
}

export function formatQuantity(row, lang) {
  return row.unit === "pcs" ? String(Math.round(row.quantity)) : row.quantity.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function columnLabel(column, t) {
  return t(column === "material" ? "materialCol" : column);
}
export function unitLabel(unit, t) {
  return unit === "m2" ? "m²" : unit === "pcs" ? t("pcs") : "m";
}
/** CSV with translated headers; numbers use a dot, strings are quoted. */
export function quantitiesCSV(rows, t) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [COLUMNS.map((c) => q(columnLabel(c, t))).join(",")];
  for (const r of rows)
    lines.push([q(r.building), q(r.storey), q(t(`cat_${r.category}`)), q(r.item), q(r.material), r.unit === "pcs" ? Math.round(r.quantity) : r.quantity.toFixed(2), q(unitLabel(r.unit, t))].join(","));
  return lines.join("\r\n");
}
