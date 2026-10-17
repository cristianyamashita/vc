// Printable 2D plan of one storey, drawn with the 2D canvas API (no WebGL)
// on an A4 landscape page at 150 dpi: walls as filled double lines with
// door swings and window lines, floor groups as light fills with name and
// area, stairs as treads with an arrow, objects as labelled footprints,
// room names with their net area, a dimension line per wall (and per
// opening) on the free side of the wall, dimension chains along the four
// sides, a scale bar, a north arrow and a title block. Coordinates are
// building-local centimetres; the page is white for printing.
import { stairsBoxes } from "./build/stairs.js";
import { cornerExtension, clampOpening, doorSwing, outerSide } from "./build/walls.js";
import { tileKey } from "./build/slabs.js";
import { wallLength } from "./schema.js";
import { pointInPolygon } from "./geom.js";

const DEG = Math.PI / 180;
export const PAGE = { w: 1754, h: 1240, dpi: 150 }; // A4 landscape at 150 dpi
const MARGIN = 50, TITLE = 78, FOOTER = 80, DIMS = 124; // px
const RATIOS = [20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000];
const FLOOR_FILLS = ["#eef3ee", "#eaf0f6", "#f5efe4", "#f0eaf4", "#e8f4f1", "#f6ece8"];
const INK = "#1c1c1c", WALL = "#3b3b3b", DIM = "#555555", LIGHT = "#9a9a9a";

/**
 * Render the plan; returns the canvas. `objectFootprint(o)` gives the
 * local bounds of a placed object as {minX, maxX, minZ, maxZ} in cm (before
 * its own rotation) and `wellTiles(fg)` the tile keys cut by stairs below.
 * `rooms` is the storey's detected [{face, room}] list (js/rooms.js) and
 * `roomName(room)` its display name; without rooms the floor groups are
 * labelled instead.
 */
