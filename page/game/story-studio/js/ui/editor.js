import { parseDocument, formatErrors } from '../script/schema.js';
import { t } from '../i18n.js';

// The JSON panel. The whole authoring loop is paste, run, read the error,
// fix, so the error list is the feature: it reports every problem at once,
// each with the field path that caused it, instead of stopping at the first.

export class Editor {
  constructor(root, { onApply }) {
    this.root = root;
    this.textarea = root.querySelector('.ss-editor-text');
    this.status = root.querySelector('.ss-editor-status');
    this.onApply = onApply;
    this.original = '';

    root.querySelector('.ss-editor-apply').addEventListener('click', () => this.apply());
    root.querySelector('.ss-editor-revert').addEventListener('click', () => this.revert());
    this.textarea.addEventListener('input', () => this.check());
    // Tab should indent, not leave the field: this is a code editor for the
    // length of the session, and losing your place on every Tab is hostile.
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b, value } = this.textarea;
      this.textarea.value = `${value.slice(0, a)}  ${value.slice(b)}`;
      this.textarea.selectionStart = this.textarea.selectionEnd = a + 2;
      this.check();
    });
  }

  load(doc) {
    this.original = JSON.stringify(doc, null, 2);
    this.textarea.value = this.original;
    this.check();
  }

  revert() {
    this.textarea.value = this.original;
    this.check();
  }

  check() {
    const res = parseDocument(this.textarea.value);
    this.report(res.ok ? [] : res.errors);
    return res;
  }

  report(errors) {
    this.status.innerHTML = '';
    if (!errors.length) {
      this.status.className = 'ss-editor-status is-ok';
      this.status.textContent = t('valid');
      return;
    }
    this.status.className = 'ss-editor-status is-bad';
    const title = document.createElement('strong');
    title.textContent = `${t('problems')} (${errors.length})`;
    this.status.appendChild(title);
    const list = document.createElement('ul');
    for (const line of formatErrors(errors).slice(0, 20)) {
      const li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    }
    this.status.appendChild(list);
  }

  async apply() {
    const res = this.check();
    if (!res.ok) return;
    const outcome = await this.onApply(res.doc);
    if (outcome?.errors?.length) this.report(outcome.errors);
  }
}
