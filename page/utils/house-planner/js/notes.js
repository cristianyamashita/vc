// Notes: text pins on any surface (project.notes, world cm). Each pin is an
// HTML label that follows the camera (projected every rendered frame, like
// the dimension labels): a numbered colour dot, the text and a done box.
import * as THREE from "three";
import { M } from "./scene.js";

export class Notes {
  constructor(app) {
    this.app = app;
    this.host = document.querySelector("#notes");
    this.pins = []; // {el, note, anchor}
    this.host.addEventListener("click", (e) => this.onClick(e));
    this.host.addEventListener("change", (e) => {
      const box = e.target.closest("input[data-done]");
      if (!box) return;
      const found = app.locate(box.dataset.done);
      if (!found) return;
      app.checkpoint();
      found.item.done = box.checked;
      app.changed({ rebuild: "none" });
    });
  }
  onClick(e) {
    if (e.target.closest("input")) return;
    const pin = e.target.closest("[data-note]");
    if (!pin) return;
    e.stopPropagation();
    const id = pin.dataset.note;
    this.app.select(id, { keepTool: this.app.state.tool === "note" });
  }
  /** Rebuild the pins from the project (after any change). */
  render() {
    const app = this.app;
    const notes = app.editor?.active ? [] : app.project.notes || [];
    this.host.innerHTML = "";
    this.pins = notes.map((n, i) => {
      const el = document.createElement("div");
      el.className = `note-pin ${n.done ? "done" : ""} ${app.state.selection === n.id ? "selected" : ""}`;
      el.dataset.note = n.id;
      el.style.setProperty("--pin", n.color);
      const dot = document.createElement("span");
      dot.className = "pin-dot";
      dot.textContent = String(i + 1);
      const text = document.createElement("span");
      text.className = "pin-text";
      text.textContent = n.text || app.t("note");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = n.done;
      box.dataset.done = n.id;
      box.title = app.t("noteDone");
      el.append(dot, text, box);
      el.hidden = true;
      this.host.append(el);
      return { el, note: n, anchor: new THREE.Vector3(n.at[0] * M, n.at[1] * M, n.at[2] * M) };
    });
    this.update();
    app.scene.requestRender();
  }
  /** Reposition the pins (called every rendered frame). */
  update() {
    if (!this.pins.length) return;
    const cam = this.app.scene.camera;
    const r = this.app.scene.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    for (const { el, anchor } of this.pins) {
      v.copy(anchor).project(cam);
      const behind = v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2;
      el.hidden = behind;
      if (behind) continue;
      el.style.left = `${((v.x + 1) / 2) * r.width}px`;
      el.style.top = `${((1 - v.y) / 2) * r.height}px`;
    }
  }
}