export function renderPlan({ project, building, storey, lang = "en", t = (k) => k, objectFootprint, wellTiles, objectName, notes = [], rooms = [], roomName }) {
  const tile = project.grid.tile;
  const canvas = document.createElement("canvas");
  canvas.width = PAGE.w;
  canvas.height = PAGE.h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PAGE.w, PAGE.h);

  // ---- collect geometry (building-local cm)
  const walls = storey.walls.filter((w) => wallLength(w) >= 1);
  const ext = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  const grow = (x, z) => {
    ext.minX = Math.min(ext.minX, x);
    ext.maxX = Math.max(ext.maxX, x);
    ext.minZ = Math.min(ext.minZ, z);
    ext.maxZ = Math.max(ext.maxZ, z);
  };
  const wallRects = walls.map((w) => {
    const [e0, e1] = cornerExtension(w, walls);
    const L = wallLength(w), ang = Math.atan2(w.b[1] - w.a[1], w.b[0] - w.a[0]);
    const c = Math.cos(ang), s = Math.sin(ang), h = w.thickness / 2;
    const corners = [[-e0, -h], [L + e1, -h], [L + e1, h], [-e0, h]].map(([u, v]) => [w.a[0] + u * c - v * s, w.a[1] + u * s + v * c]);
    corners.forEach(([x, z]) => grow(x, z));
    return { w, L, ang, e0, e1, corners };
  });
  const groups = storey.floorGroups.map((fg, i) => {
    const skip = wellTiles?.(fg) || null;
    const tiles = fg.tiles.filter(([x, z]) => !skip?.has(tileKey(x, z)));
    for (const [x, z] of tiles) {
      grow(x * tile, z * tile);
      grow((x + 1) * tile, (z + 1) * tile);
    }
    return { fg, i, tiles, keys: new Set(tiles.map(([x, z]) => tileKey(x, z))) };
  });
  const stairs = storey.stairs.map((st) => {
    const c = Math.cos(st.rotation * DEG), s = Math.sin(st.rotation * DEG);
    const map = (x, z) => [st.at[0] + x * c + z * s, st.at[1] - x * s + z * c];
    const boxes = stairsBoxes(st).map((b) => ({ ...b, quad: [map(b.x0, b.z0), map(b.x1, b.z0), map(b.x1, b.z1), map(b.x0, b.z1)], centre: map((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2) }));
    boxes.forEach((b) => b.quad.forEach(([x, z]) => grow(x, z)));
    return { st, boxes };
  });
  const objects = storey.objects.map((o) => {
    const fp = objectFootprint?.(o);
    if (!fp) return null;
    const c = Math.cos(o.rotation[1] * DEG), s = Math.sin(o.rotation[1] * DEG);
    const map = (x, z) => [o.at[0] + x * c + z * s, o.at[2] - x * s + z * c];
    const quad = [map(fp.minX, fp.minZ), map(fp.maxX, fp.minZ), map(fp.maxX, fp.maxZ), map(fp.minX, fp.maxZ)];
    quad.forEach(([x, z]) => grow(x, z));
    return { o, quad, centre: map((fp.minX + fp.maxX) / 2, (fp.minZ + fp.maxZ) / 2), w: fp.maxX - fp.minX, d: fp.maxZ - fp.minZ };
  }).filter(Boolean);
  if (!Number.isFinite(ext.minX)) Object.assign(ext, { minX: -500, maxX: 500, minZ: -400, maxZ: 400 });
  // outer edges of walls and tiles only (objects outside do not drive the dimensions)
  const dimExt = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  for (const r of wallRects) for (const [x, z] of r.corners) growInto(dimExt, x, z);
  for (const g of groups) for (const [x, z] of g.tiles) {
    growInto(dimExt, x * tile, z * tile);
    growInto(dimExt, (x + 1) * tile, (z + 1) * tile);
  }
  if (!Number.isFinite(dimExt.minX)) Object.assign(dimExt, ext);

  // ---- scale: nice ratio that fits the page
  const availW = PAGE.w - 2 * MARGIN - 2 * DIMS, availH = PAGE.h - 2 * MARGIN - TITLE - FOOTER - 2 * DIMS;
  const spanX = Math.max(100, ext.maxX - ext.minX), spanZ = Math.max(100, ext.maxZ - ext.minZ);
  const fitScale = Math.min(availW / spanX, availH / spanZ); // px per cm
  const pxPerCm = (ratio) => PAGE.dpi / 2.54 / ratio;
  const ratio = RATIOS.find((r) => pxPerCm(r) <= fitScale) || RATIOS[RATIOS.length - 1];
  const S = Math.min(fitScale, pxPerCm(ratio));
  const ox = MARGIN + DIMS + (availW - spanX * S) / 2 - ext.minX * S;
  const oy = MARGIN + TITLE + DIMS + (availH - spanZ * S) / 2 - ext.minZ * S;
  const X = (x) => ox + x * S, Y = (z) => oy + z * S;
  const font = (px, weight = "") => `${weight} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans JP", sans-serif`;

  // ---- floors
  for (const g of groups) {
    ctx.fillStyle = FLOOR_FILLS[g.i % FLOOR_FILLS.length];
    for (const [x, z] of g.tiles) ctx.fillRect(X(x * tile), Y(z * tile), tile * S + 0.5, tile * S + 0.5);
    ctx.strokeStyle = LIGHT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [x, z] of g.tiles) {
      if (!g.keys.has(tileKey(x, z - 1))) line(ctx, X(x * tile), Y(z * tile), X((x + 1) * tile), Y(z * tile));
      if (!g.keys.has(tileKey(x, z + 1))) line(ctx, X(x * tile), Y((z + 1) * tile), X((x + 1) * tile), Y((z + 1) * tile));
      if (!g.keys.has(tileKey(x - 1, z))) line(ctx, X(x * tile), Y(z * tile), X(x * tile), Y((z + 1) * tile));
      if (!g.keys.has(tileKey(x + 1, z))) line(ctx, X((x + 1) * tile), Y(z * tile), X((x + 1) * tile), Y((z + 1) * tile));
    }
    ctx.stroke();
  }
  // ---- stairs
  for (const { boxes } of stairs) {
    ctx.fillStyle = "#f4f4f4";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    for (const b of boxes) {
      poly(ctx, b.quad.map(([x, z]) => [X(x), Y(z)]));
      ctx.fill();
      ctx.stroke();
    }
    if (boxes.length > 1) {
      const pts = boxes.map((b) => [X(b.centre[0]), Y(b.centre[1])]);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.stroke();
      const [ax, ay] = pts[pts.length - 2], [bx, by] = pts[pts.length - 1];
      arrowHead(ctx, ax, ay, bx, by, 9);
      ctx.fillStyle = INK;
      ctx.font = font(12, "600");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(t("planUp"), pts[0][0], pts[0][1] - 12);
    }
  }
  // ---- objects
  ctx.font = font(11);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const ob of objects) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.strokeStyle = "#6b6b6b";
    ctx.lineWidth = 1;
    poly(ctx, ob.quad.map(([x, z]) => [X(x), Y(z)]));
    ctx.fill();
    ctx.stroke();
    const name = objectName?.(ob.o) || ob.o.name;
    if (name && Math.max(ob.w, ob.d) * S >= 40) {
      ctx.fillStyle = "#333";
      const cx = X(ob.centre[0]), cy = Y(ob.centre[1]);
      const maxW = Math.max(ob.w, ob.d) * S - 6;
      ctx.save();
      if (ob.d > ob.w * 1.4) {
        ctx.translate(cx, cy);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(ellipsize(ctx, name, maxW), 0, 0);
      } else ctx.fillText(ellipsize(ctx, name, maxW), cx, cy);
      ctx.restore();
    }
  }
  // ---- room labels, or floor labels when the walls close no room (over objects, under walls)
  const labelBox = (px, py, name, text) => {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font(14, "600");
    const w = Math.max(ctx.measureText(name).width, ctx.measureText(text).width) + 12;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(px - w / 2, py - 18, w, 36);
    ctx.fillStyle = INK;
    ctx.fillText(name, px, py - 8);
    ctx.font = font(12);
    ctx.fillStyle = DIM;
    ctx.fillText(text, px, py + 9);
  };
  const roomList = rooms.filter((p) => p.face && p.room);
  if (roomList.length)
    roomList.forEach(({ face, room }, i) => {
      const name = roomName?.(room) || room.name || `${t("room")} ${i + 1}`;
      labelBox(X(face.labelPoint[0]), Y(face.labelPoint[1]), name, `${(face.area / 10000).toLocaleString(lang, { maximumFractionDigits: 1 })} m²`);
    });
  else
    for (const g of groups) {
      if (!g.tiles.length) continue;
      const area = (g.tiles.length * tile * tile) / 10000;
      let cx = 0, cz = 0;
      for (const [x, z] of g.tiles) {
        cx += (x + 0.5) * tile;
        cz += (z + 0.5) * tile;
      }
      cx /= g.tiles.length;
      cz /= g.tiles.length;
      labelBox(X(cx), Y(cz), g.fg.name || `${t("floor")} ${g.i + 1}`, `${area.toLocaleString(lang, { maximumFractionDigits: 2 })} m²`);
    }
  // ---- walls
  ctx.lineJoin = "miter";
  for (const r of wallRects) {
    ctx.fillStyle = WALL;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    poly(ctx, r.corners.map(([x, z]) => [X(x), Y(z)]));
    ctx.fill();
    ctx.stroke();
  }
  for (const r of wallRects) {
    const { w, ang } = r, T = w.thickness, h = T / 2;
    ctx.save();
    ctx.translate(X(w.a[0]), Y(w.a[1]));
    ctx.rotate(ang);
    ctx.scale(S, S);
    const lw = (px) => px / S;
    for (const raw of w.openings) {
      const op = clampOpening({ ...raw }, w);
      const u0 = op.offset, u1 = op.offset + op.width;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(u0, -h - 0.6, op.width, T + 1.2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = lw(1.2);
      // jambs
      line(ctx, u0, -h, u0, h, true);
      line(ctx, u1, -h, u1, h, true);
      if (op.type === "window") {
        ctx.lineWidth = lw(1);
        line(ctx, u0, -h, u1, -h, true);
        line(ctx, u0, h, u1, h, true);
        ctx.lineWidth = lw(1.6);
        line(ctx, u0, 0, u1, 0, true);
        continue;
      }
      const { swing, leaves } = doorSwing(op, w, storey, tile);
      ctx.lineWidth = lw(1.1);
      if (op.preset === "door-sliding") {
        const half = op.width / 2;
        line(ctx, u0, -h / 2, u0 + half + 4, -h / 2, true);
        line(ctx, u1 - half - 4, h / 2, u1, h / 2, true);
        continue;
      }
      if (op.preset === "door-garage") {
        ctx.setLineDash([6, 4]);
        line(ctx, u0, 0, u1, 0, true);
        ctx.setLineDash([]);
        ctx.strokeRect(u0, swing > 0 ? h : h - op.height * 0.5 - h, op.width, op.height * 0.5);
        continue;
      }
      for (const leaf of leaves) {
        // leaf perpendicular to the wall, arc back to the other jamb
        line(ctx, leaf.hinge, swing * h, leaf.hinge, swing * (h + leaf.length), true);
        ctx.beginPath();
        const a0 = swing > 0 ? Math.PI / 2 : -Math.PI / 2; // leaf direction
        const a1 = leaf.dir > 0 ? 0 : Math.PI; // along the wall
        ctx.arc(leaf.hinge, swing * h, leaf.length, a0, a1, (swing > 0) === (leaf.dir > 0));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---- wall dimensions: one line per wall on the side without a room (the
  // outside), split at the openings when there are any, plus the total
  const roomPolys = roomList.map((p) => p.face.polygon);
  const off1 = 18 / S, off2 = 40 / S; // cm, so the lines sit at a fixed page distance
  ctx.font = font(10.5);
  ctx.lineWidth = 1;
  for (const r of wallRects) {
    const { w, L, ang } = r;
    if (L < 30) continue;
    const h = w.thickness / 2;
    const c = Math.cos(ang), s = Math.sin(ang);
    const mx = (w.a[0] + w.b[0]) / 2, mz = (w.a[1] + w.b[1]) / 2;
    const probe = (sign) => [mx - s * sign * (h + 15), mz + c * sign * (h + 15)]; // local +v axis is (−s, c)
    const inRoom = (p) => roomPolys.some((poly) => pointInPolygon(p[0], p[1], poly));
    const plus = inRoom(probe(1)), minus = inRoom(probe(-1));
    const side = plus && !minus ? -1 : minus && !plus ? 1 : plus && minus ? 1 : outerSide(w, storey, tile);
    const ops = w.openings.map((raw) => clampOpening({ ...raw }, w)).sort((a, b) => a.offset - b.offset);
    const chain = [0];
    for (const op of ops) {
      if (op.offset - chain[chain.length - 1] >= 1) chain.push(op.offset);
      chain.push(op.offset + op.width);
    }
    if (L - chain[chain.length - 1] >= 1) chain.push(L);
    else chain[chain.length - 1] = L;
    ctx.save();
    ctx.translate(X(w.a[0]), Y(w.a[1]));
    ctx.rotate(ang);
    // text reads left-to-right / bottom-to-top on the page
    const flip = c < -1e-6 || (Math.abs(c) < 1e-6 && s > 0);
    const drawChain = (cms, yCm, ext) => {
      const y = side * yCm * S;
      ctx.strokeStyle = DIM;
      ctx.fillStyle = DIM;
      ctx.beginPath();
      ctx.moveTo(cms[0] * S, y);
      ctx.lineTo(cms[cms.length - 1] * S, y);
      for (const u of cms) {
        const x = u * S;
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x, y + 4);
        ctx.moveTo(x - 3, y + 3);
        ctx.lineTo(x + 3, y - 3);
      }
      ctx.stroke();
      if (ext) {
        ctx.strokeStyle = LIGHT;
        ctx.beginPath();
        for (const u of cms) {
          ctx.moveTo(u * S, side * h * S);
          ctx.lineTo(u * S, y - side * 6);
        }
        ctx.stroke();
      }
      ctx.textAlign = "center";
      ctx.textBaseline = (side > 0) !== flip ? "top" : "bottom";
      for (let i = 1; i < cms.length; i++) {
        const len = cms[i] - cms[i - 1];
        if (len < 1) continue;
        const label = fmt(len, lang);
        if (ctx.measureText(label).width > len * S - 4) continue;
        const tx = ((cms[i] + cms[i - 1]) / 2) * S, ty = y + side * 5;
        if (flip) {
          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(Math.PI);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        } else ctx.fillText(label, tx, ty);
      }
    };
    if (chain.length > 2) {
      drawChain(chain, h + off1, true);
      drawChain([0, L], h + off2, false);
    } else drawChain([0, L], h + off1, true);
    ctx.restore();
  }

  // ---- dimensions
  const xs = chainCoords(wallRects.flatMap((r) => [r.w.a[0], r.w.b[0]]), dimExt.minX, dimExt.maxX);
  const zs = chainCoords(wallRects.flatMap((r) => [r.w.a[1], r.w.b[1]]), dimExt.minZ, dimExt.maxZ);
  ctx.strokeStyle = DIM;
  ctx.fillStyle = DIM;
  ctx.lineWidth = 1;
  ctx.font = font(12);
  const d1 = 62, d2 = 102; // px outside the extents, beyond the wall dimensions
  const top = Y(dimExt.minZ), bottom = Y(dimExt.maxZ), left = X(dimExt.minX), right = X(dimExt.maxX);
  hChain(ctx, xs.map(X), top - d1, -1, xs, lang);
  hChain(ctx, [X(dimExt.minX), X(dimExt.maxX)], top - d2, -1, [dimExt.minX, dimExt.maxX], lang);
  hChain(ctx, xs.map(X), bottom + d1, 1, xs, lang);
  hChain(ctx, [X(dimExt.minX), X(dimExt.maxX)], bottom + d2, 1, [dimExt.minX, dimExt.maxX], lang);
  vChain(ctx, zs.map(Y), left - d1, -1, zs, lang);
  vChain(ctx, [Y(dimExt.minZ), Y(dimExt.maxZ)], left - d2, -1, [dimExt.minZ, dimExt.maxZ], lang);
  vChain(ctx, zs.map(Y), right + d1, 1, zs, lang);
  vChain(ctx, [Y(dimExt.minZ), Y(dimExt.maxZ)], right + d2, 1, [dimExt.minZ, dimExt.maxZ], lang);

  // ---- notes: numbered pins (world cm -> building-local) within this storey's height
  const rot = building.rotation * DEG, cth = Math.cos(rot), sth = Math.sin(rot);
  const pins = [];
  notes.forEach((n, i) => {
    const y = n.at[1];
    if (y < storey.elevation - 60 || y > storey.elevation + storey.height + 60) return;
    const dx = n.at[0] - building.at[0], dz = n.at[2] - building.at[1];
    const px = X(dx * cth + dz * sth), py = Y(-dx * sth + dz * cth);
    if (px < MARGIN || px > PAGE.w - MARGIN || py < MARGIN + TITLE || py > PAGE.h - MARGIN - FOOTER) return;
    pins.push({ n, i, px, py });
  });
  for (const { n, i, px, py } of pins) {
    ctx.beginPath();
    ctx.arc(px, py, 11, 0, Math.PI * 2);
    ctx.fillStyle = n.done ? "#b9b9b9" : n.color;
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = font(12, "700");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), px, py + 0.5);
  }
  if (pins.length) {
    const lx = MARGIN + 640, lineH = 16, shown = pins.slice(0, 8);
    let ly = PAGE.h - MARGIN - 10;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    for (const { n, i } of [...shown].reverse()) {
      ctx.beginPath();
      ctx.arc(lx + 7, ly, 6, 0, Math.PI * 2);
      ctx.fillStyle = n.done ? "#b9b9b9" : n.color;
      ctx.fill();
      ctx.fillStyle = n.done ? LIGHT : INK;
      ctx.font = font(12);
      ctx.fillText(`${i + 1}. ${ellipsize(ctx, n.text || t("note"), 300)}${n.done ? " ✓" : ""}`, lx + 18, ly);
      ly -= lineH;
    }
    ctx.fillStyle = DIM;
    ctx.font = font(12, "600");
    ctx.fillText(pins.length > shown.length ? `${t("notes")} (${pins.length})` : t("notes"), lx, ly);
  }

  // ---- title block
  const storeyIndex = building.storeys.indexOf(storey);
  const storeyName = storey.name || `${t("storey")} ${storeyIndex + 1}`;
  const buildingName = project.buildings.length > 1 ? ` · ${building.name || `${t("building")} ${project.buildings.indexOf(building) + 1}`}` : "";
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = font(24, "700");
  ctx.fillText(project.name || t("untitled"), MARGIN, MARGIN + 28);
  ctx.font = font(15);
  ctx.fillStyle = DIM;
  ctx.fillText(`${storeyName}${buildingName} · ${storey.elevation} cm · ${t("planScale")} 1:${ratio}`, MARGIN, MARGIN + 54);
  ctx.textAlign = "right";
  ctx.fillText(new Date().toLocaleDateString(lang, { year: "numeric", month: "long", day: "numeric" }), PAGE.w - MARGIN, MARGIN + 28);
  ctx.strokeStyle = "#cccccc";
  line(ctx, MARGIN, MARGIN + TITLE - 8, PAGE.w - MARGIN, MARGIN + TITLE - 8, true);

  // ---- scale bar
  const metres = Math.max(1, Math.min(5, Math.floor(spanX / 200)));
  const bx = MARGIN, by = PAGE.h - MARGIN - 22, seg = 100 * S;
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK;
  for (let i = 0; i < metres; i++) {
    ctx.fillStyle = i % 2 ? "#ffffff" : INK;
    ctx.fillRect(bx + i * seg, by, seg, 8);
    ctx.strokeRect(bx + i * seg, by, seg, 8);
  }
  ctx.fillStyle = INK;
  ctx.font = font(12);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= metres; i++) ctx.fillText(i === metres ? `${i} m` : String(i), bx + i * seg, by + 11);

  // ---- north arrow (world north = −Z; rotated into the building frame)
  const th = building.rotation * DEG, nx = -Math.sin(th), nz = -Math.cos(th);
  const cx = PAGE.w - MARGIN - 30, cy = PAGE.h - MARGIN - 30, R = 24;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  const tipX = cx + nx * (R - 4), tipY = cy + nz * (R - 4);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(cx - nz * 7 - nx * 10, cy + nx * 7 - nz * 10);
  ctx.lineTo(cx + nz * 7 - nx * 10, cy - nx * 7 - nz * 10);
  ctx.closePath();
  ctx.fill();
  ctx.font = font(13, "700");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", cx + nx * (R + 12), cy + nz * (R + 12));
  return canvas;
}

