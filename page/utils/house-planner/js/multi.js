// Multi-selection helpers: extra highlighted items, clipboard (shared
// between projects through localStorage), align / distribute / mirror and
// the two-point ruler. Works on placements of the same storey (objects and
// stairs) and on site objects.
import * as THREE from "three";
import { uid, clone } from "./schema.js";
import { CM, M } from "./scene.js";

const CLIP_KEY = "housePlanner.clipboard.v1";

/** Items (with their locate() records) in the current multi-selection. */
export function selectedItems(app) {
  const ids = [app.state.selection, ...app.state.extra].filter(Boolean);
  const out = [];
  for (const id of ids) {
    const f = app.locate(id);
    if (f && (f.type === "object" || f.type === "stairs")) out.push(f);
  }
  return out;
}
/** Can `found` join the current selection? Same storey (or both site-level). */
export function canJoin(app, found) {
  const primary = app.state.selection && app.locate(app.state.selection);
  if (!primary || !found) return false;
  if (!["object", "stairs"].includes(found.type) || !["object", "stairs"].includes(primary.type)) return false;
  return (primary.storey?.id || null) === (found.storey?.id || null);
}

// ------------------------------------------------------------ clipboard

export function copySelection(app) {
  const items = selectedItems(app);
  if (!items.length) return 0;
  const payload = {
    kind: "housePlannerClipboard", version: 1,
    items: items.map((f) => ({ type: f.type, item: clone(f.item), doc: f.type === "object" && f.item.prop ? app.propDoc(f.item.prop) || null : null })),
  };
  try {
    localStorage.setItem(CLIP_KEY, JSON.stringify(payload));
  } catch {
    return 0;
  }
  return items.length;
}
export function pasteClipboard(app) {
  let payload;
  try {
    payload = JSON.parse(localStorage.getItem(CLIP_KEY) || "null");
  } catch {
    payload = null;
  }
  if (!payload?.items?.length) return 0;
  const storey = app.storey(), building = app.building();
  app.checkpoint();
  const ids = [];
  for (const { type, item, doc } of payload.items) {
    const copy = clone(item);
    copy.locked = false;
    if (type === "stairs") {
      copy.id = uid("sr");
      copy.at = [copy.at[0] + 50, copy.at[1] + 50];
      storey.stairs.push(copy);
    } else {
      copy.id = uid("ob");
      copy.at = [copy.at[0] + 50, copy.at[1], copy.at[2] + 50];
      // a custom object from another browser profile travels inline
      if (copy.prop && doc && !app.propDoc(copy.prop)) {
        copy.inline = doc;
        copy.prop = null;
      }
      storey.objects.push(copy);
    }
    ids.push(copy.id);
  }
  app.changed({ rebuild: "building", buildingId: building.id });
  app.select(ids[0]);
  for (const id of ids.slice(1)) app.state.extra.add(id);
  app.refreshExtras();
  return ids.length;
}

// --------------------------------------------------------- arrangement

