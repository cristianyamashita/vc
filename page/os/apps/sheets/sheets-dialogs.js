window.OSSheetsDialogs = function (S) {
  const E = S.E;
  const t = S.t;
  const esc = S.escapeHtml;
  const COND_TYPES = ["gt", "gte", "lt", "lte", "between", "eq", "neq", "contains", "starts", "blank", "notblank", "error", "dup", "unique", "top", "bottom", "aboveAvg", "belowAvg", "scale", "bar"];
  const CHART_TYPES = ["column", "bar", "line", "area", "pie", "donut", "scatter"];
  const CHART_COLORS = ["#008f7d", "#2980b9", "#e67e22", "#8e44ad", "#e74c3c", "#27ae60", "#f1c40f", "#1a5276", "#d35400", "#006056"];

  function langIdx() {
    const l = S.lang();
    return l === "pt" ? 4 : l === "ja" ? 5 : 3;
  }
  function field(label, inner) {
    return '<label class="sheets-field">' + esc(label) + inner + "</label>";
  }
  function selectHtml(cls, options, value) {
    return (
      '<select class="' +
      cls +
      '">' +
      options
        .map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (o[0] === value ? " selected" : "") + ">" + esc(o[1]) + "</option>";
        })
        .join("") +
      "</select>"
    );
  }
  function actions(okLabel, extra) {
    return '<div class="sheets-modal-actions">' + (extra || "") + '<button type="button" class="sheets-close-modal">' + esc(t("sheetsClose")) + "</button>" + (okLabel ? '<button type="button" class="sheets-save-confirm">' + esc(okLabel) + "</button>" : "") + "</div>";
  }
  function rangeText() {
    return S.a1Sel();
  }
  function parseRange(text) {
    const parts = String(text || "").trim().replace(/\$/g, "").split(":");
    const a = E.parseA1(parts[0]);
    if (!a) return null;
    const b = parts[1] ? E.parseA1(parts[1]) : a;
    if (!b) return null;
    return { r1: Math.min(a.r, b.r), c1: Math.min(a.c, b.c), r2: Math.max(a.r, b.r), c2: Math.max(a.c, b.c) };
  }
  function rangeToText(rg) {
    return E.a1(rg.r1, rg.c1) + (rg.r1 === rg.r2 && rg.c1 === rg.c2 ? "" : ":" + E.a1(rg.r2, rg.c2));
  }

  function fx(category) {
    const idx = langIdx();
    const cats = ["all", "math", "stat", "logical", "lookup", "text", "date", "info", "finance", "eng"];
    const catLabel = function (c) {
      return c === "all" ? t("sheetsCatAll") : t("sheetsCat" + c.charAt(0).toUpperCase() + c.slice(1));
    };
    const el = S.overlay(
      "<h2>" +
        esc(t("sheetsFx")) +
        "</h2>" +
        '<div class="sheets-row"><input class="sheets-search" placeholder="' +
        esc(t("sheetsFxSearch")) +
        '">' +
        selectHtml("sheets-fx-cat", cats.map(function (c) { return [c, catLabel(c)]; }), category || "all") +
        "</div>" +
        '<div class="sheets-fx-list"></div>' +
        '<div class="sheets-fx-detail"></div>' +
        actions(t("sheetsInsert"))
    );
    const listEl = el.querySelector(".sheets-fx-list");
    const detail = el.querySelector(".sheets-fx-detail");
    const search = el.querySelector(".sheets-search");
    const catSel = el.querySelector(".sheets-fx-cat");
    let current = null;
    function draw() {
      const q = search.value.toLowerCase();
      const cat = catSel.value;
      const items = E.FUNCTION_LIST.filter(function (fn) {
        if (cat !== "all" && fn[1] !== cat) return false;
        return !q || fn[0].toLowerCase().indexOf(q) >= 0 || fn[2].toLowerCase().indexOf(q) >= 0 || String(fn[idx]).toLowerCase().indexOf(q) >= 0;
      });
      listEl.innerHTML = items
        .map(function (fn) {
          return '<button type="button" class="sheets-fx-item' + (current === fn[0] ? " active" : "") + '" data-fn="' + fn[0] + '"><strong>' + esc(fn[0]) + "</strong><span>" + esc(fn[idx]) + "</span></button>";
        })
        .join("");
      if (!current && items.length) select(items[0][0]);
      else if (current) select(current);
    }
    function select(name) {
      current = name;
      const fn = E.FUNCTION_LIST.find(function (f) {
        return f[0] === name;
      });
      listEl.querySelectorAll(".sheets-fx-item").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-fn") === name);
      });
      if (fn) detail.innerHTML = "<strong>" + esc(fn[2]) + "</strong><div>" + esc(fn[idx]) + " · " + esc(catLabel(fn[1])) + "</div>";
    }
    function insert() {
      if (!current) return;
      el.remove();
      const sid = S.sheetId();
      const sel = S.sel;
      const raw = S.editing ? S.editing.value : S.api.getRaw(sid, sel.r, sel.c);
      const next = raw && String(raw).charAt(0) === "=" ? raw + current + "(" : "=" + current + "(";
      if (S.editing) S.commitEdit(next);
      S.startEdit("cell", next);
    }
    search.addEventListener("input", draw);
    catSel.addEventListener("change", draw);
    listEl.addEventListener("click", function (e) {
      const item = e.target.closest(".sheets-fx-item");
      if (item) select(item.getAttribute("data-fn"));
    });
    listEl.addEventListener("dblclick", function (e) {
      if (e.target.closest(".sheets-fx-item")) insert();
    });
    el.querySelector(".sheets-save-confirm").addEventListener("click", insert);
    search.addEventListener("keydown", function (e) {
      if (e.key === "Enter") insert();
    });
    draw();
    search.focus();
  }

  function find(withReplace) {
    const existing = S.root.querySelector(".sheets-panel-find");
    if (existing) existing.remove();
    const panel = document.createElement("div");
    panel.className = "sheets-panel sheets-panel-find";
    panel.innerHTML =
      '<div class="sheets-panel-head"><span>' +
      esc(t(withReplace ? "sheetsReplace" : "sheetsFind")) +
      '</span><button type="button" class="sheets-panel-close">✕</button></div>' +
      '<div class="sheets-panel-body">' +
      '<input class="sheets-find-q" placeholder="' + esc(t("sheetsFindWhat")) + '">' +
      '<input class="sheets-find-r" placeholder="' + esc(t("sheetsReplaceWith")) + '"' + (withReplace ? "" : ' style="display:none"') + ">" +
      '<div class="sheets-panel-opts">' +
      '<label><input type="checkbox" class="sheets-find-case"> ' + esc(t("sheetsMatchCase")) + "</label>" +
      '<label><input type="checkbox" class="sheets-find-whole"> ' + esc(t("sheetsWholeCell")) + "</label>" +
      '<label><input type="checkbox" class="sheets-find-formulas" checked> ' + esc(t("sheetsInFormulas")) + "</label>" +
      '<label><input type="checkbox" class="sheets-find-allsheets"> ' + esc(t("sheetsAllSheets")) + "</label>" +
      "</div>" +
      '<div class="sheets-panel-btns">' +
      '<button type="button" data-find="prev">' + esc(t("sheetsFindPrev")) + "</button>" +
      '<button type="button" data-find="next" class="primary">' + esc(t("sheetsFindNext")) + "</button>" +
      (withReplace ? '<button type="button" data-find="replace">' + esc(t("sheetsReplaceOne")) + "</button>" + '<button type="button" data-find="all">' + esc(t("sheetsReplaceAll")) + "</button>" : '<button type="button" data-find="toggle">' + esc(t("sheetsReplace")) + "</button>") +
      "</div>" +
      '<div class="sheets-panel-msg"></div>' +
      "</div>";
    S.root.querySelector(".sheets-shell").appendChild(panel);
    const q = panel.querySelector(".sheets-find-q");
    const rp = panel.querySelector(".sheets-find-r");
    const msg = panel.querySelector(".sheets-panel-msg");
    function opts() {
      return {
        text: q.value,
        matchCase: panel.querySelector(".sheets-find-case").checked,
        whole: panel.querySelector(".sheets-find-whole").checked,
        formulas: panel.querySelector(".sheets-find-formulas").checked,
        allSheets: panel.querySelector(".sheets-find-allsheets").checked,
      };
    }
    function matches(sid, r, c, o) {
      const raw = String(S.api.getRaw(sid, r, c));
      if (raw === "") return false;
      let hay = o.formulas ? raw : S.api.display(sid, r, c);
      let needle = o.text;
      if (!o.matchCase) {
        hay = hay.toLowerCase();
        needle = needle.toLowerCase();
      }
      return o.whole ? hay === needle : hay.indexOf(needle) >= 0;
    }
    function step(dir) {
      const o = opts();
      if (!o.text) return;
      const sel = S.sel;
      const sheets = o.allSheets ? S.api.data.sheets : [S.active()];
      let si = sheets.findIndex(function (s) {
        return s.id === S.sheetId();
      });
      if (si < 0) si = 0;
      let r = sel.r;
      let c = sel.c;
      for (let pass = 0; pass < sheets.length + 1; pass++) {
        const sh = sheets[si];
        const used = S.api.usedRange(sh.id);
        const cols = used.c + 1;
        const total = (used.r + 1) * cols;
        let start = pass === 0 ? r * cols + c : dir > 0 ? -1 : total;
        for (let k = 1; k <= total; k++) {
          const idx = (((start + dir * k) % total) + total) % total;
          if (pass === 0 && k === total) break;
          const rr = Math.floor(idx / cols);
          const cc = idx % cols;
          if (matches(sh.id, rr, cc, o)) {
            if (sh.id !== S.sheetId()) S.api.setActive(sh.id);
            S.setSel(rr, cc);
            S.afterSel();
            msg.textContent = E.a1(rr, cc);
            return true;
          }
        }
        si = (si + dir + sheets.length) % sheets.length;
        r = dir > 0 ? -1 : 0;
        c = 0;
      }
      msg.textContent = t("sheetsNotFound");
      return false;
    }
    function replaceOne() {
      const o = opts();
      const sel = S.sel;
      const sid = S.sheetId();
      if (matches(sid, sel.r, sel.c, o)) {
        const raw = String(S.api.getRaw(sid, sel.r, sel.c));
        const next = replaceIn(raw, o);
        S.api.setCell(sid, sel.r, sel.c, next);
      }
      step(1);
    }
    function replaceIn(raw, o) {
      if (o.whole) return rp.value;
      const re = new RegExp(o.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), o.matchCase ? "g" : "gi");
      return raw.replace(re, rp.value);
    }
    function replaceAll() {
      const o = opts();
      if (!o.text) return;
      const sheets = o.allSheets ? S.api.data.sheets : [S.active()];
      let n = 0;
      S.api.beginBatch();
      sheets.forEach(function (sh) {
        const used = S.api.usedRange(sh.id);
        for (let r = 0; r <= used.r; r++) {
          for (let c = 0; c <= used.c; c++) {
            if (!matches(sh.id, r, c, o)) continue;
            S.api.setCell(sh.id, r, c, replaceIn(String(S.api.getRaw(sh.id, r, c)), o), true);
            n++;
          }
        }
      });
      S.api.endBatch();
      msg.textContent = t("sheetsReplacedCount", { n: n });
    }
    panel.addEventListener("click", function (e) {
      if (e.target.closest(".sheets-panel-close")) {
        panel.remove();
        return;
      }
      const b = e.target.closest("[data-find]");
      if (!b) return;
      const k = b.getAttribute("data-find");
      if (k === "next") step(1);
      else if (k === "prev") step(-1);
      else if (k === "replace") replaceOne();
      else if (k === "all") replaceAll();
      else if (k === "toggle") {
        panel.remove();
        find(true);
      }
    });
    q.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        step(e.shiftKey ? -1 : 1);
      }
    });
    rp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        replaceOne();
      }
    });
    q.focus();
  }

  function condFormat() {
    const sh = S.active();
    const rules = (sh.condFormats || []).slice();
    function typeLabel(ty) {
      return t("sheetsCond_" + ty);
    }
    function draw() {
      const el = S.overlay(
        "<h2>" +
          esc(t("sheetsCondFormat")) +
          "</h2>" +
          '<div class="sheets-fx-list sheets-cond-list">' +
          (rules.length
            ? rules
                .map(function (rule, i) {
                  const swatch = rule.type === "scale" ? '<i class="sheets-cond-swatch" style="background:linear-gradient(90deg,' + (rule.v1 || "#f8696b") + "," + (rule.v3 ? rule.v3 + "," : "") + (rule.v2 || "#63be7b") + ')"></i>' : '<i class="sheets-cond-swatch" style="background:' + (rule.fill || "transparent") + ";color:" + (rule.color || "inherit") + '">Aa</i>';
                  const desc = typeLabel(rule.type) + (rule.v1 != null && rule.v1 !== "" && rule.type !== "scale" && rule.type !== "bar" ? " " + rule.v1 + (rule.type === "between" ? " – " + rule.v2 : "") : "");
                  return '<div class="sheets-cond-row"><span>' + swatch + "<strong>" + esc(rangeToText(rule)) + "</strong> " + esc(desc) + '</span><span><button type="button" data-edit="' + i + '">✎</button><button type="button" data-del="' + i + '">✕</button></span></div>';
                })
                .join("")
            : "<p>" + esc(t("sheetsCondNone")) + "</p>") +
          "</div>" +
          actions(t("sheetsCondNew"))
      );
      el.querySelector(".sheets-save-confirm").addEventListener("click", function () {
        el.remove();
        edit(null);
      });
      el.addEventListener("click", function (e) {
        const ed = e.target.closest("[data-edit]");
        const del = e.target.closest("[data-del]");
        if (ed) {
          el.remove();
          edit(Number(ed.getAttribute("data-edit")));
        } else if (del) {
          rules.splice(Number(del.getAttribute("data-del")), 1);
          S.api.setSheetProp(S.sheetId(), "condFormats", rules);
          el.remove();
          draw();
        }
      });
    }
    function edit(index) {
      const rule = index != null ? Object.assign({}, rules[index]) : { r1: S.sel.r1, c1: S.sel.c1, r2: S.sel.r2, c2: S.sel.c2, type: "gt", v1: "", v2: "", fill: "#fde7c2", color: "#9c3b1c", bold: false };
      const el = S.overlay(
        "<h2>" +
          esc(t("sheetsCondRule")) +
          "</h2>" +
          field(t("sheetsRange"), '<input class="sheets-cond-range" value="' + esc(rangeToText(rule)) + '">') +
          field(t("sheetsCondType"), selectHtml("sheets-cond-type", COND_TYPES.map(function (ty) { return [ty, typeLabel(ty)]; }), rule.type)) +
          '<div class="sheets-row sheets-cond-values">' +
          field(t("sheetsValue"), '<input class="sheets-cond-v1" value="' + esc(rule.v1 == null ? "" : rule.v1) + '">') +
          field(t("sheetsValue2"), '<input class="sheets-cond-v2" value="' + esc(rule.v2 == null ? "" : rule.v2) + '">') +
          "</div>" +
          '<div class="sheets-row sheets-cond-style">' +
          field(t("sheetsFill"), '<input type="color" class="sheets-cond-fill" value="' + esc(rule.fill || "#fde7c2") + '">') +
          field(t("sheetsFontColor"), '<input type="color" class="sheets-cond-color" value="' + esc(rule.color || "#9c3b1c") + '">') +
          '<label class="sheets-field sheets-check"><input type="checkbox" class="sheets-cond-bold"' + (rule.bold ? " checked" : "") + "> " + esc(t("sheetsBold")) + "</label>" +
          "</div>" +
          '<div class="sheets-row sheets-cond-scale">' +
          field(t("sheetsCondMinColor"), '<input type="color" class="sheets-cond-s1" value="' + esc(rule.type === "scale" ? rule.v1 || "#f8696b" : "#f8696b") + '">') +
          field(t("sheetsCondMidColor"), '<input type="color" class="sheets-cond-s3" value="' + esc(rule.v3 || "#ffeb84") + '">') +
          '<label class="sheets-field sheets-check"><input type="checkbox" class="sheets-cond-usemid"' + (rule.v3 ? " checked" : "") + "> " + esc(t("sheetsCondUseMid")) + "</label>" +
          field(t("sheetsCondMaxColor"), '<input type="color" class="sheets-cond-s2" value="' + esc(rule.type === "scale" ? rule.v2 || "#63be7b" : "#63be7b") + '">') +
          "</div>" +
          '<div class="sheets-cond-preview"></div>' +
          actions(t("sheetsSave"))
      );
      const typeSel = el.querySelector(".sheets-cond-type");
      const preview = el.querySelector(".sheets-cond-preview");
      function sync() {
        const ty = typeSel.value;
        const needsV = ["gt", "gte", "lt", "lte", "between", "eq", "neq", "contains", "starts", "top", "bottom"].indexOf(ty) >= 0;
        el.querySelector(".sheets-cond-values").style.display = needsV ? "" : "none";
        el.querySelector(".sheets-cond-v2").parentNode.style.display = ty === "between" ? "" : "none";
        el.querySelector(".sheets-cond-scale").style.display = ty === "scale" ? "" : "none";
        el.querySelector(".sheets-cond-style").style.display = ty === "scale" ? "none" : "";
        el.querySelector(".sheets-cond-color").parentNode.style.display = ty === "bar" ? "none" : "";
        el.querySelector(".sheets-cond-bold").parentNode.style.display = ty === "bar" ? "none" : "";
        if (ty === "scale") {
          const useMid = el.querySelector(".sheets-cond-usemid").checked;
          preview.style.background = "linear-gradient(90deg," + el.querySelector(".sheets-cond-s1").value + "," + (useMid ? el.querySelector(".sheets-cond-s3").value + "," : "") + el.querySelector(".sheets-cond-s2").value + ")";
          preview.style.color = "#1b1b1b";
          preview.textContent = t("sheetsPreview");
        } else if (ty === "bar") {
          preview.style.background = "linear-gradient(90deg," + el.querySelector(".sheets-cond-fill").value + " 60%, transparent 60%)";
          preview.style.color = "";
          preview.textContent = "1234";
        } else {
          preview.style.background = el.querySelector(".sheets-cond-fill").value;
          preview.style.color = el.querySelector(".sheets-cond-color").value;
          preview.style.fontWeight = el.querySelector(".sheets-cond-bold").checked ? "700" : "";
          preview.textContent = t("sheetsPreview");
        }
      }
      el.addEventListener("input", sync);
      el.addEventListener("change", sync);
      sync();
      el.querySelector(".sheets-save-confirm").addEventListener("click", function () {
        const rg = parseRange(el.querySelector(".sheets-cond-range").value);
        if (!rg) {
          S.setStatus(t("sheetsBadRange"));
          return;
        }
        const ty = typeSel.value;
        const next = { r1: rg.r1, c1: rg.c1, r2: rg.r2, c2: rg.c2, type: ty };
        if (ty === "scale") {
          next.v1 = el.querySelector(".sheets-cond-s1").value;
          next.v2 = el.querySelector(".sheets-cond-s2").value;
          if (el.querySelector(".sheets-cond-usemid").checked) next.v3 = el.querySelector(".sheets-cond-s3").value;
        } else {
          next.v1 = el.querySelector(".sheets-cond-v1").value;
          next.v2 = el.querySelector(".sheets-cond-v2").value;
          next.fill = el.querySelector(".sheets-cond-fill").value;
          if (ty !== "bar") {
            next.color = el.querySelector(".sheets-cond-color").value;
            next.bold = el.querySelector(".sheets-cond-bold").checked;
          }
        }
        if (index != null) rules[index] = next;
        else rules.push(next);
        S.api.setSheetProp(S.sheetId(), "condFormats", rules);
        el.remove();
        draw();
      });
    }
    draw();
  }

  function chartData(ch) {
    const rg = parseRange(ch.range);
    const sid = ch.sheetId || S.sheetId();
    if (!rg) return null;
    const api = S.api;
    const rows = [];
    for (let r = rg.r1; r <= rg.r2; r++) {
      const row = [];
      for (let c = rg.c1; c <= rg.c2; c++) row.push(api.getValue(sid, r, c));
      rows.push(row);
    }
    if (!rows.length) return null;
    const firstRowText = rows[0].some(function (v) {
      return typeof v === "string";
    });
    const header = firstRowText && rows.length > 1 ? rows.shift() : null;
    const firstColText = rows.some(function (row) {
      return typeof row[0] === "string";
    });
    const firstColNum = rows.every(function (row) {
      return typeof row[0] === "number" || row[0] == null || row[0] === "";
    });
    const useLabels = firstColText || (ch.type === "scatter" && firstColNum && rows[0].length > 1);
    const labels = rows.map(function (row, i) {
      return useLabels ? (row[0] == null ? "" : String(api.formatValue(row[0], {}))) : String(i + 1);
    });
    const startCol = useLabels ? 1 : 0;
    const series = [];
    for (let c = startCol; c < rows[0].length; c++) {
      series.push({
        name: header && header[c] != null ? String(header[c]) : E.colName(rg.c1 + c),
        values: rows.map(function (row) {
          return typeof row[c] === "number" ? row[c] : null;
        }),
      });
    }
    if (!series.length) return null;
    return { labels: labels, series: series, xNumeric: useLabels && firstColNum && !firstColText ? rows.map(function (row) { return row[0]; }) : null };
  }
  function chartSvg(ch, w, h) {
    const data = chartData(ch);
    w = Math.max(80, w);
    h = Math.max(60, h);
    if (!data) return '<svg width="' + w + '" height="' + h + '"><text x="8" y="20" fill="currentColor" font-size="11">' + esc(t("sheetsBadRange")) + "</text></svg>";
    const type = ch.type || "column";
    const showLegend = data.series.length > 1 || type === "pie" || type === "donut";
    const legendW = showLegend ? Math.min(120, w * 0.3) : 0;
    const padL = type === "bar" ? 60 : 40;
    const padB = 24;
    const padT = 10;
    const padR = 8;
    const pw = w - padL - padR - legendW;
    const ph = h - padT - padB;
    let out = '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + " " + h + '" font-family="Segoe UI, sans-serif" font-size="10">';
    function legend() {
      if (!showLegend) return "";
      let s = "";
      const items = type === "pie" || type === "donut" ? data.labels : data.series.map(function (sr) { return sr.name; });
      items.slice(0, 12).forEach(function (name, i) {
        s += '<rect x="' + (w - legendW + 4) + '" y="' + (padT + i * 14) + '" width="9" height="9" fill="' + CHART_COLORS[i % CHART_COLORS.length] + '"/>';
        s += '<text x="' + (w - legendW + 17) + '" y="' + (padT + i * 14 + 8) + '" fill="currentColor">' + esc(String(name).slice(0, 16)) + "</text>";
      });
      return s;
    }
    if (type === "pie" || type === "donut") {
      const vals = data.series[0].values.map(function (v) {
        return v == null || v < 0 ? 0 : v;
      });
      const total = vals.reduce(function (a, b) {
        return a + b;
      }, 0);
      const cx = (w - legendW) / 2;
      const cy = h / 2;
      const rad = Math.min(cx, cy) - 8;
      let angle = -Math.PI / 2;
      if (total > 0) {
        vals.forEach(function (v, i) {
          const a2 = angle + (v / total) * Math.PI * 2;
          const large = a2 - angle > Math.PI ? 1 : 0;
          const x1 = cx + rad * Math.cos(angle);
          const y1 = cy + rad * Math.sin(angle);
          const x2 = cx + rad * Math.cos(a2);
          const y2 = cy + rad * Math.sin(a2);
          if (v > 0) out += '<path d="M' + cx + "," + cy + " L" + x1 + "," + y1 + " A" + rad + "," + rad + " 0 " + large + ",1 " + x2 + "," + y2 + 'Z" fill="' + CHART_COLORS[i % CHART_COLORS.length] + '" stroke="#fff" stroke-width="1"><title>' + esc(data.labels[i] + ": " + v) + "</title></path>";
          angle = a2;
        });
      }
      if (type === "donut") out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + rad * 0.55 + '" fill="var(--window-bg, #fff)"/>';
      out += legend() + "</svg>";
      return out;
    }
    let min = 0;
    let max = -Infinity;
    data.series.forEach(function (sr) {
      sr.values.forEach(function (v) {
        if (v == null) return;
        min = Math.min(min, v);
        max = Math.max(max, v);
      });
    });
    if (max === -Infinity) max = 1;
    if (max === min) max = min + 1;
    const n = data.labels.length;
    const isBar = type === "bar";
    const axisLen = isBar ? pw : ph;
    const scale = function (v) {
      return ((v - min) / (max - min)) * axisLen;
    };
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const v = min + ((max - min) * i) / ticks;
      const label = E.formatValue(Math.round(v * 100) / 100, {});
      if (isBar) {
        const x = padL + scale(v);
        out += '<line x1="' + x + '" y1="' + padT + '" x2="' + x + '" y2="' + (padT + ph) + '" stroke="currentColor" stroke-opacity="0.15"/>';
        out += '<text x="' + x + '" y="' + (h - 8) + '" text-anchor="middle" fill="currentColor">' + esc(label) + "</text>";
      } else {
        const y = padT + ph - scale(v);
        out += '<line x1="' + padL + '" y1="' + y + '" x2="' + (padL + pw) + '" y2="' + y + '" stroke="currentColor" stroke-opacity="0.15"/>';
        out += '<text x="' + (padL - 4) + '" y="' + (y + 3) + '" text-anchor="end" fill="currentColor">' + esc(label) + "</text>";
      }
    }
    const zero = isBar ? padL + scale(0) : padT + ph - scale(0);
    const sc = data.series.length;
    const labelEvery = Math.max(1, Math.ceil(n / (isBar ? Math.floor(ph / 14) : Math.floor(pw / 40))));
    if (type === "scatter") {
      const xsNum = data.xNumeric;
      let xmin = 0;
      let xmax = n - 1 || 1;
      if (xsNum) {
        xmin = Infinity;
        xmax = -Infinity;
        xsNum.forEach(function (x) {
          if (typeof x === "number") {
            xmin = Math.min(xmin, x);
            xmax = Math.max(xmax, x);
          }
        });
        if (xmin === Infinity) {
          xmin = 0;
          xmax = 1;
        }
        if (xmax === xmin) xmax = xmin + 1;
      }
      data.series.forEach(function (sr, si) {
        sr.values.forEach(function (v, i) {
          if (v == null) return;
          const xv = xsNum && typeof xsNum[i] === "number" ? xsNum[i] : i;
          const x = padL + ((xv - xmin) / (xmax - xmin)) * pw;
          const y = padT + ph - scale(v);
          out += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="' + CHART_COLORS[si % CHART_COLORS.length] + '"><title>' + esc(xv + ", " + v) + "</title></circle>";
        });
      });
      out += '<line x1="' + padL + '" y1="' + (padT + ph) + '" x2="' + (padL + pw) + '" y2="' + (padT + ph) + '" stroke="currentColor" stroke-opacity="0.5"/>';
      out += legend() + "</svg>";
      return out;
    }
    if (type === "line" || type === "area") {
      const stepX = n > 1 ? pw / (n - 1) : 0;
      data.series.forEach(function (sr, si) {
        let d = "";
        let first = null;
        let last = null;
        sr.values.forEach(function (v, i) {
          if (v == null) return;
          const x = padL + (n > 1 ? i * stepX : pw / 2);
          const y = padT + ph - scale(v);
          d += (d ? " L" : "M") + x + "," + y;
          if (first == null) first = x;
          last = x;
        });
        if (!d) return;
        const color = CHART_COLORS[si % CHART_COLORS.length];
        if (type === "area") out += '<path d="' + d + " L" + last + "," + zero + " L" + first + "," + zero + 'Z" fill="' + color + '" fill-opacity="0.25"/>';
        out += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2"/>';
        sr.values.forEach(function (v, i) {
          if (v == null) return;
          const x = padL + (n > 1 ? i * stepX : pw / 2);
          const y = padT + ph - scale(v);
          out += '<circle cx="' + x + '" cy="' + y + '" r="2.5" fill="' + color + '"><title>' + esc(data.labels[i] + ": " + v) + "</title></circle>";
        });
      });
      data.labels.forEach(function (lb, i) {
        if (i % labelEvery) return;
        const x = padL + (n > 1 ? i * stepX : pw / 2);
        out += '<text x="' + x + '" y="' + (h - 8) + '" text-anchor="middle" fill="currentColor">' + esc(String(lb).slice(0, 10)) + "</text>";
      });
      out += '<line x1="' + padL + '" y1="' + zero + '" x2="' + (padL + pw) + '" y2="' + zero + '" stroke="currentColor" stroke-opacity="0.5"/>';
      out += legend() + "</svg>";
      return out;
    }
    const groupSize = (isBar ? ph : pw) / n;
    const barSize = Math.max(2, (groupSize * 0.7) / sc);
    data.series.forEach(function (sr, si) {
      const color = CHART_COLORS[si % CHART_COLORS.length];
      sr.values.forEach(function (v, i) {
        if (v == null) return;
        const len = Math.abs(scale(v) - scale(0));
        if (isBar) {
          const y = padT + i * groupSize + groupSize * 0.15 + si * barSize;
          const x = v >= 0 ? zero : zero - len;
          out += '<rect x="' + x + '" y="' + y + '" width="' + len + '" height="' + barSize + '" fill="' + color + '"><title>' + esc(data.labels[i] + ": " + v) + "</title></rect>";
        } else {
          const x = padL + i * groupSize + groupSize * 0.15 + si * barSize;
          const y = v >= 0 ? zero - len : zero;
          out += '<rect x="' + x + '" y="' + y + '" width="' + barSize + '" height="' + len + '" fill="' + color + '"><title>' + esc(data.labels[i] + ": " + v) + "</title></rect>";
        }
      });
    });
    data.labels.forEach(function (lb, i) {
      if (i % labelEvery) return;
      if (isBar) out += '<text x="' + (padL - 4) + '" y="' + (padT + i * groupSize + groupSize / 2 + 3) + '" text-anchor="end" fill="currentColor">' + esc(String(lb).slice(0, 9)) + "</text>";
      else out += '<text x="' + (padL + i * groupSize + groupSize / 2) + '" y="' + (h - 8) + '" text-anchor="middle" fill="currentColor">' + esc(String(lb).slice(0, 10)) + "</text>";
    });
    if (isBar) out += '<line x1="' + zero + '" y1="' + padT + '" x2="' + zero + '" y2="' + (padT + ph) + '" stroke="currentColor" stroke-opacity="0.5"/>';
    else out += '<line x1="' + padL + '" y1="' + zero + '" x2="' + (padL + pw) + '" y2="' + zero + '" stroke="currentColor" stroke-opacity="0.5"/>';
    out += legend() + "</svg>";
    return out;
  }
  function chart(id) {
    const sh = S.active();
    const existing = id
      ? (sh.charts || []).find(function (c) {
          return c.id === id;
        })
      : null;
    const rg = S.workRange();
    const draft = existing ? Object.assign({}, existing) : { id: "ch" + Date.now().toString(36), type: "column", range: rangeToText(rg), title: "", x: S.colX(Math.min(rg.c2 + 2, 30)), y: S.rowY(Math.max(rg.r1, S.active().frozenRows || 0)) + 4, w: 360, h: 220 };
    const el = S.overlay(
      "<h2>" +
        esc(t(existing ? "sheetsChartEdit" : "sheetsChart")) +
        "</h2>" +
        '<div class="sheets-row">' +
        field(t("sheetsChartType"), selectHtml("sheets-chart-type", CHART_TYPES.map(function (ty) { return [ty, t("sheetsChart_" + ty)]; }), draft.type)) +
        field(t("sheetsRange"), '<input class="sheets-chart-range" value="' + esc(draft.range) + '">') +
        field(t("sheetsChartTitle"), '<input class="sheets-chart-title" value="' + esc(draft.title || "") + '">') +
        "</div>" +
        '<div class="sheets-chart-preview"></div>' +
        actions(t(existing ? "sheetsSave" : "sheetsInsert"))
    );
    const preview = el.querySelector(".sheets-chart-preview");
    function read() {
      draft.type = el.querySelector(".sheets-chart-type").value;
      draft.range = el.querySelector(".sheets-chart-range").value.trim();
      draft.title = el.querySelector(".sheets-chart-title").value.trim();
    }
    function update() {
      read();
      preview.innerHTML = chartSvg(draft, 480, 220);
    }
    el.addEventListener("input", update);
    el.addEventListener("change", update);
    update();
    el.querySelector(".sheets-save-confirm").addEventListener("click", function () {
      read();
      if (!parseRange(draft.range)) {
        S.setStatus(t("sheetsBadRange"));
        return;
      }
      const list = (S.active().charts || []).filter(function (c) {
        return c.id !== draft.id;
      });
      list.push(draft);
      S.api.setSheetProp(S.sheetId(), "charts", list);
      el.remove();
    });
  }

  function names(defineNew) {
    const api = S.api;
    function draw() {
      const map = api.names();
      const keys = Object.keys(map).sort();
      const el = S.overlay(
        "<h2>" +
          esc(t("sheetsNames")) +
          "</h2>" +
          '<div class="sheets-row">' +
          field(t("sheetsName"), '<input class="sheets-name-key" placeholder="MyRange" value="">') +
          field(t("sheetsRefersTo"), '<input class="sheets-name-ref" value="' + esc("'" + S.active().name.replace(/'/g, "''") + "'!" + S.a1Sel()) + '">') +
          '<button type="button" class="sheets-save-confirm sheets-name-add">' +
          esc(t("sheetsAdd")) +
          "</button></div>" +
          '<div class="sheets-fx-list sheets-cond-list">' +
          (keys.length
            ? keys
                .map(function (k) {
                  return '<div class="sheets-cond-row"><span><strong>' + esc(k) + "</strong> " + esc(map[k]) + '</span><span><button type="button" data-go="' + esc(k) + '">→</button><button type="button" data-del="' + esc(k) + '">✕</button></span></div>';
                })
                .join("")
            : "<p>" + esc(t("sheetsNoNames")) + "</p>") +
          "</div>" +
          actions("")
      );
      const key = el.querySelector(".sheets-name-key");
      const ref = el.querySelector(".sheets-name-ref");
      function add() {
        if (!api.defineName(key.value, ref.value.trim())) {
          S.setStatus(t("sheetsBadName"));
          return;
        }
        el.remove();
        draw();
      }
      el.querySelector(".sheets-name-add").addEventListener("click", add);
      key.addEventListener("keydown", function (e) {
        if (e.key === "Enter") add();
      });
      el.addEventListener("click", function (e) {
        const del = e.target.closest("[data-del]");
        const go = e.target.closest("[data-go]");
        if (del) {
          api.defineName(del.getAttribute("data-del"), null);
          el.remove();
          draw();
        } else if (go) {
          const r = api.nameRef(go.getAttribute("data-go"), S.sheetId());
          el.remove();
          if (!r) return;
          if (r.sheetId !== S.sheetId()) api.setActive(r.sheetId);
          if (r.r != null) S.setSel(r.r, r.c);
          else S.setSel(r.r1, r.c1, r.r2, r.c2);
          S.afterSel();
        }
      });
      key.focus();
    }
    draw();
    void defineNew;
  }

  function sort() {
    const rg = S.workRange();
    const header = S.looksLikeHeader(rg);
    const sid = S.sheetId();
    const colOptions = [];
    for (let c = rg.c1; c <= rg.c2; c++) {
      const label = header ? String(S.api.display(sid, rg.r1, c) || E.colName(c)) : E.colName(c);
      colOptions.push([String(c), label]);
    }
    const el = S.overlay(
      "<h2>" +
        esc(t("sheetsSortCustom")) +
        "</h2>" +
        field(t("sheetsRange"), '<input class="sheets-sort-range" value="' + esc(rangeToText(rg)) + '">') +
        '<label class="sheets-field sheets-check"><input type="checkbox" class="sheets-sort-header"' + (header ? " checked" : "") + "> " + esc(t("sheetsHasHeader")) + "</label>" +
        '<div class="sheets-row">' +
        field(t("sheetsSortBy"), selectHtml("sheets-sort-col", colOptions, String(Math.max(rg.c1, Math.min(rg.c2, S.sel.c))))) +
        field(t("sheetsOrder"), selectHtml("sheets-sort-dir", [["asc", t("sheetsSortAsc")], ["desc", t("sheetsSortDesc")]], "asc")) +
        "</div>" +
        '<div class="sheets-row">' +
        field(t("sheetsThenBy"), selectHtml("sheets-sort-col2", [["", "—"]].concat(colOptions), "")) +
        field(t("sheetsOrder"), selectHtml("sheets-sort-dir2", [["asc", t("sheetsSortAsc")], ["desc", t("sheetsSortDesc")]], "asc")) +
        "</div>" +
        actions(t("sheetsSort"))
    );
    el.querySelector(".sheets-save-confirm").addEventListener("click", function () {
      const range = parseRange(el.querySelector(".sheets-sort-range").value);
      if (!range) {
        S.setStatus(t("sheetsBadRange"));
        return;
      }
      const hasHeader = el.querySelector(".sheets-sort-header").checked;
      const c2 = el.querySelector(".sheets-sort-col2").value;
      S.api.beginBatch();
      if (c2 !== "") S.sortRange(range, Number(c2), el.querySelector(".sheets-sort-dir2").value === "desc", hasHeader);
      S.sortRange(range, Number(el.querySelector(".sheets-sort-col").value), el.querySelector(".sheets-sort-dir").value === "desc", hasHeader);
      S.api.endBatch();
      S.setSel(range.r1, range.c1, range.r2, range.c2);
      S.afterSel();
      el.remove();
    });
  }

  function textToCols() {
    const sel = S.sel;
    const el = S.overlay(
      "<h2>" +
        esc(t("sheetsTextToCols")) +
        "</h2>" +
        field(t("sheetsDelimiter"), selectHtml("sheets-ttc-delim", [[",", t("sheetsDelimComma")], [";", t("sheetsDelimSemicolon")], ["\t", t("sheetsDelimTab")], [" ", t("sheetsDelimSpace")], ["|", "|"], ["custom", t("sheetsDelimCustom")]], ",")) +
        field(t("sheetsDelimCustom"), '<input class="sheets-ttc-custom" value="-">') +
        "<p>" +
        esc(t("sheetsTextToColsHint")) +
        "</p>" +
        actions(t("sheetsSplit"))
    );
    el.querySelector(".sheets-save-confirm").addEventListener("click", function () {
      let d = el.querySelector(".sheets-ttc-delim").value;
      if (d === "custom") d = el.querySelector(".sheets-ttc-custom").value;
      if (!d) return;
      const sid = S.sheetId();
      const api = S.api;
      api.beginBatch();
      let maxW = 0;
      for (let r = sel.r1; r <= sel.r2; r++) {
        const raw = String(api.getRaw(sid, r, sel.c1));
        if (raw === "" || raw.charAt(0) === "=") continue;
        const parts = raw.split(d);
        maxW = Math.max(maxW, parts.length);
        parts.forEach(function (p, i) {
          api.setCell(sid, r, sel.c1 + i, p.trim(), true);
        });
      }
      api.endBatch();
      S.setSel(sel.r1, sel.c1, sel.r2, sel.c1 + Math.max(0, maxW - 1));
      S.afterSel();
      el.remove();
    });
  }

  function fillSeries() {
    const sel = S.sel;
    const sid = S.sheetId();
    const first = S.api.getValue(sid, sel.r1, sel.c1);
    const el = S.overlay(
      "<h2>" +
        esc(t("sheetsFillSeries")) +
        "</h2>" +
        '<div class="sheets-row">' +
        field(t("sheetsStartValue"), '<input class="sheets-fs-start" value="' + esc(typeof first === "number" ? first : 1) + '">') +
        field(t("sheetsStep"), '<input class="sheets-fs-step" value="1">') +
        field(t("sheetsSeriesType"), selectHtml("sheets-fs-type", [["linear", t("sheetsLinear")], ["growth", t("sheetsGrowth")], ["date", t("sheetsFmt_date")], ["weekday", t("sheetsWeekdays")], ["month", t("sheetsMonths")]], "linear")) +
        "</div>" +
        "<p>" +
        esc(t("sheetsFillSeriesHint")) +
        "</p>" +
        actions(t("sheetsFill"))
    );
    el.querySelector(".sheets-save-confirm").addEventListener("click", function () {
      const start = Number(el.querySelector(".sheets-fs-start").value);
      const step = Number(el.querySelector(".sheets-fs-step").value);
      const type = el.querySelector(".sheets-fs-type").value;
      if (!Number.isFinite(start) || !Number.isFinite(step)) return;
      const vertical = sel.r2 - sel.r1 >= sel.c2 - sel.c1;
      const n = vertical ? sel.r2 - sel.r1 + 1 : sel.c2 - sel.c1 + 1;
      let base = start;
      if (type === "date" || type === "weekday" || type === "month") {
        const cur = S.api.getValue(sid, sel.r1, sel.c1);
        const now = new Date();
        base = typeof cur === "number" && cur > 1000 ? cur : E.dateToSerial(now.getFullYear(), now.getMonth() + 1, now.getDate());
      }
      S.api.beginBatch();
      let v = base;
      for (let i = 0; i < n; i++) {
        const r = vertical ? sel.r1 + i : sel.r1;
        const c = vertical ? sel.c1 : sel.c1 + i;
        if (i > 0) {
          if (type === "linear") v += step;
          else if (type === "growth") v *= step;
          else if (type === "date") v += step;
          else if (type === "weekday") {
            v += step;
            while (E.serialToParts(v).dow === 0 || E.serialToParts(v).dow === 6) v += 1;
          } else if (type === "month") {
            const p = E.serialToParts(v);
            const dt = new Date(Date.UTC(p.y, p.m - 1 + step, p.d));
            v = E.dateToSerial(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
          }
        }
        if (type !== "linear" && type !== "growth") S.api.setStyle(sid, r, c, { format: "date" }, true);
        S.api.setCell(sid, r, c, String(Math.round(v * 1e8) / 1e8), true);
      }
      S.api.endBatch();
      el.remove();
    });
  }

  function note() {
    const sel = S.sel;
    const sid = S.sheetId();
    const cur = (S.api.getStyle(sid, sel.r, sel.c) || {}).note || "";
    const el = S.overlay(
      "<h2>" +
        esc(t(cur ? "sheetsEditNote" : "sheetsNote")) +
        " · " +
        esc(E.a1(sel.r, sel.c)) +
        "</h2>" +
        '<textarea class="sheets-note-text" rows="5">' +
        esc(cur) +
        "</textarea>" +
        actions(t("sheetsSave"), cur ? '<button type="button" class="sheets-close-modal sheets-note-del">' + esc(t("sheetsDeleteNote")) + "</button>" : "")
    );
    const ta = el.querySelector(".sheets-note-text");
    el.querySelector(".sheets-save-confirm").addEventListener("click", function () {
      S.api.setStyle(sid, sel.r, sel.c, { note: ta.value.trim() });
      el.remove();
    });
    const del = el.querySelector(".sheets-note-del");
    if (del) del.addEventListener("click", function () {
      S.api.setStyle(sid, sel.r, sel.c, { note: "" });
    });
    ta.focus();
  }

  function customFormat() {
    const cur = S.styleOf(S.sel.r, S.sel.c);
    const presets = [["0", "0"], ["0.00", "0.00"], ["#,##0", "#,##0"], ["#,##0.00", "#,##0.00"], ["0%", "0%"], ["0.0%", "0.0%"], ["yyyy-mm-dd", "yyyy-mm-dd"], ["dd/mm/yyyy", "dd/mm/yyyy"], ["mm/dd/yyyy", "mm/dd/yyyy"], ["hh:mm", "hh:mm"], ["hh:mm:ss", "hh:mm:ss"], ["0.00E+00", "0.00E+00"]];
    const el = S.overlay(
      "<h2>" +
        esc(t("sheetsFmt_custom")) +
        "</h2>" +
        field(t("sheetsFormatCode"), '<input class="sheets-fmt-code" value="' + esc(cur.code || "#,##0.00") + '">') +
        '<div class="sheets-fmt-presets">' +
        presets
          .map(function (p) {
            return '<button type="button" data-code="' + esc(p[0]) + '">' + esc(p[1]) + "</button>";
          })
          .join("") +
        "</div>" +
        '<div class="sheets-cond-preview sheets-fmt-preview"></div>' +
        actions(t("sheetsApply"))
    );
    const input = el.querySelector(".sheets-fmt-code");
    const preview = el.querySelector(".sheets-fmt-preview");
    function update() {
      const v = S.api.getValue(S.sheetId(), S.sel.r, S.sel.c);
      const sample = typeof v === "number" ? v : 1234.5678;
      preview.textContent = E.formatValue(sample, { format: "custom", code: input.value });
    }
    el.addEventListener("click", function (e) {
      const b = e.target.closest("[data-code]");
      if (b) {
        input.value = b.getAttribute("data-code");
        update();
      }
    });
    input.addEventListener("input", update);
    update();
    el.querySelector(".sheets-save-confirm").addEventListener("click", function () {
      S.applySel({ format: "custom", code: input.value });
      el.remove();
    });
  }

  function filterMenu(col, anchor) {
    const sh = S.active();
    const filter = sh.filter;
    if (!filter) return;
    const sid = S.sheetId();
    const values = new Map();
    for (let r = filter.r1 + 1; r <= filter.r2; r++) {
      const v = S.api.display(sid, r, col);
      values.set(v, (values.get(v) || 0) + 1);
    }
    const all = Array.from(values.keys()).sort(function (a, b) {
      const na = Number(a);
      const nb = Number(b);
      if (a !== "" && b !== "" && Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
    });
    const allowed = filter.cols && filter.cols[col] ? new Set(filter.cols[col]) : null;
    const m = document.createElement("div");
    m.className = "sheets-menu sheets-filter-menu";
    m.innerHTML =
      '<button type="button" data-sort="asc">' + esc(t("sheetsSortAsc")) + "</button>" +
      '<button type="button" data-sort="desc">' + esc(t("sheetsSortDesc")) + "</button>" +
      '<div class="sheets-menu-sep"></div>' +
      '<input class="sheets-search sheets-filter-search" placeholder="' + esc(t("sheetsSearch")) + '">' +
      '<div class="sheets-filter-list">' +
      '<label><input type="checkbox" class="sheets-filter-all" checked> ' + esc(t("sheetsSelectAll")) + "</label>" +
      all
        .slice(0, 1000)
        .map(function (v) {
          return '<label data-v="' + esc(v) + '"><input type="checkbox" class="sheets-filter-val" value="' + esc(v) + '"' + (!allowed || allowed.has(v) ? " checked" : "") + "> " + (v === "" ? "<em>" + esc(t("sheetsBlanks")) + "</em>" : esc(v)) + " <span>(" + values.get(v) + ")</span></label>";
        })
        .join("") +
      "</div>" +
      '<div class="sheets-panel-btns"><button type="button" data-filter="clear">' + esc(t("sheetsFilterClear")) + '</button><button type="button" class="primary" data-filter="ok">OK</button></div>';
    S.root.querySelector(".sheets-shell").appendChild(m);
    S.setMenu(m);
    const r = anchor.getBoundingClientRect();
    S.positionMenu(r.left, r.bottom + 2);
    const boxes = function () {
      return Array.from(m.querySelectorAll(".sheets-filter-val"));
    };
    function syncAll() {
      const vis = boxes().filter(function (b) {
        return b.parentNode.style.display !== "none";
      });
      m.querySelector(".sheets-filter-all").checked = vis.every(function (b) {
        return b.checked;
      });
    }
    m.querySelector(".sheets-filter-all").addEventListener("change", function (e) {
      boxes().forEach(function (b) {
        if (b.parentNode.style.display !== "none") b.checked = e.target.checked;
      });
    });
    m.querySelector(".sheets-filter-search").addEventListener("input", function (e) {
      const q = e.target.value.toLowerCase();
      boxes().forEach(function (b) {
        b.parentNode.style.display = !q || b.value.toLowerCase().indexOf(q) >= 0 ? "" : "none";
      });
      syncAll();
    });
    m.addEventListener("change", function (e) {
      if (e.target.classList.contains("sheets-filter-val")) syncAll();
    });
    m.addEventListener("click", function (e) {
      const srt = e.target.closest("[data-sort]");
      if (srt) {
        S.closeMenu();
        S.sortRange({ r1: filter.r1, c1: filter.c1, r2: filter.r2, c2: filter.c2 }, col, srt.getAttribute("data-sort") === "desc", true);
        S.applyFilter(filter);
        return;
      }
      const fb = e.target.closest("[data-filter]");
      if (!fb) return;
      const next = { r1: filter.r1, c1: filter.c1, r2: filter.r2, c2: filter.c2, cols: Object.assign({}, filter.cols || {}) };
      if (fb.getAttribute("data-filter") === "clear") delete next.cols[col];
      else {
        const checked = boxes().filter(function (b) {
          return b.checked;
        }).map(function (b) {
          return b.value;
        });
        if (checked.length === all.length) delete next.cols[col];
        else next.cols[col] = checked;
      }
      S.closeMenu();
      S.applyFilter(next);
    });
    m.querySelector(".sheets-filter-search").focus();
  }

  function help() {
    const l = S.lang();
    const rows = [
      ["Enter / Tab", "sheetsHelpEnter"],
      ["F2", "sheetsHelpF2"],
      ["Ctrl+Z / Ctrl+Y", "sheetsHelpUndo"],
      ["Ctrl+C / X / V", "sheetsHelpClip"],
      ["Ctrl+Arrow", "sheetsHelpJump"],
      ["Shift+Arrow", "sheetsHelpExtend"],
      ["Ctrl+A", "sheetsHelpSelectAll"],
      ["Ctrl+F / Ctrl+H", "sheetsHelpFind"],
      ["Ctrl+D / Ctrl+R", "sheetsHelpFillDR"],
      ["Alt+=", "sheetsHelpAutoSum"],
      ["Ctrl+B / I / U", "sheetsHelpFormat"],
      ["Ctrl+Shift+L", "sheetsHelpFilter"],
      ["Ctrl+;  /  Ctrl+Shift+;", "sheetsHelpDate"],
      ["Ctrl+`", "sheetsHelpShowFormulas"],
      ["Ctrl+9 / Ctrl+0", "sheetsHelpHide"],
      ["F4", "sheetsHelpF4"],
      ["F9", "sheetsHelpF9"],
      ["Ctrl+PgUp / PgDn", "sheetsHelpSheets"],
      ["Ctrl+Wheel", "sheetsHelpZoom"],
      ["Alt+Enter", "sheetsHelpNewline"],
    ];
    void l;
    S.overlay(
      "<h2>" +
        esc(t("sheetsHelp")) +
        "</h2>" +
        '<div class="sheets-help-body">' +
        "<p>" +
        esc(t("sheetsHelpIntro")) +
        "</p>" +
        "<ul><li>" +
        esc(t("sheetsHelpTip1")) +
        "</li><li>" +
        esc(t("sheetsHelpTip2")) +
        "</li><li>" +
        esc(t("sheetsHelpTip3")) +
        "</li><li>" +
        esc(t("sheetsHelpTip4")) +
        "</li><li>" +
        esc(t("sheetsHelpTip5")) +
        "</li></ul>" +
        "<table>" +
        rows
          .map(function (r) {
            return "<tr><td><kbd>" + esc(r[0]) + "</kbd></td><td>" + esc(t(r[1])) + "</td></tr>";
          })
          .join("") +
        "</table></div>" +
        actions("")
    );
  }

  return {
    fx: fx,
    find: find,
    condFormat: condFormat,
    chart: chart,
    chartSvg: chartSvg,
    names: names,
    sort: sort,
    textToCols: textToCols,
    fillSeries: fillSeries,
    note: note,
    customFormat: customFormat,
    filterMenu: filterMenu,
    help: help,
  };
};
