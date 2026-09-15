import { t, localised } from '../i18n.js';

// The library tabs, one per kind. Official and imported documents sit in the
// same list on purpose: the point of the format is that they are the same
// kind of thing, and a visitor's chair should not live in a second-class
// section.

export const TABS = [
  { kind: 'staticStory', labelKey: 'staticStories' },
  { kind: 'story', labelKey: 'stories' },
  { kind: 'character', labelKey: 'characters' },
  { kind: 'prop', labelKey: 'props' },
  { kind: 'set', labelKey: 'sets' },
  { kind: 'outfit', labelKey: 'outfits' },
  { kind: 'position', labelKey: 'positions' },
  { kind: 'action', labelKey: 'actions' },
];

/** Tabs that put user edits first, then A–Z, and expose a search field. */
const RANKED_TABS = new Set(['prop', 'set', 'outfit', 'position', 'action']);

/** Stable URL hashes so a reload reopens the same library tab. */
const TAB_HASH = {
  staticStory: 'static-stories',
  story: 'stories',
  character: 'characters',
  prop: 'props',
  set: 'sets',
  outfit: 'outfits',
  position: 'positions',
  action: 'actions',
};
const HASH_TAB = Object.fromEntries(Object.entries(TAB_HASH).map(([kind, hash]) => [hash, kind]));

