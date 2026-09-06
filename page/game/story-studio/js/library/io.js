import { parseDocument, validate } from '../script/schema.js';
import { putDocument, deleteDocument, putBlob, deleteBlob, listBlobs } from './store.js';

// Import and export. Both go through the validator, including on the way out:
// exporting a document the app itself could not read back would be a quiet way
// to hand someone a broken file.

const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
const MAX_GLB_BYTES = 12 * 1024 * 1024;

export function toJson(doc) {
  return JSON.stringify(doc, null, 2);
}

/** A story plus every custom character, prop and set it leans on, so a scene
 *  can be shared as one file instead of "import these six in this order". */
export function bundleFor(story, registry) {
  const wanted = new Map();
  const add = (kind, id) => {
    if (!id || wanted.has(`${kind}:${id}`)) return;
    const doc = registry.get(kind, id);
    if (doc) wanted.set(`${kind}:${id}`, doc);
  };

  add('set', story.set);
  for (const c of story.cast) add('character', c.character);
  const setDoc = registry.get('set', story.set);
  for (const pl of setDoc?.props || []) add('prop', pl.prop);
  for (const e of story.setEdits) if (e.op === 'add') add('prop', e.prop);

  return {
    kind: 'bundle',
    version: 1,
    documents: [...wanted.values(), story],
  };
}

/**
 * Reads text into documents, without saving anything.
 * @returns {{ ok, documents: Array, errors: Array }}
 */
export function readText(source) {
  if (typeof source !== 'string') {
    return { ok: false, documents: [], errors: [{ path: '', message: 'expected text' }] };
  }
  if (source.length > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      documents: [],
      errors: [{ path: '', message: `file is ${(source.length / 1048576).toFixed(1)} MB; the limit is 4 MB` }],
    };
  }
  const res = parseDocument(source);
  if (!res.ok) return { ok: false, documents: [], errors: res.errors };
  if (res.doc.kind === 'bundle') return { ok: true, documents: res.doc.documents, errors: [] };
  return { ok: true, documents: [res.doc], errors: [] };
}

export async function readFile(file) {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, documents: [], errors: [{ path: '', message: 'file is larger than 4 MB' }] };
  }
  return readText(await file.text());
}

/** Saves documents into the visitor's library. */
export async function saveAll(documents) {
  const saved = [];
  for (const doc of documents) {
    const res = validate(doc);
    if (!res.ok) continue;
    await putDocument(res.doc);
    saved.push(res.doc);
  }
  return saved;
}

export function removeDocument(kind, id) {
  return deleteDocument(kind, id);
}

/** Stores an uploaded .glb and hands back a prop document that points at it. */
export async function importGlb(file, id, name) {
  if (!/\.glb$/i.test(file.name)) {
    return { ok: false, errors: [{ path: '', message: 'expected a .glb file' }] };
  }
  if (file.size > MAX_GLB_BYTES) {
    return {
      ok: false,
      errors: [{ path: '', message: `model is ${(file.size / 1048576).toFixed(1)} MB; the limit is 12 MB` }],
    };
  }
  const blobId = id;
  await putBlob(blobId, file, { name: file.name, size: file.size });
  const res = validate({
    kind: 'prop',
    version: 1,
    id,
    name: name || file.name.replace(/\.glb$/i, ''),
    source: { type: 'gltfBlob', blobId },
    footprint: [1, 1],
  });
  if (!res.ok) return { ok: false, errors: res.errors };
  await putDocument(res.doc);
  return { ok: true, doc: res.doc, errors: [] };
}

/** Drops blobs nothing points at any more. */
export async function pruneBlobs(registry) {
  const used = new Set();
  for (const entry of registry.list('prop')) {
    if (entry.doc.source?.type === 'gltfBlob') used.add(entry.doc.source.blobId);
  }
  const rows = await listBlobs();
  let removed = 0;
  for (const row of rows) {
    if (!used.has(row.id)) {
      await deleteBlob(row.id);
      removed++;
    }
  }
  return removed;
}

/** Hands the viewer a file. */
export function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
