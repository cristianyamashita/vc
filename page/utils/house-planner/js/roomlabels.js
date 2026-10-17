// Translucent room labels (name and net area) floating over the rooms of
// the active storey, as HTML that follows the camera, like the dimension
// labels in dims.js. They share the Measures toggle and click to select.
import * as THREE from "three";
import { M } from "./scene.js";
import { roomLabel, formatArea } from "./rooms.js";

const LIFT = 110; // cm above the floor

export class RoomLabels {
  constructor(app) {
    this.app = app;
    this.host = document.querySelector("#room-labels");
    this.items = []; // {el, anchor}
    this.host.addEventListener("click", (e) => {
      const el = e.target.closest("[data-room]");
      if (el) app.select(el.dataset.room);
    });
  }
  /** Rebuild the labels from the active storey's rooms. */
  refresh() {
    const app = this.app;
    this.host.innerHTML = "";
    this.items = [];
    if (!app.dims.enabled || app.editor?.active || app.walk?.active) return;
    const b = app.building(), s = app.storey();
    if (!s.visible) return;
    const pairs = app.roomsOf(s);
    const group = app.buildingGroups.get(b.id);
    if (!group || !pairs.length) return;
    group.updateMatrixWorld(true);
    for (const { face, room } of pairs) {
      const el = document.createElement("div");
      el.className = `room-label ${app.state.selection === room.id ? "selected" : ""}`;
      el.dataset.room = room.id;
      el.innerHTML = `<span class="rn"></span><span class="ra"></span>`;
      el.querySelector(".rn").textContent = roomLabel(room, s, app.t);
      el.querySelector(".ra").textContent = formatArea(face.area, app.lang);
      this.host.append(el);
      const y = app.roomFloorY(b, s, face) + LIFT;
      const anchor = new THREE.Vector3(face.labelPoint[0] * M, y * M, face.labelPoint[1] * M).applyMatrix4(group.matrixWorld);
      this.items.push({ el, anchor });
    }
    this.update();
  }
  /** Reposition the labels (called every rendered frame). */
  update() {
    if (!this.items.length) return;
    const cam = this.app.scene.camera;
    const r = this.app.scene.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    for (const { el, anchor } of this.items) {
      v.copy(anchor).project(cam);
      const behind = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2;
      el.hidden = behind;
      if (behind) continue;
      el.style.left = `${((v.x + 1) / 2) * r.width}px`;
      el.style.top = `${((1 - v.y) / 2) * r.height}px`;
    }
  }
}
