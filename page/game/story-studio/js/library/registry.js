import { validate } from '../script/schema.js';
import { listDocuments, getBlob } from './store.js';

// One place to ask "give me the character called ana". It looks at the
// visitor's own documents first and the shipped ones second, which is what
// makes a library extensible rather than merely browsable: import a character
// whose id is `ana` and every official story that casts Ana now casts yours,
// without editing a single story.

const KINDS = ['character', 'prop', 'set', 'story'];

// Spelled out rather than derived: "story" pluralises to "stories", and a
// naive `kind + "s"` quietly looks for data/storys/ and finds nothing.
const FOLDER = { character: 'characters', prop: 'props', set: 'sets', story: 'stories' };

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
  async loadOfficial() {
    let index;
    try {
      const res = await fetch(new URL('index.json', DATA));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      index = await res.json();
    } catch (err) {
      this.problems.push(`could not read data/index.json: ${err.message}`);
      return this;
    }

    const jobs = [];
    for (const kind of KINDS) {
      for (const file of index[FOLDER[kind]] || []) {
        jobs.push(this.loadOne(kind, file));
      }
    }
    await Promise.all(jobs);
    return this;
  }

  async loadOne(kind, file) {
    try {
      const res = await fetch(new URL(`${FOLDER[kind]}/${file}`, DATA));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      // Shipped content goes through the same validator as an import. If a
      // hand-edited official file drifts from the schema, it should say so
      // here rather than fail obscurely three layers down.
      const { ok, doc, errors } = validate(raw);
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
    return this;
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
    return out.sort((a, b) => a.doc.id.localeCompare(b.doc.id));
  }

  character(id) {
    return this.get('character', id);
  }

  prop(id) {
    return this.get('prop', id);
  }

  blob(id) {
    return getBlob(id);
  }
}
