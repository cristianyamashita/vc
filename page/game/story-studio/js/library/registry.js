import { validate } from '../script/schema.js';
import { installOutfits } from '../cast/wardrobe.js';
import { listDocuments, getBlob } from './store.js';
import { prepareCharacterModel } from '../cast/skinned.js';

// One place to ask "give me the character called ana". It looks at the
// visitor's own documents first and the shipped ones second, which is what
// makes a library extensible rather than merely browsable: import a character
// whose id is `ana` and every official story that casts Ana now casts yours,
// without editing a single story.

const KINDS = ['outfit', 'character', 'prop', 'set', 'action', 'position', 'story', 'staticStory'];

// Spelled out rather than derived: "story" pluralises to "stories", and a
// naive `kind + "s"` quietly looks for data/storys/ and finds nothing.
const FOLDER = {
  outfit: 'outfits', character: 'characters', prop: 'props', set: 'sets',
  action: 'actions', position: 'positions', story: 'stories', staticStory: 'static-stories',
};

// Two orderings that are not preferences but requirements: a character names
// its outfits, and a story names its actions, and each is checked against the
// library rather than against a list in the code. So outfits come first, the
// things that name them second, and stories last.
const LOAD_ORDER = [['outfit'], ['character', 'prop', 'set', 'action', 'position'], ['story', 'staticStory']];

/** Men and boys first, then women and girls; tallest to shortest within each. */
const MALE_BASES = new Set(['man', 'boy']);
function compareCharacters(a, b) {
  const da = a.doc;
  const db = b.doc;
  const maleA = MALE_BASES.has(da.base) ? 0 : 1;
  const maleB = MALE_BASES.has(db.base) ? 0 : 1;
  if (maleA !== maleB) return maleA - maleB;
  const ha = da.height ?? 0;
  const hb = db.height ?? 0;
  if (hb !== ha) return hb - ha;
  return String(da.id).localeCompare(String(db.id));
}

const DATA = new URL('../../data/', import.meta.url);

export class Registry {
  constructor() {
    this.official = new Map();    // kind -> Map(id -> doc)
    this.user = new Map();
    for (const kind of KINDS) {
      this.official.set(kind, new Map());
      this.user.set(kind, new Map());
    }
    this.problems = [];
  }

  /** Loads the shipped library from `data/index.json`. */
  async loadOfficial(onProgress = () => {}) {
    let index;
    try {
      // Revalidate the catalogue so newly shipped entries appear on reload,
      // even when the host gives JSON files a long cache lifetime.
      const res = await fetch(new URL('index.json', DATA), { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      index = await res.json();
    } catch (err) {
      this.problems.push(`could not read data/index.json: ${err.message}`);
      return this;
    }

    const fileCount = KINDS.reduce((count, kind) => count + (index[FOLDER[kind]] || []).length, 0);
    const modelCount = (index[FOLDER.character] || []).length;
    const total = 1 + fileCount + modelCount;
    let completed = 1;
    onProgress(completed / total);

    for (const phase of LOAD_ORDER) {
      const jobs = [];
      for (const kind of phase) {
        for (const file of index[FOLDER[kind]] || []) {
          jobs.push(this.loadOne(kind, file).finally(() => {
            completed++;
            onProgress(completed / total);
          }));
        }
      }
      await Promise.all(jobs);
      // Installed as soon as the phase that carries them is in, because the
      // very next phase validates characters against this book.
      if (phase.includes('outfit')) this.syncOutfits();
    }
    await this.prepareModels(() => {
      completed++;
      onProgress(completed / total);
    });
    onProgress(1);
    return this;
  }

  async prepareModels(onProgress = () => {}) {
    await Promise.all(this.list('character').map(async ({ doc }) => {
      try { await prepareCharacterModel(doc); }
      catch (err) {
        this.problems.push(`${doc.id}: ${err.message} (voxel fallback)`);
      }
      finally { onProgress(); }
    }));
  }

  /** Hands the loaded outfits to the wardrobe, which is where every part of
   *  the app that dresses somebody looks them up. Imports and deletions call
   *  it again through `loadUser`. */
  syncOutfits() {
    const book = new Map(this.official.get('outfit') ?? []);
    for (const [id, doc] of this.user.get('outfit') ?? []) book.set(id, doc);
    installOutfits(book);
  }

  async loadOne(kind, file) {
    try {
      const res = await fetch(new URL(`${FOLDER[kind]}/${file}`, DATA), { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      // Shipped content goes through the same validator as an import. If a
      // hand-edited official file drifts from the schema, it should say so
      // here rather than fail obscurely three layers down.
      const { ok, doc, errors } = validate(raw, { actions: this.actionMap(), positions: this.positionMap() });
      if (!ok) {
        this.problems.push(`data/${FOLDER[kind]}/${file}: ${errors[0].path} ${errors[0].message}`);
        return;
      }
      if (doc.kind !== kind) {
        this.problems.push(`data/${FOLDER[kind]}/${file}: document says kind "${doc.kind}"`);
        return;
      }
      this.official.get(kind).set(doc.id, doc);
    } catch (err) {
      this.problems.push(`data/${FOLDER[kind]}/${file}: ${err.message}`);
    }
  }

  /** Loads whatever the visitor has saved. Safe to call again after an import. */
  async loadUser() {
    for (const kind of KINDS) this.user.get(kind).clear();
    let docs = [];
    try {
      docs = await listDocuments();
    } catch (_err) {
      return this;                  // storage blocked: official content only
    }
    for (const doc of docs) {
      if (this.user.has(doc.kind)) this.user.get(doc.kind).set(doc.id, doc);
    }
    this.syncOutfits();
    await this.prepareModels();
    return this;
  }

  /** Every action the app can currently perform, the visitor's own included.
   *  This is what a story is validated against. */
  actionMap() {
    const out = new Map(this.official.get('action') ?? []);
    for (const [id, doc] of this.user.get('action') ?? []) out.set(id, doc);
    return out;
  }

  positionMap() {
    const out = new Map(this.official.get('position') ?? []);
    for (const [id, doc] of this.user.get('position') ?? []) out.set(id, doc);
    return out;
  }

  libraryOptions() {
    return { actions: this.actionMap(), positions: this.positionMap() };
  }

  action(id) {
    return this.get('action', id);
  }

  get(kind, id) {
    return this.user.get(kind)?.get(id) ?? this.official.get(kind)?.get(id) ?? null;
  }

  has(kind, id) {
    return !!this.get(kind, id);
  }

  /** Everything of one kind, each tagged with where it came from and whether
   *  it shadows a shipped document of the same id. */
  list(kind) {
    const out = [];
    const official = this.official.get(kind) ?? new Map();
    const user = this.user.get(kind) ?? new Map();
    for (const [id, doc] of official) {
      if (!user.has(id)) out.push({ doc, source: 'official', overridden: false });
    }
    for (const [id, doc] of user) {
      out.push({ doc, source: 'user', overridden: official.has(id) });
    }
    if (kind === 'character') return out.sort(compareCharacters);
    return out.sort((a, b) => a.doc.id.localeCompare(b.doc.id));
  }

  character(id) {
    return this.get('character', id);
  }

  prop(id) {
    return this.get('prop', id);
  }

  outfit(id) {
    return this.get('outfit', id);
  }

  blob(id) {
    return getBlob(id);
  }
}
