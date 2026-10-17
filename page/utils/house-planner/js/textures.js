// Custom textures: the "My textures" dialog (pick an image, name it, set
// the tile size), the IndexedDB rows behind it and a grouped texture
// select shared by every panel. Images are resized to at most 1024 px on
// a canvas and stored as blobs; at runtime they are registered in the
// texture index under `custom-tex-…` ids.
import { textureIndex, textureGroups, registerCustomTexture, unregisterCustomTexture, isCustomTexture } from "./materials.js";
import { registerTextureId, unregisterTextureId, uid, CUSTOM_TEXTURE_PREFIX } from "./schema.js";
import { invalidateAllGeometry } from "./props.js";
import { clearThumbs } from "./thumbs.js";
import * as store from "./store.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const MAX_SIZE = 1024;

/** Fill a <select> with the texture ids: optional "solid colour", built-ins, then "My textures". */
export function fillTextureSelect(sel, { value = "", lang = "en", t = (k) => k, none = true } = {}) {
  sel.innerHTML = "";
  const groups = textureGroups();
  if (none) sel.append(new Option(t("solidColor"), ""));
  for (const id of groups.builtin) sel.append(new Option(textureIndex[id].name[lang] || id, id));
  if (groups.custom.length) {
    const og = document.createElement("optgroup");
    og.label = t("myTextures");
    for (const id of groups.custom) og.append(new Option(textureIndex[id].name[lang] || id, id));
    sel.append(og);
  }
  sel.value = value && textureIndex[value] ? value : none ? "" : groups.builtin[0] || "";
  return sel;
}
/**
 * A texture select with a "+" button that opens the texture dialog and
 * applies the new texture to the select. onChange(id|null).
 */
export function textureControl(app, { value = null, none = true, onChange, disabled = false, small = false } = {}) {
  const wrap = document.createElement("span");
  wrap.className = "texwrap";
  const sel = document.createElement("select");
  fillTextureSelect(sel, { value: value || "", lang: app.lang, t: app.t, none });
  sel.disabled = disabled;
  if (small) sel.classList.add("small");
  sel.addEventListener("change", () => onChange(sel.value === "" ? null : sel.value));
  const add = document.createElement("button");
  add.type = "button";
  add.className = "mini texadd";
  add.textContent = "+";
  add.title = app.t("addTexture");
  add.disabled = disabled;
  add.addEventListener("click", (e) => {
    e.preventDefault();
    app.textures.open({
      onPick: (id) => {
        fillTextureSelect(sel, { value: id, lang: app.lang, t: app.t, none });
        onChange(id);
      },
    });
  });
  wrap.append(sel, add);
  wrap.select = sel;
  return wrap;
}

