/* Smart Note — Markdown <-> HTML and HTML normalisation. */
window.SNMarkdown = (function () {
  const CALLOUT_ICONS = ['💡', '⚠️', '✅', '❌', 'ℹ️', '📌', '🔥', '⭐'];
  function preText(pre) {
    let out = '';
    const walk = (n) => n.childNodes.forEach((c) => { if (c.nodeType === 3) out += c.nodeValue; else if (c.nodeType === 1) { if (c.tagName === 'BR') out += '\n'; else walk(c); } });
    walk(pre);
    return out.replace(/\n$/, '');
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const attr = (s) => esc(s).replace(/'/g, '&#39;');

  /* ---------------- Markdown -> HTML ---------------- */
  function inline(md) {
    let s = esc(md);
    const codes = [];
    s = s.replace(/`([^`\n]+)`/g, (m, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, alt, src) => `<img src="${attr(src)}" alt="${attr(alt)}">`);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (m, text, href) => {
      const page = href.match(/^smartnote:\/\/page\/([A-Za-z0-9_-]+)$/);
      if (page) return `<a class="plink" data-page="${attr(page[1])}" href="#">${text}</a>`;
      return `<a href="${attr(href)}">${text}</a>`;
    });
    s = s.replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, '<b>$2</b>');
    s = s.replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?!\w)/g, '$1<i>$2</i>');
    s = s.replace(/(^|[^_\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, '$1<i>$2</i>');
    s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>');
    s = s.replace(/&lt;(\/?)(u|sub|sup|br|mark|kbd)&gt;/g, '<$1$2>');
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) => `${pre}<a href="${attr(url)}">${url}</a>`);
    s = s.replace(/ {2,}\n/g, '<br>').replace(/\n/g, '<br>');
    s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => `<code>${codes[+i]}</code>`);
    return s;
  }

  function parseTable(lines, start) {
    const rows = [];
    let i = start;
    const splitRow = (line) => {
      let l = line.trim();
      if (l.startsWith('|')) l = l.slice(1);
      if (l.endsWith('|')) l = l.slice(0, -1);
      return l.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
    };
    const sep = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;
    if (!(i + 1 < lines.length && lines[i].includes('|') && sep.test(lines[i + 1]))) return null;
    const header = splitRow(lines[i]);
    i += 2;
    while (i < lines.length && lines[i].trim() && lines[i].includes('|')) { rows.push(splitRow(lines[i])); i++; }
    const cols = Math.max(header.length, ...rows.map((r) => r.length));
    const cell = (tag, txt) => `<${tag}>${inline(txt || '') || '<br>'}</${tag}>`;
    let html = '<table class="tbl"><tbody><tr>';
    for (let c = 0; c < cols; c++) html += cell('th', header[c]);
    html += '</tr>';
    rows.forEach((r) => { html += '<tr>'; for (let c = 0; c < cols; c++) html += cell('td', r[c]); html += '</tr>'; });
    html += '</tbody></table>';
    return { html, next: i };
  }

  function parseList(lines, start, baseIndent) {
    // Returns {html, next}. Handles nested lists by indentation and to-dos.
    const itemRe = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
    let i = start;
    const first = lines[i].match(itemRe);
    const ordered = /\d/.test(first[2]);
    const indent = first[1].length;
    const items = [];
    while (i < lines.length) {
      const m = lines[i].match(itemRe);
      if (!m) break;
      if (m[1].length < indent) break;
      if (m[1].length > indent) {
        const sub = parseList(lines, i, m[1].length);
        if (items.length) items[items.length - 1].children += sub.html;
        else items.push({ text: '', children: sub.html });
        i = sub.next;
        continue;
      }
      items.push({ text: m[3], children: '' });
      i++;
      // continuation lines (indented, not a new item)
      while (i < lines.length && lines[i].trim() && !itemRe.test(lines[i]) && /^\s{2,}/.test(lines[i])) {
        items[items.length - 1].text += '\n' + lines[i].trim();
        i++;
      }
    }
    const todo = items.every((it) => /^\[( |x|X)\]\s*/.test(it.text)) && items.length;
    let html = '';
    if (todo) {
      items.forEach((it) => {
        const m = it.text.match(/^\[( |x|X)\]\s*([\s\S]*)$/);
        const checked = m[1].toLowerCase() === 'x';
        html += `<div class="todo"${checked ? ' data-checked="1"' : ''}>${inline(m[2]) || '<br>'}</div>`;
        if (it.children) html += it.children;
      });
      return { html, next: i };
    }
    html = ordered ? '<ol>' : '<ul>';
    items.forEach((it) => { html += `<li>${inline(it.text) || '<br>'}${it.children}</li>`; });
    html += ordered ? '</ol>' : '</ul>';
    return { html, next: i };
  }

  function toHtml(md) {
    const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    let html = '';
    let i = 0;
    let para = [];
    const flush = () => { if (para.length) { html += `<p>${inline(para.join('\n'))}</p>`; para = []; } };
    while (i < lines.length) {
      const line = lines[i];
      const t = line.trim();
      if (!t) { flush(); i++; continue; }
      let m;
      if ((m = t.match(/^```(\w*)\s*$/))) {
        flush();
        const buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
        i++;
        html += `<pre${m[1] ? ` data-lang="${attr(m[1])}"` : ''}>${esc(buf.join('\n'))}${buf.length ? '' : '<br>'}</pre>`;
        continue;
      }
      if ((m = t.match(/^(#{1,6})\s+(.*)$/))) { flush(); const lvl = Math.min(3, m[1].length); html += `<h${lvl}>${inline(m[2].replace(/\s+#+$/, ''))}</h${lvl}>`; i++; continue; }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); html += '<hr contenteditable="false">'; i++; continue; }
      if ((m = line.match(/^(\s*)([-*+]|\d+[.)])\s+/))) { flush(); const r = parseList(lines, i, m[1].length); html += r.html; i = r.next; continue; }
      if (t.startsWith('>')) {
        flush();
        const buf = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) { buf.push(lines[i].trim().replace(/^>\s?/, '')); i++; }
        const text = buf.join('\n');
        const icon = CALLOUT_ICONS.find((ic) => text.startsWith(ic));
        if (icon) html += `<div class="callout" data-icon="${icon}">${inline(text.slice(icon.length).trim())}</div>`;
        else html += `<blockquote>${inline(text)}</blockquote>`;
        continue;
      }
      if (t.includes('|')) { const r = parseTable(lines, i); if (r) { flush(); html += r.html; i = r.next; continue; } }
      if ((m = t.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/))) {
        flush();
        html += `<figure class="img" contenteditable="false" data-w="100" data-align="center"><img src="${attr(m[2])}" alt="${attr(m[1])}"><figcaption contenteditable="true">${inline(m[1])}</figcaption></figure>`;
        i++; continue;
      }
      if ((m = t.match(/^\[📄\s*([^\]]*)\]\(smartnote:\/\/page\/([A-Za-z0-9_-]+)\)$/))) {
        flush();
        html += `<div class="page-link" contenteditable="false" data-page="${attr(m[2])}"><span class="pl-icon">📄</span><span class="pl-title">${inline(m[1])}</span></div>`;
        i++; continue;
      }
      para.push(line.replace(/^\s+/, ''));
      i++;
    }
    flush();
    return html || '<p><br></p>';
  }

  /* ---------------- HTML -> Markdown ---------------- */
  function inlineMd(node) {
    let out = '';
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { out += n.nodeValue.replace(/\n/g, ' '); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      const inner = () => inlineMd(n);
      switch (tag) {
        case 'BR': out += '  \n'; break;
        case 'B': case 'STRONG': { const t = inner(); out += t.trim() ? `**${t}**` : t; break; }
        case 'I': case 'EM': { const t = inner(); out += t.trim() ? `*${t}*` : t; break; }
        case 'S': case 'STRIKE': case 'DEL': { const t = inner(); out += t.trim() ? `~~${t}~~` : t; break; }
        case 'U': out += `<u>${inner()}</u>`; break;
        case 'SUB': case 'SUP': case 'MARK': case 'KBD': out += `<${tag.toLowerCase()}>${inner()}</${tag.toLowerCase()}>`; break;
        case 'CODE': out += '`' + n.textContent + '`'; break;
        case 'A': {
          const t = inner();
          if (n.dataset.page) out += `[${t}](smartnote://page/${n.dataset.page})`;
          else out += `[${t}](${n.getAttribute('href') || ''})`;
          break;
        }
        case 'IMG': out += `![${n.getAttribute('alt') || ''}](${n.getAttribute('src') || ''})`; break;
        case 'SPAN': case 'FONT': {
          const t = inner();
          const st = n.style || {};
          if (st.fontWeight === 'bold' || +st.fontWeight >= 600) out += `**${t}**`;
          else if (st.fontStyle === 'italic') out += `*${t}*`;
          else out += t;
          break;
        }
        default: out += inner();
      }
    });
    return out;
  }

  function listMd(list, depth, lines) {
    const ordered = list.tagName === 'OL';
    let n = 1;
    Array.from(list.children).forEach((li) => {
      if (li.tagName !== 'LI') return;
      const own = li.cloneNode(true);
      const subs = Array.from(own.querySelectorAll(':scope > ul, :scope > ol'));
      subs.forEach((s) => s.remove());
      const text = inlineMd(own).replace(/\s*\n\s*/g, ' ').trim();
      lines.push(`${'  '.repeat(depth)}${ordered ? `${n++}.` : '-'} ${text}`);
      Array.from(li.children).forEach((c) => { if (c.tagName === 'UL' || c.tagName === 'OL') listMd(c, depth + 1, lines); });
    });
  }

  function toMarkdown(root) {
    const out = [];
    Array.from(root.children).forEach((el) => {
      const tag = el.tagName;
      if (tag === 'H1' || tag === 'H2' || tag === 'H3') { out.push(`${'#'.repeat(+tag[1])} ${inlineMd(el).trim()}`); return; }
      if (tag === 'P') { out.push(inlineMd(el).trim()); return; }
      if (tag === 'UL' || tag === 'OL') { const lines = []; listMd(el, 0, lines); out.push(lines.join('\n')); return; }
      if (tag === 'BLOCKQUOTE') { out.push(inlineMd(el).trim().split(/ {2}\n|\n/).map((l) => `> ${l.trim()}`).join('\n')); return; }
      if (tag === 'PRE') { out.push('```' + (el.dataset.lang || '') + '\n' + preText(el) + '\n```'); return; }
      if (tag === 'HR') { out.push('---'); return; }
      if (tag === 'FIGURE') {
        const img = el.querySelector('img');
        const cap = el.querySelector('figcaption');
        out.push(`![${(cap ? cap.textContent : img && img.alt) || ''}](${img ? img.getAttribute('src') || '' : ''})`);
        return;
      }
      if (tag === 'TABLE') {
        const rows = Array.from(el.querySelectorAll('tr')).map((tr) => Array.from(tr.children).map((c) => inlineMd(c).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim()));
        if (!rows.length) return;
        const cols = Math.max(...rows.map((r) => r.length));
        const line = (r) => `| ${Array.from({ length: cols }, (_, i) => r[i] || '').join(' | ')} |`;
        const md = [line(rows[0]), `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`, ...rows.slice(1).map(line)];
        out.push(md.join('\n'));
        return;
      }
      if (tag === 'DIV' && el.classList.contains('todo')) {
        // consecutive to-dos are grouped by the blank-line join below, so merge them here
        const line = `- [${el.dataset.checked ? 'x' : ' '}] ${inlineMd(el).trim()}`;
        const prev = out[out.length - 1];
        if (prev !== undefined && /^- \[[ x]\] /.test(prev) && el.previousElementSibling && el.previousElementSibling.classList.contains('todo')) out[out.length - 1] = prev + '\n' + line;
        else out.push(line);
        return;
      }
      if (tag === 'DIV' && el.classList.contains('callout')) { out.push(`> ${el.dataset.icon || '💡'} ${inlineMd(el).trim().split(/ {2}\n|\n/).join('\n> ')}`); return; }
      if (tag === 'DIV' && el.classList.contains('page-link')) {
        const t = el.querySelector('.pl-title');
        out.push(`[📄 ${t ? t.textContent : ''}](smartnote://page/${el.dataset.page || ''})`);
        return;
      }
      const text = inlineMd(el).trim();
      if (text) out.push(text);
    });
    return out.join('\n\n') + '\n';
  }

  function toText(root) {
    const out = [];
    Array.from(root.children).forEach((el) => {
      if (el.tagName === 'HR') { out.push('----------'); return; }
      if (el.tagName === 'TABLE') { out.push(Array.from(el.querySelectorAll('tr')).map((tr) => Array.from(tr.children).map((c) => c.textContent.trim()).join('\t')).join('\n')); return; }
      if (el.tagName === 'UL' || el.tagName === 'OL') { out.push(Array.from(el.querySelectorAll('li')).map((li) => `• ${li.textContent.trim()}`).join('\n')); return; }
      if (el.classList.contains('todo')) { out.push(`[${el.dataset.checked ? 'x' : ' '}] ${el.textContent.trim()}`); return; }
      if (el.tagName === 'FIGURE') { const c = el.querySelector('figcaption'); out.push(`[image${c && c.textContent.trim() ? ': ' + c.textContent.trim() : ''}]`); return; }
      out.push(el.innerText !== undefined ? el.innerText.trim() : el.textContent.trim());
    });
    return out.join('\n\n') + '\n';
  }

  /* ---------------- HTML normalisation (import / paste) ---------------- */
  const INLINE_OK = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'CODE', 'A', 'BR', 'SPAN', 'SUB', 'SUP', 'MARK', 'KBD', 'IMG', 'FONT']);
  const STYLE_OK = ['font-family', 'font-size', 'color', 'background-color', 'font-weight', 'font-style', 'text-decoration', 'text-align'];

  function cleanInline(node, out) {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      let tag = n.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return;
      if (!INLINE_OK.has(tag)) {
        if (tag === 'INPUT') return;
        // block inside inline context: flatten
        cleanInline(n, out);
        return;
      }
      if (tag === 'STRONG') tag = 'B';
      if (tag === 'EM') tag = 'I';
      if (tag === 'STRIKE' || tag === 'DEL') tag = 'S';
      if (tag === 'FONT') tag = 'SPAN';
      const el = document.createElement(tag.toLowerCase());
      if (tag === 'A') {
        const href = n.getAttribute('href') || '';
        if (n.dataset.page) { el.dataset.page = n.dataset.page; el.className = 'plink'; el.setAttribute('href', '#'); }
        else if (/^(https?:|mailto:|tel:|#|\/|\.)/i.test(href)) el.setAttribute('href', href);
        else el.setAttribute('href', href.replace(/^\s*javascript:.*$/i, '#'));
      }
      if (tag === 'IMG') {
        const src = n.getAttribute('src') || '';
        if (!/^(https?:|data:image\/|blob:)/i.test(src)) return;
        el.setAttribute('src', src);
        if (n.getAttribute('alt')) el.setAttribute('alt', n.getAttribute('alt'));
        if (n.dataset.asset) el.dataset.asset = n.dataset.asset;
      }
      if (tag === 'SPAN' || tag === 'B' || tag === 'I') {
        const st = n.style;
        if (n.tagName === 'FONT') {
          if (n.getAttribute('face')) el.style.fontFamily = n.getAttribute('face');
          if (n.getAttribute('color')) el.style.color = n.getAttribute('color');
        }
        if (st) STYLE_OK.forEach((p) => { const v = st.getPropertyValue(p); if (v && p !== 'text-align') el.style.setProperty(p, v); });
        if (tag === 'SPAN' && !el.getAttribute('style')) { cleanInline(n, out); return; }
      }
      if (tag === 'BR') { out.appendChild(el); return; }
      cleanInline(n, el);
      if (tag !== 'IMG' && !el.childNodes.length) return;
      out.appendChild(el);
    });
  }

  function makeBlock(tag, src, cls) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    cleanInline(src, el);
    if (src.style && src.style.textAlign && ['center', 'right'].includes(src.style.textAlign)) el.style.textAlign = src.style.textAlign;
    if (!el.childNodes.length) el.innerHTML = '<br>';
    return el;
  }

  function cleanList(list) {
    const out = document.createElement(list.tagName.toLowerCase());
    const todos = [];
    Array.from(list.children).forEach((li) => {
      if (li.tagName !== 'LI') return;
      const cb = li.querySelector(':scope > input[type="checkbox"], :scope > label > input[type="checkbox"], :scope > p > input[type="checkbox"]');
      if (cb || li.classList.contains('task-list-item')) {
        const d = document.createElement('div');
        d.className = 'todo';
        if (cb && cb.checked) d.dataset.checked = '1';
        if (cb) cb.remove();
        cleanInline(li, d);
        if (!d.childNodes.length) d.innerHTML = '<br>';
        todos.push(d);
        return;
      }
      const item = document.createElement('li');
      const subs = [];
      Array.from(li.childNodes).forEach((c) => {
        if (c.nodeType === 1 && (c.tagName === 'UL' || c.tagName === 'OL')) subs.push(cleanList(c));
        else if (c.nodeType === 1 && (c.tagName === 'P' || c.tagName === 'DIV')) { if (item.childNodes.length) item.appendChild(document.createElement('br')); cleanInline(c, item); }
        else cleanInline({ childNodes: [c] }, item);
      });
      if (!item.childNodes.length) item.innerHTML = '<br>';
      subs.forEach((s) => item.appendChild(s));
      out.appendChild(item);
    });
    if (todos.length && !out.children.length) { const frag = document.createDocumentFragment(); todos.forEach((t) => frag.appendChild(t)); return frag; }
    if (todos.length) { const frag = document.createDocumentFragment(); frag.appendChild(out); todos.forEach((t) => frag.appendChild(t)); return frag; }
    return out;
  }

  function makeFigure(src, alt, cap) {
    const fig = document.createElement('figure');
    fig.className = 'img';
    fig.setAttribute('contenteditable', 'false');
    fig.dataset.w = '100';
    fig.dataset.align = 'center';
    const img = document.createElement('img');
    img.setAttribute('src', src);
    if (alt) img.setAttribute('alt', alt);
    fig.appendChild(img);
    const fc = document.createElement('figcaption');
    fc.setAttribute('contenteditable', 'true');
    fc.textContent = cap || '';
    fig.appendChild(fc);
    return fig;
  }

  function cleanBlocks(parent, out) {
    Array.from(parent.childNodes).forEach((n) => {
      if (n.nodeType === 3) {
        if (!n.nodeValue.trim()) return;
        const p = document.createElement('p');
        p.textContent = n.nodeValue.replace(/\s+/g, ' ');
        out.appendChild(p);
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'META' || tag === 'LINK' || tag === 'TITLE' || tag === 'HEAD') return;
      if (/^H[1-6]$/.test(tag)) { out.appendChild(makeBlock(`h${Math.min(3, +tag[1])}`, n)); return; }
      if (tag === 'P') {
        const onlyImg = n.children.length === 1 && n.children[0].tagName === 'IMG' && !n.textContent.trim();
        if (onlyImg) { const img = n.children[0]; const src = img.getAttribute('src') || ''; if (/^(https?:|data:image\/|blob:)/i.test(src)) out.appendChild(makeFigure(src, img.getAttribute('alt'), '')); return; }
        out.appendChild(makeBlock('p', n));
        return;
      }
      if (tag === 'UL' || tag === 'OL') { out.appendChild(cleanList(n)); return; }
      if (tag === 'BLOCKQUOTE') {
        const text = n.textContent.trim();
        const icon = CALLOUT_ICONS.find((ic) => text.startsWith(ic));
        const el = makeBlock('div', n, icon ? 'callout' : null);
        if (icon) { el.dataset.icon = icon; const first = el.firstChild; if (first && first.nodeType === 3) first.nodeValue = first.nodeValue.replace(icon, '').replace(/^\s+/, ''); out.appendChild(el); return; }
        const bq = document.createElement('blockquote');
        while (el.firstChild) bq.appendChild(el.firstChild);
        out.appendChild(bq);
        return;
      }
      if (tag === 'PRE') { const pre = document.createElement('pre'); pre.textContent = preText(n); if (!pre.textContent) pre.innerHTML = '<br>'; if (n.dataset.lang) pre.dataset.lang = n.dataset.lang; out.appendChild(pre); return; }
      if (tag === 'HR') { const hr = document.createElement('hr'); hr.setAttribute('contenteditable', 'false'); out.appendChild(hr); return; }
      if (tag === 'IMG') { const src = n.getAttribute('src') || ''; if (/^(https?:|data:image\/|blob:)/i.test(src)) { const f = makeFigure(src, n.getAttribute('alt'), ''); if (n.dataset.asset) f.dataset.asset = n.dataset.asset; out.appendChild(f); } return; }
      if (tag === 'FIGURE') {
        const img = n.querySelector('img');
        if (!img) { cleanBlocks(n, out); return; }
        const src = img.getAttribute('src') || '';
        if (!/^(https?:|data:image\/|blob:)/i.test(src) && !n.dataset.asset) return;
        const cap = n.querySelector('figcaption');
        const f = makeFigure(src, img.getAttribute('alt'), cap ? cap.textContent : '');
        if (n.dataset.asset) f.dataset.asset = n.dataset.asset;
        if (n.dataset.w) f.dataset.w = n.dataset.w;
        if (n.dataset.align) f.dataset.align = n.dataset.align;
        out.appendChild(f);
        return;
      }
      if (tag === 'TABLE') {
        const table = document.createElement('table');
        table.className = 'tbl';
        const tbody = document.createElement('tbody');
        Array.from(n.querySelectorAll('tr')).forEach((tr) => {
          const row = document.createElement('tr');
          Array.from(tr.children).forEach((c) => { if (c.tagName === 'TD' || c.tagName === 'TH') row.appendChild(makeBlock(c.tagName.toLowerCase(), c)); });
          if (row.children.length) tbody.appendChild(row);
        });
        if (!tbody.children.length) return;
        table.appendChild(tbody);
        out.appendChild(table);
        return;
      }
      if (tag === 'DIV' && n.classList.contains('todo')) { const d = makeBlock('div', n, 'todo'); if (n.dataset.checked) d.dataset.checked = '1'; out.appendChild(d); return; }
      if (tag === 'DIV' && n.classList.contains('callout')) { const d = makeBlock('div', n, 'callout'); d.dataset.icon = n.dataset.icon || '💡'; out.appendChild(d); return; }
      if (tag === 'DIV' && n.classList.contains('page-link')) {
        const d = document.createElement('div');
        d.className = 'page-link';
        d.setAttribute('contenteditable', 'false');
        d.dataset.page = n.dataset.page || '';
        const t = n.querySelector('.pl-title');
        d.innerHTML = `<span class="pl-icon">📄</span><span class="pl-title">${esc(t ? t.textContent : n.textContent)}</span>`;
        out.appendChild(d);
        return;
      }
      const hasBlockChild = Array.from(n.children).some((c) => !INLINE_OK.has(c.tagName));
      if (hasBlockChild || tag === 'BODY' || tag === 'HTML' || tag === 'ARTICLE' || tag === 'SECTION' || tag === 'MAIN' || tag === 'TBODY' || tag === 'LI' || tag === 'DETAILS') {
        cleanBlocks(n, out);
        return;
      }
      const p = makeBlock('p', n);
      if (p.textContent.trim() || p.querySelector('img')) out.appendChild(p);
    });
  }

  function normalizeHtml(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const out = document.createElement('div');
    cleanBlocks(doc.body, out);
    return out.innerHTML;
  }

  return { toHtml, toMarkdown, toText, normalizeHtml, inline, preText, CALLOUT_ICONS, esc };
})();
