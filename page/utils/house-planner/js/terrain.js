// Heightmap terrain. The document stores (resolution+1)² heights in cm, row
// by Z then X, centred on the origin. The mesh is in metres. Buildings may
// clamp the ground under their slabs (a "foundation") without touching the
// stored heights: `setClamp` gives a function (xcm, zcm) -> max height.
import * as THREE from "three";
import { TriplanarMaterial, textureIndex, textureTile } from "./materials.js";
import { M } from "./scene.js";
import { pointInPolygon } from "./geom.js";

// Pools cut the ground: the terrain shaders discard fragments inside the
// pool polygons (world metres), in the colour pass and in the shadow pass.
const CUT_MAX = 160, CUT_POLYS = 8;
const CUT_PARS = /* glsl */ `
uniform vec2 uCutPts[${CUT_MAX}];
uniform int uCutStart[${CUT_POLYS}];
uniform int uCutLen[${CUT_POLYS}];
uniform int uCutCount;
varying vec3 vCutPos;
bool cutInside( vec2 p ) {
  for ( int k = 0; k < ${CUT_POLYS}; k ++ ) {
    if ( k >= uCutCount ) break;
    int start = uCutStart[ k ];
    int len = uCutLen[ k ];
    bool inside = false;
    for ( int i = 0; i < ${CUT_MAX}; i ++ ) {
      if ( i >= len ) break;
      vec2 a = uCutPts[ start + i ];
      vec2 b = uCutPts[ start + ( i + 1 == len ? 0 : i + 1 ) ];
      if ( ( a.y > p.y ) != ( b.y > p.y ) && p.x < ( b.x - a.x ) * ( p.y - a.y ) / ( b.y - a.y ) + a.x ) inside = ! inside;
    }
    if ( inside ) return true;
  }
  return false;
}
`;
function withCut(mat, cut, key) {
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    base?.call(mat, shader, renderer);
    shader.uniforms.uCutPts = cut.pts;
    shader.uniforms.uCutStart = cut.start;
    shader.uniforms.uCutLen = cut.len;
    shader.uniforms.uCutCount = cut.count;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCutPos;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvCutPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${CUT_PARS}`)
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif ( uCutCount > 0 && cutInside( vCutPos.xz ) ) discard;");
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

export class Terrain {
  constructor() {
    this.mesh = null;
    this.doc = null;
    this.clamp = null;
    this.cutPolys = [];
    this.cut = {
      pts: { value: new Float32Array(CUT_MAX * 2) },
      start: { value: new Int32Array(CUT_POLYS) },
      len: { value: new Int32Array(CUT_POLYS) },
      count: { value: 0 },
    };
    this.depthMaterial = withCut(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), this.cut, "depth-cut");
  }
  build(doc) {
    this.doc = doc;
    const n = doc.resolution;
    const positions = new Float32Array((n + 1) * (n + 1) * 3);
    const indices = [];
    for (let z = 0; z <= n; z++)
      for (let x = 0; x <= n; x++) {
        const i = (z * (n + 1) + x) * 3;
        positions[i] = (x / n - 0.5) * doc.width * M;
        positions[i + 1] = 0;
        positions[i + 2] = (z / n - 0.5) * doc.depth * M;
      }
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const a = z * (n + 1) + x, b = a + 1, c = a + n + 1, d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    this.dispose();
    this.mesh = new THREE.Mesh(geo, this.material());
    this.mesh.customDepthMaterial = this.depthMaterial;
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.mesh.userData = { kind: "terrain", id: "terrain" };
    this.mesh.name = "terrain";
    this.update();
    return this.mesh;
  }
  material() {
    const id = textureIndex[this.doc.material] ? this.doc.material : null;
    const color = new THREE.Color(this.doc.tint || "#ffffff").getHex();
    const m = id
      ? new TriplanarMaterial({ textureId: id, tile: textureTile(id), color, roughness: 1, metalness: textureIndex[id].metal || 0 })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
    return withCut(m, this.cut, id ? "triplanar-cut" : "standard-cut");
  }
  refreshMaterial() {
    if (!this.mesh) return;
    this.mesh.material.dispose();
    this.mesh.material = this.material();
  }
  /** Polygons (world cm) where the ground is not drawn (pools). */
  setCutouts(polys) {
    const { pts, start, len } = this.cut;
    pts.value.fill(0);
    this.cutPolys = [];
    let k = 0;
    for (const poly of polys) {
      const n = this.cutPolys.length;
      if (n >= CUT_POLYS || poly.length < 3 || k + poly.length > CUT_MAX) continue;
      start.value[n] = k;
      len.value[n] = poly.length;
      for (const [x, z] of poly) {
        pts.value[k * 2] = x * M;
        pts.value[k * 2 + 1] = z * M;
        k++;
      }
      this.cutPolys.push(poly);
    }
    this.cut.count.value = this.cutPolys.length;
  }
  /** Is this world cm point inside a cut-out (pool)? */
  isCut(x, z) {
    return this.cutPolys.some((p) => pointInPolygon(x, z, p));
  }
  /** Returns true when any shown height changed. */
  setClamp(fn) {
    this.clamp = fn;
    return this.update();
  }
  /** Displayed height (cm) at a vertex index: stored height limited by the clamp. */
  shownHeight(x, z) {
    const n = this.doc.resolution;
    const h = this.doc.heights[z * (n + 1) + x];
    if (!this.clamp) return h;
    const px = (x / n - 0.5) * this.doc.width, pz = (z / n - 0.5) * this.doc.depth;
    return Math.min(h, this.clamp(px, pz));
  }
  /** Push stored heights (and clamp) into the mesh; true when anything moved. */
  update() {
    if (!this.mesh) return false;
    const n = this.doc.resolution;
    const pos = this.mesh.geometry.attributes.position;
    const prev = this.shown && this.shown.length === (n + 1) * (n + 1) ? this.shown : null;
    this.shown = new Float32Array((n + 1) * (n + 1));
    let changed = !prev;
    for (let z = 0; z <= n; z++)
      for (let x = 0; x <= n; x++) {
        const k = z * (n + 1) + x;
        const h = this.shownHeight(x, z);
        if (prev && prev[k] !== h) changed = true;
        this.shown[k] = h;
        pos.setY(k, h * M);
      }
    if (!changed) return false;
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();
    this.mesh.geometry.computeBoundingBox();
    return true;
  }
  /** Bilinear displayed height (cm) at world cm coordinates. */
  heightAt(xcm, zcm) {
    const t = this.doc;
    if (!t || !this.shown) return 0;
    const n = t.resolution;
    const u = Math.max(0, Math.min(n, (xcm / t.width + 0.5) * n));
    const v = Math.max(0, Math.min(n, (zcm / t.depth + 0.5) * n));
    const ix = Math.min(n - 1, Math.floor(u)), iz = Math.min(n - 1, Math.floor(v));
    const fx = u - ix, fz = v - iz, k = iz * (n + 1) + ix;
    const h00 = this.shown[k], h10 = this.shown[k + 1], h01 = this.shown[k + n + 1], h11 = this.shown[k + n + 2];
    return fx + fz <= 1 ? h00 + (h10 - h00) * fx + (h01 - h00) * fz : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
  }
  /** Lowest displayed height (cm) inside a rectangle of world cm. */
  minHeightIn(x0, z0, x1, z1) {
    let min = Infinity;
    const steps = 6;
    for (let i = 0; i <= steps; i++)
      for (let j = 0; j <= steps; j++) min = Math.min(min, this.heightAt(x0 + ((x1 - x0) * i) / steps, z0 + ((z1 - z0) * j) / steps));
    return Number.isFinite(min) ? min : 0;
  }
  /**
   * Apply a brush at world cm (px, pz). `base` is the heights array at the
   * start of the stroke (so repeated moves within a stroke do not compound
   * the smoothing), `mode` raise|lower|flatten|smooth.
   */
  brush(px, pz, { radius, strength, mode, target = 0, base }) {
    const t = this.doc, n = t.resolution;
    const src = base || t.heights;
    let touched = false;
    for (let z = 0; z <= n; z++)
      for (let x = 0; x <= n; x++) {
        const vx = (x / n - 0.5) * t.width, vz = (z / n - 0.5) * t.depth;
        const d = Math.hypot(vx - px, vz - pz);
        if (d > radius) continue;
        const k = z * (n + 1) + x;
        const weight = 0.5 + 0.5 * Math.cos((d / radius) * Math.PI);
        const cur = t.heights[k];
        let next = cur;
        if (mode === "raise" || mode === "lower") next = cur + strength * weight * (mode === "raise" ? 1 : -1) * 0.25;
        else if (mode === "flatten") next = cur + (target - cur) * weight * 0.35;
        else if (mode === "smooth") {
          let sum = 0, count = 0;
          for (let dz = -1; dz <= 1; dz++)
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx, zz = z + dz;
              if (xx < 0 || xx > n || zz < 0 || zz > n) continue;
              sum += src[zz * (n + 1) + xx];
              count++;
            }
          next = cur + (sum / count - cur) * weight * 0.4;
        }
        next = Math.max(-5000, Math.min(5000, next));
        if (next !== cur) {
          t.heights[k] = Math.round(next * 10) / 10;
          touched = true;
        }
      }
    if (touched) this.update();
    return touched;
  }
  /** Change grid size, resampling heights bilinearly. */
  resample(width, depth, resolution) {
    const old = { ...this.doc, heights: this.doc.heights.slice() };
    const shownBackup = this.shown;
    const clamp = this.clamp;
    this.clamp = null;
    this.shown = Float32Array.from(old.heights);
    const next = new Array((resolution + 1) ** 2);
    for (let z = 0; z <= resolution; z++)
      for (let x = 0; x <= resolution; x++) {
        const px = (x / resolution - 0.5) * width, pz = (z / resolution - 0.5) * depth;
        next[z * (resolution + 1) + x] = Math.abs(px) <= old.width / 2 && Math.abs(pz) <= old.depth / 2 ? Math.round(this.heightAt(px, pz) * 10) / 10 : 0;
      }
    this.shown = shownBackup;
    this.clamp = clamp;
    this.doc.width = width;
    this.doc.depth = depth;
    this.doc.resolution = resolution;
    this.doc.heights = next;
  }
  dispose() {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh = null;
    }
  }
}
