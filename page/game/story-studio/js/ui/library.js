import { t, localised } from '../i18n.js';

// The four tabs. Official and imported documents sit in the same list on
// purpose: the point of the format is that they are the same kind of thing,
// and a visitor's chair should not live in a second-class section.

export const TABS = [
  { kind: 'story', labelKey: 'stories' },
  { kind: 'character', labelKey: 'characters' },
  { kind: 'prop', labelKey: 'props' },
  { kind: 'set', labelKey: 'sets' },
];

function summarise(doc) {
  if (doc.kind === 'story') {
    return `${doc.cast.length} ${t('castLabel').toLowerCase()} · ${doc.timeline.length} ${t('actionsLabel').toLowerCase()}`;
  }
  if (doc.kind === 'character') {
    const base = { man: 'baseMan', woman: 'baseWoman', child: 'baseChild' }[doc.base];
    const h = doc.height ? `${doc.height.toFixed(2)} m` : '';
    return [t(base), h, `${doc.wardrobe.length} ${t('outfits').toLowerCase()}`].filter(Boolean).join(' · ');
  }
  if (doc.kind === 'prop') {
    const anchors = Object.keys(doc.anchors);
    return [doc.source?.type, anchors.length ? `${t('anchors').toLowerCase()}: ${anchors.join(', ')}` : '']
      .filter(Boolean).join(' · ');
  }
  return `${doc.props.length} ${t('props').toLowerCase()} · ${doc.sky}`;
}

export class LibraryView {
  constructor(root, { registry, onOpen, onExport, onExportBundle, onEdit, onDelete }) {
    this.root = root;
    this.registry = registry;
    this.handlers = { onOpen, onExport, onExportBundle, onEdit, onDelete };
    this.tab = 'story';
    this.tabsEl = root.querySelector('.ss-tabs');
    this.listEl = root.querySelector('.ss-list');

    this.tabsEl.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-kind]');
      if (!button) return;
      this.tab = button.dataset.kind;
      this.render();
    });
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

    this.listEl.innerHTML = '';
    const entries = this.registry.list(this.tab);
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'ss-empty';
      empty.textContent = t('empty');
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
    name.textContent = localised(doc.name, doc.id);
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
    add(doc.kind === 'story' ? t('play') : t('preview'), 'ss-primary', this.handlers.onOpen);
    add(t('edit'), '', this.handlers.onEdit);
    add(t('export'), '', this.handlers.onExport);
    if (doc.kind === 'story') add(t('exportBundle'), '', this.handlers.onExportBundle);
    if (source === 'user') add(t('remove'), 'ss-danger', this.handlers.onDelete);
    el.appendChild(actions);
    return el;
  }
}