function tabFromHash(hash = location.hash) {
  const slug = String(hash || '').replace(/^#/, '').trim().toLowerCase();
  return HASH_TAB[slug] || null;
}

function writeTabHash(kind) {
  const slug = TAB_HASH[kind];
  if (!slug) return;
  const next = `#${slug}`;
  if (location.hash === next) return;
  history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
}

function entryLabel(doc) {
  return localised(doc.name, doc.id);
}

function compareRanked(a, b) {
  if (a.source !== b.source) return a.source === 'user' ? -1 : 1;
  const byName = entryLabel(a.doc).localeCompare(entryLabel(b.doc), undefined, { sensitivity: 'base' });
  if (byName) return byName;
  return String(a.doc.id).localeCompare(String(b.doc.id));
}

function matchesFilter(entry, query) {
  if (!query) return true;
  const name = entryLabel(entry.doc).toLowerCase();
  const id = String(entry.doc.id).toLowerCase();
  return name.includes(query) || id.includes(query);
}

function summarise(doc) {
  if (doc.kind === 'staticStory') {
    return `${doc.pages.length} ${t('pagesLabel').toLowerCase()} · ${doc.pages[0]?.set || '—'}`;
  }
  if (doc.kind === 'position') {
    return doc.pose || 'stand';
  }
  if (doc.kind === 'story') {
    return `${doc.cast.length} ${t('castLabel').toLowerCase()} · ${doc.timeline.length} ${t('actionsLabel').toLowerCase()}`;
  }
  if (doc.kind === 'character') {
    // `child` still appears in documents written before boys and girls were
    // separate plans, and it reads as a boy everywhere else, so it labels the
    // same way here rather than showing nothing.
    const base = { man: 'baseMan', woman: 'baseWoman', boy: 'baseBoy', girl: 'baseGirl', child: 'baseBoy' }[doc.base];
    const h = doc.height ? `${doc.height.toFixed(2)} m` : '';
    const hair = doc.look?.hairStyle;
    return [base ? t(base) : '', h, hair, `${doc.wardrobe.length} ${t('outfits').toLowerCase()}`]
      .filter(Boolean).join(' · ');
  }
  if (doc.kind === 'prop') {
    const anchors = Object.keys(doc.anchors);
    return [doc.source?.type, anchors.length ? `${t('anchors').toLowerCase()}: ${anchors.join(', ')}` : '']
      .filter(Boolean).join(' · ');
  }
  if (doc.kind === 'outfit') {
    const cut = doc.cut;
    const paints = `${doc.paints.length} ${t('fitPaints').toLowerCase()}`;
    const cells = doc.paints.reduce((n, p) => n + Object.keys(p.spray || {}).length, 0);
    return [`${cut.top} · ${cut.legs} · ${cut.feet}`, paints,
      cells ? t('fitSprayed', { n: String(cells) }) : ''].filter(Boolean).join(' · ');
  }
  if (doc.kind === 'action') {
    if (doc.category === 'group') {
      return `${t('groupAction')} · ${doc.roles.map((r) => r.id).join(' + ')}`;
    }
    const len = doc.reps ? `${doc.period}s × ${t('reps').toLowerCase()}`
      : doc.duration ? `${doc.duration}s` : '';
    return [t('soloAction'), doc.type, len].filter(Boolean).join(' · ');
  }
  return `${doc.props.length} ${t('props').toLowerCase()} · ${doc.sky}`;
}

export class LibraryView {
  constructor(root, { registry, onOpen, onExport, onExportGlb, onExportBundle, onEdit, onVisualEdit, onStoryEdit, onDuplicate, onDelete, onNewProp, onNewAction, onNewStaticStory, onNewPosition }) {
    this.root = root;
    this.registry = registry;
    this.handlers = { onOpen, onExport, onExportGlb, onExportBundle, onEdit, onVisualEdit, onStoryEdit, onDuplicate, onDelete, onNewProp, onNewAction, onNewStaticStory, onNewPosition };
    this.tab = tabFromHash() || 'staticStory';
    this.filter = '';
    this.tabsEl = root.querySelector('.ss-tabs');
    this.filterEl = root.querySelector('.ss-lib-filter');
    this.filterWrap = root.querySelector('.ss-lib-toolbar');
    this.listEl = root.querySelector('.ss-list');

    this.tabsEl.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-kind]');
      if (!button) return;
      this.selectTab(button.dataset.kind);
    });
    this.filterEl?.addEventListener('input', () => {
      this.filter = this.filterEl.value.trim().toLowerCase();
      this.renderList();
    });
    addEventListener('hashchange', () => {
      const kind = tabFromHash();
      if (!kind || kind === this.tab) return;
      this.selectTab(kind, { writeHash: false });
    });
  }

  selectTab(kind, { writeHash = true } = {}) {
    if (!TAB_HASH[kind]) return;
    if (kind === this.tab) {
      if (writeHash) writeTabHash(kind);
      return;
    }
    this.tab = kind;
    this.filter = '';
    if (this.filterEl) this.filterEl.value = '';
    if (writeHash) writeTabHash(kind);
    this.render();
  }

  render() {
    this.tabsEl.innerHTML = '';
    for (const tab of TABS) {
      const b = document.createElement('button');
      b.dataset.kind = tab.kind;
      b.textContent = t(tab.labelKey);
      b.className = tab.kind === this.tab ? 'is-active' : '';
      b.setAttribute('aria-pressed', String(tab.kind === this.tab));
      this.tabsEl.appendChild(b);
    }
    if (this.tab === 'prop' && this.handlers.onNewProp) {
      const b = document.createElement('button'); b.className = 'ss-new-inline'; b.textContent = `＋ ${t('propNew')}`; b.onclick = this.handlers.onNewProp; this.tabsEl.appendChild(b);
    }

    if (this.tab === 'staticStory' && this.handlers.onNewStaticStory) {
      const b = document.createElement('button'); b.className = 'ss-new-inline'; b.textContent = `＋ ${t('staticNew')}`; b.onclick = this.handlers.onNewStaticStory; this.tabsEl.appendChild(b);
    }
    if (this.tab === 'position' && this.handlers.onNewPosition) {
      const b = document.createElement('button'); b.className = 'ss-new-inline'; b.textContent = `＋ ${t('posNew')}`; b.onclick = this.handlers.onNewPosition; this.tabsEl.appendChild(b);
    }
    if (this.tab === 'action' && this.handlers.onNewAction) {
      const b = document.createElement('button'); b.className = 'ss-new-inline'; b.textContent = `＋ ${t('aeNew')}`; b.onclick = this.handlers.onNewAction; this.tabsEl.appendChild(b);
    }

    const ranked = RANKED_TABS.has(this.tab);
    if (this.filterWrap) this.filterWrap.hidden = !ranked;
    if (this.filterEl) {
      this.filterEl.placeholder = t('libraryFilter');
      this.filterEl.setAttribute('aria-label', t('libraryFilter'));
      if (!ranked) {
        this.filter = '';
        this.filterEl.value = '';
      }
    }

    writeTabHash(this.tab);
    this.renderList();
  }

  renderList() {
    this.listEl.innerHTML = '';
    let entries = this.registry.list(this.tab);
    if (RANKED_TABS.has(this.tab)) {
      entries = [...entries].sort(compareRanked).filter((e) => matchesFilter(e, this.filter));
    }
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'ss-empty';
      empty.textContent = this.filter ? t('libraryFilterEmpty') : t('empty');
      this.listEl.appendChild(empty);
      return;
    }
    for (const entry of entries) this.listEl.appendChild(this.card(entry));
  }

  card({ doc, source, overridden }) {
    const el = document.createElement('article');
    el.className = 'ss-card';

    const head = document.createElement('div');
    head.className = 'ss-card-head';
    const name = document.createElement('h3');
    name.textContent = entryLabel(doc);
    head.appendChild(name);
    const badge = document.createElement('span');
    badge.className = `ss-badge is-${source}`;
    badge.textContent = source === 'user' ? t('mine') : t('official');
    head.appendChild(badge);
    el.appendChild(head);

    const meta = document.createElement('p');
    meta.className = 'ss-meta';
    meta.textContent = summarise(doc);
    el.appendChild(meta);

    if (overridden) {
      const note = document.createElement('p');
      note.className = 'ss-override';
      note.textContent = t('overrides');
      el.appendChild(note);
    }

    const id = document.createElement('code');
    id.className = 'ss-id';
    id.textContent = doc.id;
    el.appendChild(id);

    const actions = document.createElement('div');
    actions.className = 'ss-card-actions';
    const add = (label, className, fn) => {
      const b = document.createElement('button');
      b.className = className;
      b.textContent = label;
      b.addEventListener('click', () => fn(doc));
      actions.appendChild(b);
      return b;
    };
    add((doc.kind === 'story' || doc.kind === 'staticStory') ? t('play') : t('preview'), 'ss-primary', this.handlers.onOpen);
    add(t('edit'), '', this.handlers.onEdit);
    // A set is a floor plan, and typing coordinates is a poor way to lay one
    // out, so it gets the mouse as well as the JSON.
    if ((doc.kind === 'action' && (doc.category === 'group' || ['overlay', 'posture', 'move'].includes(doc.type))) || doc.kind === 'set' || doc.kind === 'outfit' || doc.kind === 'position' || (doc.kind === 'prop' && doc.source?.type === 'boxes')) add(t('visualEdit'), '', this.handlers.onVisualEdit);
    if (doc.kind === 'story' || doc.kind === 'staticStory') add(t('storyEdit'), '', this.handlers.onStoryEdit);
    // Next to Edit, because that is what it is for: a copy is where you edit
    // without losing the thing that already worked.
    add(t('duplicate'), '', this.handlers.onDuplicate);
    add(t('export'), '', this.handlers.onExport);
    if ((doc.kind === 'prop' || doc.kind === 'character') && this.handlers.onExportGlb) add(t('exportGlb'), '', this.handlers.onExportGlb);
    if (doc.kind === 'story' || doc.kind === 'staticStory') add(t('exportBundle'), '', this.handlers.onExportBundle);
    if (source === 'user') add(t('remove'), 'ss-danger', this.handlers.onDelete);
    el.appendChild(actions);
    return el;
  }
}
