import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildGeometry, toHex } from '../render/geometry.js';
import { buildCharacter, disposeCharacter } from '../cast/build.js';
import { getBlob } from './store.js';
import { prepareCharacterModel } from '../cast/skinned.js';

const APP_ROOT = new URL('../../', import.meta.url);

function safeName(value) {
  return String(value || 'object').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'object';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportBoxes(doc) {
  const scene = new THREE.Scene();
  scene.name = doc.id;
  const opacity = doc.opacity ?? 1;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(
    buildGeometry(doc.source.boxes.map((b) => ({ ...b, color: toHex(b.color, 0xa0a0a0) })), true),
    material,
  );
  mesh.name = doc.id;
  scene.add(mesh);
  if (doc.scale && doc.scale !== 1) scene.scale.setScalar(doc.scale);
  if (doc.yaw) scene.rotation.y = (doc.yaw * Math.PI) / 180;

  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(scene, (result) => {
      resolve(new Blob([result], { type: 'model/gltf-binary' }));
    }, reject, { binary: true, onlyVisible: true });
  });
}

async function exportCharacter(doc) {
  await prepareCharacterModel(doc);
  const character = buildCharacter(doc, doc.defaultOutfit);
  const runtimeData = character.userData;
  character.userData = runtimeData.model ? { model: runtimeData.model } : {};
  character.name = doc.id;
  character.traverse((object) => {
    if (!object.isMesh) return;
    if (runtimeData.model) return;
    const source = object.material;
    const hasVertexColors = !!object.geometry.getAttribute('color');
    object.material = new THREE.MeshStandardMaterial({
      color: source?.color?.getHex?.() ?? 0xffffff,
      vertexColors: hasVertexColors,
      roughness: 0.82,
      metalness: 0,
      transparent: (source?.opacity ?? 1) < 1,
      opacity: source?.opacity ?? 1,
      side: source?.side ?? THREE.FrontSide,
    });
  });

  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(character, (result) => {
      character.userData = runtimeData;
      disposeCharacter(character);
      resolve(new Blob([result], { type: 'model/gltf-binary' }));
    }, (error) => {
      character.userData = runtimeData;
      disposeCharacter(character);
      reject(error);
    }, { binary: true, onlyVisible: true });
  });
}

async function sourceBlob(doc) {
  if (doc.source.type === 'gltfBlob') {
    const blob = await getBlob(doc.source.blobId);
    if (!blob) throw new Error(`missing model blob ${doc.source.blobId}`);
    return blob;
  }
  const response = await fetch(new URL(doc.source.file, APP_ROOT));
  if (!response.ok) throw new Error(`could not read model (${response.status})`);
  return response.blob();
}

/** Downloads a prop as a binary GLB. Geometric props are regenerated from
 *  their editable parts, while an already-imported GLB is copied unchanged. */
export async function exportPropGlb(doc) {
  if (doc?.kind !== 'prop' || !doc.source) throw new Error('not an exportable prop');
  const blob = doc.source.type === 'boxes' ? await exportBoxes(doc) : await sourceBlob(doc);
  downloadBlob(blob, `${safeName(doc.id)}.glb`);
  return blob;
}

export async function exportCharacterGlb(doc) {
  if (doc?.kind !== 'character') throw new Error('not an exportable character');
  const blob = await exportCharacter(doc);
  downloadBlob(blob, `${safeName(doc.id)}.glb`);
  return blob;
}

export async function exportDocumentGlb(doc) {
  if (doc?.kind === 'prop') return exportPropGlb(doc);
  if (doc?.kind === 'character') return exportCharacterGlb(doc);
  throw new Error('document kind has no GLB exporter');
}