function growInto(e, x, z) {
  e.minX = Math.min(e.minX, x);
  e.maxX = Math.max(e.maxX, x);
  e.minZ = Math.min(e.minZ, z);
  e.maxZ = Math.max(e.maxZ, z);
}
function line(ctx, x0, y0, x1, y1, stroke = false) {
  if (stroke) ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  if (stroke) ctx.stroke();
}
function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
  ctx.closePath();
}
function arrowHead(ctx, ax, ay, bx, by, size) {
  const a = Math.atan2(by - ay, bx - ax);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx - size * Math.cos(a - 0.45), by - size * Math.sin(a - 0.45));
  ctx.lineTo(bx - size * Math.cos(a + 0.45), by - size * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}
function ellipsize(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
  return s + "…";
}
/** Distinct coordinates (1 cm) between min and max, always including both. */
function chainCoords(values, min, max) {
  const set = new Set([Math.round(min), Math.round(max)]);
  for (const v of values) {
    const r = Math.round(v);
    if (r >= min - 0.5 && r <= max + 0.5) set.add(r);
  }
  return [...set].sort((a, b) => a - b);
}
function fmt(cm, lang) {
  return Math.round(cm).toLocaleString(lang);
}
/** Horizontal dimension chain at page y; `side` −1 above, +1 below. */
function hChain(ctx, px, y, side, cm, lang) {
  if (px.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(px[0], y);
  ctx.lineTo(px[px.length - 1], y);
  for (const x of px) {
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y + 5);
    ctx.moveTo(x - 4, y + 4);
    ctx.lineTo(x + 4, y - 4);
  }
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = side < 0 ? "bottom" : "top";
  for (let i = 1; i < px.length; i++) {
    const len = cm[i] - cm[i - 1];
    if (len < 1) continue;
    const label = fmt(len, lang);
    if (ctx.measureText(label).width > px[i] - px[i - 1] + 10) continue;
    ctx.fillText(label, (px[i] + px[i - 1]) / 2, y + side * 6);
  }
}
/** Vertical dimension chain at page x; `side` −1 left, +1 right. */
function vChain(ctx, py, x, side, cm, lang) {
  if (py.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(x, py[0]);
  ctx.lineTo(x, py[py.length - 1]);
  for (const y of py) {
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.moveTo(x - 4, y + 4);
    ctx.lineTo(x + 4, y - 4);
  }
  ctx.stroke();
  for (let i = 1; i < py.length; i++) {
    const len = cm[i] - cm[i - 1];
    if (len < 1) continue;
    const label = fmt(len, lang);
    if (ctx.measureText(label).width > py[i] - py[i - 1] + 10) continue;
    ctx.save();
    ctx.translate(x + side * 6, (py[i] + py[i - 1]) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = side < 0 ? "bottom" : "top";
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
}
