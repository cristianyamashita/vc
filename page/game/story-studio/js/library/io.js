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

// A copy is marked in every language at once, not just the one the page
// happens to be showing: the document travels, and a Portuguese reader
// opening an English author's copy should still see that it is one.
const COPY_SUFFIX = { en: ' (copy)', pt: ' (cópia)', ja: '（コピー）' };
const MAX_ID = 64;                        // LIMITS.idLength in the schema

/** A duplicate of `doc`, under an id nothing is using yet.
 *
 *  Duplicating is how you start from something that already works — take the
 *  official gym story, give it your own cast — so the copy has to be a
 *  separate document rather than an override: same id would shadow the
 *  original everywhere instead of sitting beside it.
 *
 *  References inside are left exactly as they are. A copied story still uses
 *  the same characters and set, which is the point; copying `ana` does not
 *  recast the stories that name her. */
export function copyOf(doc, registry) {
  const copy = JSON.parse(JSON.stringify(doc));
  copy.id = freeId(doc.kind, doc.id, registry);
  copy.name = {};
  for (const lang of Object.keys(COPY_SUFFIX)) {
    const base = doc.name?.[lang] || doc.name?.en || doc.id;
    copy.name[lang] = `${base}${COPY_SUFFIX[lang]}`;
  }
  return copy;
}

/** `chair` → `chair-copy` → `chair-copy-2`… The number only appears from the
 *  second copy on, because `-copy-1` reads like there is a `-copy-0`. */
function freeId(kind, from, registry) {
  const stem = `${from}-copy`.replace(/(-copy)+$/, '-copy').slice(0, MAX_ID - 3);
  if (!registry.has(kind, stem)) return stem;
  for (let n = 2; n < 500; n += 1) {
    const candidate = `${stem}-${n}`;
    if (!registry.has(kind, candidate)) return candidate;
  }
  return `${stem}-${Date.now().toString(36)}`.slice(0, MAX_ID);
}

/** A story plus every custom character, outfit, prop and set it leans on, so
 *  a scene can be shared as one file instead of "import these six in this
 *  order". */
export function bundleFor(story, registry) {
  const wanted = new Map();
  const add = (kind, id) => {
    if (!id || wanted.has(`${kind}:${id}`)) return;
    const doc = registry.get(kind, id);
    if (doc) wanted.set(`${kind}:${id}`, doc);
  };

  add('set', story.set);
  for (const c of story.cast) {
    add('character', c.character);
    // The clothes are documents too, and a cast bundled without them arrives
    // somewhere else dressed in the fallback cut.
    const doc = registry.get('character', c.character);
    for (const w of doc?.wardrobe || []) {
      if (typeof w.outfit === 'string') add('outfit', w.outfit);
    }
  }
  const setDoc = registry.get('set', story.set);
  for (const pl of setDoc?.props || []) add('prop', pl.prop);
  for (const e of story.setEdits) if (e.op === 'add') add('prop', e.prop);
  // Only the actions this story is not shipped with: bundling all thirty
  // would bury the story under boilerplate every time.
  for (const e of story.timeline) {
    const doc = registry.get('action', e.do);
    if (doc && registry.list('action').some((x) => x.doc === doc && x.source === 'user')) {
      add('action', e.do);
    }
    for (const pr of doc?.props || []) add('prop', pr.prop);
  }
  for (const c of story.cast) if (c.holds) add('prop', c.holds);

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
export function readText(source, actions) {
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
  const res = parseDocument(source, { actions });
  if (!res.ok) return { ok: false, documents: [], errors: res.errors };
  if (res.doc.kind === 'bundle') return { ok: true, documents: res.doc.documents, errors: [] };
  return { ok: true, documents: [res.doc], errors: [] };
}

export async function readFile(file, actions) {
  if (file.size > MAX_IMPORT_BYTES) {
    return { ok: false, documents: [], errors: [{ path: '', message: 'file is larger than 4 MB' }] };
  }
  return readText(await file.text(), actions);
}

/** Saves documents into the visitor's library. */
export async function saveAll(documents, actions) {
  const saved = [];
  // Actions first, so a story saved in the same breath can be checked
  // against the ones arriving with it.
  const known = new Map(actions || []);
  for (const doc of documents) if (doc.kind === 'action') known.set(doc.id, doc);
  for (const doc of documents) {
    const res = validate(doc, { actions: known });
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