export class TextureManager {
  constructor(app) {
    this.app = app;
    this.rows = []; // {id, name, tile, blob, updatedAt}
    this.pending = null; // {blob, width, height, kind}
    this.onPick = null;
    this.dialog = $("#texture-dialog");
    this.bind();
  }
  get t() {
    return this.app.t;
  }
  /** Load the saved rows and register them (called once at boot, before the project). */
  async load() {
    try {
      this.rows = await store.listTextures();
    } catch (err) {
      console.warn("textures", err);
      this.rows = [];
    }
    for (const row of this.rows) this.register(row, { quiet: true });
  }
  register(row, { quiet = false } = {}) {
    registerTextureId(row.id);
    registerCustomTexture(row);
    if (!this.rows.includes(row)) {
      const i = this.rows.findIndex((r) => r.id === row.id);
      if (i >= 0) this.rows[i] = row;
      else this.rows.push(row);
    }
    if (!quiet) {
      invalidateAllGeometry();
      clearThumbs();
    }
  }
  unregister(id) {
    unregisterCustomTexture(id);
    unregisterTextureId(id);
    this.rows = this.rows.filter((r) => r.id !== id);
    invalidateAllGeometry();
    clearThumbs();
  }
  /** Rows as export entries {id, name, tile, data}. */
  async exportRows(ids) {
    const out = [];
    for (const row of this.rows) {
      if (!ids.includes(row.id)) continue;
      out.push({ id: row.id, name: row.name, tile: row.tile, data: await store.blobToDataURL(row.blob) });
    }
    return out;
  }
  /** Save and register textures from an imported project (existing ids are kept). */
  async importRows(entries) {
    for (const tx of entries) {
      if (this.rows.some((r) => r.id === tx.id)) continue;
      try {
        const blob = await store.dataURLToBlob(tx.data);
        const row = { id: tx.id, name: tx.name, tile: tx.tile, blob };
        await store.saveTexture(row);
        this.register(row, { quiet: true });
      } catch (err) {
        console.warn("texture import", err);
      }
    }
  }
  // ------------------------------------------------------------ dialog
  bind() {
    const d = this.dialog;
    $("#texture-file", d).addEventListener("change", (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (file) this.handleFile(file);
    });
    $("#texture-save", d).addEventListener("click", () => this.save());
    $("#texture-list", d).addEventListener("click", (e) => {
      const del = e.target.closest("[data-deltex]");
      if (del) return this.remove(del.dataset.deltex);
      const use = e.target.closest("[data-usetex]");
      if (use && this.onPick) {
        this.onPick(use.dataset.usetex);
        this.close();
      }
    });
    d.addEventListener("close", () => {
      this.onPick = null;
      this.clearPending();
    });
  }
  open({ onPick = null } = {}) {
    this.onPick = onPick;
    this.clearPending();
    $("#texture-name", this.dialog).value = "";
    $("#texture-tile", this.dialog).value = 100;
    this.renderList();
    this.dialog.showModal();
  }
  close() {
    this.dialog.close();
  }
  clearPending() {
    this.pending = null;
    const img = $("#texture-preview", this.dialog);
    if (img.src) URL.revokeObjectURL(img.src);
    img.removeAttribute("src");
    img.hidden = true;
    $("#texture-save", this.dialog).disabled = true;
    $("#texture-info", this.dialog).textContent = "";
  }
  renderList() {
    const host = $("#texture-list", this.dialog), t = this.t;
    for (const img of host.querySelectorAll("img[src]")) URL.revokeObjectURL(img.src);
    host.innerHTML = this.rows.length
      ? this.rows
          .map(
            (r) =>
              `<div class="texitem"><img class="texthumb" alt="" src="${URL.createObjectURL(r.blob)}"><span class="texname">${esc(r.name)}</span><span class="texmeta">${Math.round(r.tile)} cm</span>${this.onPick ? `<button class="tb small" data-usetex="${esc(r.id)}">${esc(t("useTexture"))}</button>` : ""}<button class="tb small danger" data-deltex="${esc(r.id)}">${esc(t("delete"))}</button></div>`,
          )
          .join("")
      : `<p class="hint">${esc(t("noTextures"))}</p>`;
  }
  /** Decode, resize to ≤ MAX_SIZE on a canvas and keep the blob pending. */
  async handleFile(file) {
    const t = this.t;
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error("decode"));
        im.src = url;
      });
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const png = file.type === "image/png";
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, png ? "image/png" : "image/jpeg", 0.9));
      if (!blob) throw new Error("encode");
      this.pending = { blob, width: w, height: h };
      const preview = $("#texture-preview", this.dialog);
      if (preview.src) URL.revokeObjectURL(preview.src);
      preview.src = URL.createObjectURL(blob);
      preview.hidden = false;
      $("#texture-info", this.dialog).textContent = `${w} × ${h} px · ${Math.round(blob.size / 1024)} kB`;
      const name = $("#texture-name", this.dialog);
      if (!name.value.trim()) name.value = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 40);
      $("#texture-save", this.dialog).disabled = false;
    } catch (err) {
      console.warn(err);
      this.app.toast(t("textureReadError"));
    }
  }
  async save() {
    const t = this.t, app = this.app;
    if (!this.pending) return;
    const name = $("#texture-name", this.dialog).value.trim() || t("texture");
    const tile = Math.min(2000, Math.max(5, Number($("#texture-tile", this.dialog).value) || 100));
    const row = { id: `${CUSTOM_TEXTURE_PREFIX}${uid("t").slice(2)}`, name: name.slice(0, 60), tile, blob: this.pending.blob };
    try {
      await store.saveTexture(row);
    } catch (err) {
      console.warn(err);
      return app.toast(t("unsaved"));
    }
    this.register(row);
    app.toast(`${t("textureSaved")}: ${row.name}`);
    app.refreshAfterTextures();
    if (this.onPick) {
      this.onPick(row.id);
      this.close();
      return;
    }
    this.clearPending();
    $("#texture-name", this.dialog).value = "";
    this.renderList();
  }
  async remove(id) {
    const t = this.t, app = this.app;
    const row = this.rows.find((r) => r.id === id);
    if (!row || !isCustomTexture(id)) return;
    if (store.usedTextureIds(app.project, app.customProps, [id]).length) return app.toast(t("textureInUse", { name: app.project.name || t("untitled") }));
    const users = (await store.textureUsers(id)).filter((p) => p.id !== app.project.id);
    if (users.length) return app.toast(t("textureInUse", { name: users[0].name || t("untitled") }));
    if (!confirm(t("confirmDeleteTexture", { name: row.name }))) return;
    try {
      await store.deleteTexture(id);
    } catch (err) {
      console.warn(err);
    }
    this.unregister(id);
    this.renderList();
    app.refreshAfterTextures();
  }
}
