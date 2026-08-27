window.OSSheetsEngine = (function () {
  const MAX_ROWS = 1048576;
  const MAX_COLS = 16384;
  const MAX_RANGE = 250000;
  const DB_NAME = "OSSheetsDB";
  const DB_VERSION = 1;
  const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
  const SAVE_MS = 400;

  const ERR = {
    DIV: "#DIV/0!",
    VALUE: "#VALUE!",
    REF: "#REF!",
    NAME: "#NAME?",
    NA: "#N/A",
    NUM: "#NUM!",
    CIRC: "#CIRC!",
    NULL: "#NULL!",
  };

  function e(code) {
    return { error: code };
  }
  function isErr(v) {
    return !!(v && typeof v === "object" && v.error);
  }
  function isRange(v) {
    return !!(v && typeof v === "object" && v.range);
  }
  function rng(sheetId, r1, c1, r2, c2) {
    return {
      range: true,
      sheetId: sheetId,
      r1: Math.min(r1, r2),
      c1: Math.min(c1, c2),
      r2: Math.max(r1, r2),
      c2: Math.max(c1, c2),
    };
  }
  function cellKey(sheetId, r, c) {
    return sheetId + ":" + r + "," + c;
  }
  function posKey(r, c) {
    return r + "," + c;
  }
  function clampRC(r, c) {
    if (r < 0 || c < 0 || r >= MAX_ROWS || c >= MAX_COLS) return null;
    return [r, c];
  }
  function colName(c) {
    let n = c + 1;
    let s = "";
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  function parseCol(letters) {
    let n = 0;
    const s = letters.toUpperCase();
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      if (code < 65 || code > 90) return -1;
      n = n * 26 + (code - 64);
    }
    return n - 1;
  }
  function parseA1(text) {
    const m = String(text).match(/^(\$?)([A-Za-z]{1,3})(\$?)([1-9][0-9]{0,6})$/);
    if (!m) return null;
    const c = parseCol(m[2]);
    const r = Number(m[4]) - 1;
    if (c < 0 || c >= MAX_COLS || r < 0 || r >= MAX_ROWS) return null;
    return { r: r, c: c, absC: m[1] === "$", absR: m[3] === "$" };
  }
  function a1(r, c, absR, absC) {
    return (absC ? "$" : "") + colName(c) + (absR ? "$" : "") + String(r + 1);
  }
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function dateToSerial(y, m, d) {
    const t = Date.UTC(Number(y), Number(m) - 1, Number(d));
    return (t - EXCEL_EPOCH) / 86400000;
  }
  function serialToParts(n) {
    const ms = EXCEL_EPOCH + Number(n) * 86400000;
    const dt = new Date(ms);
    return {
      y: dt.getUTCFullYear(),
      m: dt.getUTCMonth() + 1,
      d: dt.getUTCDate(),
      H: dt.getUTCHours(),
      M: dt.getUTCMinutes(),
      S: dt.getUTCSeconds(),
      date: dt,
      dow: dt.getUTCDay(),
    };
  }
  function todaySerial() {
    const n = new Date();
    return dateToSerial(n.getFullYear(), n.getMonth() + 1, n.getDate());
  }
  function nowSerial() {
    const n = new Date();
    return (
      todaySerial() +
      (n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds()) / 86400
    );
  }

  function toNum(v) {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (isErr(v)) return v;
    if (typeof v === "string") {
      if (v.trim() === "") return 0;
      const n = Number(v);
      if (Number.isFinite(n)) return n;
      return e(ERR.VALUE);
    }
    return e(ERR.VALUE);
  }
  function toBool(v) {
    if (isErr(v)) return v;
    if (typeof v === "boolean") return v;
    if (v == null || v === "") return false;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
      if (/^true$/i.test(v)) return true;
      if (/^false$/i.test(v)) return false;
      const n = Number(v);
      if (Number.isFinite(n)) return n !== 0;
    }
    return true;
  }
  function toStr(v) {
    if (v == null) return "";
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (isErr(v)) return v.error;
    return String(v);
  }
  function unwrap(v) {
    if (isRange(v)) return { want: "first", range: v };
    return v;
  }

  function parseLiteral(raw) {
    if (raw == null || raw === "") return null;
    const s = String(raw);
    if (s.charAt(0) === "'") return s.slice(1);
    if (/^TRUE$/i.test(s)) return true;
    if (/^FALSE$/i.test(s)) return false;
    if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?%$/.test(s)) return parseFloat(s) / 100;
    if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) return parseFloat(s);
    return s;
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function wildcardRe(pat) {
    let out = "^";
    const s = String(pat);
    for (let i = 0; i < s.length; i++) {
      const ch = s.charAt(i);
      if (ch === "~" && i + 1 < s.length) {
        out += escapeRe(s.charAt(++i));
      } else if (ch === "*") out += ".*";
      else if (ch === "?") out += ".";
      else out += escapeRe(ch);
    }
    return new RegExp(out + "$", "i");
  }
  function matchCriteria(value, criteria) {
    if (isErr(value)) return false;
    if (criteria == null || criteria === "") return value == null || value === "";
    if (typeof criteria === "number") {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) && n === criteria;
    }
    if (typeof criteria === "boolean") return value === criteria;
    const s = String(criteria);
    const m = s.match(/^(<=|>=|<>|=|<|>)(.*)$/);
    if (m) {
      const op = m[1];
      let rhs = m[2];
      if (rhs === "") {
        if (op === "=") return value == null || value === "";
        if (op === "<>") return !(value == null || value === "");
      }
      const rhsNum = Number(rhs);
      const lhsNum = typeof value === "number" ? value : Number(value);
      if (rhs !== "" && Number.isFinite(rhsNum) && Number.isFinite(lhsNum) && String(value) !== "" && value != null) {
        if (op === "=") return lhsNum === rhsNum;
        if (op === "<>") return lhsNum !== rhsNum;
        if (op === "<") return lhsNum < rhsNum;
        if (op === ">") return lhsNum > rhsNum;
        if (op === "<=") return lhsNum <= rhsNum;
        if (op === ">=") return lhsNum >= rhsNum;
      }
      const lhs = toStr(value);
      if (op === "=") return wildcardRe(rhs).test(lhs);
      if (op === "<>") return !wildcardRe(rhs).test(lhs);
      return false;
    }
    if (/[*?]/.test(s)) return wildcardRe(s).test(toStr(value));
    if (typeof value === "number" && Number.isFinite(Number(s))) return value === Number(s);
    return toStr(value).toLowerCase() === s.toLowerCase();
  }

  function tokenize(src) {
    const s = String(src);
    const tokens = [];
    let i = 0;
    const n = s.length;
    function push(t, v, extra) {
      const tok = { t: t, v: v };
      if (extra) Object.assign(tok, extra);
      tokens.push(tok);
    }
    while (i < n) {
      const ch = s.charAt(i);
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        i++;
        continue;
      }
      if (ch === '"') {
        let out = "";
        i++;
        while (i < n) {
          const c = s.charAt(i++);
          if (c === '"') {
            if (s.charAt(i) === '"') {
              out += '"';
              i++;
            } else break;
          } else out += c;
        }
        push("str", out);
        continue;
      }
      if (ch === "'") {
        let name = "";
        i++;
        while (i < n) {
          const c = s.charAt(i++);
          if (c === "'") {
            if (s.charAt(i) === "'") {
              name += "'";
              i++;
            } else break;
          } else name += c;
        }
        if (s.charAt(i) === "!") {
          i++;
          push("sheet", name);
        } else push("ident", name);
        continue;
      }
      if (ch === "<") {
        if (s.charAt(i + 1) === "=") {
          push("op", "<=");
          i += 2;
        } else if (s.charAt(i + 1) === ">") {
          push("op", "<>");
          i += 2;
        } else {
          push("op", "<");
          i++;
        }
        continue;
      }
      if (ch === ">") {
        if (s.charAt(i + 1) === "=") {
          push("op", ">=");
          i += 2;
        } else {
          push("op", ">");
          i++;
        }
        continue;
      }
      if ("+-*/^&=%(),:;!".indexOf(ch) >= 0) {
        if (ch === ",") push("sep", ",");
        else if (ch === ";") push("sep", ";");
        else if (ch === "(") push("lp");
        else if (ch === ")") push("rp");
        else if (ch === "!") push("bang");
        else if (ch === "%") push("pct");
        else if (ch === ":") push("colon");
        else push("op", ch);
        i++;
        continue;
      }
      if (ch === "$" || /[A-Za-z_]/.test(ch) || (ch >= "0" && ch <= "9") || ch === ".") {
        if ((ch >= "0" && ch <= "9") || (ch === "." && s.charAt(i + 1) >= "0" && s.charAt(i + 1) <= "9")) {
          const m = s.slice(i).match(/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/);
          if (m) {
            push("num", parseFloat(m[0]));
            i += m[0].length;
            continue;
          }
        }
        if (ch === "$" || /[A-Za-z_]/.test(ch)) {
          const start = i;
          if (s.charAt(i) === "$") i++;
          while (i < n && /[A-Za-z]/.test(s.charAt(i))) i++;
          const afterLetters = i;
          const absR = s.charAt(i) === "$";
          if (absR) i++;
          let digits = "";
          while (i < n && s.charAt(i) >= "0" && s.charAt(i) <= "9") digits += s.charAt(i++);
          const next = s.charAt(i);
          const letters = s.slice(ch === "$" ? start + 1 : start, afterLetters);
          const looksRef = letters && digits && parseA1((ch === "$" ? "$" : "") + letters + (absR ? "$" : "") + digits);
          if (looksRef && next !== "(" && next !== ".") {
            const ref = parseA1((s.charAt(start) === "$" ? "$" : "") + letters + (absR ? "$" : "") + digits);
            push("ref", a1(ref.r, ref.c, ref.absR, ref.absC), ref);
            continue;
          }
          i = start;
          if (s.charAt(i) === "$") {
            push("op", "$");
            i++;
            continue;
          }
          while (i < n && /[A-Za-z0-9_.]/.test(s.charAt(i))) i++;
          const ident = s.slice(start, i);
          if (s.charAt(i) === "!") {
            i++;
            push("sheet", ident);
            continue;
          }
          push("ident", ident);
          continue;
        }
      }
      push("bad", ch);
      i++;
    }
    push("eof");
    return tokens;
  }

  function parseFormula(src) {
    const tokens = tokenize(src);
    let i = 0;
    function peek() {
      return tokens[i] || { t: "eof" };
    }
    function eat() {
      return tokens[i++] || { t: "eof" };
    }
    function prec(tok) {
      if (!tok || tok.t === "eof") return -1;
      if (tok.t === "colon") return 80;
      if (tok.t === "op") {
        const o = tok.v;
        if (o === "^") return 60;
        if (o === "*" || o === "/") return 50;
        if (o === "+" || o === "-") return 40;
        if (o === "&") return 30;
        if (o === "=" || o === "<>" || o === "<" || o === ">" || o === "<=" || o === ">=") return 20;
      }
      return -1;
    }
    function rightAssoc(tok) {
      return tok && tok.t === "op" && tok.v === "^";
    }
    function parseRefMaybeSheet() {
      if (peek().t === "sheet") {
        const sh = eat().v;
        const r = parsePrefix();
        if (r.t === "ref" || r.t === "range") {
          r.sheet = sh;
          return r;
        }
        return { t: "err", v: ERR.REF };
      }
      return null;
    }
    function parsePrefix() {
      const sh = parseRefMaybeSheet();
      if (sh) return sh;
      const tok = eat();
      if (tok.t === "num") return { t: "num", v: tok.v };
      if (tok.t === "str") return { t: "str", v: tok.v };
      if (tok.t === "ref") return { t: "ref", r: tok.r, c: tok.c, absR: tok.absR, absC: tok.absC, sheet: null };
      if (tok.t === "ident") {
        const name = tok.v.toUpperCase();
        if (name === "TRUE") return { t: "bool", v: true };
        if (name === "FALSE") return { t: "bool", v: false };
        if (peek().t === "lp") {
          eat();
          const args = [];
          if (peek().t !== "rp") {
            args.push(parseExpr(0));
            while (peek().t === "sep") {
              eat();
              if (peek().t === "rp") break;
              args.push(parseExpr(0));
            }
          }
          if (peek().t === "rp") eat();
          return { t: "call", name: name, args: args };
        }
        return { t: "name", v: tok.v };
      }
      if (tok.t === "op" && (tok.v === "+" || tok.v === "-")) {
        return { t: "un", op: tok.v, a: parseExpr(70) };
      }
      if (tok.t === "lp") {
        const inner = parseExpr(0);
        if (peek().t === "rp") eat();
        return inner;
      }
      return { t: "err", v: ERR.VALUE };
    }
    function parseExpr(minP) {
      let left = parsePrefix();
      while (true) {
        if (peek().t === "pct" && 65 >= minP) {
          eat();
          left = { t: "pct", a: left };
          continue;
        }
        const p = prec(peek());
        if (p < minP) break;
        const tok = eat();
        if (tok.t === "colon") {
          const right = parseExpr(p + 1);
          left = { t: "range", a: left, b: right };
          continue;
        }
        const nextP = rightAssoc(tok) ? p : p + 1;
        const right = parseExpr(nextP);
        left = { t: "op", op: tok.v, a: left, b: right };
      }
      return left;
    }
    const ast = parseExpr(0);
    return ast;
  }

  function collectNums(vals, skipText) {
    const out = [];
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (isErr(v)) return v;
      if (v == null || v === "") continue;
      if (typeof v === "number") {
        if (Number.isFinite(v)) out.push(v);
        continue;
      }
      if (typeof v === "boolean") {
        out.push(v ? 1 : 0);
        continue;
      }
      if (typeof v === "string") {
        if (skipText) continue;
        const n = Number(v);
        if (Number.isFinite(n)) out.push(n);
      }
    }
    return out;
  }

  function flatten(ctx, args, keepEmpty) {
    const out = [];
    function walk(v) {
      if (isErr(v)) {
        out.push(v);
        return;
      }
      if (isRange(v)) {
        const cells = ctx.iterRange(v);
        for (let i = 0; i < cells.length; i++) {
          const x = cells[i];
          if (keepEmpty || (x != null && x !== "")) out.push(x);
        }
        return;
      }
      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) walk(v[i]);
        return;
      }
      if (keepEmpty || (v != null && v !== "")) out.push(v);
    }
    for (let i = 0; i < args.length; i++) walk(args[i]);
    return out;
  }

  function firstErr(list) {
    for (let i = 0; i < list.length; i++) if (isErr(list[i])) return list[i];
    return null;
  }

  function scalar(ctx, v) {
    if (isErr(v)) return v;
    if (isRange(v)) {
      if (v.r1 === v.r2 && v.c1 === v.c2) return ctx.getValue(v.sheetId, v.r1, v.c1);
      return ctx.getValue(v.sheetId, v.r1, v.c1);
    }
    return v;
  }

  function mean(nums) {
    if (!nums.length) return e(ERR.DIV);
    let s = 0;
    for (let i = 0; i < nums.length; i++) s += nums[i];
    return s / nums.length;
  }
  function variance(nums, sample) {
    if (nums.length < (sample ? 2 : 1)) return e(ERR.DIV);
    const m = mean(nums);
    if (isErr(m)) return m;
    let s = 0;
    for (let i = 0; i < nums.length; i++) {
      const d = nums[i] - m;
      s += d * d;
    }
    return s / (nums.length - (sample ? 1 : 0));
  }
  function percentile(nums, k) {
    if (!nums.length) return e(ERR.NUM);
    if (k < 0 || k > 1) return e(ERR.NUM);
    const a = nums.slice().sort(function (x, y) {
      return x - y;
    });
    const idx = (a.length - 1) * k;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return a[lo];
    return a[lo] + (a[hi] - a[lo]) * (idx - lo);
  }
  function gcd2(a, b) {
    a = Math.abs(Math.floor(a));
    b = Math.abs(Math.floor(b));
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  }
  function fact(n) {
    if (n < 0 || n > 170) return e(ERR.NUM);
    n = Math.floor(n);
    let x = 1;
    for (let i = 2; i <= n; i++) x *= i;
    return x;
  }
  function pmt(rate, nper, pv, fv, type) {
    fv = fv || 0;
    type = type || 0;
    if (rate === 0) return -(pv + fv) / nper;
    const pvif = Math.pow(1 + rate, nper);
    return -(rate * (pv * pvif + fv)) / ((1 + rate * type) * (pvif - 1));
  }
  function fvFn(rate, nper, pmtV, pv, type) {
    pv = pv || 0;
    type = type || 0;
    if (rate === 0) return -pv - pmtV * nper;
    const pow = Math.pow(1 + rate, nper);
    return -pv * pow - pmtV * (1 + rate * type) * (pow - 1) / rate;
  }
  function pvFn(rate, nper, pmtV, fv, type) {
    fv = fv || 0;
    type = type || 0;
    if (rate === 0) return -fv - pmtV * nper;
    const pow = Math.pow(1 + rate, nper);
    return (-fv - pmtV * (1 + rate * type) * (pow - 1) / rate) / pow;
  }
  function npvFn(rate, values) {
    let s = 0;
    for (let i = 0; i < values.length; i++) s += values[i] / Math.pow(1 + rate, i + 1);
    return s;
  }
  function irrFn(values, guess) {
    let r = guess == null ? 0.1 : guess;
    for (let i = 0; i < 80; i++) {
      let npv = 0;
      let d = 0;
      for (let t = 0; t < values.length; t++) {
        const den = Math.pow(1 + r, t);
        npv += values[t] / den;
        d -= t * values[t] / Math.pow(1 + r, t + 1);
      }
      if (Math.abs(d) < 1e-12) break;
      const nr = r - npv / d;
      if (Math.abs(nr - r) < 1e-10) return nr;
      r = nr;
    }
    return e(ERR.NUM);
  }
  function nperFn(rate, pmtV, pv, fv, type) {
    fv = fv || 0;
    type = type || 0;
    if (rate === 0) {
      if (pmtV === 0) return e(ERR.DIV);
      return -(pv + fv) / pmtV;
    }
    const a = pmtV * (1 + rate * type);
    const num = a - fv * rate;
    const den = pv * rate + a;
    if (num === 0 || den === 0 || num / den <= 0) return e(ERR.NUM);
    return Math.log(num / den) / Math.log(1 + rate);
  }
  function rateFn(nper, pmtV, pv, fv, type, guess) {
    fv = fv || 0;
    type = type || 0;
    let r = guess == null ? 0.1 : guess;
    for (let i = 0; i < 80; i++) {
      const f = fvFn(r, nper, pmtV, pv, type) - fv;
      const h = 1e-7;
      const df = (fvFn(r + h, nper, pmtV, pv, type) - fv - f) / h;
      if (Math.abs(df) < 1e-14) break;
      const nr = r - f / df;
      if (Math.abs(nr - r) < 1e-10) return nr;
      r = nr;
    }
    return e(ERR.NUM);
  }
  function ipmtFn(rate, per, nper, pv, fv, type) {
    type = type || 0;
    fv = fv || 0;
    const p = pmt(rate, nper, pv, fv, type);
    let remaining = pv;
    for (let i = 1; i <= per; i++) {
      const interest = remaining * rate;
      if (i === per) return -interest;
      remaining = remaining + interest + p;
    }
    return e(ERR.NUM);
  }

  function binToDec(s) {
    const t = String(s);
    if (!/^[01]+$/.test(t) || t.length > 10) return e(ERR.NUM);
    if (t.length === 10 && t.charAt(0) === "1") return parseInt(t, 2) - 1024;
    return parseInt(t, 2);
  }
  function decToBin(n, places) {
    n = Math.floor(Number(n));
    if (n < -512 || n > 511) return e(ERR.NUM);
    let s;
    if (n < 0) s = (n + 1024).toString(2);
    else s = n.toString(2);
    if (places != null) {
      places = Math.floor(places);
      if (places < s.length) return e(ERR.NUM);
      s = s.padStart(places, "0");
    }
    return s;
  }
  function hexToDec(s) {
    const t = String(s).toUpperCase();
    if (!/^[0-9A-F]+$/.test(t) || t.length > 10) return e(ERR.NUM);
    const n = parseInt(t, 16);
    if (t.length === 10 && t.charAt(0) >= "8") return n - Math.pow(2, 40);
    return n;
  }
  function decToHex(n, places) {
    n = Math.floor(Number(n));
    if (n < -549755813888 || n > 549755813887) return e(ERR.NUM);
    let v = n < 0 ? n + Math.pow(2, 40) : n;
    let s = v.toString(16).toUpperCase();
    if (places != null) {
      places = Math.floor(places);
      if (places < s.length) return e(ERR.NUM);
      s = s.padStart(places, "0");
    }
    return s;
  }
  function octToDec(s) {
    const t = String(s);
    if (!/^[0-7]+$/.test(t) || t.length > 10) return e(ERR.NUM);
    return parseInt(t, 8);
  }
  function decToOct(n, places) {
    n = Math.floor(Number(n));
    if (n < 0) return e(ERR.NUM);
    let s = n.toString(8);
    if (places != null) {
      places = Math.floor(places);
      if (places < s.length) return e(ERR.NUM);
      s = s.padStart(places, "0");
    }
    return s;
  }

  function proper(s) {
    return String(s).replace(/[A-Za-zÀ-ÿ]+/g, function (w) {
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
  }
  function excelText(value, fmt) {
    const f = String(fmt || "");
    if (typeof value === "number" && /y|m|d|h|s/i.test(f) && !/0|#/.test(f)) {
      const p = serialToParts(value);
      return f
        .replace(/yyyy/gi, String(p.y))
        .replace(/yy/gi, String(p.y).slice(-2))
        .replace(/mm/gi, String(p.m).padStart(2, "0"))
        .replace(/dd/gi, String(p.d).padStart(2, "0"))
        .replace(/hh/gi, String(p.H).padStart(2, "0"))
        .replace(/ss/gi, String(p.S).padStart(2, "0"));
    }
    if (typeof value === "number") {
      if (f.indexOf("%") >= 0) return (value * 100).toFixed((f.split(".")[1] || "").replace(/[^0]/g, "").length) + "%";
      const m = f.match(/0(?:\.0+)?/);
      if (m) {
        const dec = (m[0].split(".")[1] || "").length;
        return value.toFixed(dec);
      }
    }
    return toStr(value);
  }

  function isWeekend(serial) {
    const dow = serialToParts(serial).dow;
    return dow === 0 || dow === 6;
  }
  function holidaySet(ctx, holidays) {
    const set = new Set();
    if (holidays == null) return set;
    const list = flatten(ctx, [holidays], false);
    for (let i = 0; i < list.length; i++) {
      const n = toNum(list[i]);
      if (!isErr(n)) set.add(Math.floor(n));
    }
    return set;
  }

  const FUN = {};

  FUN.SUM = function (ctx, args) {
    const vals = flatten(ctx, args, false);
    const err = firstErr(vals);
    if (err) return err;
    const nums = collectNums(vals, true);
    if (isErr(nums)) return nums;
    let s = 0;
    for (let i = 0; i < nums.length; i++) s += nums[i];
    return s;
  };
  FUN.PRODUCT = function (ctx, args) {
    const vals = flatten(ctx, args, false);
    const err = firstErr(vals);
    if (err) return err;
    const nums = collectNums(vals, true);
    if (isErr(nums)) return nums;
    if (!nums.length) return 0;
    let s = 1;
    for (let i = 0; i < nums.length; i++) s *= nums[i];
    return s;
  };
  FUN.SUMSQ = function (ctx, args) {
    const vals = flatten(ctx, args, false);
    const nums = collectNums(vals, true);
    if (isErr(nums)) return nums;
    let s = 0;
    for (let i = 0; i < nums.length; i++) s += nums[i] * nums[i];
    return s;
  };
  FUN.ABS = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : Math.abs(n);
  };
  FUN.SIGN = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    if (isErr(n)) return n;
    return n > 0 ? 1 : n < 0 ? -1 : 0;
  };
  FUN.SQRT = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    if (isErr(n) || n < 0) return isErr(n) ? n : e(ERR.NUM);
    return Math.sqrt(n);
  };
  FUN.POWER = function (ctx, args) {
    const a = toNum(scalar(ctx, args[0]));
    const b = toNum(scalar(ctx, args[1]));
    if (isErr(a)) return a;
    if (isErr(b)) return b;
    const r = Math.pow(a, b);
    return Number.isFinite(r) ? r : e(ERR.NUM);
  };
  FUN.EXP = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    if (isErr(n)) return n;
    const r = Math.exp(n);
    return Number.isFinite(r) ? r : e(ERR.NUM);
  };
  FUN.LN = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    if (isErr(n) || n <= 0) return isErr(n) ? n : e(ERR.NUM);
    return Math.log(n);
  };
  FUN.LOG = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    const b = args[1] == null ? 10 : toNum(scalar(ctx, args[1]));
    if (isErr(n)) return n;
    if (isErr(b) || n <= 0 || b <= 0 || b === 1) return e(ERR.NUM);
    return Math.log(n) / Math.log(b);
  };
  FUN.LOG10 = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    if (isErr(n) || n <= 0) return isErr(n) ? n : e(ERR.NUM);
    return Math.log10(n);
  };
  FUN.MOD = function (ctx, args) {
    const a = toNum(scalar(ctx, args[0]));
    const b = toNum(scalar(ctx, args[1]));
    if (isErr(a)) return a;
    if (isErr(b) || b === 0) return e(ERR.DIV);
    return a - b * Math.floor(a / b);
  };
  FUN.QUOTIENT = function (ctx, args) {
    const a = toNum(scalar(ctx, args[0]));
    const b = toNum(scalar(ctx, args[1]));
    if (isErr(a)) return a;
    if (isErr(b) || b === 0) return e(ERR.DIV);
    return a > 0 ? Math.floor(a / b) : Math.ceil(a / b);
  };
  FUN.INT = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : Math.floor(n);
  };
  FUN.TRUNC = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    const d = args[1] == null ? 0 : toNum(scalar(ctx, args[1]));
    if (isErr(n)) return n;
    if (isErr(d)) return d;
    const f = Math.pow(10, d);
    return (n < 0 ? Math.ceil(n * f) : Math.floor(n * f)) / f;
  };
  FUN.ROUND = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    const d = args[1] == null ? 0 : toNum(scalar(ctx, args[1]));
    if (isErr(n)) return n;
    if (isErr(d)) return d;
    const f = Math.pow(10, d);
    return Math.round(n * f + (n >= 0 ? 1e-12 : -1e-12)) / f;
  };
  FUN.ROUNDUP = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    const d = args[1] == null ? 0 : toNum(scalar(ctx, args[1]));
    if (isErr(n) || isErr(d)) return isErr(n) ? n : d;
    const f = Math.pow(10, d);
    return (n >= 0 ? Math.ceil(n * f - 1e-12) : Math.floor(n * f + 1e-12)) / f;
  };
  FUN.ROUNDDOWN = FUN.TRUNC;
  FUN.MROUND = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    const m = toNum(scalar(ctx, args[1]));
    if (isErr(n) || isErr(m) || m === 0) return e(ERR.NUM);
    if (n * m < 0) return e(ERR.NUM);
    return Math.round(n / m) * m;
  };
  FUN.CEILING = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    const m = args[1] == null ? 1 : toNum(scalar(ctx, args[1]));
    if (isErr(n) || isErr(m) || m === 0) return e(ERR.NUM);
    return Math.ceil(n / m) * m;
  };
  FUN.FLOOR = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    const m = args[1] == null ? 1 : toNum(scalar(ctx, args[1]));
    if (isErr(n) || isErr(m) || m === 0) return e(ERR.NUM);
    return Math.floor(n / m) * m;
  };
  FUN.EVEN = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    if (isErr(n)) return n;
    return n >= 0 ? Math.ceil(n / 2) * 2 : Math.floor(n / 2) * 2;
  };
  FUN.ODD = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    if (isErr(n)) return n;
    if (n >= 0) {
      const x = Math.ceil(n);
      return x % 2 === 0 ? x + 1 : x;
    }
    const x = Math.floor(n);
    return x % 2 === 0 ? x - 1 : x;
  };
  FUN.FACT = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : fact(n);
  };
  FUN.GCD = function (ctx, args) {
    const vals = flatten(ctx, args, false);
    const nums = collectNums(vals, true);
    if (isErr(nums) || !nums.length) return e(ERR.VALUE);
    let g = Math.abs(Math.floor(nums[0]));
    for (let i = 1; i < nums.length; i++) g = gcd2(g, nums[i]);
    return g;
  };
  FUN.LCM = function (ctx, args) {
    const vals = flatten(ctx, args, false);
    const nums = collectNums(vals, true);
    if (isErr(nums) || !nums.length) return e(ERR.VALUE);
    let l = Math.abs(Math.floor(nums[0]));
    for (let i = 1; i < nums.length; i++) {
      const b = Math.abs(Math.floor(nums[i]));
      l = Math.abs(l * b) / (gcd2(l, b) || 1);
    }
    return l;
  };
  FUN.PI = function () {
    return Math.PI;
  };
  FUN.RAND = function (ctx) {
    ctx.volatile = true;
    return Math.random();
  };
  FUN.RANDBETWEEN = function (ctx, args) {
    ctx.volatile = true;
    const a = toNum(scalar(ctx, args[0]));
    const b = toNum(scalar(ctx, args[1]));
    if (isErr(a) || isErr(b)) return isErr(a) ? a : b;
    const lo = Math.ceil(Math.min(a, b));
    const hi = Math.floor(Math.max(a, b));
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  };
  function trig(fn, ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : fn(n);
  }
  FUN.SIN = function (c, a) {
    return trig(Math.sin, c, a);
  };
  FUN.COS = function (c, a) {
    return trig(Math.cos, c, a);
  };
  FUN.TAN = function (c, a) {
    return trig(Math.tan, c, a);
  };
  FUN.ASIN = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    if (isErr(n) || n < -1 || n > 1) return e(ERR.NUM);
    return Math.asin(n);
  };
  FUN.ACOS = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    if (isErr(n) || n < -1 || n > 1) return e(ERR.NUM);
    return Math.acos(n);
  };
  FUN.ATAN = function (c, a) {
    return trig(Math.atan, c, a);
  };
  FUN.ATAN2 = function (ctx, args) {
    const x = toNum(scalar(ctx, args[0]));
    const y = toNum(scalar(ctx, args[1]));
    if (isErr(x) || isErr(y)) return isErr(x) ? x : y;
    if (x === 0 && y === 0) return e(ERR.DIV);
    return Math.atan2(y, x);
  };
  FUN.DEGREES = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : (n * 180) / Math.PI;
  };
  FUN.RADIANS = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : (n * Math.PI) / 180;
  };
  FUN.SINH = function (c, a) {
    return trig(Math.sinh, c, a);
  };
  FUN.COSH = function (c, a) {
    return trig(Math.cosh, c, a);
  };
  FUN.TANH = function (c, a) {
    return trig(Math.tanh, c, a);
  };

  function ifRange(ctx, rangeArg, critArg, sumArg, mode) {
    const range = isRange(rangeArg) ? rangeArg : null;
    if (!range) return e(ERR.VALUE);
    const crit = scalar(ctx, critArg);
    const target = sumArg == null ? range : isRange(sumArg) ? sumArg : null;
    if (sumArg != null && !target) return e(ERR.VALUE);
    let sum = 0;
    let count = 0;
    let n = 0;
    const h = range.r2 - range.r1;
    const w = range.c2 - range.c1;
    for (let i = 0; i <= h; i++) {
      for (let j = 0; j <= w; j++) {
        const v = ctx.getValue(range.sheetId, range.r1 + i, range.c1 + j);
        if (!matchCriteria(v, crit)) continue;
        n++;
        if (mode === "count") continue;
        const tv = target
          ? ctx.getValue(target.sheetId, target.r1 + i, target.c1 + j)
          : v;
        const num = typeof tv === "number" ? tv : Number(tv);
        if (typeof tv === "number" || (typeof tv === "string" && tv !== "" && Number.isFinite(num))) {
          sum += typeof tv === "number" ? tv : num;
          count++;
        } else if (typeof tv === "boolean") {
          sum += tv ? 1 : 0;
          count++;
        }
      }
    }
    if (mode === "count") return n;
    if (mode === "avg") return count ? sum / count : e(ERR.DIV);
    return sum;
  }
  FUN.SUMIF = function (ctx, args) {
    return ifRange(ctx, args[0], args[1], args[2], "sum");
  };
  FUN.AVERAGEIF = function (ctx, args) {
    return ifRange(ctx, args[0], args[1], args[2], "avg");
  };
  FUN.COUNTIF = function (ctx, args) {
    return ifRange(ctx, args[0], args[1], null, "count");
  };
  function multiIf(ctx, args, mode) {
    const sumRange = isRange(args[0]) ? args[0] : null;
    if (!sumRange) return e(ERR.VALUE);
    const pairs = [];
    for (let i = 1; i < args.length; i += 2) {
      if (!isRange(args[i]) || args[i + 1] == null) return e(ERR.VALUE);
      pairs.push([args[i], scalar(ctx, args[i + 1])]);
    }
    const h = sumRange.r2 - sumRange.r1;
    const w = sumRange.c2 - sumRange.c1;
    let sum = 0;
    let count = 0;
    let n = 0;
    for (let r = 0; r <= h; r++) {
      for (let c = 0; c <= w; c++) {
        let ok = true;
        for (let p = 0; p < pairs.length; p++) {
          const rg = pairs[p][0];
          const v = ctx.getValue(rg.sheetId, rg.r1 + r, rg.c1 + c);
          if (!matchCriteria(v, pairs[p][1])) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        n++;
        const tv = ctx.getValue(sumRange.sheetId, sumRange.r1 + r, sumRange.c1 + c);
        if (mode === "count") continue;
        if (typeof tv === "number") {
          sum += tv;
          count++;
        }
      }
    }
    if (mode === "count") return n;
    if (mode === "avg") return count ? sum / count : e(ERR.DIV);
    return sum;
  }
  FUN.SUMIFS = function (ctx, args) {
    return multiIf(ctx, args, "sum");
  };
  FUN.AVERAGEIFS = function (ctx, args) {
    return multiIf(ctx, args, "avg");
  };
  FUN.COUNTIFS = function (ctx, args) {
    const packed = [args[0]].concat(args);
    return multiIf(ctx, packed, "count");
  };
  FUN.SUMPRODUCT = function (ctx, args) {
    const ranges = args.filter(isRange);
    if (!ranges.length) {
      const vals = flatten(ctx, args, false);
      const nums = collectNums(vals, true);
      return isErr(nums) ? nums : nums.reduce(function (a, b) {
        return a + b;
      }, 0);
    }
    const h = ranges[0].r2 - ranges[0].r1;
    const w = ranges[0].c2 - ranges[0].c1;
    let s = 0;
    for (let r = 0; r <= h; r++) {
      for (let c = 0; c <= w; c++) {
        let p = 1;
        for (let i = 0; i < ranges.length; i++) {
          const v = ctx.getValue(ranges[i].sheetId, ranges[i].r1 + r, ranges[i].c1 + c);
          const n = toNum(v == null || v === "" ? 0 : v);
          if (isErr(n)) return n;
          p *= n;
        }
        s += p;
      }
    }
    return s;
  };
  FUN.AVERAGE = function (ctx, args) {
    const nums = collectNums(flatten(ctx, args, false), true);
    if (isErr(nums)) return nums;
    return mean(nums);
  };
  FUN.MEDIAN = function (ctx, args) {
    const nums = collectNums(flatten(ctx, args, false), true);
    if (isErr(nums) || !nums.length) return e(ERR.NUM);
    nums.sort(function (a, b) {
      return a - b;
    });
    const m = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[m] : (nums[m - 1] + nums[m]) / 2;
  };
  FUN.MODE = function (ctx, args) {
    const nums = collectNums(flatten(ctx, args, false), true);
    if (isErr(nums) || !nums.length) return e(ERR.NA);
    const map = new Map();
    let best = nums[0];
    let bestN = 0;
    for (let i = 0; i < nums.length; i++) {
      const k = nums[i];
      const n = (map.get(k) || 0) + 1;
      map.set(k, n);
      if (n > bestN) {
        bestN = n;
        best = k;
      }
    }
    return bestN < 2 ? e(ERR.NA) : best;
  };
  FUN.MIN = function (ctx, args) {
    const nums = collectNums(flatten(ctx, args, false), true);
    if (isErr(nums) || !nums.length) return 0;
    return Math.min.apply(null, nums);
  };
  FUN.MAX = function (ctx, args) {
    const nums = collectNums(flatten(ctx, args, false), true);
    if (isErr(nums) || !nums.length) return 0;
    return Math.max.apply(null, nums);
  };
  FUN.COUNT = function (ctx, args) {
    const vals = flatten(ctx, args, true);
    let n = 0;
    for (let i = 0; i < vals.length; i++) {
      if (typeof vals[i] === "number") n++;
      else if (typeof vals[i] === "boolean") n++;
      else if (typeof vals[i] === "string" && vals[i] !== "" && Number.isFinite(Number(vals[i]))) n++;
    }
    return n;
  };
  FUN.COUNTA = function (ctx, args) {
    const vals = flatten(ctx, args, true);
    let n = 0;
    for (let i = 0; i < vals.length; i++) if (vals[i] != null && vals[i] !== "") n++;
    return n;
  };
  FUN.COUNTBLANK = function (ctx, args) {
    const v = args[0];
    if (!isRange(v)) return scalar(ctx, v) == null || scalar(ctx, v) === "" ? 1 : 0;
    let n = 0;
    ctx.iterRange(v, true).forEach(function (x) {
      if (x == null || x === "") n++;
    });
    return n;
  };
  FUN.STDEV = function (ctx, args) {
    const v = variance(collectNums(flatten(ctx, args, false), true), true);
    return isErr(v) ? v : Math.sqrt(v);
  };
  FUN["STDEV.S"] = FUN.STDEV;
  FUN["STDEV.P"] = function (ctx, args) {
    const v = variance(collectNums(flatten(ctx, args, false), true), false);
    return isErr(v) ? v : Math.sqrt(v);
  };
  FUN.VAR = function (ctx, args) {
    return variance(collectNums(flatten(ctx, args, false), true), true);
  };
  FUN["VAR.S"] = FUN.VAR;
  FUN["VAR.P"] = function (ctx, args) {
    return variance(collectNums(flatten(ctx, args, false), true), false);
  };
  FUN.LARGE = function (ctx, args) {
    const nums = collectNums(flatten(ctx, [args[0]], false), true);
    const k = toNum(scalar(ctx, args[1]));
    if (isErr(nums) || isErr(k) || k < 1 || k > nums.length) return e(ERR.NUM);
    nums.sort(function (a, b) {
      return b - a;
    });
    return nums[Math.floor(k) - 1];
  };
  FUN.SMALL = function (ctx, args) {
    const nums = collectNums(flatten(ctx, [args[0]], false), true);
    const k = toNum(scalar(ctx, args[1]));
    if (isErr(nums) || isErr(k) || k < 1 || k > nums.length) return e(ERR.NUM);
    nums.sort(function (a, b) {
      return a - b;
    });
    return nums[Math.floor(k) - 1];
  };
  FUN.RANK = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    const nums = collectNums(flatten(ctx, [args[1]], false), true);
    const order = args[2] == null ? 0 : toNum(scalar(ctx, args[2]));
    if (isErr(n) || isErr(nums)) return e(ERR.NA);
    const sorted = nums.slice().sort(function (a, b) {
      return order ? a - b : b - a;
    });
    const idx = sorted.indexOf(n);
    return idx < 0 ? e(ERR.NA) : idx + 1;
  };
  FUN.PERCENTILE = function (ctx, args) {
    const nums = collectNums(flatten(ctx, [args[0]], false), true);
    const k = toNum(scalar(ctx, args[1]));
    if (isErr(nums) || isErr(k)) return e(ERR.NUM);
    return percentile(nums, k);
  };
  FUN.QUARTILE = function (ctx, args) {
    const nums = collectNums(flatten(ctx, [args[0]], false), true);
    const q = toNum(scalar(ctx, args[1]));
    if (isErr(nums) || isErr(q) || q < 0 || q > 4) return e(ERR.NUM);
    return percentile(nums, Math.floor(q) / 4);
  };
  FUN.CORREL = function (ctx, args) {
    if (!isRange(args[0]) || !isRange(args[1])) return e(ERR.VALUE);
    const a = collectNums(flatten(ctx, [args[0]], true), true);
    const b = collectNums(flatten(ctx, [args[1]], true), true);
    const n = Math.min(a.length, b.length);
    if (n < 2) return e(ERR.DIV);
    const ma = mean(a.slice(0, n));
    const mb = mean(b.slice(0, n));
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < n; i++) {
      const xa = a[i] - ma;
      const xb = b[i] - mb;
      num += xa * xb;
      da += xa * xa;
      db += xb * xb;
    }
    if (!da || !db) return e(ERR.DIV);
    return num / Math.sqrt(da * db);
  };

  FUN.IF = function (ctx, args) {
    const c = toBool(scalar(ctx, args[0]));
    if (isErr(c)) return c;
    return c ? (args[1] == null ? true : scalar(ctx, args[1])) : args[2] == null ? false : scalar(ctx, args[2]);
  };
  FUN.IFS = function (ctx, args) {
    for (let i = 0; i < args.length; i += 2) {
      const c = toBool(scalar(ctx, args[i]));
      if (isErr(c)) return c;
      if (c) return scalar(ctx, args[i + 1]);
    }
    return e(ERR.NA);
  };
  FUN.AND = function (ctx, args) {
    const vals = flatten(ctx, args, false);
    if (!vals.length) return e(ERR.VALUE);
    for (let i = 0; i < vals.length; i++) {
      if (isErr(vals[i])) return vals[i];
      if (!toBool(vals[i])) return false;
    }
    return true;
  };
  FUN.OR = function (ctx, args) {
    const vals = flatten(ctx, args, false);
    if (!vals.length) return e(ERR.VALUE);
    for (let i = 0; i < vals.length; i++) {
      if (isErr(vals[i])) return vals[i];
      if (toBool(vals[i])) return true;
    }
    return false;
  };
  FUN.XOR = function (ctx, args) {
    const vals = flatten(ctx, args, false);
    let n = 0;
    for (let i = 0; i < vals.length; i++) {
      if (isErr(vals[i])) return vals[i];
      if (toBool(vals[i])) n++;
    }
    return n % 2 === 1;
  };
  FUN.NOT = function (ctx, args) {
    const c = toBool(scalar(ctx, args[0]));
    return isErr(c) ? c : !c;
  };
  FUN.TRUE = function () {
    return true;
  };
  FUN.FALSE = function () {
    return false;
  };
  FUN.IFERROR = function (ctx, args) {
    const v = scalar(ctx, args[0]);
    return isErr(v) ? scalar(ctx, args[1]) : v;
  };
  FUN.IFNA = function (ctx, args) {
    const v = scalar(ctx, args[0]);
    return isErr(v) && v.error === ERR.NA ? scalar(ctx, args[1]) : v;
  };
  FUN.SWITCH = function (ctx, args) {
    const expr = scalar(ctx, args[0]);
    for (let i = 1; i < args.length - 1; i += 2) {
      if (toStr(scalar(ctx, args[i])) === toStr(expr) || scalar(ctx, args[i]) === expr) return scalar(ctx, args[i + 1]);
    }
    if (args.length % 2 === 0) return scalar(ctx, args[args.length - 1]);
    return e(ERR.NA);
  };

  function lookupExact(list, value) {
    for (let i = 0; i < list.length; i++) {
      if (list[i] === value) return i;
      if (typeof list[i] === "string" && typeof value === "string" && list[i].toLowerCase() === value.toLowerCase()) return i;
      if (typeof list[i] === "number" && typeof value === "number" && list[i] === value) return i;
    }
    return -1;
  }
  function lookupApprox(list, value) {
    let best = -1;
    for (let i = 0; i < list.length; i++) {
      if (typeof list[i] === "number" && typeof value === "number") {
        if (list[i] <= value) best = i;
        else break;
      } else if (toStr(list[i]).toLowerCase() <= toStr(value).toLowerCase()) best = i;
      else break;
    }
    return best;
  }
  FUN.VLOOKUP = function (ctx, args) {
    const lookup = scalar(ctx, args[0]);
    const table = args[1];
    const col = toNum(scalar(ctx, args[2]));
    const approx = args[3] == null ? true : toBool(scalar(ctx, args[3]));
    if (!isRange(table) || isErr(col) || col < 1) return e(ERR.VALUE);
    const colIdx = Math.floor(col) - 1;
    if (colIdx > table.c2 - table.c1) return e(ERR.REF);
    const keys = [];
    for (let r = table.r1; r <= table.r2; r++) keys.push(ctx.getValue(table.sheetId, r, table.c1));
    const idx = approx && approx !== false && approx !== 0 ? lookupApprox(keys, lookup) : lookupExact(keys, lookup);
    if (idx < 0) return e(ERR.NA);
    return ctx.getValue(table.sheetId, table.r1 + idx, table.c1 + colIdx);
  };
  FUN.HLOOKUP = function (ctx, args) {
    const lookup = scalar(ctx, args[0]);
    const table = args[1];
    const row = toNum(scalar(ctx, args[2]));
    const approx = args[3] == null ? true : toBool(scalar(ctx, args[3]));
    if (!isRange(table) || isErr(row) || row < 1) return e(ERR.VALUE);
    const rowIdx = Math.floor(row) - 1;
    if (rowIdx > table.r2 - table.r1) return e(ERR.REF);
    const keys = [];
    for (let c = table.c1; c <= table.c2; c++) keys.push(ctx.getValue(table.sheetId, table.r1, c));
    const idx = approx && approx !== false && approx !== 0 ? lookupApprox(keys, lookup) : lookupExact(keys, lookup);
    if (idx < 0) return e(ERR.NA);
    return ctx.getValue(table.sheetId, table.r1 + rowIdx, table.c1 + idx);
  };
  FUN.INDEX = function (ctx, args) {
    const range = args[0];
    const row = args[1] == null ? 1 : toNum(scalar(ctx, args[1]));
    const col = args[2] == null ? 1 : toNum(scalar(ctx, args[2]));
    if (!isRange(range) || isErr(row) || isErr(col)) return e(ERR.VALUE);
    const rr = range.r1 + Math.max(0, Math.floor(row) - 1);
    const cc = range.c1 + Math.max(0, Math.floor(col) - 1);
    if (rr > range.r2 || cc > range.c2) return e(ERR.REF);
    return ctx.getValue(range.sheetId, rr, cc);
  };
  FUN.MATCH = function (ctx, args) {
    const lookup = scalar(ctx, args[0]);
    const range = args[1];
    const type = args[2] == null ? 1 : toNum(scalar(ctx, args[2]));
    if (!isRange(range)) return e(ERR.VALUE);
    const list = flatten(ctx, [range], true);
    let idx = -1;
    if (type === 0) idx = lookupExact(list, lookup);
    else if (type === -1) {
      for (let i = 0; i < list.length; i++) {
        if (typeof list[i] === "number" && typeof lookup === "number" && list[i] >= lookup) idx = i;
      }
    } else idx = lookupApprox(list, lookup);
    return idx < 0 ? e(ERR.NA) : idx + 1;
  };
  FUN.CHOOSE = function (ctx, args) {
    const i = toNum(scalar(ctx, args[0]));
    if (isErr(i) || i < 1 || i >= args.length) return e(ERR.VALUE);
    return scalar(ctx, args[Math.floor(i)]);
  };
  FUN.LOOKUP = function (ctx, args) {
    const lookup = scalar(ctx, args[0]);
    const vec = args[1];
    const res = args[2] || vec;
    if (!isRange(vec)) return e(ERR.VALUE);
    const list = flatten(ctx, [vec], true);
    const idx = lookupApprox(list, lookup);
    if (idx < 0) return e(ERR.NA);
    if (isRange(res)) {
      const vals = flatten(ctx, [res], true);
      return vals[idx] == null ? e(ERR.NA) : vals[idx];
    }
    return list[idx];
  };
  FUN.XLOOKUP = function (ctx, args) {
    const lookup = scalar(ctx, args[0]);
    const lookRange = args[1];
    const retRange = args[2];
    const ifna = args[3];
    if (!isRange(lookRange) || !isRange(retRange)) return e(ERR.VALUE);
    const list = flatten(ctx, [lookRange], true);
    const idx = lookupExact(list, lookup);
    if (idx < 0) return ifna == null ? e(ERR.NA) : scalar(ctx, ifna);
    const rets = flatten(ctx, [retRange], true);
    return rets[idx] == null ? e(ERR.NA) : rets[idx];
  };
  FUN.ROW = function (ctx, args) {
    if (!args.length) return ctx.row + 1;
    if (isRange(args[0])) return args[0].r1 + 1;
    return e(ERR.VALUE);
  };
  FUN.COLUMN = function (ctx, args) {
    if (!args.length) return ctx.col + 1;
    if (isRange(args[0])) return args[0].c1 + 1;
    return e(ERR.VALUE);
  };
  FUN.ROWS = function (ctx, args) {
    if (isRange(args[0])) return args[0].r2 - args[0].r1 + 1;
    return 1;
  };
  FUN.COLUMNS = function (ctx, args) {
    if (isRange(args[0])) return args[0].c2 - args[0].c1 + 1;
    return 1;
  };
  FUN.ADDRESS = function (ctx, args) {
    const r = toNum(scalar(ctx, args[0]));
    const c = toNum(scalar(ctx, args[1]));
    const abs = args[2] == null ? 1 : toNum(scalar(ctx, args[2]));
    const sheet = args[4] == null ? "" : toStr(scalar(ctx, args[4]));
    if (isErr(r) || isErr(c) || r < 1 || c < 1) return e(ERR.VALUE);
    const absC = abs === 1 || abs === 3;
    const absR = abs === 1 || abs === 2;
    let a = a1(Math.floor(r) - 1, Math.floor(c) - 1, absR, absC);
    if (sheet) a = (/[^A-Za-z0-9_]/.test(sheet) ? "'" + sheet.replace(/'/g, "''") + "'" : sheet) + "!" + a;
    return a;
  };
  FUN.INDIRECT = function (ctx, args) {
    ctx.volatile = true;
    const text = toStr(scalar(ctx, args[0]));
    const parsed = parseAddress(text, ctx.sheetId, ctx.wb);
    if (!parsed) return e(ERR.REF);
    if (parsed.range) return parsed;
    return ctx.getValue(parsed.sheetId, parsed.r, parsed.c);
  };
  FUN.OFFSET = function (ctx, args) {
    ctx.volatile = true;
    const base = args[0];
    if (!isRange(base) && !(base && base.t === "ref")) {
      if (!isRange(base)) return e(ERR.VALUE);
    }
    const rows = toNum(scalar(ctx, args[1]));
    const cols = toNum(scalar(ctx, args[2]));
    const h = args[3] == null ? (isRange(base) ? base.r2 - base.r1 + 1 : 1) : toNum(scalar(ctx, args[3]));
    const w = args[4] == null ? (isRange(base) ? base.c2 - base.c1 + 1 : 1) : toNum(scalar(ctx, args[4]));
    if (isErr(rows) || isErr(cols) || isErr(h) || isErr(w)) return e(ERR.VALUE);
    const r1 = (isRange(base) ? base.r1 : 0) + Math.floor(rows);
    const c1 = (isRange(base) ? base.c1 : 0) + Math.floor(cols);
    const r2 = r1 + Math.floor(h) - 1;
    const c2 = c1 + Math.floor(w) - 1;
    const sheetId = isRange(base) ? base.sheetId : ctx.sheetId;
    if (!clampRC(r1, c1) || !clampRC(r2, c2)) return e(ERR.REF);
    if (h === 1 && w === 1) return ctx.getValue(sheetId, r1, c1);
    return rng(sheetId, r1, c1, r2, c2);
  };

  FUN.CONCAT = function (ctx, args) {
    return flatten(ctx, args, true)
      .map(toStr)
      .join("");
  };
  FUN.CONCATENATE = FUN.CONCAT;
  FUN.TEXTJOIN = function (ctx, args) {
    const delim = toStr(scalar(ctx, args[0]));
    const skip = toBool(scalar(ctx, args[1]));
    const vals = flatten(ctx, args.slice(2), !skip);
    const parts = [];
    for (let i = 0; i < vals.length; i++) {
      if (skip && (vals[i] == null || vals[i] === "")) continue;
      parts.push(toStr(vals[i]));
    }
    return parts.join(delim);
  };
  FUN.LEFT = function (ctx, args) {
    const s = toStr(scalar(ctx, args[0]));
    const n = args[1] == null ? 1 : toNum(scalar(ctx, args[1]));
    if (isErr(n)) return n;
    return s.slice(0, Math.max(0, Math.floor(n)));
  };
  FUN.RIGHT = function (ctx, args) {
    const s = toStr(scalar(ctx, args[0]));
    const n = args[1] == null ? 1 : toNum(scalar(ctx, args[1]));
    if (isErr(n)) return n;
    return s.slice(-Math.max(0, Math.floor(n)));
  };
  FUN.MID = function (ctx, args) {
    const s = toStr(scalar(ctx, args[0]));
    const start = toNum(scalar(ctx, args[1]));
    const n = toNum(scalar(ctx, args[2]));
    if (isErr(start) || isErr(n) || start < 1) return e(ERR.VALUE);
    return s.substr(Math.floor(start) - 1, Math.max(0, Math.floor(n)));
  };
  FUN.LEN = function (ctx, args) {
    return toStr(scalar(ctx, args[0])).length;
  };
  FUN.TRIM = function (ctx, args) {
    return toStr(scalar(ctx, args[0])).replace(/\s+/g, " ").trim();
  };
  FUN.UPPER = function (ctx, args) {
    return toStr(scalar(ctx, args[0])).toUpperCase();
  };
  FUN.LOWER = function (ctx, args) {
    return toStr(scalar(ctx, args[0])).toLowerCase();
  };
  FUN.PROPER = function (ctx, args) {
    return proper(toStr(scalar(ctx, args[0])));
  };
  FUN.FIND = function (ctx, args) {
    const find = toStr(scalar(ctx, args[0]));
    const within = toStr(scalar(ctx, args[1]));
    const start = args[2] == null ? 1 : toNum(scalar(ctx, args[2]));
    if (isErr(start)) return start;
    const idx = within.indexOf(find, Math.max(0, Math.floor(start) - 1));
    return idx < 0 ? e(ERR.VALUE) : idx + 1;
  };
  FUN.SEARCH = function (ctx, args) {
    const find = toStr(scalar(ctx, args[0])).toLowerCase();
    const within = toStr(scalar(ctx, args[1])).toLowerCase();
    const start = args[2] == null ? 1 : toNum(scalar(ctx, args[2]));
    if (isErr(start)) return start;
    const idx = within.indexOf(find, Math.max(0, Math.floor(start) - 1));
    return idx < 0 ? e(ERR.VALUE) : idx + 1;
  };
  FUN.SUBSTITUTE = function (ctx, args) {
    const text = toStr(scalar(ctx, args[0]));
    const old = toStr(scalar(ctx, args[1]));
    const neu = toStr(scalar(ctx, args[2]));
    const inst = args[3] == null ? null : toNum(scalar(ctx, args[3]));
    if (!old) return text;
    if (inst == null) return text.split(old).join(neu);
    if (isErr(inst) || inst < 1) return e(ERR.VALUE);
    let n = 0;
    let out = "";
    let i = 0;
    const target = Math.floor(inst);
    while (i < text.length) {
      if (text.substr(i, old.length) === old) {
        n++;
        if (n === target) {
          out += neu;
          i += old.length;
          continue;
        }
      }
      out += text.charAt(i);
      i++;
    }
    return out;
  };
  FUN.REPLACE = function (ctx, args) {
    const text = toStr(scalar(ctx, args[0]));
    const start = toNum(scalar(ctx, args[1]));
    const n = toNum(scalar(ctx, args[2]));
    const neu = toStr(scalar(ctx, args[3]));
    if (isErr(start) || isErr(n) || start < 1) return e(ERR.VALUE);
    const i = Math.floor(start) - 1;
    return text.slice(0, i) + neu + text.slice(i + Math.floor(n));
  };
  FUN.REPT = function (ctx, args) {
    const s = toStr(scalar(ctx, args[0]));
    const n = toNum(scalar(ctx, args[1]));
    if (isErr(n) || n < 0) return e(ERR.VALUE);
    return s.repeat(Math.min(10000, Math.floor(n)));
  };
  FUN.VALUE = function (ctx, args) {
    const s = toStr(scalar(ctx, args[0])).replace(/,/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : e(ERR.VALUE);
  };
  FUN.TEXT = function (ctx, args) {
    const v = scalar(ctx, args[0]);
    const f = toStr(scalar(ctx, args[1]));
    if (isErr(v)) return v;
    return excelText(v, f);
  };
  FUN.CHAR = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    if (isErr(n) || n < 1 || n > 255) return e(ERR.VALUE);
    return String.fromCharCode(Math.floor(n));
  };
  FUN.CODE = function (ctx, args) {
    const s = toStr(scalar(ctx, args[0]));
    return s ? s.charCodeAt(0) : e(ERR.VALUE);
  };
  FUN.EXACT = function (ctx, args) {
    return toStr(scalar(ctx, args[0])) === toStr(scalar(ctx, args[1]));
  };
  FUN.CLEAN = function (ctx, args) {
    return toStr(scalar(ctx, args[0])).replace(/[\x00-\x1F]/g, "");
  };
  FUN.T = function (ctx, args) {
    const v = scalar(ctx, args[0]);
    return typeof v === "string" ? v : "";
  };
  FUN.NUMBERVALUE = function (ctx, args) {
    let s = toStr(scalar(ctx, args[0]));
    const dec = args[1] == null ? "." : toStr(scalar(ctx, args[1]));
    const grp = args[2] == null ? "," : toStr(scalar(ctx, args[2]));
    if (grp) s = s.split(grp).join("");
    if (dec && dec !== ".") s = s.replace(dec, ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : e(ERR.VALUE);
  };

  FUN.DATE = function (ctx, args) {
    const y = toNum(scalar(ctx, args[0]));
    const m = toNum(scalar(ctx, args[1]));
    const d = toNum(scalar(ctx, args[2]));
    if (isErr(y) || isErr(m) || isErr(d)) return e(ERR.VALUE);
    return dateToSerial(y, m, d);
  };
  FUN.TIME = function (ctx, args) {
    const h = toNum(scalar(ctx, args[0]));
    const m = toNum(scalar(ctx, args[1]));
    const s = toNum(scalar(ctx, args[2]));
    if (isErr(h) || isErr(m) || isErr(s)) return e(ERR.VALUE);
    return (h * 3600 + m * 60 + s) / 86400;
  };
  FUN.NOW = function (ctx) {
    ctx.volatile = true;
    return nowSerial();
  };
  FUN.TODAY = function (ctx) {
    ctx.volatile = true;
    return todaySerial();
  };
  FUN.YEAR = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : serialToParts(n).y;
  };
  FUN.MONTH = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : serialToParts(n).m;
  };
  FUN.DAY = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : serialToParts(n).d;
  };
  FUN.HOUR = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : serialToParts(n).H;
  };
  FUN.MINUTE = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : serialToParts(n).M;
  };
  FUN.SECOND = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : serialToParts(n).S;
  };
  FUN.WEEKDAY = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    const t = args[1] == null ? 1 : toNum(scalar(ctx, args[1]));
    if (isErr(n) || isErr(t)) return e(ERR.VALUE);
    const dow = serialToParts(n).dow;
    if (t === 1) return dow + 1;
    if (t === 2) return dow === 0 ? 7 : dow;
    if (t === 3) return dow === 0 ? 6 : dow - 1;
    return dow + 1;
  };
  FUN.WEEKNUM = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    if (isErr(n)) return n;
    const p = serialToParts(n);
    const start = Date.UTC(p.y, 0, 1);
    return Math.floor((Date.UTC(p.y, p.m - 1, p.d) - start) / 86400000 / 7) + 1;
  };
  FUN.EOMONTH = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    const m = toNum(scalar(ctx, args[1]));
    if (isErr(n) || isErr(m)) return e(ERR.VALUE);
    const p = serialToParts(n);
    const dt = new Date(Date.UTC(p.y, p.m - 1 + Math.floor(m) + 1, 0));
    return dateToSerial(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  };
  FUN.EDATE = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    const m = toNum(scalar(ctx, args[1]));
    if (isErr(n) || isErr(m)) return e(ERR.VALUE);
    const p = serialToParts(n);
    return dateToSerial(p.y, p.m + Math.floor(m), p.d);
  };
  FUN.DATEDIF = function (ctx, args) {
    const a = toNum(scalar(ctx, args[0]));
    const b = toNum(scalar(ctx, args[1]));
    const unit = toStr(scalar(ctx, args[2])).toUpperCase();
    if (isErr(a) || isErr(b) || b < a) return e(ERR.NUM);
    const pa = serialToParts(a);
    const pb = serialToParts(b);
    if (unit === "Y") return pb.y - pa.y - (pb.m < pa.m || (pb.m === pa.m && pb.d < pa.d) ? 1 : 0);
    if (unit === "M") return (pb.y - pa.y) * 12 + (pb.m - pa.m) - (pb.d < pa.d ? 1 : 0);
    if (unit === "D") return Math.floor(b) - Math.floor(a);
    if (unit === "YM") return (pb.m - pa.m + 12) % 12 - (pb.d < pa.d ? 1 : 0);
    if (unit === "MD") {
      const d = pb.d - pa.d;
      return d >= 0 ? d : pb.d + (new Date(Date.UTC(pb.y, pb.m - 1, 0)).getUTCDate() - pa.d);
    }
    if (unit === "YD") return Math.floor(dateToSerial(pa.y, pb.m, pb.d) - dateToSerial(pa.y, pa.m, pa.d) + (dateToSerial(pa.y, pb.m, pb.d) < dateToSerial(pa.y, pa.m, pa.d) ? 365 : 0));
    return e(ERR.NUM);
  };
  FUN.YEARFRAC = function (ctx, args) {
    const a = toNum(scalar(ctx, args[0]));
    const b = toNum(scalar(ctx, args[1]));
    if (isErr(a) || isErr(b)) return e(ERR.VALUE);
    return Math.abs(b - a) / 365;
  };
  FUN.DATEVALUE = function (ctx, args) {
    const s = toStr(scalar(ctx, args[0]));
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return e(ERR.VALUE);
    return dateToSerial(d.getFullYear(), d.getMonth() + 1, d.getDate());
  };
  FUN.TIMEVALUE = function (ctx, args) {
    const s = toStr(scalar(ctx, args[0]));
    const m = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return e(ERR.VALUE);
    return (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0)) / 86400;
  };
  FUN.NETWORKDAYS = function (ctx, args) {
    const a = Math.floor(toNum(scalar(ctx, args[0])));
    const b = Math.floor(toNum(scalar(ctx, args[1])));
    if (!Number.isFinite(a) || !Number.isFinite(b)) return e(ERR.VALUE);
    const hols = holidaySet(ctx, args[2]);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    let n = 0;
    for (let d = lo; d <= hi; d++) if (!isWeekend(d) && !hols.has(d)) n++;
    return a <= b ? n : -n;
  };
  FUN.WORKDAY = function (ctx, args) {
    let d = Math.floor(toNum(scalar(ctx, args[0])));
    let n = Math.floor(toNum(scalar(ctx, args[1])));
    if (!Number.isFinite(d) || !Number.isFinite(n)) return e(ERR.VALUE);
    const hols = holidaySet(ctx, args[2]);
    const step = n >= 0 ? 1 : -1;
    n = Math.abs(n);
    while (n > 0) {
      d += step;
      if (!isWeekend(d) && !hols.has(d)) n--;
    }
    return d;
  };

  FUN.ISBLANK = function (ctx, args) {
    const v = scalar(ctx, args[0]);
    return v == null || v === "";
  };
  FUN.ISNUMBER = function (ctx, args) {
    return typeof scalar(ctx, args[0]) === "number";
  };
  FUN.ISTEXT = function (ctx, args) {
    return typeof scalar(ctx, args[0]) === "string";
  };
  FUN.ISLOGICAL = function (ctx, args) {
    return typeof scalar(ctx, args[0]) === "boolean";
  };
  FUN.ISERROR = function (ctx, args) {
    return isErr(scalar(ctx, args[0]));
  };
  FUN.ISNA = function (ctx, args) {
    const v = scalar(ctx, args[0]);
    return isErr(v) && v.error === ERR.NA;
  };
  FUN.ISERR = function (ctx, args) {
    const v = scalar(ctx, args[0]);
    return isErr(v) && v.error !== ERR.NA;
  };
  FUN.ISEVEN = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : Math.floor(Math.abs(n)) % 2 === 0;
  };
  FUN.ISODD = function (ctx, args) {
    const n = toNum(scalar(ctx, args[0]));
    return isErr(n) ? n : Math.floor(Math.abs(n)) % 2 === 1;
  };
  FUN.N = function (ctx, args) {
    const v = scalar(ctx, args[0]);
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (isErr(v)) return v;
    return 0;
  };
  FUN.TYPE = function (ctx, args) {
    const v = scalar(ctx, args[0]);
    if (v == null || v === "") return 1;
    if (typeof v === "number") return 1;
    if (typeof v === "string") return 2;
    if (typeof v === "boolean") return 4;
    if (isErr(v)) return 16;
    return 1;
  };
  FUN.NA = function () {
    return e(ERR.NA);
  };
  FUN["ERROR.TYPE"] = function (ctx, args) {
    const v = scalar(ctx, args[0]);
    if (!isErr(v)) return e(ERR.NA);
    const map = {};
    map[ERR.NULL] = 1;
    map[ERR.DIV] = 2;
    map[ERR.VALUE] = 3;
    map[ERR.REF] = 4;
    map[ERR.NAME] = 5;
    map[ERR.NUM] = 6;
    map[ERR.NA] = 7;
    return map[v.error] || e(ERR.NA);
  };
  FUN.ISFORMULA = function (ctx, args) {
    if (!isRange(args[0])) return false;
    const raw = ctx.getRaw(args[0].sheetId, args[0].r1, args[0].c1);
    return String(raw || "").charAt(0) === "=";
  };
  FUN.SHEET = function (ctx) {
    return ctx.sheetIndex + 1;
  };
  FUN.SHEETS = function (ctx) {
    return ctx.sheetCount;
  };

  FUN.PMT = function (ctx, args) {
    const rate = toNum(scalar(ctx, args[0]));
    const nper = toNum(scalar(ctx, args[1]));
    const pv = toNum(scalar(ctx, args[2]));
    const fv = args[3] == null ? 0 : toNum(scalar(ctx, args[3]));
    const type = args[4] == null ? 0 : toNum(scalar(ctx, args[4]));
    if (isErr(rate) || isErr(nper) || isErr(pv)) return e(ERR.VALUE);
    return pmt(rate, nper, pv, fv, type);
  };
  FUN.FV = function (ctx, args) {
    return fvFn(
      toNum(scalar(ctx, args[0])),
      toNum(scalar(ctx, args[1])),
      toNum(scalar(ctx, args[2])),
      args[3] == null ? 0 : toNum(scalar(ctx, args[3])),
      args[4] == null ? 0 : toNum(scalar(ctx, args[4]))
    );
  };
  FUN.PV = function (ctx, args) {
    return pvFn(
      toNum(scalar(ctx, args[0])),
      toNum(scalar(ctx, args[1])),
      toNum(scalar(ctx, args[2])),
      args[3] == null ? 0 : toNum(scalar(ctx, args[3])),
      args[4] == null ? 0 : toNum(scalar(ctx, args[4]))
    );
  };
  FUN.NPV = function (ctx, args) {
    const rate = toNum(scalar(ctx, args[0]));
    const vals = collectNums(flatten(ctx, args.slice(1), false), true);
    if (isErr(rate) || isErr(vals)) return e(ERR.VALUE);
    return npvFn(rate, vals);
  };
  FUN.IRR = function (ctx, args) {
    const vals = collectNums(flatten(ctx, [args[0]], false), true);
    const guess = args[1] == null ? 0.1 : toNum(scalar(ctx, args[1]));
    if (isErr(vals)) return vals;
    return irrFn(vals, guess);
  };
  FUN.RATE = function (ctx, args) {
    return rateFn(
      toNum(scalar(ctx, args[0])),
      toNum(scalar(ctx, args[1])),
      toNum(scalar(ctx, args[2])),
      args[3] == null ? 0 : toNum(scalar(ctx, args[3])),
      args[4] == null ? 0 : toNum(scalar(ctx, args[4])),
      args[5] == null ? 0.1 : toNum(scalar(ctx, args[5]))
    );
  };
  FUN.NPER = function (ctx, args) {
    return nperFn(
      toNum(scalar(ctx, args[0])),
      toNum(scalar(ctx, args[1])),
      toNum(scalar(ctx, args[2])),
      args[3] == null ? 0 : toNum(scalar(ctx, args[3])),
      args[4] == null ? 0 : toNum(scalar(ctx, args[4]))
    );
  };
  FUN.IPMT = function (ctx, args) {
    return ipmtFn(
      toNum(scalar(ctx, args[0])),
      toNum(scalar(ctx, args[1])),
      toNum(scalar(ctx, args[2])),
      toNum(scalar(ctx, args[3])),
      args[4] == null ? 0 : toNum(scalar(ctx, args[4])),
      args[5] == null ? 0 : toNum(scalar(ctx, args[5]))
    );
  };
  FUN.PPMT = function (ctx, args) {
    const p = FUN.PMT(ctx, [args[0], args[2], args[3], args[4], args[5]]);
    const i = FUN.IPMT(ctx, args);
    if (isErr(p) || isErr(i)) return isErr(p) ? p : i;
    return p - i;
  };

  FUN.BIN2DEC = function (ctx, args) {
    return binToDec(toStr(scalar(ctx, args[0])));
  };
  FUN.DEC2BIN = function (ctx, args) {
    return decToBin(toNum(scalar(ctx, args[0])), args[1] == null ? null : toNum(scalar(ctx, args[1])));
  };
  FUN.HEX2DEC = function (ctx, args) {
    return hexToDec(toStr(scalar(ctx, args[0])));
  };
  FUN.DEC2HEX = function (ctx, args) {
    return decToHex(toNum(scalar(ctx, args[0])), args[1] == null ? null : toNum(scalar(ctx, args[1])));
  };
  FUN.OCT2DEC = function (ctx, args) {
    return octToDec(toStr(scalar(ctx, args[0])));
  };
  FUN.DEC2OCT = function (ctx, args) {
    return decToOct(toNum(scalar(ctx, args[0])), args[1] == null ? null : toNum(scalar(ctx, args[1])));
  };

  const FUNCTION_LIST = [
    ["SUM", "math", "SUM(number1, [number2], ...)", "Adds numbers.", "Soma números.", "数値を合計します。"],
    ["SUMIF", "math", "SUMIF(range, criteria, [sum_range])", "Conditional sum.", "Soma condicional.", "条件付き合計。"],
    ["SUMIFS", "math", "SUMIFS(sum_range, criteria_range1, criteria1, ...)", "Sum with many criteria.", "Soma com vários critérios.", "複数条件の合計。"],
    ["SUMPRODUCT", "math", "SUMPRODUCT(array1, [array2], ...)", "Sum of products.", "Soma dos produtos.", "積の合計。"],
    ["PRODUCT", "math", "PRODUCT(number1, ...)", "Multiplies numbers.", "Multiplica números.", "数値を掛けます。"],
    ["ABS", "math", "ABS(number)", "Absolute value.", "Valor absoluto.", "絶対値。"],
    ["SIGN", "math", "SIGN(number)", "Sign of a number.", "Sinal do número.", "符号。"],
    ["SQRT", "math", "SQRT(number)", "Square root.", "Raiz quadrada.", "平方根。"],
    ["POWER", "math", "POWER(number, power)", "Raises to a power.", "Eleva a uma potência.", "べき乗。"],
    ["EXP", "math", "EXP(number)", "e raised to a power.", "e elevado a.", "e の累乗。"],
    ["LN", "math", "LN(number)", "Natural log.", "Log natural.", "自然対数。"],
    ["LOG", "math", "LOG(number, [base])", "Logarithm.", "Logaritmo.", "対数。"],
    ["LOG10", "math", "LOG10(number)", "Base-10 log.", "Log de base 10.", "常用対数。"],
    ["MOD", "math", "MOD(number, divisor)", "Remainder.", "Resto.", "剰余。"],
    ["QUOTIENT", "math", "QUOTIENT(numerator, denominator)", "Integer division.", "Divisão inteira.", "整数除算。"],
    ["INT", "math", "INT(number)", "Rounds down.", "Arredonda para baixo.", "切り下げ。"],
    ["TRUNC", "math", "TRUNC(number, [digits])", "Truncates.", "Trunca.", "切り捨て。"],
    ["ROUND", "math", "ROUND(number, num_digits)", "Rounds.", "Arredonda.", "四捨五入。"],
    ["ROUNDUP", "math", "ROUNDUP(number, num_digits)", "Rounds away from 0.", "Arredonda para longe de 0.", "ゼロから遠ざける丸め。"],
    ["ROUNDDOWN", "math", "ROUNDDOWN(number, num_digits)", "Rounds toward 0.", "Arredonda para 0.", "ゼロ方向へ丸め。"],
    ["MROUND", "math", "MROUND(number, multiple)", "Round to multiple.", "Arredonda ao múltiplo.", "倍数に丸め。"],
    ["CEILING", "math", "CEILING(number, significance)", "Rounds up to multiple.", "Arredonda ao múltiplo acima.", "倍数に切り上げ。"],
    ["FLOOR", "math", "FLOOR(number, significance)", "Rounds down to multiple.", "Arredonda ao múltiplo abaixo.", "倍数に切り下げ。"],
    ["EVEN", "math", "EVEN(number)", "Next even.", "Próximo par.", "次の偶数。"],
    ["ODD", "math", "ODD(number)", "Next odd.", "Próximo ímpar.", "次の奇数。"],
    ["FACT", "math", "FACT(number)", "Factorial.", "Fatorial.", "階乗。"],
    ["GCD", "math", "GCD(number1, ...)", "Greatest common divisor.", "MDC.", "最大公約数。"],
    ["LCM", "math", "LCM(number1, ...)", "Least common multiple.", "MMC.", "最小公倍数。"],
    ["PI", "math", "PI()", "Pi.", "Pi.", "円周率。"],
    ["RAND", "math", "RAND()", "Random 0–1.", "Aleatório 0–1.", "0～1 の乱数。"],
    ["RANDBETWEEN", "math", "RANDBETWEEN(bottom, top)", "Random integer.", "Inteiro aleatório.", "整数乱数。"],
    ["SUMSQ", "math", "SUMSQ(number1, ...)", "Sum of squares.", "Soma dos quadrados.", "平方和。"],
    ["SIN", "math", "SIN(number)", "Sine (radians).", "Seno (radianos).", "正弦（ラジアン）。"],
    ["COS", "math", "COS(number)", "Cosine.", "Cosseno.", "余弦。"],
    ["TAN", "math", "TAN(number)", "Tangent.", "Tangente.", "正接。"],
    ["ASIN", "math", "ASIN(number)", "Arcsine.", "Arco seno.", "逆正弦。"],
    ["ACOS", "math", "ACOS(number)", "Arccosine.", "Arco cosseno.", "逆余弦。"],
    ["ATAN", "math", "ATAN(number)", "Arctangent.", "Arco tangente.", "逆正接。"],
    ["ATAN2", "math", "ATAN2(x, y)", "Arctangent x/y.", "Arco tangente x/y.", "atan2。"],
    ["DEGREES", "math", "DEGREES(angle)", "Radians to degrees.", "Radianos para graus.", "ラジアンを度に。"],
    ["RADIANS", "math", "RADIANS(angle)", "Degrees to radians.", "Graus para radianos.", "度をラジアンに。"],
    ["SINH", "math", "SINH(number)", "Hyperbolic sine.", "Seno hiperbólico.", "双曲線正弦。"],
    ["COSH", "math", "COSH(number)", "Hyperbolic cosine.", "Cosseno hiperbólico.", "双曲線余弦。"],
    ["TANH", "math", "TANH(number)", "Hyperbolic tangent.", "Tangente hiperbólica.", "双曲線正接。"],
    ["AVERAGE", "stat", "AVERAGE(number1, ...)", "Arithmetic mean.", "Média.", "平均。"],
    ["AVERAGEIF", "stat", "AVERAGEIF(range, criteria, [avg_range])", "Conditional average.", "Média condicional.", "条件付き平均。"],
    ["AVERAGEIFS", "stat", "AVERAGEIFS(avg_range, range1, criteria1, ...)", "Average with many criteria.", "Média com vários critérios.", "複数条件の平均。"],
    ["MEDIAN", "stat", "MEDIAN(number1, ...)", "Median.", "Mediana.", "中央値。"],
    ["MODE", "stat", "MODE(number1, ...)", "Most frequent number.", "Valor mais frequente.", "最頻値。"],
    ["MIN", "stat", "MIN(number1, ...)", "Smallest number.", "Menor número.", "最小。"],
    ["MAX", "stat", "MAX(number1, ...)", "Largest number.", "Maior número.", "最大。"],
    ["COUNT", "stat", "COUNT(value1, ...)", "Count numbers.", "Conta números.", "数値の個数。"],
    ["COUNTA", "stat", "COUNTA(value1, ...)", "Count non-empty.", "Conta não vazios.", "空白以外の個数。"],
    ["COUNTBLANK", "stat", "COUNTBLANK(range)", "Count blanks.", "Conta vazios.", "空白の個数。"],
    ["COUNTIF", "stat", "COUNTIF(range, criteria)", "Count by criteria.", "Conta por critério.", "条件付きカウント。"],
    ["COUNTIFS", "stat", "COUNTIFS(range1, criteria1, ...)", "Count with many criteria.", "Conta com vários critérios.", "複数条件のカウント。"],
    ["STDEV", "stat", "STDEV(number1, ...)", "Sample standard deviation.", "Desvio padrão amostral.", "標本標準偏差。"],
    ["STDEV.S", "stat", "STDEV.S(number1, ...)", "Sample standard deviation.", "Desvio padrão amostral.", "標本標準偏差。"],
    ["STDEV.P", "stat", "STDEV.P(number1, ...)", "Population standard deviation.", "Desvio padrão populacional.", "母標準偏差。"],
    ["VAR", "stat", "VAR(number1, ...)", "Sample variance.", "Variância amostral.", "標本分散。"],
    ["VAR.S", "stat", "VAR.S(number1, ...)", "Sample variance.", "Variância amostral.", "標本分散。"],
    ["VAR.P", "stat", "VAR.P(number1, ...)", "Population variance.", "Variância populacional.", "母分散。"],
    ["LARGE", "stat", "LARGE(array, k)", "Kth largest.", "K-ésimo maior.", "k 番目に大きい値。"],
    ["SMALL", "stat", "SMALL(array, k)", "Kth smallest.", "K-ésimo menor.", "k 番目に小さい値。"],
    ["RANK", "stat", "RANK(number, ref, [order])", "Rank of a number.", "Classificação.", "順位。"],
    ["PERCENTILE", "stat", "PERCENTILE(array, k)", "Percentile.", "Percentil.", "パーセンタイル。"],
    ["QUARTILE", "stat", "QUARTILE(array, quart)", "Quartile.", "Quartil.", "四分位。"],
    ["CORREL", "stat", "CORREL(array1, array2)", "Correlation.", "Correlação.", "相関。"],
    ["IF", "logical", "IF(logical_test, value_if_true, [value_if_false])", "Conditional.", "Condicional.", "条件分岐。"],
    ["IFS", "logical", "IFS(test1, value1, ...)", "Multiple conditions.", "Várias condições.", "複数条件。"],
    ["AND", "logical", "AND(logical1, ...)", "True if all true.", "Verdadeiro se todos verdadeiros.", "すべて真なら TRUE。"],
    ["OR", "logical", "OR(logical1, ...)", "True if any true.", "Verdadeiro se algum verdadeiro.", "いずれか真なら TRUE。"],
    ["XOR", "logical", "XOR(logical1, ...)", "Exclusive or.", "Ou exclusivo.", "排他的論理和。"],
    ["NOT", "logical", "NOT(logical)", "Negates.", "Nega.", "否定。"],
    ["TRUE", "logical", "TRUE()", "Boolean true.", "Booleano verdadeiro.", "真。"],
    ["FALSE", "logical", "FALSE()", "Boolean false.", "Booleano falso.", "偽。"],
    ["IFERROR", "logical", "IFERROR(value, value_if_error)", "Fallback on error.", "Valor se erro.", "エラー時の代替。"],
    ["IFNA", "logical", "IFNA(value, value_if_na)", "Fallback on #N/A.", "Valor se #N/A.", "#N/A の代替。"],
    ["SWITCH", "logical", "SWITCH(expression, value1, result1, ...)", "Match value to results.", "Compara valor a resultados.", "値に応じて結果を返す。"],
    ["VLOOKUP", "lookup", "VLOOKUP(lookup_value, table_array, col_index, [range_lookup])", "Vertical lookup.", "Procura vertical.", "垂直検索。"],
    ["HLOOKUP", "lookup", "HLOOKUP(lookup_value, table_array, row_index, [range_lookup])", "Horizontal lookup.", "Procura horizontal.", "水平検索。"],
    ["INDEX", "lookup", "INDEX(array, row_num, [column_num])", "Value at position.", "Valor na posição.", "位置の値。"],
    ["MATCH", "lookup", "MATCH(lookup_value, lookup_array, [match_type])", "Position of a value.", "Posição de um valor.", "値の位置。"],
    ["CHOOSE", "lookup", "CHOOSE(index_num, value1, ...)", "Pick by index.", "Escolhe pelo índice.", "番号で選択。"],
    ["LOOKUP", "lookup", "LOOKUP(lookup_value, lookup_vector, [result_vector])", "Approximate lookup.", "Procura aproximada.", "近似検索。"],
    ["XLOOKUP", "lookup", "XLOOKUP(lookup_value, lookup_array, return_array, [if_not_found])", "Exact lookup.", "Procura exata.", "完全一致検索。"],
    ["ROW", "lookup", "ROW([reference])", "Row number.", "Número da linha.", "行番号。"],
    ["COLUMN", "lookup", "COLUMN([reference])", "Column number.", "Número da coluna.", "列番号。"],
    ["ROWS", "lookup", "ROWS(array)", "Row count.", "Contagem de linhas.", "行数。"],
    ["COLUMNS", "lookup", "COLUMNS(array)", "Column count.", "Contagem de colunas.", "列数。"],
    ["ADDRESS", "lookup", "ADDRESS(row, column, [abs_num], [a1], [sheet])", "Cell address text.", "Endereço da célula.", "セル番地。"],
    ["INDIRECT", "lookup", "INDIRECT(ref_text)", "Reference from text.", "Referência a partir de texto.", "文字列から参照。"],
    ["OFFSET", "lookup", "OFFSET(reference, rows, cols, [height], [width])", "Shifted range.", "Intervalo deslocado.", "ずらした範囲。"],
    ["CONCAT", "text", "CONCAT(text1, ...)", "Joins text.", "Junta texto.", "文字列を結合。"],
    ["CONCATENATE", "text", "CONCATENATE(text1, ...)", "Joins text.", "Junta texto.", "文字列を結合。"],
    ["TEXTJOIN", "text", "TEXTJOIN(delimiter, ignore_empty, text1, ...)", "Join with delimiter.", "Junta com delimitador.", "区切り文字で結合。"],
    ["LEFT", "text", "LEFT(text, [num_chars])", "Left characters.", "Caracteres à esquerda.", "左から取り出し。"],
    ["RIGHT", "text", "RIGHT(text, [num_chars])", "Right characters.", "Caracteres à direita.", "右から取り出し。"],
    ["MID", "text", "MID(text, start_num, num_chars)", "Middle characters.", "Caracteres do meio.", "途中から取り出し。"],
    ["LEN", "text", "LEN(text)", "Length.", "Comprimento.", "長さ。"],
    ["TRIM", "text", "TRIM(text)", "Strip extra spaces.", "Remove espaços extras.", "余分な空白を削除。"],
    ["UPPER", "text", "UPPER(text)", "Uppercase.", "Maiúsculas.", "大文字。"],
    ["LOWER", "text", "LOWER(text)", "Lowercase.", "Minúsculas.", "小文字。"],
    ["PROPER", "text", "PROPER(text)", "Capitalize words.", "Primeira letra maiúscula.", "単語の先頭を大文字。"],
    ["FIND", "text", "FIND(find_text, within_text, [start_num])", "Case-sensitive find.", "Localiza (diferencia maiúsculas).", "大文字小文字を区別して検索。"],
    ["SEARCH", "text", "SEARCH(find_text, within_text, [start_num])", "Case-insensitive find.", "Localiza (sem diferenciar).", "大文字小文字を無視して検索。"],
    ["SUBSTITUTE", "text", "SUBSTITUTE(text, old, new, [instance])", "Replace text.", "Substitui texto.", "文字列を置換。"],
    ["REPLACE", "text", "REPLACE(old_text, start_num, num_chars, new_text)", "Replace by position.", "Substitui por posição.", "位置で置換。"],
    ["REPT", "text", "REPT(text, number_times)", "Repeat text.", "Repete texto.", "繰り返し。"],
    ["VALUE", "text", "VALUE(text)", "Text to number.", "Texto para número.", "数値に変換。"],
    ["TEXT", "text", "TEXT(value, format_text)", "Format as text.", "Formata como texto.", "表示形式を適用。"],
    ["CHAR", "text", "CHAR(number)", "Character from code.", "Caractere do código.", "コードから文字。"],
    ["CODE", "text", "CODE(text)", "Code of first character.", "Código do primeiro caractere.", "先頭文字のコード。"],
    ["EXACT", "text", "EXACT(text1, text2)", "Case-sensitive equal.", "Igualdade com maiúsculas.", "完全一致比較。"],
    ["CLEAN", "text", "CLEAN(text)", "Strip control chars.", "Remove caracteres de controle.", "制御文字を削除。"],
    ["T", "text", "T(value)", "Text or empty.", "Texto ou vazio.", "文字列または空。"],
    ["NUMBERVALUE", "text", "NUMBERVALUE(text, [decimal], [group])", "Locale number parse.", "Número com locale.", "ロケール付き数値解析。"],
    ["DATE", "date", "DATE(year, month, day)", "Date serial.", "Data serial.", "日付シリアル。"],
    ["TIME", "date", "TIME(hour, minute, second)", "Time fraction.", "Fração de hora.", "時刻の小数。"],
    ["NOW", "date", "NOW()", "Current date and time.", "Data e hora atuais.", "現在の日時。"],
    ["TODAY", "date", "TODAY()", "Current date.", "Data de hoje.", "今日の日付。"],
    ["YEAR", "date", "YEAR(serial)", "Year.", "Ano.", "年。"],
    ["MONTH", "date", "MONTH(serial)", "Month.", "Mês.", "月。"],
    ["DAY", "date", "DAY(serial)", "Day.", "Dia.", "日。"],
    ["HOUR", "date", "HOUR(serial)", "Hour.", "Hora.", "時。"],
    ["MINUTE", "date", "MINUTE(serial)", "Minute.", "Minuto.", "分。"],
    ["SECOND", "date", "SECOND(serial)", "Second.", "Segundo.", "秒。"],
    ["WEEKDAY", "date", "WEEKDAY(serial, [return_type])", "Day of week.", "Dia da semana.", "曜日。"],
    ["WEEKNUM", "date", "WEEKNUM(serial)", "Week number.", "Número da semana.", "週番号。"],
    ["EOMONTH", "date", "EOMONTH(start_date, months)", "End of month.", "Fim do mês.", "月末。"],
    ["EDATE", "date", "EDATE(start_date, months)", "Date plus months.", "Data mais meses.", "月を加算した日付。"],
    ["DATEDIF", "date", "DATEDIF(start, end, unit)", "Date difference.", "Diferença de datas.", "日付の差。"],
    ["YEARFRAC", "date", "YEARFRAC(start, end)", "Fractional years.", "Anos fracionários.", "年の端数。"],
    ["DATEVALUE", "date", "DATEVALUE(date_text)", "Parse date text.", "Converte texto de data.", "日付文字列を変換。"],
    ["TIMEVALUE", "date", "TIMEVALUE(time_text)", "Parse time text.", "Converte texto de hora.", "時刻文字列を変換。"],
    ["NETWORKDAYS", "date", "NETWORKDAYS(start, end, [holidays])", "Working days.", "Dias úteis.", "営業日数。"],
    ["WORKDAY", "date", "WORKDAY(start, days, [holidays])", "Date after workdays.", "Data após dias úteis.", "営業日後の日付。"],
    ["ISBLANK", "info", "ISBLANK(value)", "Is empty.", "Está vazio.", "空白か。"],
    ["ISNUMBER", "info", "ISNUMBER(value)", "Is a number.", "É número.", "数値か。"],
    ["ISTEXT", "info", "ISTEXT(value)", "Is text.", "É texto.", "文字列か。"],
    ["ISLOGICAL", "info", "ISLOGICAL(value)", "Is boolean.", "É lógico.", "論理値か。"],
    ["ISERROR", "info", "ISERROR(value)", "Is any error.", "É erro.", "エラーか。"],
    ["ISNA", "info", "ISNA(value)", "Is #N/A.", "É #N/A.", "#N/A か。"],
    ["ISERR", "info", "ISERR(value)", "Is error except #N/A.", "É erro (exceto #N/A).", "#N/A 以外のエラーか。"],
    ["ISEVEN", "info", "ISEVEN(number)", "Is even.", "É par.", "偶数か。"],
    ["ISODD", "info", "ISODD(number)", "Is odd.", "É ímpar.", "奇数か。"],
    ["N", "info", "N(value)", "Convert to number.", "Converte para número.", "数値に変換。"],
    ["TYPE", "info", "TYPE(value)", "Value type code.", "Código do tipo.", "型コード。"],
    ["NA", "info", "NA()", "The #N/A error.", "Erro #N/A.", "#N/A エラー。"],
    ["ERROR.TYPE", "info", "ERROR.TYPE(error_val)", "Error type number.", "Número do tipo de erro.", "エラー種別。"],
    ["ISFORMULA", "info", "ISFORMULA(reference)", "Cell has a formula.", "Célula tem fórmula.", "数式があるか。"],
    ["SHEET", "info", "SHEET()", "Current sheet index.", "Índice da planilha atual.", "現在のシート番号。"],
    ["SHEETS", "info", "SHEETS()", "Sheet count.", "Número de planilhas.", "シート数。"],
    ["PMT", "finance", "PMT(rate, nper, pv, [fv], [type])", "Loan payment.", "Prestação.", "ローン支払額。"],
    ["FV", "finance", "FV(rate, nper, pmt, [pv], [type])", "Future value.", "Valor futuro.", "将来価値。"],
    ["PV", "finance", "PV(rate, nper, pmt, [fv], [type])", "Present value.", "Valor presente.", "現在価値。"],
    ["NPV", "finance", "NPV(rate, value1, ...)", "Net present value.", "VPL.", "正味現在価値。"],
    ["IRR", "finance", "IRR(values, [guess])", "Internal rate of return.", "TIR.", "内部収益率。"],
    ["RATE", "finance", "RATE(nper, pmt, pv, [fv], [type], [guess])", "Interest rate.", "Taxa de juros.", "利率。"],
    ["NPER", "finance", "NPER(rate, pmt, pv, [fv], [type])", "Number of periods.", "Número de períodos.", "期間数。"],
    ["IPMT", "finance", "IPMT(rate, per, nper, pv, [fv], [type])", "Interest portion.", "Parcela de juros.", "利息部分。"],
    ["PPMT", "finance", "PPMT(rate, per, nper, pv, [fv], [type])", "Principal portion.", "Parcela de principal.", "元本部分。"],
    ["BIN2DEC", "eng", "BIN2DEC(number)", "Binary to decimal.", "Binário para decimal.", "2進数を10進数に。"],
    ["DEC2BIN", "eng", "DEC2BIN(number, [places])", "Decimal to binary.", "Decimal para binário.", "10進数を2進数に。"],
    ["HEX2DEC", "eng", "HEX2DEC(number)", "Hex to decimal.", "Hex para decimal.", "16進数を10進数に。"],
    ["DEC2HEX", "eng", "DEC2HEX(number, [places])", "Decimal to hex.", "Decimal para hex.", "10進数を16進数に。"],
    ["OCT2DEC", "eng", "OCT2DEC(number)", "Octal to decimal.", "Octal para decimal.", "8進数を10進数に。"],
    ["DEC2OCT", "eng", "DEC2OCT(number, [places])", "Decimal to octal.", "Decimal para octal.", "10進数を8進数に。"],
  ];

  function parseAddress(text, currentSheetId, wb) {
    const s = String(text || "").trim();
    let sheetName = null;
    let rest = s;
    const q = s.match(/^'((?:[^']|'')+)'!(.+)$/);
    const u = s.match(/^([^'!]+)!(.+)$/);
    if (q) {
      sheetName = q[1].replace(/''/g, "'");
      rest = q[2];
    } else if (u) {
      sheetName = u[1];
      rest = u[2];
    }
    let sheetId = currentSheetId;
    if (sheetName) {
      const sh = wb.sheetByName(sheetName);
      if (!sh) return null;
      sheetId = sh.id;
    }
    const parts = rest.split(":");
    const a = parseA1(parts[0]);
    if (!a) return null;
    if (parts.length === 1) return { sheetId: sheetId, r: a.r, c: a.c };
    const b = parseA1(parts[1]);
    if (!b) return null;
    return rng(sheetId, a.r, a.c, b.r, b.c);
  }

  function compare(op, a, b) {
    if (isErr(a)) return a;
    if (isErr(b)) return b;
    if (a == null) a = 0;
    if (b == null) b = 0;
    let rel;
    if (typeof a === "number" && typeof b === "number") rel = a === b ? 0 : a < b ? -1 : 1;
    else rel = toStr(a).toLowerCase() === toStr(b).toLowerCase() ? 0 : toStr(a).toLowerCase() < toStr(b).toLowerCase() ? -1 : 1;
    if (op === "=") return rel === 0;
    if (op === "<>") return rel !== 0;
    if (op === "<") return rel < 0;
    if (op === ">") return rel > 0;
    if (op === "<=") return rel <= 0;
    if (op === ">=") return rel >= 0;
    return e(ERR.VALUE);
  }

  function evalArg(ast, ctx) {
    if (!ast) return e(ERR.VALUE);
    if (ast.t === "ref") {
      const sh = ast.sheet ? ctx.wb.sheetByName(ast.sheet) : ctx.wb.sheetById(ctx.sheetId);
      if (!sh) return e(ERR.REF);
      return rng(sh.id, ast.r, ast.c, ast.r, ast.c);
    }
    return evalAst(ast, ctx);
  }

  function evalAst(ast, ctx) {
    if (!ast) return e(ERR.VALUE);
    if (ast.t === "num") return ast.v;
    if (ast.t === "str") return ast.v;
    if (ast.t === "bool") return ast.v;
    if (ast.t === "err") return e(ast.v);
    if (ast.t === "name") return e(ERR.NAME);
    if (ast.t === "pct") {
      const v = toNum(scalar(ctx, evalAst(ast.a, ctx)));
      return isErr(v) ? v : v / 100;
    }
    if (ast.t === "un") {
      const v = toNum(scalar(ctx, evalAst(ast.a, ctx)));
      if (isErr(v)) return v;
      return ast.op === "-" ? -v : v;
    }
    if (ast.t === "ref") {
      const sh = ast.sheet ? ctx.wb.sheetByName(ast.sheet) : ctx.wb.sheetById(ctx.sheetId);
      if (!sh) return e(ERR.REF);
      return ctx.getValue(sh.id, ast.r, ast.c);
    }
    if (ast.t === "range") {
      function asRef(node, fallbackId) {
        if (node.t === "ref") {
          const sh = node.sheet ? ctx.wb.sheetByName(node.sheet) : ctx.wb.sheetById(fallbackId || ctx.sheetId);
          if (!sh) return null;
          return { sheetId: sh.id, r: node.r, c: node.c, sheet: node.sheet };
        }
        return null;
      }
      const a = asRef(ast.a);
      const b = asRef(ast.b, a && a.sheetId);
      if (!a || !b) return e(ERR.REF);
      if (a.sheetId !== b.sheetId) return e(ERR.VALUE);
      return rng(a.sheetId, a.r, a.c, b.r, b.c);
    }
    if (ast.t === "call") {
      const fn = FUN[ast.name];
      if (!fn) return e(ERR.NAME);
      const args = [];
      for (let i = 0; i < ast.args.length; i++) args.push(evalArg(ast.args[i], ctx));
      try {
        return fn(ctx, args);
      } catch (_err) {
        return e(ERR.VALUE);
      }
    }
    if (ast.t === "op") {
      let a = evalAst(ast.a, ctx);
      let b = evalAst(ast.b, ctx);
      a = scalar(ctx, a);
      b = scalar(ctx, b);
      if (ast.op === "&") return toStr(isErr(a) ? a.error : a) + toStr(isErr(b) ? b.error : b);
      if ("=<>".indexOf(ast.op.charAt(0)) >= 0 || ast.op === "<=" || ast.op === ">=" || ast.op === "<>") return compare(ast.op, a, b);
      const na = toNum(a);
      const nb = toNum(b);
      if (isErr(na)) return na;
      if (isErr(nb)) return nb;
      if (ast.op === "+") return na + nb;
      if (ast.op === "-") return na - nb;
      if (ast.op === "*") return na * nb;
      if (ast.op === "/") return nb === 0 ? e(ERR.DIV) : na / nb;
      if (ast.op === "^") {
        const r = Math.pow(na, nb);
        return Number.isFinite(r) ? r : e(ERR.NUM);
      }
    }
    return e(ERR.VALUE);
  }

  function formatValue(value, style) {
    if (isErr(value)) return value.error;
    if (value == null || value === "") return "";
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    const fmt = (style && style.format) || "general";
    if (typeof value === "number") {
      const dec = style && style.decimals != null ? style.decimals : 2;
      if (fmt === "percent") return (value * 100).toFixed(dec) + "%";
      if (fmt === "currency") {
        const sign = value < 0 ? "-" : "";
        return sign + "$" + Math.abs(value).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      }
      if (fmt === "number") return value.toFixed(dec);
      if (fmt === "date") {
        const p = serialToParts(value);
        return p.y + "-" + String(p.m).padStart(2, "0") + "-" + String(p.d).padStart(2, "0");
      }
      if (fmt === "text") return String(value);
      if (Math.abs(value) >= 1e10 || (Math.abs(value) > 0 && Math.abs(value) < 1e-6)) return String(value);
      if (Number.isInteger(value)) return String(value);
      return String(Math.round(value * 1e10) / 1e10);
    }
    return String(value);
  }

  function emptySheet(name, index) {
    return {
      id: uid(),
      name: name || "Sheet" + (index || 1),
      cells: {},
      colWidths: {},
      rowHeights: {},
      merges: [],
    };
  }
  function normMerge(m) {
    if (!m) return null;
    const r1 = Math.max(0, Math.min(MAX_ROWS - 1, Number(m.r1)));
    const c1 = Math.max(0, Math.min(MAX_COLS - 1, Number(m.c1)));
    const r2 = Math.max(0, Math.min(MAX_ROWS - 1, Number(m.r2)));
    const c2 = Math.max(0, Math.min(MAX_COLS - 1, Number(m.c2)));
    if (!Number.isFinite(r1) || !Number.isFinite(c1) || !Number.isFinite(r2) || !Number.isFinite(c2)) return null;
    const a = { r1: Math.min(r1, r2), c1: Math.min(c1, c2), r2: Math.max(r1, r2), c2: Math.max(c1, c2) };
    if (a.r1 === a.r2 && a.c1 === a.c2) return null;
    return a;
  }
  function mergeOverlaps(m, r1, c1, r2, c2) {
    return m.r1 <= r2 && m.r2 >= r1 && m.c1 <= c2 && m.c2 >= c1;
  }
  function cloneMerges(list) {
    return (list || []).map(function (m) {
      return { r1: m.r1, c1: m.c1, r2: m.r2, c2: m.c2 };
    });
  }

  function createWorkbook(name) {
    const s1 = emptySheet("Sheet1", 1);
    const s2 = emptySheet("Sheet2", 2);
    const s3 = emptySheet("Sheet3", 3);
    return fromData({
      id: uid(),
      name: name || "Book 1",
      activeSheetId: s1.id,
      sheets: [s1, s2, s3],
      updatedAt: Date.now(),
    });
  }

  function fromData(data) {
    const wb = {
      id: data.id || uid(),
      name: data.name || "Book 1",
      activeSheetId: data.activeSheetId,
      sheets: (data.sheets || []).map(function (s) {
        return {
          id: s.id,
          name: s.name,
          cells: s.cells || {},
          colWidths: s.colWidths || {},
          rowHeights: s.rowHeights || {},
          merges: Array.isArray(s.merges) ? s.merges.map(normMerge).filter(Boolean) : [],
        };
      }),
      updatedAt: data.updatedAt || Date.now(),
      cache: new Map(),
      dirty: new Set(),
      undo: [],
      redo: [],
      batch: null,
      listeners: [],
    };
    if (!wb.sheets.length) wb.sheets.push(emptySheet("Sheet1", 1));
    function sheetById(id) {
      for (let i = 0; i < wb.sheets.length; i++) if (wb.sheets[i].id === id) return wb.sheets[i];
      return null;
    }
    function sheetByName(name) {
      const n = String(name || "").toLowerCase();
      for (let i = 0; i < wb.sheets.length; i++) if (wb.sheets[i].name.toLowerCase() === n) return wb.sheets[i];
      return null;
    }
    if (!wb.activeSheetId || !sheetById(wb.activeSheetId)) wb.activeSheetId = wb.sheets[0].id;

    function notify() {
      wb.updatedAt = Date.now();
      for (let i = 0; i < wb.listeners.length; i++) wb.listeners[i]();
    }
    function uniqueName(base) {
      let name = base;
      let i = 2;
      while (sheetByName(name)) {
        name = base + " (" + i + ")";
        i++;
      }
      return name;
    }
    function invalidateAll() {
      wb.cache.clear();
    }
    function getRaw(sheetId, r, c) {
      const sh = sheetById(sheetId);
      if (!sh) return "";
      const cell = sh.cells[posKey(r, c)];
      return cell && cell.raw != null ? cell.raw : "";
    }
    function getStyle(sheetId, r, c) {
      const sh = sheetById(sheetId);
      if (!sh) return {};
      const cell = sh.cells[posKey(r, c)];
      return (cell && cell.style) || {};
    }
    function iterRange(range, keepEmpty) {
      const out = [];
      const count = (range.r2 - range.r1 + 1) * (range.c2 - range.c1 + 1);
      if (count > MAX_RANGE) return out;
      for (let r = range.r1; r <= range.r2; r++) {
        for (let c = range.c1; c <= range.c2; c++) {
          const v = getValue(range.sheetId, r, c);
          if (keepEmpty || (v != null && v !== "")) out.push(v);
        }
      }
      return out;
    }
    const stack = new Set();
    function getValue(sheetId, r, c) {
      const key = cellKey(sheetId, r, c);
      if (stack.has(key)) return e(ERR.CIRC);
      if (wb.cache.has(key)) return wb.cache.get(key);
      stack.add(key);
      const raw = getRaw(sheetId, r, c);
      let val;
      if (String(raw).charAt(0) === "=") {
        const ctx = {
          wb: api,
          sheetId: sheetId,
          row: r,
          col: c,
          sheetIndex: wb.sheets.findIndex(function (s) {
            return s.id === sheetId;
          }),
          sheetCount: wb.sheets.length,
          volatile: false,
          getValue: getValue,
          getRaw: getRaw,
          iterRange: iterRange,
        };
        try {
          val = evalAst(parseFormula(String(raw).slice(1)), ctx);
          if (isRange(val)) val = getValue(val.sheetId, val.r1, val.c1);
        } catch (_err) {
          val = e(ERR.VALUE);
        }
      } else val = parseLiteral(raw);
      stack.delete(key);
      wb.cache.set(key, val);
      return val;
    }
    function display(sheetId, r, c) {
      return formatValue(getValue(sheetId, r, c), getStyle(sheetId, r, c));
    }
    function pushChange(change) {
      if (wb.batch) {
        wb.batch.push(change);
        return;
      }
      wb.undo.push([change]);
      if (wb.undo.length > 80) wb.undo.shift();
      wb.redo = [];
    }
    function applyCell(sheetId, r, c, raw, style, record) {
      const sh = sheetById(sheetId);
      if (!sh) return;
      const k = posKey(r, c);
      const prev = sh.cells[k] ? { raw: sh.cells[k].raw || "", style: Object.assign({}, sh.cells[k].style || {}) } : { raw: "", style: {} };
      const nextRaw = raw == null ? prev.raw : raw;
      const nextStyle = style ? Object.assign({}, prev.style, style) : prev.style;
      if (record) pushChange({ type: "cell", sheetId: sheetId, r: r, c: c, prev: prev, next: { raw: nextRaw, style: nextStyle } });
      if (nextRaw === "" && (!nextStyle || !Object.keys(nextStyle).length)) delete sh.cells[k];
      else sh.cells[k] = { raw: nextRaw, style: nextStyle };
      invalidateAll();
    }
    function setCell(sheetId, r, c, raw, record) {
      applyCell(sheetId, r, c, raw, null, record !== false);
      notify();
    }
    function setStyle(sheetId, r, c, patch, record) {
      applyCell(sheetId, r, c, null, patch, record !== false);
      notify();
    }
    function beginBatch() {
      wb.batch = [];
    }
    function endBatch() {
      if (wb.batch && wb.batch.length) {
        wb.undo.push(wb.batch);
        if (wb.undo.length > 80) wb.undo.shift();
        wb.redo = [];
      }
      wb.batch = null;
      notify();
    }
    function replay(changes, forward) {
      for (let i = 0; i < changes.length; i++) {
        const ch = changes[i];
        if (ch.type === "cell") {
          const st = forward ? ch.next : ch.prev;
          const sh = sheetById(ch.sheetId);
          if (!sh) continue;
          const k = posKey(ch.r, ch.c);
          if (!st.raw && (!st.style || !Object.keys(st.style).length)) delete sh.cells[k];
          else sh.cells[k] = { raw: st.raw, style: Object.assign({}, st.style || {}) };
        } else if (ch.type === "merges") {
          const sh = sheetById(ch.sheetId);
          if (sh) sh.merges = cloneMerges(forward ? ch.next : ch.prev);
        }
      }
      invalidateAll();
      notify();
    }
    function undo() {
      const g = wb.undo.pop();
      if (!g) return;
      replay(g, false);
      wb.redo.push(g);
    }
    function redo() {
      const g = wb.redo.pop();
      if (!g) return;
      replay(g, true);
      wb.undo.push(g);
    }
    function usedRange(sheetId) {
      const sh = sheetById(sheetId);
      let maxR = 0;
      let maxC = 0;
      if (!sh) return { r: 0, c: 0 };
      Object.keys(sh.cells).forEach(function (k) {
        const p = k.split(",");
        maxR = Math.max(maxR, Number(p[0]));
        maxC = Math.max(maxC, Number(p[1]));
      });
      (sh.merges || []).forEach(function (m) {
        maxR = Math.max(maxR, m.r2);
        maxC = Math.max(maxC, m.c2);
      });
      return { r: maxR, c: maxC };
    }
    function addSheet(name) {
      const sh = emptySheet(uniqueName(name || "Sheet" + (wb.sheets.length + 1)));
      wb.sheets.push(sh);
      wb.activeSheetId = sh.id;
      invalidateAll();
      notify();
      return sh;
    }
    function deleteSheet(id) {
      if (wb.sheets.length <= 1) return;
      wb.sheets = wb.sheets.filter(function (s) {
        return s.id !== id;
      });
      if (wb.activeSheetId === id) wb.activeSheetId = wb.sheets[0].id;
      invalidateAll();
      notify();
    }
    function renameSheet(id, name) {
      const sh = sheetById(id);
      if (!sh) return;
      const next = String(name || "").trim() || sh.name;
      if (sheetByName(next) && sheetByName(next).id !== id) return;
      const prev = sh.name;
      sh.name = next;
      wb.sheets.forEach(function (other) {
        Object.keys(other.cells).forEach(function (k) {
          const cell = other.cells[k];
          if (!cell || String(cell.raw).charAt(0) !== "=") return;
          const re = new RegExp("(?:'?" + escapeRe(prev).replace(/'/g, "''") + "'?|" + escapeRe(prev) + ")!", "g");
          const quoted = /[^A-Za-z0-9_]/.test(next) ? "'" + next.replace(/'/g, "''") + "'!" : next + "!";
          cell.raw = cell.raw.replace(re, quoted);
        });
      });
      invalidateAll();
      notify();
    }
    function duplicateSheet(id) {
      const sh = sheetById(id);
      if (!sh) return;
      const copy = {
        id: uid(),
        name: uniqueName(sh.name),
        cells: JSON.parse(JSON.stringify(sh.cells)),
        colWidths: Object.assign({}, sh.colWidths),
        rowHeights: Object.assign({}, sh.rowHeights),
        merges: cloneMerges(sh.merges),
      };
      const idx = wb.sheets.findIndex(function (s) {
        return s.id === id;
      });
      wb.sheets.splice(idx + 1, 0, copy);
      wb.activeSheetId = copy.id;
      invalidateAll();
      notify();
      return copy;
    }
    function moveSheet(id, toIndex) {
      const idx = wb.sheets.findIndex(function (s) {
        return s.id === id;
      });
      if (idx < 0) return;
      const [sh] = wb.sheets.splice(idx, 1);
      wb.sheets.splice(Math.max(0, Math.min(toIndex, wb.sheets.length)), 0, sh);
      notify();
    }
    function insertRows(sheetId, at, count) {
      shiftDimension(sheetId, at, count, true);
    }
    function deleteRows(sheetId, at, count) {
      shiftDimension(sheetId, at, -count, true);
    }
    function insertCols(sheetId, at, count) {
      shiftDimension(sheetId, at, count, false);
    }
    function deleteCols(sheetId, at, count) {
      shiftDimension(sheetId, at, -count, false);
    }
    function shiftDimension(sheetId, at, delta, isRow) {
      const sh = sheetById(sheetId);
      if (!sh) return;
      const next = {};
      Object.keys(sh.cells).forEach(function (k) {
        const p = k.split(",");
        let r = Number(p[0]);
        let c = Number(p[1]);
        const pos = isRow ? r : c;
        if (delta < 0 && pos >= at && pos < at - delta) return;
        if (pos >= at) {
          if (isRow) r += delta;
          else c += delta;
        }
        if (r < 0 || c < 0 || r >= MAX_ROWS || c >= MAX_COLS) return;
        next[posKey(r, c)] = sh.cells[k];
      });
      sh.cells = next;
      const count = Math.abs(delta);
      sh.merges = (sh.merges || [])
        .map(function (m) {
          let a = isRow ? m.r1 : m.c1;
          let b = isRow ? m.r2 : m.c2;
          if (delta < 0) {
            function mapPos(p, isEnd) {
              if (p < at) return p;
              if (p < at + count) return isEnd ? at - 1 : at;
              return p - count;
            }
            a = mapPos(a, false);
            b = mapPos(b, true);
            if (b < a) return null;
          } else if (a >= at) {
            a += delta;
            b += delta;
          } else if (b >= at) b += delta;
          const out = { r1: m.r1, c1: m.c1, r2: m.r2, c2: m.c2 };
          if (isRow) {
            out.r1 = a;
            out.r2 = b;
          } else {
            out.c1 = a;
            out.c2 = b;
          }
          return out.r1 === out.r2 && out.c1 === out.c2 ? null : out;
        })
        .filter(Boolean);
      invalidateAll();
      notify();
    }
    function fill(sheetId, r1, c1, r2, c2, toR, toC) {
      beginBatch();
      const srcH = r2 - r1;
      const srcW = c2 - c1;
      const destR1 = Math.min(r1, toR);
      const destC1 = Math.min(c1, toC);
      const destR2 = Math.max(r2, toR);
      const destC2 = Math.max(c2, toC);
      for (let r = destR1; r <= destR2; r++) {
        for (let c = destC1; c <= destC2; c++) {
          if (r >= r1 && r <= r2 && c >= c1 && c <= c2) continue;
          const sr = r1 + ((r - destR1) % (srcH + 1));
          const sc = c1 + ((c - destC1) % (srcW + 1));
          let raw = getRaw(sheetId, sr, sc);
          const style = Object.assign({}, getStyle(sheetId, sr, sc));
          if (String(raw).charAt(0) === "=") raw = adjustFormula(raw, r - sr, c - sc);
          else if (srcH === 0 && srcW === 0) {
            const n = Number(raw);
            if (raw !== "" && Number.isFinite(n)) {
              const stepR = r > r2 ? r - r2 : r < r1 ? r - r1 : 0;
              const stepC = c > c2 ? c - c2 : c < c1 ? c - c1 : 0;
              raw = String(n + stepR + stepC);
            }
          }
          applyCell(sheetId, r, c, raw, style, true);
        }
      }
      endBatch();
    }
    function adjustFormula(raw, dr, dc) {
      return String(raw).replace(/(\$?)([A-Za-z]{1,3})(\$?)([1-9][0-9]{0,6})(?![A-Za-z0-9_!(])/g, function (m, ac, col, ar, row) {
        const parsed = parseA1(m);
        if (!parsed) return m;
        const r = parsed.absR ? parsed.r : parsed.r + dr;
        const c = parsed.absC ? parsed.c : parsed.c + dc;
        if (!clampRC(r, c)) return m;
        return a1(r, c, parsed.absR, parsed.absC);
      });
    }
    function copyRange(sheetId, r1, c1, r2, c2) {
      const rows = [];
      for (let r = r1; r <= r2; r++) {
        const row = [];
        for (let c = c1; c <= c2; c++) {
          row.push({ raw: getRaw(sheetId, r, c), style: Object.assign({}, getStyle(sheetId, r, c)) });
        }
        rows.push(row);
      }
      return rows;
    }
    function pasteRange(sheetId, r, c, block, asValues, mergesRel) {
      beginBatch();
      for (let i = 0; i < block.length; i++) {
        for (let j = 0; j < block[i].length; j++) {
          const item = block[i][j];
          let raw = item.raw;
          if (asValues) raw = formatValue(parseLiteral(String(raw).charAt(0) === "=" ? getValue(sheetId, r + i, c + j) : parseLiteral(raw)), item.style);
          else if (String(raw).charAt(0) === "=") raw = adjustFormula(raw, i, j);
          applyCell(sheetId, r + i, c + j, raw, item.style, true);
        }
      }
      if (mergesRel && mergesRel.length) {
        const sh = sheetById(sheetId);
        const h = block.length;
        const w = block[0] ? block[0].length : 0;
        const prev = cloneMerges(sh.merges);
        const destR2 = r + Math.max(0, h - 1);
        const destC2 = c + Math.max(0, w - 1);
        let next = prev.filter(function (m) {
          return !mergeOverlaps(m, r, c, destR2, destC2);
        });
        mergesRel.forEach(function (m) {
          const nm = normMerge({ r1: r + m.r1, c1: c + m.c1, r2: r + m.r2, c2: c + m.c2 });
          if (nm) next.push(nm);
        });
        sh.merges = next;
        pushChange({ type: "merges", sheetId: sheetId, prev: prev, next: cloneMerges(next) });
      }
      endBatch();
    }
    function clearRange(sheetId, r1, c1, r2, c2) {
      beginBatch();
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) applyCell(sheetId, r, c, "", {}, true);
      endBatch();
    }
    function applyStyleRange(sheetId, r1, c1, r2, c2, patch) {
      beginBatch();
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) applyCell(sheetId, r, c, null, patch, true);
      endBatch();
    }
    function mergeAt(sheetId, r, c) {
      const sh = sheetById(sheetId);
      const list = (sh && sh.merges) || [];
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        if (r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2) return { r1: m.r1, c1: m.c1, r2: m.r2, c2: m.c2 };
      }
      return null;
    }
    function expandToMerges(sheetId, r1, c1, r2, c2) {
      const sh = sheetById(sheetId);
      const list = (sh && sh.merges) || [];
      let a = { r1: r1, c1: c1, r2: r2, c2: c2 };
      let guard = 0;
      let changed = true;
      while (changed && guard++ < 32) {
        changed = false;
        for (let i = 0; i < list.length; i++) {
          const m = list[i];
          if (!mergeOverlaps(m, a.r1, a.c1, a.r2, a.c2)) continue;
          const nr1 = Math.min(a.r1, m.r1);
          const nc1 = Math.min(a.c1, m.c1);
          const nr2 = Math.max(a.r2, m.r2);
          const nc2 = Math.max(a.c2, m.c2);
          if (nr1 !== a.r1 || nc1 !== a.c1 || nr2 !== a.r2 || nc2 !== a.c2) {
            a = { r1: nr1, c1: nc1, r2: nr2, c2: nc2 };
            changed = true;
          }
        }
      }
      return a;
    }
    function copyMerges(sheetId, r1, c1, r2, c2) {
      const sh = sheetById(sheetId);
      return ((sh && sh.merges) || [])
        .filter(function (m) {
          return m.r1 >= r1 && m.c1 >= c1 && m.r2 <= r2 && m.c2 <= c2;
        })
        .map(function (m) {
          return { r1: m.r1 - r1, c1: m.c1 - c1, r2: m.r2 - r1, c2: m.c2 - c1 };
        });
    }
    function writeCell(sheetId, r, c, raw, style, record) {
      const sh = sheetById(sheetId);
      if (!sh) return;
      const k = posKey(r, c);
      const prev = sh.cells[k] ? { raw: sh.cells[k].raw || "", style: Object.assign({}, sh.cells[k].style || {}) } : { raw: "", style: {} };
      const next = { raw: raw || "", style: Object.assign({}, style || {}) };
      if (record) pushChange({ type: "cell", sheetId: sheetId, r: r, c: c, prev: prev, next: { raw: next.raw, style: Object.assign({}, next.style) } });
      if (next.raw === "" && !Object.keys(next.style).length) delete sh.cells[k];
      else sh.cells[k] = next;
    }
    function mergeCells(sheetId, r1, c1, r2, c2) {
      const sh = sheetById(sheetId);
      if (!sh) return;
      const rr1 = Math.min(r1, r2);
      const rr2 = Math.max(r1, r2);
      const cc1 = Math.min(c1, c2);
      const cc2 = Math.max(c1, c2);
      if (rr1 === rr2 && cc1 === cc2) return;
      beginBatch();
      const prev = cloneMerges(sh.merges);
      let keepRaw = getRaw(sheetId, rr1, cc1);
      let keepStyle = Object.assign({}, getStyle(sheetId, rr1, cc1));
      if (keepRaw === "") {
        outer: for (let r = rr1; r <= rr2; r++) {
          for (let c = cc1; c <= cc2; c++) {
            const raw = getRaw(sheetId, r, c);
            if (raw !== "") {
              keepRaw = raw;
              keepStyle = Object.assign({}, getStyle(sheetId, r, c));
              break outer;
            }
          }
        }
      }
      for (let r = rr1; r <= rr2; r++) {
        for (let c = cc1; c <= cc2; c++) {
          if (r === rr1 && c === cc1) writeCell(sheetId, r, c, keepRaw, keepStyle, true);
          else writeCell(sheetId, r, c, "", {}, true);
        }
      }
      const next = prev.filter(function (m) {
        return !mergeOverlaps(m, rr1, cc1, rr2, cc2);
      });
      next.push({ r1: rr1, c1: cc1, r2: rr2, c2: cc2 });
      sh.merges = next;
      pushChange({ type: "merges", sheetId: sheetId, prev: prev, next: cloneMerges(next) });
      invalidateAll();
      endBatch();
    }
    function unmergeCells(sheetId, r1, c1, r2, c2) {
      const sh = sheetById(sheetId);
      if (!sh) return;
      const prev = cloneMerges(sh.merges);
      const next = prev.filter(function (m) {
        return !mergeOverlaps(m, r1, c1, r2, c2);
      });
      if (next.length === prev.length) return;
      beginBatch();
      sh.merges = next;
      pushChange({ type: "merges", sheetId: sheetId, prev: prev, next: cloneMerges(next) });
      endBatch();
    }
    function toggleMerge(sheetId, r1, c1, r2, c2) {
      const a = Math.min(r1, r2);
      const b = Math.max(r1, r2);
      const c = Math.min(c1, c2);
      const d = Math.max(c1, c2);
      if (a === b && c === d) return;
      const sh = sheetById(sheetId);
      const exact = ((sh && sh.merges) || []).some(function (m) {
        return m.r1 === a && m.c1 === c && m.r2 === b && m.c2 === d;
      });
      if (exact) unmergeCells(sheetId, a, c, b, d);
      else mergeCells(sheetId, a, c, b, d);
    }
    function colWidth(sheetId, c) {
      const sh = sheetById(sheetId);
      const w = sh && sh.colWidths[c];
      return w || 84;
    }
    function rowHeight(sheetId, r) {
      const sh = sheetById(sheetId);
      const h = sh && sh.rowHeights[r];
      return h || 24;
    }
    function setColWidth(sheetId, c, w) {
      const sh = sheetById(sheetId);
      if (sh) sh.colWidths[c] = Math.max(36, Math.min(480, w));
      notify();
    }
    function toJSON() {
      return {
        id: wb.id,
        name: wb.name,
        activeSheetId: wb.activeSheetId,
        updatedAt: wb.updatedAt,
        sheets: wb.sheets.map(function (s) {
          return {
            id: s.id,
            name: s.name,
            cells: s.cells,
            colWidths: s.colWidths,
            rowHeights: s.rowHeights,
            merges: cloneMerges(s.merges),
          };
        }),
      };
    }
    const api = {
      data: wb,
      MAX_ROWS: MAX_ROWS,
      MAX_COLS: MAX_COLS,
      sheetById: sheetById,
      sheetByName: sheetByName,
      getRaw: getRaw,
      getStyle: getStyle,
      getValue: getValue,
      display: display,
      setCell: setCell,
      setStyle: setStyle,
      applyStyleRange: applyStyleRange,
      mergeAt: mergeAt,
      expandToMerges: expandToMerges,
      copyMerges: copyMerges,
      mergeCells: mergeCells,
      unmergeCells: unmergeCells,
      toggleMerge: toggleMerge,
      usedRange: usedRange,
      addSheet: addSheet,
      deleteSheet: deleteSheet,
      renameSheet: renameSheet,
      duplicateSheet: duplicateSheet,
      moveSheet: moveSheet,
      insertRows: insertRows,
      deleteRows: deleteRows,
      insertCols: insertCols,
      deleteCols: deleteCols,
      fill: fill,
      copyRange: copyRange,
      pasteRange: pasteRange,
      clearRange: clearRange,
      adjustFormula: adjustFormula,
      colWidth: colWidth,
      rowHeight: rowHeight,
      setColWidth: setColWidth,
      undo: undo,
      redo: redo,
      beginBatch: beginBatch,
      endBatch: endBatch,
      invalidateAll: invalidateAll,
      toJSON: toJSON,
      formatValue: formatValue,
      onChange: function (fn) {
        wb.listeners.push(fn);
      },
      setName: function (name) {
        wb.name = String(name || wb.name);
        notify();
      },
      setActive: function (id) {
        if (sheetById(id)) {
          wb.activeSheetId = id;
          notify();
        }
      },
    };
    wb.sheetByName = sheetByName;
    wb.sheetById = sheetById;
    return api;
  }

  function openDb() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains("workbooks")) db.createObjectStore("workbooks", { keyPath: "id" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "id" });
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }
  function idbReq(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }
  async function listWorkbooks() {
    const db = await openDb();
    const tx = db.transaction("workbooks", "readonly");
    const rows = await idbReq(tx.objectStore("workbooks").getAll());
    return (rows || []).sort(function (a, b) {
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }
  async function loadWorkbook(id) {
    const db = await openDb();
    const tx = db.transaction("workbooks", "readonly");
    const row = await idbReq(tx.objectStore("workbooks").get(id));
    return row ? fromData(row) : null;
  }
  async function saveWorkbook(api) {
    const db = await openDb();
    const data = api.toJSON();
    data.updatedAt = Date.now();
    api.data.updatedAt = data.updatedAt;
    const meta = (await getMeta()) || { id: "state" };
    meta.lastWorkbookId = data.id;
    const tx = db.transaction(["workbooks", "meta"], "readwrite");
    tx.objectStore("workbooks").put(data);
    tx.objectStore("meta").put(meta);
    return idbReq(tx.objectStore("workbooks").get(data.id)).then(function () {
      return data;
    });
  }
  async function deleteWorkbook(id) {
    const db = await openDb();
    const tx = db.transaction("workbooks", "readwrite");
    tx.objectStore("workbooks").delete(id);
    return idbReq(tx.objectStore("workbooks").get(id));
  }
  async function getMeta() {
    const db = await openDb();
    const tx = db.transaction("meta", "readonly");
    return idbReq(tx.objectStore("meta").get("state"));
  }
  async function putMeta(patch) {
    const db = await openDb();
    const cur = (await getMeta()) || { id: "state" };
    const next = Object.assign({}, cur, patch || {}, { id: "state" });
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put(next);
    return idbReq(tx.objectStore("meta").get("state"));
  }
  async function lastWorkbookId() {
    const row = await getMeta();
    return row && row.lastWorkbookId;
  }
  async function lastFsFileId() {
    const row = await getMeta();
    return row && row.lastFsFileId;
  }

  let saveTimer = null;
  function scheduleSave(api) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      saveWorkbook(api).catch(function () {});
    }, SAVE_MS);
  }

  function sheetToAoa(api, sheet, valuesOnly) {
    const used = api.usedRange(sheet.id);
    const aoa = [];
    for (let r = 0; r <= used.r; r++) {
      const row = [];
      for (let c = 0; c <= used.c; c++) {
        if (valuesOnly) row.push(api.display(sheet.id, r, c));
        else row.push(api.getRaw(sheet.id, r, c));
      }
      aoa.push(row);
    }
    return aoa;
  }
  function exportCsv(api, sheetId) {
    const sh = api.sheetById(sheetId);
    const aoa = sheetToAoa(api, sh, true);
    return aoa
      .map(function (row) {
        return row
          .map(function (v) {
            const s = String(v == null ? "" : v);
            if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
            return s;
          })
          .join(",");
      })
      .join("\n");
  }
  function importCsv(text) {
    const api = createWorkbook("CSV");
    api.data.sheets = [emptySheet("Sheet1")];
    api.data.activeSheetId = api.data.sheets[0].id;
    const lines = String(text).replace(/^\ufeff/, "").split(/\r?\n/);
    const sh = api.data.sheets[0];
    lines.forEach(function (line, r) {
      if (line === "" && r === lines.length - 1) return;
      const cells = [];
      let cur = "";
      let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line.charAt(i);
        if (q) {
          if (ch === '"' && line.charAt(i + 1) === '"') {
            cur += '"';
            i++;
          } else if (ch === '"') q = false;
          else cur += ch;
        } else if (ch === '"') q = true;
        else if (ch === ",") {
          cells.push(cur);
          cur = "";
        } else cur += ch;
      }
      cells.push(cur);
      cells.forEach(function (v, c) {
        if (v !== "") sh.cells[posKey(r, c)] = { raw: v, style: {} };
      });
    });
    return api;
  }
  function exportXlsx(api) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error("xlsx");
    const book = XLSX.utils.book_new();
    api.data.sheets.forEach(function (sh) {
      const used = api.usedRange(sh.id);
      const ws = {};
      let maxR = 0;
      let maxC = 0;
      for (let r = 0; r <= used.r; r++) {
        for (let c = 0; c <= used.c; c++) {
          const raw = api.getRaw(sh.id, r, c);
          if (raw === "" || raw == null) continue;
          const addr = colName(c) + String(r + 1);
          if (String(raw).charAt(0) === "=") {
            const val = api.getValue(sh.id, r, c);
            ws[addr] = {
              t: typeof val === "number" ? "n" : isErr(val) ? "e" : "s",
              v: isErr(val) ? val.error : val,
              f: String(raw).slice(1),
            };
          } else {
            const lit = parseLiteral(raw);
            ws[addr] = {
              t: typeof lit === "number" ? "n" : typeof lit === "boolean" ? "b" : "s",
              v: lit == null ? "" : lit,
            };
          }
          maxR = r;
          maxC = Math.max(maxC, c);
        }
      }
      ws["!ref"] = "A1:" + colName(maxC) + String(maxR + 1);
      if (sh.merges && sh.merges.length) {
        ws["!merges"] = sh.merges.map(function (m) {
          return { s: { r: m.r1, c: m.c1 }, e: { r: m.r2, c: m.c2 } };
        });
      }
      XLSX.utils.book_append_sheet(book, ws, sh.name.slice(0, 31) || "Sheet");
    });
    return XLSX.write(book, { type: "array", bookType: "xlsx" });
  }
  function toUint8(buffer) {
    if (!buffer) return buffer;
    if (typeof buffer.byteLength === "number") return new Uint8Array(buffer);
    return buffer;
  }
  function importXlsx(buffer) {
    const XLSX = window.XLSX;
    if (!XLSX) throw new Error("xlsx");
    const book = XLSX.read(toUint8(buffer), { type: "array", cellFormula: true });
    const sheets = book.SheetNames.map(function (name) {
      const ws = book.Sheets[name];
      const sh = emptySheet(name);
      sh.merges = ((ws && ws["!merges"]) || [])
        .map(function (m) {
          return normMerge({ r1: m.s.r, c1: m.s.c, r2: m.e.r, c2: m.e.c });
        })
        .filter(Boolean);
      const ref = ws && ws["!ref"];
      const range = ref ? XLSX.utils.decode_range(ref) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
          if (!cell) continue;
          let raw = "";
          if (cell.f) raw = "=" + cell.f;
          else if (cell.v != null) raw = String(cell.v);
          if (raw !== "") sh.cells[posKey(r, c)] = { raw: raw, style: {} };
        }
      }
      return sh;
    });
    if (!sheets.length) sheets.push(emptySheet("Sheet1"));
    return fromData({
      id: uid(),
      name: "Import",
      activeSheetId: sheets[0].id,
      sheets: sheets,
      updatedAt: Date.now(),
    });
  }

  return {
    MAX_ROWS: MAX_ROWS,
    MAX_COLS: MAX_COLS,
    ERR: ERR,
    FUN: FUN,
    FUNCTION_LIST: FUNCTION_LIST,
    colName: colName,
    parseCol: parseCol,
    parseA1: parseA1,
    a1: a1,
    parseLiteral: parseLiteral,
    formatValue: formatValue,
    isErr: isErr,
    createWorkbook: createWorkbook,
    fromData: fromData,
    listWorkbooks: listWorkbooks,
    loadWorkbook: loadWorkbook,
    saveWorkbook: saveWorkbook,
    deleteWorkbook: deleteWorkbook,
    getMeta: getMeta,
    putMeta: putMeta,
    lastWorkbookId: lastWorkbookId,
    lastFsFileId: lastFsFileId,
    scheduleSave: scheduleSave,
    exportCsv: exportCsv,
    importCsv: importCsv,
    exportXlsx: exportXlsx,
    importXlsx: importXlsx,
  };
})();