function pos(f) {
  return f.type === "stairs" ? [f.item.at[0], f.item.at[1]] : [f.item.at[0], f.item.at[2]];
}
function setPos(f, x, z) {
  if (f.type === "stairs") f.item.at = [x, z];
  else f.item.at = [x, f.item.at[1], z];
}
/** op: alignX | alignZ | centerX | centerZ | distX | distZ | mirrorX | mirrorZ; edge: "min" | "max" */
export function arrange(app, op, edge = "min") {
  const items = selectedItems(app).filter((f) => !f.item.locked);
  if (items.length < 2 && !op.startsWith("mirror")) return false;
  if (!items.length) return false;
  app.checkpoint();
  const xs = items.map((f) => pos(f)[0]), zs = items.map((f) => pos(f)[1]);
  const min = (a) => Math.min(...a), max = (a) => Math.max(...a);
  const cx = (min(xs) + max(xs)) / 2, cz = (min(zs) + max(zs)) / 2;
  if (op === "alignX") items.forEach((f) => setPos(f, edge === "min" ? min(xs) : max(xs), pos(f)[1]));
  if (op === "alignZ") items.forEach((f) => setPos(f, pos(f)[0], edge === "min" ? min(zs) : max(zs)));
  if (op === "centerX") items.forEach((f) => setPos(f, cx, pos(f)[1]));
  if (op === "centerZ") items.forEach((f) => setPos(f, pos(f)[0], cz));
  if (op === "distX" || op === "distZ") {
    const k = op === "distX" ? 0 : 1;
    const sorted = [...items].sort((a, b) => pos(a)[k] - pos(b)[k]);
    const lo = pos(sorted[0])[k], hi = pos(sorted[sorted.length - 1])[k];
    sorted.forEach((f, i) => {
      const v = lo + ((hi - lo) * i) / (sorted.length - 1);
      const p = pos(f);
      setPos(f, k === 0 ? v : p[0], k === 1 ? v : p[1]);
    });
  }
  if (op === "mirrorX" || op === "mirrorZ") {
    for (const f of items) {
      const [x, z] = pos(f);
      if (op === "mirrorX") setPos(f, 2 * cx - x, z);
      else setPos(f, x, 2 * cz - z);
      if (f.type === "stairs") f.item.rotation = ((op === "mirrorX" ? 180 - f.item.rotation : -f.item.rotation) + 360) % 360;
      else f.item.rotation[1] = ((op === "mirrorX" ? 180 - f.item.rotation[1] : -f.item.rotation[1]) + 360) % 360;
    }
  }
  for (const f of items) {
    if (f.type === "stairs") f.item.at = f.item.at.map((v) => Math.round(v * 10) / 10);
    else f.item.at = f.item.at.map((v) => Math.round(v * 10) / 10);
  }
  app.changed({ rebuild: items[0].building ? "building" : "site", buildingId: items[0].building?.id });
  return true;
}

// ---------------------------------------------------------------- ruler

export class Ruler {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.a = null;
    this.line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xd9534f, depthTest: false }));
    this.line.renderOrder = 30;
    this.line.visible = false;
    app.scene.overlay.add(this.line);
    this.dots = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd9534f, depthTest: false }));
      m.renderOrder = 31;
      m.visible = false;
      app.scene.overlay.add(m);
      return m;
    });
    this.label = document.createElement("div");
    this.label.className = "dim ruler-label";
    this.label.hidden = true;
    document.querySelector("#dims").append(this.label);
    this.mid = new THREE.Vector3();
  }
  toggle(on = !this.active) {
    this.active = on;
    this.a = null;
    if (!on) this.clear();
    this.app.scene.setToolActive(on || this.app.state.tool !== "select");
    this.app.refreshToolbar();
  }
  clear() {
    this.line.visible = false;
    this.dots.forEach((d) => (d.visible = false));
    this.label.hidden = true;
    this.app.scene.requestRender();
  }
  /** Any surface under the pointer, else the ground plane. */
  point(e) {
    const hits = this.app.scene.ray(e).intersectObjects(this.app.scene.world.children, true).filter((h) => h.object.visible && h.object.material?.visible !== false);
    return hits[0]?.point || this.app.scene.pickPlane(e, 0);
  }
  click(e) {
    const p = this.point(e);
    if (!p) return;
    if (!this.a) {
      this.a = p.clone();
      this.dots[0].position.copy(p);
      this.dots[0].visible = true;
      this.dots[1].visible = false;
      this.line.visible = false;
      this.label.hidden = true;
      this.app.scene.requestRender();
      return;
    }
    this.show(this.a, p);
    this.a = null;
  }
  move(e) {
    if (!this.a) return;
    const p = this.point(e);
    if (p) this.show(this.a, p);
  }
  show(a, b) {
    this.line.geometry.dispose();
    this.line.geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
    this.line.visible = true;
    this.dots[1].position.copy(b);
    this.dots[1].visible = true;
    this.mid.copy(a).lerp(b, 0.5);
    const d = a.distanceTo(b) * CM;
    const dy = Math.abs(b.y - a.y) * CM;
    this.label.textContent = `${Math.round(d)} cm${dy > 1 ? ` · Δh ${Math.round(dy)} cm` : ""}`;
    this.label.hidden = false;
    this.update();
    this.app.scene.requestRender();
  }
  update() {
    if (this.label.hidden) return;
    const v = this.mid.clone().project(this.app.scene.camera);
    const r = this.app.scene.canvas.getBoundingClientRect();
    this.label.style.left = `${((v.x + 1) / 2) * r.width}px`;
    this.label.style.top = `${((1 - v.y) / 2) * r.height - 14}px`;
  }
}
export { M };
