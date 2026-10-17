// Textures and materials. Walls, slabs and terrain have no useful UVs, so
// textures are projected from the world axes (triplanar, after story-studio
// js/stage/materials.js) at `tile` metres per repeat. Until a texture
// arrives a 1×1 white stand-in is sampled, so nothing renders black.
import * as THREE from "three";

export const TEXTURE_ROOT = new URL("../../../assets/house-planner/textures/", import.meta.url).href;
export const textureIndex = {}; // id -> {name:{en,pt,ja}, tile, metal}

export async function loadTextureIndex() {
  try {
    const res = await fetch(`${TEXTURE_ROOT}index.json`);
    Object.assign(textureIndex, await res.json());
  } catch {
    /* index missing: tiles default to 2 m */
  }
  return textureIndex;
}
export const textureIds = () => Object.keys(textureIndex);
export const textureTile = (id) => textureIndex[id]?.tile || 2;

const loader = new THREE.TextureLoader();
function solid(r, g, b, colorSpace) {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  tex.colorSpace = colorSpace;
  tex.needsUpdate = true;
  return tex;
}
const WHITE = solid(255, 255, 255, THREE.SRGBColorSpace);
const FLAT_NORMAL = solid(128, 128, 255, THREE.NoColorSpace);
const slots = new Map();
let onTextureReady = () => {};
export function setTextureReadyCallback(fn) {
  onTextureReady = fn;
}
function loadMap(id, file, colorSpace) {
  return new Promise((resolve, reject) => {
    loader.load(
      `${TEXTURE_ROOT}${id}/${file}`,
      (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = colorSpace;
        tex.anisotropy = 4;
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}
function slotFor(id) {
  let slot = slots.get(id);
  if (slot) return slot;
  slot = { map: { value: WHITE }, normalMap: { value: FLAT_NORMAL }, ready: false, loading: null };
  slots.set(id, slot);
  slot.loading = Promise.all([loadMap(id, "color.jpg", THREE.SRGBColorSpace), loadMap(id, "normal.jpg", THREE.NoColorSpace)])
    .then(([map, normalMap]) => {
      slot.map.value = map;
      slot.normalMap.value = normalMap;
      slot.ready = true;
      onTextureReady(id);
    })
    .catch(() => {
      slot.ready = false;
    });
  return slot;
}
export const textureLoaded = (id) => (textureIndex[id] ? slotFor(id).loading : Promise.resolve());

const VERTEX_PARS = /* glsl */ `
varying vec3 vTriPos;
varying vec3 vTriNrm;
`;
const VERTEX_WORLD = /* glsl */ `
#include <worldpos_vertex>
{
  vec4 triWorld = vec4( transformed, 1.0 );
  vTriPos = ( modelMatrix * triWorld ).xyz;
  vTriNrm = normalize( mat3( modelMatrix ) * objectNormal );
}
`;
const FRAGMENT_PARS = /* glsl */ `
uniform sampler2D uTriMap;
uniform sampler2D uTriNormal;
uniform float uTriTile;
uniform float uTriNormalScale;
varying vec3 vTriPos;
varying vec3 vTriNrm;
vec3 triWeights( vec3 n ) {
  vec3 w = abs( n );
  w = w * w * w * w;
  return w / ( w.x + w.y + w.z );
}
`;
const MAP_FRAGMENT = /* glsl */ `
vec3 triN = normalize( vTriNrm );
vec3 triW = triWeights( triN );
vec3 triSign = vec3( triN.x < 0.0 ? -1.0 : 1.0, triN.y < 0.0 ? -1.0 : 1.0, triN.z < 0.0 ? -1.0 : 1.0 );
vec2 triUvX = vTriPos.zy / uTriTile;
vec2 triUvY = vTriPos.xz / uTriTile;
vec2 triUvZ = vTriPos.xy / uTriTile;
triUvX.x *= triSign.x;
triUvY.x *= triSign.y;
triUvZ.x *= -triSign.z;
{
  vec4 triColor = texture2D( uTriMap, triUvX ) * triW.x
    + texture2D( uTriMap, triUvY ) * triW.y
    + texture2D( uTriMap, triUvZ ) * triW.z;
  diffuseColor *= triColor;
}
`;
const NORMAL_FRAGMENT = /* glsl */ `
{
  vec3 triWn = inverseTransformDirection( normal, viewMatrix );
  vec3 tnX = texture2D( uTriNormal, triUvX ).xyz * 2.0 - 1.0;
  vec3 tnY = texture2D( uTriNormal, triUvY ).xyz * 2.0 - 1.0;
  vec3 tnZ = texture2D( uTriNormal, triUvZ ).xyz * 2.0 - 1.0;
  tnX.xy *= uTriNormalScale;
  tnY.xy *= uTriNormalScale;
  tnZ.xy *= uTriNormalScale;
  tnX.x *= triSign.x;
  tnY.x *= triSign.y;
  tnZ.x *= -triSign.z;
  tnX = vec3( tnX.xy + triWn.zy, abs( tnX.z ) * triWn.x );
  tnY = vec3( tnY.xy + triWn.xz, abs( tnY.z ) * triWn.y );
  tnZ = vec3( tnZ.xy + triWn.xy, abs( tnZ.z ) * triWn.z );
  vec3 triWorldN = normalize( tnX.zyx * triW.x + tnY.xzy * triW.y + tnZ.xyz * triW.z );
  normal = normalize( ( viewMatrix * vec4( triWorldN, 0.0 ) ).xyz );
}
`;

export class TriplanarMaterial extends THREE.MeshStandardMaterial {
  constructor(params = {}) {
    const { textureId = null, tile = 2, normalScale = 0.8, ...rest } = params;
    super(rest);
    this.isTriplanarMaterial = true;
    this._textureId = textureId;
    this._slot = slotFor(textureId);
    this._tile = { value: Math.max(0.05, tile) };
    this._normalScale = { value: normalScale };
  }
  get textureId() {
    return this._textureId;
  }
  copy(source) {
    super.copy(source);
    this._textureId = source._textureId;
    this._slot = source._slot;
    this._tile = { value: source._tile.value };
    this._normalScale = { value: source._normalScale.value };
    return this;
  }
  customProgramCacheKey() {
    return "triplanar";
  }
  onBeforeCompile(shader) {
    shader.uniforms.uTriMap = this._slot.map;
    shader.uniforms.uTriNormal = this._slot.normalMap;
    shader.uniforms.uTriTile = this._tile;
    shader.uniforms.uTriNormalScale = this._normalScale;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_PARS}`)
      .replace("#include <worldpos_vertex>", VERTEX_WORLD);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAGMENT_PARS}`)
      .replace("#include <map_fragment>", MAP_FRAGMENT)
      .replace("#include <normal_fragment_maps>", NORMAL_FRAGMENT);
  }
}

const cache = new Map();
/**
 * Shared material for a surface: a texture id (or none) and a tint.
 * `vertexColors` multiplies baked part colours in (props); plain surfaces
 * must not use it (a geometry without colours reads as black).
 */
export function surfaceMaterial({ material = null, tint = null, vertexColors = false, roughness = 0.9, offset = 0 } = {}) {
  const id = textureIndex[material] ? material : null;
  const colorHex = new THREE.Color(tint || "#ffffff").getHex();
  const key = `${id}|${colorHex}|${vertexColors ? "v" : ""}|${roughness}|${offset}`;
  let m = cache.get(key);
  if (m) return m;
  if (id) {
    m = new TriplanarMaterial({
      textureId: id,
      tile: textureTile(id),
      color: colorHex,
      vertexColors,
      roughness: 1,
      metalness: textureIndex[id].metal || 0,
    });
  } else {
    m = new THREE.MeshStandardMaterial({ color: colorHex, vertexColors, roughness, metalness: 0 });
  }
  if (offset) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -offset;
    m.polygonOffsetUnits = -offset;
  }
  m.userData.shared = true;
  cache.set(key, m);
  return m;
}
export function glassMaterial(tint = "#bcd8e6", opacity = 0.35) {
  const key = `glass|${tint}|${opacity}`;
  let m = cache.get(key);
  if (m) return m;
  m = new THREE.MeshPhysicalMaterial({
    color: tint,
    transparent: true,
    opacity,
    roughness: 0.15,
    metalness: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  m.userData.shared = true;
  cache.set(key, m);
  return m;
}
/** Translucent pool water (shared). */
export function waterMaterial(tint = "#2d9cc4") {
  const key = `water|${tint}`;
  let m = cache.get(key);
  if (m) return m;
  m = new THREE.MeshPhysicalMaterial({ color: tint, transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
  m.userData.shared = true;
  cache.set(key, m);
  return m;
}
/** Transparent material for part groups of a prop (vertex colours). */
export function partGlassMaterial(opacity) {
  const key = `partglass|${opacity}`;
  let m = cache.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity, roughness: 0.4, depthWrite: false });
  m.userData.shared = true;
  cache.set(key, m);
  return m;
}
export function ghostMaterial(color = "#008f7d") {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false });
}
