(function () {
  const E = window.OSSheetsEngine;
  if (!E || !E.H) return;
  const H = E.H;
  const FUN = E.FUN;
  const LIST = E.FUNCTION_LIST;
  const ERR = H.ERR;
  const e = H.e;
  const toNum = H.toNum;
  const toStr = H.toStr;
  const toBool = H.toBool;
  const scalar = H.scalar;
  const flatten = H.flatten;
  const collectNums = H.collectNums;
  const isErr = E.isErr;
  const isRange = E.isRange;

  function num(ctx, a, def) {
    if (a == null) return def;
    return toNum(scalar(ctx, a));
  }
  function nums(ctx, args, skipText) {
    const v = collectNums(flatten(ctx, args, false), skipText !== false);
    return v;
  }
  function pairs(ctx, a, b) {
    const xs = flatten(ctx, [a], true);
    const ys = flatten(ctx, [b], true);
    const n = Math.min(xs.length, ys.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      if (typeof xs[i] === "number" && typeof ys[i] === "number") out.push([xs[i], ys[i]]);
    }
    return out;
  }
  function rangeCells(ctx, range) {
    const out = [];
    if (!isRange(range)) return out;
    for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) out.push(ctx.getValue(range.sheetId, r, c));
    return out;
  }
  function add(name, cat, sig, en, pt, ja, fn) {
    FUN[name] = fn;
    LIST.push([name, cat, sig, en, pt, ja]);
  }
  function sortNums(a) {
    return a.slice().sort(function (x, y) {
      return x - y;
    });
  }
  function erf(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return x >= 0 ? y : -y;
  }
  function normCdf(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
  }
  function normPdf(z) {
    return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  }
  function normInv(p) {
    if (p <= 0 || p >= 1) return e(ERR.NUM);
    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    let q;
    let r;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p <= 1 - pl) {
      q = p - 0.5;
      r = q * q;
      return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  function linreg(pts) {
    const n = pts.length;
    if (n < 2) return null;
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < n; i++) {
      sx += pts[i][0];
      sy += pts[i][1];
    }
    const mx = sx / n;
    const my = sy / n;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (pts[i][0] - mx) * (pts[i][1] - my);
      sxx += (pts[i][0] - mx) * (pts[i][0] - mx);
      syy += (pts[i][1] - my) * (pts[i][1] - my);
    }
    if (sxx === 0) return null;
    const slope = sxy / sxx;
    return { slope: slope, intercept: my - slope * mx, r2: syy === 0 ? 1 : (sxy * sxy) / (sxx * syy) };
  }
  function toBase(n, base, places) {
    if (!Number.isFinite(n)) return e(ERR.VALUE);
    let v = Math.trunc(n);
    const limit = Math.pow(base, 10);
    if (v < -limit / 2 || v >= limit / 2) return e(ERR.NUM);
    if (v < 0) v += limit;
    let s = v.toString(base).toUpperCase();
    if (places != null && Number.isFinite(places)) {
      if (s.length > places) return e(ERR.NUM);
      s = s.padStart(places, "0");
    }
    return s;
  }
  function fromBase(s, base) {
    const t = String(s).trim().toUpperCase();
    if (!t) return 0;
    const valid = base === 2 ? /^[01]{1,10}$/ : base === 8 ? /^[0-7]{1,10}$/ : /^[0-9A-F]{1,10}$/;
    if (!valid.test(t)) return e(ERR.NUM);
    let v = parseInt(t, base);
    if (t.length === 10 && v >= Math.pow(base, 10) / 2) v -= Math.pow(base, 10);
    return v;
  }
  function criteriaPairs(ctx, args, start) {
    const list = [];
    for (let i = start; i + 1 < args.length; i += 2) {
      if (!isRange(args[i])) return null;
      list.push({ range: args[i], crit: scalar(ctx, args[i + 1]) });
    }
    return list;
  }
  function matchAllCriteria(ctx, list, idxR, idxC) {
    for (let k = 0; k < list.length; k++) {
      const rg = list[k].range;
      const v = ctx.getValue(rg.sheetId, rg.r1 + idxR, rg.c1 + idxC);
      if (!H.matchCriteria(v, list[k].crit)) return false;
    }
    return true;
  }
  function extremeIfs(ctx, args, wantMax) {
    const target = args[0];
    if (!isRange(target)) return e(ERR.VALUE);
    const list = criteriaPairs(ctx, args, 1);
    if (!list) return e(ERR.VALUE);
    let best = null;
    for (let r = 0; r <= target.r2 - target.r1; r++) {
      for (let c = 0; c <= target.c2 - target.c1; c++) {
        if (!matchAllCriteria(ctx, list, r, c)) continue;
        const v = ctx.getValue(target.sheetId, target.r1 + r, target.c1 + c);
        if (typeof v !== "number") continue;
        if (best == null || (wantMax ? v > best : v < best)) best = v;
      }
    }
    return best == null ? 0 : best;
  }
  function regexOf(pat, flags) {
    try {
      return new RegExp(String(pat), flags || "");
    } catch (_err) {
      return null;
    }
  }
  function roman(n) {
    if (n < 0 || n > 3999) return e(ERR.VALUE);
    const map = [
      [1000, "M"],
      [900, "CM"],
      [500, "D"],
      [400, "CD"],
      [100, "C"],
      [90, "XC"],
      [50, "L"],
      [40, "XL"],
      [10, "X"],
      [9, "IX"],
      [5, "V"],
      [4, "IV"],
      [1, "I"],
    ];
    let v = Math.floor(n);
    let out = "";
    for (let i = 0; i < map.length; i++) {
      while (v >= map[i][0]) {
        out += map[i][1];
        v -= map[i][0];
      }
    }
    return out;
  }
  function arabic(s) {
    const t = String(s).toUpperCase().trim();
    if (!/^M*(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(t)) return e(ERR.VALUE);
    const val = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let total = 0;
    for (let i = 0; i < t.length; i++) {
      const cur = val[t.charAt(i)];
      const next = val[t.charAt(i + 1)] || 0;
      total += cur < next ? -cur : cur;
    }
    return total;
  }
  const UNITS = {
    g: ["mass", 1],
    kg: ["mass", 1000],
    mg: ["mass", 0.001],
    lbm: ["mass", 453.59237],
    ozm: ["mass", 28.349523125],
    m: ["len", 1],
    km: ["len", 1000],
    cm: ["len", 0.01],
    mm: ["len", 0.001],
    mi: ["len", 1609.344],
    yd: ["len", 0.9144],
    ft: ["len", 0.3048],
    in: ["len", 0.0254],
    nmi: ["len", 1852],
    sec: ["time", 1],
    s: ["time", 1],
    min: ["time", 60],
    hr: ["time", 3600],
    day: ["time", 86400],
    d: ["time", 86400],
    yr: ["time", 31557600],
    l: ["vol", 1],
    ml: ["vol", 0.001],
    gal: ["vol", 3.785411784],
    qt: ["vol", 0.946352946],
    pt: ["vol", 0.473176473],
    cup: ["vol", 0.2365882365],
    oz: ["vol", 0.0295735295625],
    tsp: ["vol", 0.00492892159375],
    tbs: ["vol", 0.01478676478125],
    m3: ["vol", 1000],
    "m^3": ["vol", 1000],
    "k": ["temp", 1],
    "c": ["temp", 1],
    "f": ["temp", 1],
    pa: ["press", 1],
    atm: ["press", 101325],
    mmhg: ["press", 133.322],
    psi: ["press", 6894.757],
    bar: ["press", 100000],
    j: ["energy", 1],
    kj: ["energy", 1000],
    cal: ["energy", 4.184],
    kcal: ["energy", 4184],
    wh: ["energy", 3600],
    kwh: ["energy", 3600000],
    ev: ["energy", 1.602176634e-19],
    w: ["power", 1],
    kw: ["power", 1000],
    hp: ["power", 745.69987158227],
    "m/s": ["speed", 1],
    "km/h": ["speed", 1 / 3.6],
    mph: ["speed", 0.44704],
    kn: ["speed", 0.514444],
    byte: ["info", 8],
    bit: ["info", 1],
    kb: ["info", 8 * 1024],
    mb: ["info", 8 * 1024 * 1024],
    gb: ["info", 8 * 1024 * 1024 * 1024],
    m2: ["area", 1],
    "m^2": ["area", 1],
    km2: ["area", 1e6],
    ha: ["area", 1e4],
    ft2: ["area", 0.09290304],
    "ft^2": ["area", 0.09290304],
    ac: ["area", 4046.8564224],
  };
  function convertUnit(v, from, to) {
    const a = UNITS[String(from).toLowerCase()];
    const b = UNITS[String(to).toLowerCase()];
    if (!a || !b || a[0] !== b[0]) return e(ERR.NA);
    if (a[0] === "temp") {
      const f = String(from).toLowerCase();
      const t = String(to).toLowerCase();
      let k = f === "c" ? v + 273.15 : f === "f" ? ((v - 32) * 5) / 9 + 273.15 : v;
      return t === "c" ? k - 273.15 : t === "f" ? ((k - 273.15) * 9) / 5 + 32 : k;
    }
    return (v * a[1]) / b[1];
  }

  add("CEILING.MATH", "math", "CEILING.MATH(number, [significance])", "Rounds up to a multiple.", "Arredonda ao múltiplo acima.", "倍数に切り上げ。", function (ctx, args) {
    const n = num(ctx, args[0], 0);
    const s = Math.abs(num(ctx, args[1], 1)) || 1;
    if (isErr(n)) return n;
    return Math.ceil(n / s) * s;
  });
  add("FLOOR.MATH", "math", "FLOOR.MATH(number, [significance])", "Rounds down to a multiple.", "Arredonda ao múltiplo abaixo.", "倍数に切り下げ。", function (ctx, args) {
    const n = num(ctx, args[0], 0);
    const s = Math.abs(num(ctx, args[1], 1)) || 1;
    if (isErr(n)) return n;
    return Math.floor(n / s) * s;
  });
  add("COMBIN", "math", "COMBIN(n, k)", "Combinations.", "Combinações.", "組み合わせの数。", function (ctx, args) {
    const n = Math.floor(num(ctx, args[0], 0));
    const k = Math.floor(num(ctx, args[1], 0));
    if (isErr(n) || isErr(k) || n < 0 || k < 0 || k > n) return e(ERR.NUM);
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return Math.round(r);
  });
  add("PERMUT", "math", "PERMUT(n, k)", "Permutations.", "Permutações.", "順列の数。", function (ctx, args) {
    const n = Math.floor(num(ctx, args[0], 0));
    const k = Math.floor(num(ctx, args[1], 0));
    if (isErr(n) || isErr(k) || n < 0 || k < 0 || k > n) return e(ERR.NUM);
    let r = 1;
    for (let i = 0; i < k; i++) r *= n - i;
    return r;
  });
  add("SQRTPI", "math", "SQRTPI(number)", "Square root of n·π.", "Raiz de n·π.", "n·π の平方根。", function (ctx, args) {
    const n = num(ctx, args[0], 0);
    if (isErr(n)) return n;
    return n < 0 ? e(ERR.NUM) : Math.sqrt(n * Math.PI);
  });
  add("ROMAN", "math", "ROMAN(number)", "Roman numeral.", "Algarismo romano.", "ローマ数字。", function (ctx, args) {
    const n = num(ctx, args[0], 0);
    return isErr(n) ? n : roman(n);
  });
  add("ARABIC", "math", "ARABIC(text)", "Roman to number.", "Romano para número.", "ローマ数字を数値に。", function (ctx, args) {
    return arabic(toStr(scalar(ctx, args[0])));
  });
  add("BASE", "math", "BASE(number, radix, [min_length])", "Number to text in a base.", "Número para texto na base.", "基数変換。", function (ctx, args) {
    const n = Math.floor(num(ctx, args[0], 0));
    const b = Math.floor(num(ctx, args[1], 10));
    const len = args[2] == null ? 0 : Math.floor(num(ctx, args[2], 0));
    if (isErr(n) || isErr(b) || b < 2 || b > 36 || n < 0) return e(ERR.NUM);
    return n.toString(b).toUpperCase().padStart(len, "0");
  });
  add("DECIMAL", "math", "DECIMAL(text, radix)", "Text in a base to number.", "Texto na base para número.", "基数から10進数。", function (ctx, args) {
    const s = toStr(scalar(ctx, args[0]));
    const b = Math.floor(num(ctx, args[1], 10));
    if (b < 2 || b > 36) return e(ERR.NUM);
    const v = parseInt(s, b);
    return Number.isFinite(v) ? v : e(ERR.NUM);
  });
  add("SUBTOTAL", "math", "SUBTOTAL(function_num, ref1, ...)", "Subtotal (1=AVG 2=COUNT 3=COUNTA 4=MAX 5=MIN 6=PRODUCT 7=STDEV 9=SUM).", "Subtotal (1=MÉDIA 2=CONT 3=CONTA 4=MÁX 5=MÍN 6=PRODUTO 7=DESVPAD 9=SOMA).", "小計（1=平均 2=個数 4=最大 5=最小 9=合計）。", function (ctx, args) {
    const code = Math.floor(num(ctx, args[0], 9)) % 100;
    const rest = args.slice(1);
    const map = { 1: "AVERAGE", 2: "COUNT", 3: "COUNTA", 4: "MAX", 5: "MIN", 6: "PRODUCT", 7: "STDEV", 8: "STDEV.P", 9: "SUM", 10: "VAR", 11: "VAR.P" };
    const fn = FUN[map[code]];
    return fn ? fn(ctx, rest) : e(ERR.VALUE);
  });
  add("SUMX2MY2", "math", "SUMX2MY2(array_x, array_y)", "Sum of x²−y².", "Soma de x²−y².", "x²−y² の合計。", function (ctx, args) {
    const p = pairs(ctx, args[0], args[1]);
    let s = 0;
    p.forEach(function (q) {
      s += q[0] * q[0] - q[1] * q[1];
    });
    return s;
  });
  add("SUMXMY2", "math", "SUMXMY2(array_x, array_y)", "Sum of (x−y)².", "Soma de (x−y)².", "(x−y)² の合計。", function (ctx, args) {
    const p = pairs(ctx, args[0], args[1]);
    let s = 0;
    p.forEach(function (q) {
      s += (q[0] - q[1]) * (q[0] - q[1]);
    });
    return s;
  });
  add("ROUNDBANK", "math", "ROUNDBANK(number, digits)", "Round half to even.", "Arredonda metade ao par.", "銀行家の丸め。", function (ctx, args) {
    const n = num(ctx, args[0], 0);
    const d = Math.floor(num(ctx, args[1], 0));
    if (isErr(n)) return n;
    const f = Math.pow(10, d);
    const x = n * f;
    const fl = Math.floor(x);
    const diff = x - fl;
    let r = diff > 0.5 ? fl + 1 : diff < 0.5 ? fl : fl % 2 === 0 ? fl : fl + 1;
    return r / f;
  });

  add("AVERAGEA", "stat", "AVERAGEA(value1, ...)", "Average incl. text as 0.", "Média incluindo texto como 0.", "文字列を0として平均。", function (ctx, args) {
    const vals = flatten(ctx, args, false);
    let s = 0;
    let n = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (isErr(v)) return v;
      n++;
      s += typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : 0;
    }
    return n ? s / n : e(ERR.DIV);
  });
  add("MAXA", "stat", "MAXA(value1, ...)", "Max incl. text as 0.", "Máximo incluindo texto como 0.", "文字列を0として最大。", function (ctx, args) {
    const vals = flatten(ctx, args, false);
    let best = null;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      const n = typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : 0;
      if (best == null || n > best) best = n;
    }
    return best == null ? 0 : best;
  });
  add("MINA", "stat", "MINA(value1, ...)", "Min incl. text as 0.", "Mínimo incluindo texto como 0.", "文字列を0として最小。", function (ctx, args) {
    const vals = flatten(ctx, args, false);
    let best = null;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      const n = typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : 0;
      if (best == null || n < best) best = n;
    }
    return best == null ? 0 : best;
  });
  add("MAXIFS", "stat", "MAXIFS(max_range, range1, criteria1, ...)", "Max with criteria.", "Máximo com critérios.", "条件付き最大。", function (ctx, args) {
    return extremeIfs(ctx, args, true);
  });
  add("MINIFS", "stat", "MINIFS(min_range, range1, criteria1, ...)", "Min with criteria.", "Mínimo com critérios.", "条件付き最小。", function (ctx, args) {
    return extremeIfs(ctx, args, false);
  });
  add("COUNTUNIQUE", "stat", "COUNTUNIQUE(value1, ...)", "Count distinct values.", "Conta valores distintos.", "一意な値の個数。", function (ctx, args) {
    const vals = flatten(ctx, args, false);
    const set = new Set();
    vals.forEach(function (v) {
      set.add(typeof v + ":" + toStr(v).toLowerCase());
    });
    return set.size;
  });
  add("GEOMEAN", "stat", "GEOMEAN(number1, ...)", "Geometric mean.", "Média geométrica.", "幾何平均。", function (ctx, args) {
    const a = nums(ctx, args);
    if (isErr(a)) return a;
    if (!a.length) return e(ERR.NUM);
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] <= 0) return e(ERR.NUM);
      s += Math.log(a[i]);
    }
    return Math.exp(s / a.length);
  });
  add("HARMEAN", "stat", "HARMEAN(number1, ...)", "Harmonic mean.", "Média harmônica.", "調和平均。", function (ctx, args) {
    const a = nums(ctx, args);
    if (isErr(a)) return a;
    if (!a.length) return e(ERR.NUM);
    let s = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] <= 0) return e(ERR.NUM);
      s += 1 / a[i];
    }
    return a.length / s;
  });
  add("TRIMMEAN", "stat", "TRIMMEAN(array, percent)", "Mean excluding extremes.", "Média sem extremos.", "両端を除く平均。", function (ctx, args) {
    const a = sortNums(nums(ctx, [args[0]]));
    const p = num(ctx, args[1], 0);
    if (p < 0 || p >= 1) return e(ERR.NUM);
    const k = Math.floor((a.length * p) / 2);
    const b = a.slice(k, a.length - k);
    return b.length ? H.mean(b) : e(ERR.NUM);
  });
  add("DEVSQ", "stat", "DEVSQ(number1, ...)", "Sum of squared deviations.", "Soma dos quadrados dos desvios.", "偏差平方和。", function (ctx, args) {
    const a = nums(ctx, args);
    if (isErr(a)) return a;
    const m = H.mean(a);
    let s = 0;
    a.forEach(function (x) {
      s += (x - m) * (x - m);
    });
    return s;
  });
  add("AVEDEV", "stat", "AVEDEV(number1, ...)", "Mean absolute deviation.", "Desvio absoluto médio.", "平均絶対偏差。", function (ctx, args) {
    const a = nums(ctx, args);
    if (isErr(a)) return a;
    if (!a.length) return e(ERR.NUM);
    const m = H.mean(a);
    let s = 0;
    a.forEach(function (x) {
      s += Math.abs(x - m);
    });
    return s / a.length;
  });
  add("SKEW", "stat", "SKEW(number1, ...)", "Skewness.", "Assimetria.", "歪度。", function (ctx, args) {
    const a = nums(ctx, args);
    if (isErr(a)) return a;
    const n = a.length;
    if (n < 3) return e(ERR.DIV);
    const m = H.mean(a);
    const sd = Math.sqrt(H.variance(a, true));
    if (!sd) return e(ERR.DIV);
    let s = 0;
    a.forEach(function (x) {
      s += Math.pow((x - m) / sd, 3);
    });
    return (n / ((n - 1) * (n - 2))) * s;
  });
  add("KURT", "stat", "KURT(number1, ...)", "Kurtosis.", "Curtose.", "尖度。", function (ctx, args) {
    const a = nums(ctx, args);
    if (isErr(a)) return a;
    const n = a.length;
    if (n < 4) return e(ERR.DIV);
    const m = H.mean(a);
    const sd = Math.sqrt(H.variance(a, true));
    if (!sd) return e(ERR.DIV);
    let s = 0;
    a.forEach(function (x) {
      s += Math.pow((x - m) / sd, 4);
    });
    return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * s - (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
  });
  add("MODE.SNGL", "stat", "MODE.SNGL(number1, ...)", "Most frequent number.", "Valor mais frequente.", "最頻値。", function (ctx, args) {
    return FUN.MODE(ctx, args);
  });
  add("RANK.EQ", "stat", "RANK.EQ(number, ref, [order])", "Rank of a number.", "Classificação.", "順位。", function (ctx, args) {
    return FUN.RANK(ctx, args);
  });
  add("RANK.AVG", "stat", "RANK.AVG(number, ref, [order])", "Average rank for ties.", "Classificação média em empates.", "同順位は平均順位。", function (ctx, args) {
    const n = num(ctx, args[0], 0);
    const a = nums(ctx, [args[1]]);
    const order = num(ctx, args[2], 0);
    if (isErr(n) || isErr(a)) return e(ERR.VALUE);
    const sorted = a.slice().sort(function (x, y) {
      return order ? x - y : y - x;
    });
    const first = sorted.indexOf(n);
    const last = sorted.lastIndexOf(n);
    if (first < 0) return e(ERR.NA);
    return (first + last) / 2 + 1;
  });
  add("PERCENTILE.INC", "stat", "PERCENTILE.INC(array, k)", "Percentile (inclusive).", "Percentil (inclusivo).", "パーセンタイル（含む）。", function (ctx, args) {
    return FUN.PERCENTILE(ctx, args);
  });
  add("PERCENTILE.EXC", "stat", "PERCENTILE.EXC(array, k)", "Percentile (exclusive).", "Percentil (exclusivo).", "パーセンタイル（除く）。", function (ctx, args) {
    const a = sortNums(nums(ctx, [args[0]]));
    const k = num(ctx, args[1], 0);
    const n = a.length;
    if (!n || k <= 0 || k >= 1) return e(ERR.NUM);
    const pos = k * (n + 1);
    if (pos < 1 || pos > n) return e(ERR.NUM);
    const lo = Math.floor(pos);
    const frac = pos - lo;
    return lo >= n ? a[n - 1] : a[lo - 1] + frac * (a[lo] - a[lo - 1]);
  });
  add("QUARTILE.INC", "stat", "QUARTILE.INC(array, quart)", "Quartile (inclusive).", "Quartil (inclusivo).", "四分位（含む）。", function (ctx, args) {
    return FUN.QUARTILE(ctx, args);
  });
  add("PERCENTRANK", "stat", "PERCENTRANK(array, x, [significance])", "Rank as a percentage.", "Posição percentual.", "百分率順位。", function (ctx, args) {
    const a = sortNums(nums(ctx, [args[0]]));
    const x = num(ctx, args[1], 0);
    const sig = Math.floor(num(ctx, args[2], 3));
    const n = a.length;
    if (!n) return e(ERR.NUM);
    if (x < a[0] || x > a[n - 1]) return e(ERR.NA);
    if (n === 1) return 1;
    let i = 0;
    while (i < n && a[i] < x) i++;
    let rank;
    if (a[i] === x) rank = i / (n - 1);
    else rank = ((i - 1) + (x - a[i - 1]) / (a[i] - a[i - 1])) / (n - 1);
    const f = Math.pow(10, sig);
    return Math.floor(rank * f) / f;
  });
  add("SLOPE", "stat", "SLOPE(known_y, known_x)", "Regression slope.", "Inclinação da regressão.", "回帰直線の傾き。", function (ctx, args) {
    const p = pairs(ctx, args[1], args[0]);
    const lr = linreg(p);
    return lr ? lr.slope : e(ERR.DIV);
  });
  add("INTERCEPT", "stat", "INTERCEPT(known_y, known_x)", "Regression intercept.", "Interseção da regressão.", "回帰直線の切片。", function (ctx, args) {
    const p = pairs(ctx, args[1], args[0]);
    const lr = linreg(p);
    return lr ? lr.intercept : e(ERR.DIV);
  });
  add("RSQ", "stat", "RSQ(known_y, known_x)", "R squared.", "R ao quadrado.", "決定係数。", function (ctx, args) {
    const p = pairs(ctx, args[1], args[0]);
    const lr = linreg(p);
    return lr ? lr.r2 : e(ERR.DIV);
  });
  add("FORECAST", "stat", "FORECAST(x, known_y, known_x)", "Linear forecast.", "Previsão linear.", "線形予測。", function (ctx, args) {
    const x = num(ctx, args[0], 0);
    const p = pairs(ctx, args[2], args[1]);
    const lr = linreg(p);
    if (!lr || isErr(x)) return e(ERR.DIV);
    return lr.intercept + lr.slope * x;
  });
  add("FORECAST.LINEAR", "stat", "FORECAST.LINEAR(x, known_y, known_x)", "Linear forecast.", "Previsão linear.", "線形予測。", function (ctx, args) {
    return FUN.FORECAST(ctx, args);
  });
  add("PEARSON", "stat", "PEARSON(array1, array2)", "Pearson correlation.", "Correlação de Pearson.", "ピアソン相関。", function (ctx, args) {
    return FUN.CORREL(ctx, args);
  });
  add("COVARIANCE.P", "stat", "COVARIANCE.P(array1, array2)", "Population covariance.", "Covariância populacional.", "母共分散。", function (ctx, args) {
    const p = pairs(ctx, args[0], args[1]);
    if (!p.length) return e(ERR.DIV);
    let mx = 0;
    let my = 0;
    p.forEach(function (q) {
      mx += q[0];
      my += q[1];
    });
    mx /= p.length;
    my /= p.length;
    let s = 0;
    p.forEach(function (q) {
      s += (q[0] - mx) * (q[1] - my);
    });
    return s / p.length;
  });
  add("COVARIANCE.S", "stat", "COVARIANCE.S(array1, array2)", "Sample covariance.", "Covariância amostral.", "標本共分散。", function (ctx, args) {
    const p = pairs(ctx, args[0], args[1]);
    if (p.length < 2) return e(ERR.DIV);
    const c = FUN["COVARIANCE.P"](ctx, args);
    return isErr(c) ? c : (c * p.length) / (p.length - 1);
  });
  add("STANDARDIZE", "stat", "STANDARDIZE(x, mean, standard_dev)", "Z-score.", "Escore z.", "標準化。", function (ctx, args) {
    const x = num(ctx, args[0], 0);
    const m = num(ctx, args[1], 0);
    const sd = num(ctx, args[2], 1);
    if (sd <= 0) return e(ERR.NUM);
    return (x - m) / sd;
  });
  add("NORM.DIST", "stat", "NORM.DIST(x, mean, standard_dev, cumulative)", "Normal distribution.", "Distribuição normal.", "正規分布。", function (ctx, args) {
    const x = num(ctx, args[0], 0);
    const m = num(ctx, args[1], 0);
    const sd = num(ctx, args[2], 1);
    const cum = toBool(scalar(ctx, args[3]));
    if (sd <= 0) return e(ERR.NUM);
    const z = (x - m) / sd;
    return cum ? normCdf(z) : normPdf(z) / sd;
  });
  add("NORMDIST", "stat", "NORMDIST(x, mean, standard_dev, cumulative)", "Normal distribution.", "Distribuição normal.", "正規分布。", function (ctx, args) {
    return FUN["NORM.DIST"](ctx, args);
  });
  add("NORM.S.DIST", "stat", "NORM.S.DIST(z, cumulative)", "Standard normal distribution.", "Normal padrão.", "標準正規分布。", function (ctx, args) {
    const z = num(ctx, args[0], 0);
    const cum = args[1] == null ? true : toBool(scalar(ctx, args[1]));
    return cum ? normCdf(z) : normPdf(z);
  });
  add("NORM.INV", "stat", "NORM.INV(probability, mean, standard_dev)", "Inverse normal.", "Normal inversa.", "正規分布の逆関数。", function (ctx, args) {
    const p = num(ctx, args[0], 0);
    const m = num(ctx, args[1], 0);
    const sd = num(ctx, args[2], 1);
    const z = normInv(p);
    if (isErr(z)) return z;
    if (sd <= 0) return e(ERR.NUM);
    return m + z * sd;
  });
  add("NORM.S.INV", "stat", "NORM.S.INV(probability)", "Inverse standard normal.", "Normal padrão inversa.", "標準正規分布の逆関数。", function (ctx, args) {
    return normInv(num(ctx, args[0], 0));
  });
  add("CONFIDENCE.NORM", "stat", "CONFIDENCE.NORM(alpha, standard_dev, size)", "Confidence interval.", "Intervalo de confiança.", "信頼区間。", function (ctx, args) {
    const a = num(ctx, args[0], 0.05);
    const sd = num(ctx, args[1], 1);
    const n = num(ctx, args[2], 1);
    if (a <= 0 || a >= 1 || sd <= 0 || n < 1) return e(ERR.NUM);
    const z = normInv(1 - a / 2);
    return (z * sd) / Math.sqrt(n);
  });
  add("BINOM.DIST", "stat", "BINOM.DIST(number_s, trials, probability_s, cumulative)", "Binomial distribution.", "Distribuição binomial.", "二項分布。", function (ctx, args) {
    const k = Math.floor(num(ctx, args[0], 0));
    const n = Math.floor(num(ctx, args[1], 0));
    const p = num(ctx, args[2], 0.5);
    const cum = toBool(scalar(ctx, args[3]));
    if (k < 0 || n < 0 || k > n || p < 0 || p > 1) return e(ERR.NUM);
    function pmf(i) {
      let c = 1;
      for (let j = 1; j <= i; j++) c = (c * (n - i + j)) / j;
      return c * Math.pow(p, i) * Math.pow(1 - p, n - i);
    }
    if (!cum) return pmf(k);
    let s = 0;
    for (let i = 0; i <= k; i++) s += pmf(i);
    return s;
  });
  add("POISSON.DIST", "stat", "POISSON.DIST(x, mean, cumulative)", "Poisson distribution.", "Distribuição de Poisson.", "ポアソン分布。", function (ctx, args) {
    const x = Math.floor(num(ctx, args[0], 0));
    const m = num(ctx, args[1], 1);
    const cum = toBool(scalar(ctx, args[2]));
    if (x < 0 || m <= 0) return e(ERR.NUM);
    function pmf(i) {
      return (Math.exp(-m) * Math.pow(m, i)) / H.fact(i);
    }
    if (!cum) return pmf(x);
    let s = 0;
    for (let i = 0; i <= x; i++) s += pmf(i);
    return s;
  });
  add("EXPON.DIST", "stat", "EXPON.DIST(x, lambda, cumulative)", "Exponential distribution.", "Distribuição exponencial.", "指数分布。", function (ctx, args) {
    const x = num(ctx, args[0], 0);
    const l = num(ctx, args[1], 1);
    const cum = toBool(scalar(ctx, args[2]));
    if (x < 0 || l <= 0) return e(ERR.NUM);
    return cum ? 1 - Math.exp(-l * x) : l * Math.exp(-l * x);
  });
  add("FREQUENCY", "stat", "FREQUENCY(data_array, bins_array)", "Count per bin (first bin).", "Contagem por intervalo (primeiro).", "区間ごとの個数（先頭）。", function (ctx, args) {
    const data = nums(ctx, [args[0]]);
    const bins = sortNums(nums(ctx, [args[1]]));
    if (isErr(data) || isErr(bins)) return e(ERR.VALUE);
    const counts = new Array(bins.length + 1).fill(0);
    data.forEach(function (v) {
      let i = 0;
      while (i < bins.length && v > bins[i]) i++;
      counts[i]++;
    });
    return counts.map(function (c) {
      return [c];
    });
  });

  add("XMATCH", "lookup", "XMATCH(lookup_value, lookup_array, [match_mode])", "Position of a value.", "Posição de um valor.", "位置を返す。", function (ctx, args) {
    const mode = num(ctx, args[2], 0);
    return FUN.MATCH(ctx, [args[0], args[1], mode === 0 ? 0 : mode === -1 ? 1 : mode === 1 ? -1 : 0]);
  });
  add("HYPERLINK", "lookup", "HYPERLINK(link_location, [friendly_name])", "Link text.", "Texto do link.", "リンク文字列。", function (ctx, args) {
    return args[1] == null ? toStr(scalar(ctx, args[0])) : toStr(scalar(ctx, args[1]));
  });
  add("TRANSPOSE", "lookup", "TRANSPOSE(array)", "Transposed array (first value).", "Matriz transposta (primeiro valor).", "転置配列（先頭の値）。", function (ctx, args) {
    const rg = args[0];
    if (!isRange(rg)) return scalar(ctx, rg);
    const out = [];
    for (let c = rg.c1; c <= rg.c2; c++) {
      const row = [];
      for (let r = rg.r1; r <= rg.r2; r++) row.push(ctx.getValue(rg.sheetId, r, c));
      out.push(row);
    }
    return out;
  });
  add("UNIQUE", "lookup", "UNIQUE(range)", "Distinct values (first value).", "Valores distintos (primeiro).", "一意な値（先頭）。", function (ctx, args) {
    const vals = flatten(ctx, [args[0]], false);
    const seen = new Set();
    const out = [];
    vals.forEach(function (v) {
      const k = typeof v + ":" + toStr(v).toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(v);
      }
    });
    return out;
  });
  add("SORT", "lookup", "SORT(range, [sort_index], [order])", "Sorted values (first value).", "Valores ordenados (primeiro).", "並べ替え（先頭）。", function (ctx, args) {
    const rg = args[0];
    if (!isRange(rg)) return scalar(ctx, rg);
    const idx = Math.floor(num(ctx, args[1], 1)) - 1;
    const order = num(ctx, args[2], 1);
    const rows = [];
    for (let r = rg.r1; r <= rg.r2; r++) {
      const row = [];
      for (let c = rg.c1; c <= rg.c2; c++) row.push(ctx.getValue(rg.sheetId, r, c));
      rows.push(row);
    }
    rows.sort(function (a, b) {
      const x = a[idx];
      const y = b[idx];
      let rel;
      if (typeof x === "number" && typeof y === "number") rel = x - y;
      else rel = toStr(x).localeCompare(toStr(y), undefined, { numeric: true, sensitivity: "base" });
      return order < 0 ? -rel : rel;
    });
    return rows;
  });
  add("FILTER", "lookup", "FILTER(range, include)", "Rows where include is true (first value).", "Linhas onde a condição é verdadeira (primeiro).", "条件に合う行（先頭）。", function (ctx, args) {
    const rg = args[0];
    const inc = args[1];
    if (!isRange(rg) || !isRange(inc)) return e(ERR.VALUE);
    const out = [];
    for (let r = rg.r1; r <= rg.r2; r++) {
      const flag = ctx.getValue(inc.sheetId, inc.r1 + (r - rg.r1), inc.c1);
      if (!toBool(flag)) continue;
      const row = [];
      for (let c = rg.c1; c <= rg.c2; c++) row.push(ctx.getValue(rg.sheetId, r, c));
      out.push(row);
    }
    return out.length ? out : e(ERR.NA);
  });

  add("TEXTBEFORE", "text", "TEXTBEFORE(text, delimiter, [instance])", "Text before a delimiter.", "Texto antes do delimitador.", "区切り文字の前の文字列。", function (ctx, args) {
    const s = toStr(scalar(ctx, args[0]));
    const d = toStr(scalar(ctx, args[1]));
    const inst = Math.floor(num(ctx, args[2], 1));
    if (!d) return e(ERR.VALUE);
    let idx = -1;
    let from = 0;
    for (let i = 0; i < inst; i++) {
      idx = s.indexOf(d, from);
      if (idx < 0) return e(ERR.NA);
      from = idx + d.length;
    }
    return s.slice(0, idx);
  });
  add("TEXTAFTER", "text", "TEXTAFTER(text, delimiter, [instance])", "Text after a delimiter.", "Texto após o delimitador.", "区切り文字の後の文字列。", function (ctx, args) {
    const s = toStr(scalar(ctx, args[0]));
    const d = toStr(scalar(ctx, args[1]));
    const inst = Math.floor(num(ctx, args[2], 1));
    if (!d) return e(ERR.VALUE);
    let idx = -1;
    let from = 0;
    for (let i = 0; i < inst; i++) {
      idx = s.indexOf(d, from);
      if (idx < 0) return e(ERR.NA);
      from = idx + d.length;
    }
    return s.slice(from);
  });
  add("SPLIT", "text", "SPLIT(text, delimiter, [index])", "Part of text split by delimiter.", "Parte do texto dividido.", "分割した文字列の一部。", function (ctx, args) {
    const s = toStr(scalar(ctx, args[0]));
    const d = toStr(scalar(ctx, args[1]));
    const idx = Math.floor(num(ctx, args[2], 1));
    const parts = d ? s.split(d) : [s];
    if (idx < 1 || idx > parts.length) return e(ERR.NA);
    return parts[idx - 1];
  });
  add("FIXED", "text", "FIXED(number, [decimals], [no_commas])", "Number as text.", "Número como texto.", "数値を文字列に。", function (ctx, args) {
    const n = num(ctx, args[0], 0);
    const d = Math.floor(num(ctx, args[1], 2));
    const noCommas = toBool(scalar(ctx, args[2]));
    if (isErr(n)) return n;
    const s = n.toFixed(Math.max(0, d));
    if (noCommas) return s;
    const parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  });
  add("DOLLAR", "text", "DOLLAR(number, [decimals])", "Currency text.", "Texto em moeda.", "通貨形式の文字列。", function (ctx, args) {
    const n = num(ctx, args[0], 0);
    const d = Math.floor(num(ctx, args[1], 2));
    if (isErr(n)) return n;
    return E.formatValue(n, { format: "currency", decimals: Math.max(0, d) });
  });
  add("UNICODE", "text", "UNICODE(text)", "Code point of first char.", "Código do primeiro caractere.", "先頭文字のコードポイント。", function (ctx, args) {
    const s = toStr(scalar(ctx, args[0]));
    return s ? s.codePointAt(0) : e(ERR.VALUE);
  });
  add("UNICHAR", "text", "UNICHAR(number)", "Char from code point.", "Caractere do código.", "コードポイントから文字。", function (ctx, args) {
    const n = Math.floor(num(ctx, args[0], 0));
    if (n < 1 || n > 1114111) return e(ERR.VALUE);
    return String.fromCodePoint(n);
  });
  add("REGEXMATCH", "text", "REGEXMATCH(text, pattern)", "Text matches regex.", "Texto corresponde à regex.", "正規表現に一致するか。", function (ctx, args) {
    const re = regexOf(toStr(scalar(ctx, args[1])));
    if (!re) return e(ERR.VALUE);
    return re.test(toStr(scalar(ctx, args[0])));
  });
  add("REGEXEXTRACT", "text", "REGEXEXTRACT(text, pattern)", "First regex match.", "Primeira ocorrência da regex.", "正規表現の最初の一致。", function (ctx, args) {
    const re = regexOf(toStr(scalar(ctx, args[1])));
    if (!re) return e(ERR.VALUE);
    const m = toStr(scalar(ctx, args[0])).match(re);
    if (!m) return e(ERR.NA);
    return m[1] != null ? m[1] : m[0];
  });
  add("REGEXREPLACE", "text", "REGEXREPLACE(text, pattern, replacement)", "Replace by regex.", "Substitui por regex.", "正規表現で置換。", function (ctx, args) {
    const re = regexOf(toStr(scalar(ctx, args[1])), "g");
    if (!re) return e(ERR.VALUE);
    return toStr(scalar(ctx, args[0])).replace(re, toStr(scalar(ctx, args[2])));
  });
  add("STARTSWITH", "text", "STARTSWITH(text, prefix)", "Text starts with prefix.", "Começa com.", "前方一致。", function (ctx, args) {
    return toStr(scalar(ctx, args[0])).toLowerCase().indexOf(toStr(scalar(ctx, args[1])).toLowerCase()) === 0;
  });
  add("ENDSWITH", "text", "ENDSWITH(text, suffix)", "Text ends with suffix.", "Termina com.", "後方一致。", function (ctx, args) {
    const s = toStr(scalar(ctx, args[0])).toLowerCase();
    const x = toStr(scalar(ctx, args[1])).toLowerCase();
    return x === "" || s.slice(-x.length) === x;
  });
  add("ISNONTEXT", "info", "ISNONTEXT(value)", "Not text.", "Não é texto.", "文字列でないか。", function (ctx, args) {
    return typeof scalar(ctx, args[0]) !== "string";
  });
  add("ISREF", "info", "ISREF(value)", "Is a reference.", "É referência.", "参照か。", function (ctx, args) {
    return isRange(args[0]);
  });
  add("CELL", "info", "CELL(info_type, [reference])", "Cell info: address, row, col, contents, type.", "Info da célula: address, row, col, contents, type.", "セル情報。", function (ctx, args) {
    const kind = toStr(scalar(ctx, args[0])).toLowerCase();
    const rg = isRange(args[1]) ? args[1] : H.rng(ctx.sheetId, ctx.row, ctx.col, ctx.row, ctx.col);
    if (kind === "address") return "$" + E.colName(rg.c1) + "$" + (rg.r1 + 1);
    if (kind === "row") return rg.r1 + 1;
    if (kind === "col") return rg.c1 + 1;
    if (kind === "contents") return ctx.getValue(rg.sheetId, rg.r1, rg.c1);
    if (kind === "type") {
      const v = ctx.getValue(rg.sheetId, rg.r1, rg.c1);
      return v == null || v === "" ? "b" : typeof v === "string" ? "l" : "v";
    }
    return e(ERR.VALUE);
  });

  add("DAYS", "date", "DAYS(end_date, start_date)", "Days between dates.", "Dias entre datas.", "日数差。", function (ctx, args) {
    const a = num(ctx, args[0], 0);
    const b = num(ctx, args[1], 0);
    if (isErr(a) || isErr(b)) return e(ERR.VALUE);
    return Math.floor(a) - Math.floor(b);
  });
  add("DAYS360", "date", "DAYS360(start_date, end_date)", "Days on a 360-day year.", "Dias em ano de 360 dias.", "360日基準の日数。", function (ctx, args) {
    const a = H.serialToParts(num(ctx, args[0], 0));
    const b = H.serialToParts(num(ctx, args[1], 0));
    let d1 = a.d;
    let d2 = b.d;
    if (d1 === 31) d1 = 30;
    if (d2 === 31 && d1 === 30) d2 = 30;
    return (b.y - a.y) * 360 + (b.m - a.m) * 30 + (d2 - d1);
  });
  add("ISOWEEKNUM", "date", "ISOWEEKNUM(date)", "ISO week number.", "Semana ISO.", "ISO 週番号。", function (ctx, args) {
    const p = H.serialToParts(num(ctx, args[0], 0));
    const d = new Date(Date.UTC(p.y, p.m - 1, p.d));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const start = Date.UTC(d.getUTCFullYear(), 0, 1);
    return Math.ceil(((d - start) / 86400000 + 1) / 7);
  });
  add("DATESTRING", "date", "DATESTRING(date)", "Date as ISO text.", "Data como texto ISO.", "ISO 日付文字列。", function (ctx, args) {
    return E.formatValue(num(ctx, args[0], 0), { format: "dateIso" });
  });
  add("NETWORKDAYS.INTL", "date", "NETWORKDAYS.INTL(start, end, [weekend], [holidays])", "Working days with custom weekend.", "Dias úteis com fim de semana custom.", "週末指定の営業日数。", function (ctx, args) {
    const a = Math.floor(num(ctx, args[0], 0));
    const b = Math.floor(num(ctx, args[1], 0));
    const wk = args[2] == null ? 1 : scalar(ctx, args[2]);
    const hols = H.holidaySet(ctx, args[3]);
    const mask = weekendMask(wk);
    if (!mask) return e(ERR.VALUE);
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    let n = 0;
    for (let d = lo; d <= hi; d++) if (!mask[H.serialToParts(d).dow] && !hols.has(d)) n++;
    return a <= b ? n : -n;
  });
  function weekendMask(wk) {
    const mask = [false, false, false, false, false, false, false];
    if (typeof wk === "string" && /^[01]{7}$/.test(wk)) {
      for (let i = 0; i < 7; i++) mask[(i + 1) % 7] = wk.charAt(i) === "1";
      return mask;
    }
    const n = Number(wk);
    const table = { 1: [6, 0], 2: [0, 1], 3: [1, 2], 4: [2, 3], 5: [3, 4], 6: [4, 5], 7: [5, 6], 11: [0], 12: [1], 13: [2], 14: [3], 15: [4], 16: [5], 17: [6] };
    if (!table[n]) return null;
    table[n].forEach(function (d) {
      mask[d] = true;
    });
    return mask;
  }

  add("SLN", "finance", "SLN(cost, salvage, life)", "Straight-line depreciation.", "Depreciação linear.", "定額法の減価償却。", function (ctx, args) {
    const cost = num(ctx, args[0], 0);
    const sal = num(ctx, args[1], 0);
    const life = num(ctx, args[2], 1);
    if (!life) return e(ERR.DIV);
    return (cost - sal) / life;
  });
  add("SYD", "finance", "SYD(cost, salvage, life, period)", "Sum-of-years depreciation.", "Depreciação soma dos dígitos.", "級数法の減価償却。", function (ctx, args) {
    const cost = num(ctx, args[0], 0);
    const sal = num(ctx, args[1], 0);
    const life = num(ctx, args[2], 1);
    const per = num(ctx, args[3], 1);
    if (life <= 0 || per < 1 || per > life) return e(ERR.NUM);
    return ((cost - sal) * (life - per + 1) * 2) / (life * (life + 1));
  });
  add("DB", "finance", "DB(cost, salvage, life, period, [month])", "Fixed-declining depreciation.", "Depreciação saldo fixo.", "定率法の減価償却。", function (ctx, args) {
    const cost = num(ctx, args[0], 0);
    const sal = num(ctx, args[1], 0);
    const life = num(ctx, args[2], 1);
    const per = num(ctx, args[3], 1);
    const month = num(ctx, args[4], 12);
    if (cost <= 0 || life <= 0 || per < 1) return e(ERR.NUM);
    const rate = Math.round((1 - Math.pow(sal / cost, 1 / life)) * 1000) / 1000;
    let total = 0;
    let dep = 0;
    for (let i = 1; i <= per; i++) {
      if (i === 1) dep = (cost * rate * month) / 12;
      else if (i === life + 1) dep = ((cost - total) * rate * (12 - month)) / 12;
      else dep = (cost - total) * rate;
      total += dep;
    }
    return dep;
  });
  add("DDB", "finance", "DDB(cost, salvage, life, period, [factor])", "Double-declining depreciation.", "Depreciação saldo duplo.", "倍額定率法。", function (ctx, args) {
    const cost = num(ctx, args[0], 0);
    const sal = num(ctx, args[1], 0);
    const life = num(ctx, args[2], 1);
    const per = num(ctx, args[3], 1);
    const factor = num(ctx, args[4], 2);
    if (cost < 0 || life <= 0 || per < 1 || per > life) return e(ERR.NUM);
    let book = cost;
    let dep = 0;
    for (let i = 1; i <= per; i++) {
      dep = Math.min((book * factor) / life, Math.max(0, book - sal));
      book -= dep;
    }
    return dep;
  });
  add("EFFECT", "finance", "EFFECT(nominal_rate, npery)", "Effective annual rate.", "Taxa efetiva anual.", "実効年利率。", function (ctx, args) {
    const r = num(ctx, args[0], 0);
    const n = Math.floor(num(ctx, args[1], 1));
    if (r <= 0 || n < 1) return e(ERR.NUM);
    return Math.pow(1 + r / n, n) - 1;
  });
  add("NOMINAL", "finance", "NOMINAL(effect_rate, npery)", "Nominal annual rate.", "Taxa nominal anual.", "名目年利率。", function (ctx, args) {
    const r = num(ctx, args[0], 0);
    const n = Math.floor(num(ctx, args[1], 1));
    if (r <= 0 || n < 1) return e(ERR.NUM);
    return n * (Math.pow(1 + r, 1 / n) - 1);
  });
  add("RRI", "finance", "RRI(nper, pv, fv)", "Equivalent interest rate.", "Taxa equivalente.", "等価利率。", function (ctx, args) {
    const n = num(ctx, args[0], 1);
    const pv = num(ctx, args[1], 0);
    const fv = num(ctx, args[2], 0);
    if (n <= 0 || pv === 0) return e(ERR.NUM);
    return Math.pow(fv / pv, 1 / n) - 1;
  });
  add("PDURATION", "finance", "PDURATION(rate, pv, fv)", "Periods to reach a value.", "Períodos para atingir valor.", "目標到達までの期間。", function (ctx, args) {
    const r = num(ctx, args[0], 0);
    const pv = num(ctx, args[1], 0);
    const fv = num(ctx, args[2], 0);
    if (r <= 0 || pv <= 0 || fv <= 0) return e(ERR.NUM);
    return (Math.log(fv) - Math.log(pv)) / Math.log(1 + r);
  });
  add("FVSCHEDULE", "finance", "FVSCHEDULE(principal, schedule)", "Future value with variable rates.", "Valor futuro com taxas variáveis.", "変動利率の将来価値。", function (ctx, args) {
    let v = num(ctx, args[0], 0);
    const rates = nums(ctx, [args[1]]);
    if (isErr(rates)) return rates;
    rates.forEach(function (r) {
      v *= 1 + r;
    });
    return v;
  });
  add("CUMIPMT", "finance", "CUMIPMT(rate, nper, pv, start, end, type)", "Cumulative interest.", "Juros acumulados.", "累計利息。", function (ctx, args) {
    const start = Math.floor(num(ctx, args[3], 1));
    const end = Math.floor(num(ctx, args[4], 1));
    if (start < 1 || end < start) return e(ERR.NUM);
    let s = 0;
    for (let p = start; p <= end; p++) {
      const v = FUN.IPMT(ctx, [args[0], p, args[1], args[2], 0, args[5]]);
      if (isErr(v)) return v;
      s += v;
    }
    return s;
  });
  add("CUMPRINC", "finance", "CUMPRINC(rate, nper, pv, start, end, type)", "Cumulative principal.", "Principal acumulado.", "累計元金。", function (ctx, args) {
    const start = Math.floor(num(ctx, args[3], 1));
    const end = Math.floor(num(ctx, args[4], 1));
    if (start < 1 || end < start) return e(ERR.NUM);
    let s = 0;
    for (let p = start; p <= end; p++) {
      const v = FUN.PPMT(ctx, [args[0], p, args[1], args[2], 0, args[5]]);
      if (isErr(v)) return v;
      s += v;
    }
    return s;
  });
  add("MIRR", "finance", "MIRR(values, finance_rate, reinvest_rate)", "Modified IRR.", "TIR modificada.", "修正内部収益率。", function (ctx, args) {
    const vals = nums(ctx, [args[0]]);
    const fr = num(ctx, args[1], 0);
    const rr = num(ctx, args[2], 0);
    if (isErr(vals) || vals.length < 2) return e(ERR.VALUE);
    const n = vals.length;
    let npvNeg = 0;
    let npvPos = 0;
    for (let i = 0; i < n; i++) {
      if (vals[i] < 0) npvNeg += vals[i] / Math.pow(1 + fr, i);
      else npvPos += vals[i] / Math.pow(1 + rr, i);
    }
    if (!npvNeg || !npvPos) return e(ERR.DIV);
    return Math.pow((-npvPos * Math.pow(1 + rr, n)) / (npvNeg * (1 + fr)), 1 / (n - 1)) - 1;
  });
  add("XNPV", "finance", "XNPV(rate, values, dates)", "NPV with dates.", "VPL com datas.", "日付付き正味現在価値。", function (ctx, args) {
    const r = num(ctx, args[0], 0);
    const vals = flatten(ctx, [args[1]], true);
    const dates = flatten(ctx, [args[2]], true);
    if (vals.length !== dates.length || !vals.length) return e(ERR.NUM);
    const d0 = toNum(dates[0]);
    let s = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = toNum(vals[i]);
      const d = toNum(dates[i]);
      if (isErr(v) || isErr(d)) return e(ERR.VALUE);
      s += v / Math.pow(1 + r, (d - d0) / 365);
    }
    return s;
  });
  add("XIRR", "finance", "XIRR(values, dates, [guess])", "IRR with dates.", "TIR com datas.", "日付付き内部収益率。", function (ctx, args) {
    const vals = flatten(ctx, [args[0]], true).map(toNum);
    const dates = flatten(ctx, [args[1]], true).map(toNum);
    if (vals.length !== dates.length || vals.length < 2) return e(ERR.NUM);
    let r = num(ctx, args[2], 0.1);
    const d0 = dates[0];
    function f(rate) {
      let s = 0;
      for (let i = 0; i < vals.length; i++) s += vals[i] / Math.pow(1 + rate, (dates[i] - d0) / 365);
      return s;
    }
    function df(rate) {
      let s = 0;
      for (let i = 0; i < vals.length; i++) {
        const t = (dates[i] - d0) / 365;
        s += (-t * vals[i]) / Math.pow(1 + rate, t + 1);
      }
      return s;
    }
    for (let i = 0; i < 100; i++) {
      const y = f(r);
      const dy = df(r);
      if (!dy) break;
      const nr = r - y / dy;
      if (Math.abs(nr - r) < 1e-10) return nr;
      r = nr;
      if (r <= -1) r = -0.99;
    }
    return Math.abs(f(r)) < 1e-6 ? r : e(ERR.NUM);
  });
  add("ISPMT", "finance", "ISPMT(rate, per, nper, pv)", "Interest for even principal.", "Juros com principal constante.", "元金均等の利息。", function (ctx, args) {
    const r = num(ctx, args[0], 0);
    const per = num(ctx, args[1], 1);
    const n = num(ctx, args[2], 1);
    const pv = num(ctx, args[3], 0);
    if (!n) return e(ERR.DIV);
    return -pv * r * (1 - per / n);
  });

  add("BIN2HEX", "eng", "BIN2HEX(number, [places])", "Binary to hex.", "Binário para hex.", "2進数を16進数に。", function (ctx, args) {
    const v = fromBase(toStr(scalar(ctx, args[0])), 2);
    return isErr(v) ? v : toBase(v, 16, args[1] == null ? null : num(ctx, args[1], null));
  });
  add("BIN2OCT", "eng", "BIN2OCT(number, [places])", "Binary to octal.", "Binário para octal.", "2進数を8進数に。", function (ctx, args) {
    const v = fromBase(toStr(scalar(ctx, args[0])), 2);
    return isErr(v) ? v : toBase(v, 8, args[1] == null ? null : num(ctx, args[1], null));
  });
  add("HEX2BIN", "eng", "HEX2BIN(number, [places])", "Hex to binary.", "Hex para binário.", "16進数を2進数に。", function (ctx, args) {
    const v = fromBase(toStr(scalar(ctx, args[0])), 16);
    return isErr(v) ? v : toBase(v, 2, args[1] == null ? null : num(ctx, args[1], null));
  });
  add("HEX2OCT", "eng", "HEX2OCT(number, [places])", "Hex to octal.", "Hex para octal.", "16進数を8進数に。", function (ctx, args) {
    const v = fromBase(toStr(scalar(ctx, args[0])), 16);
    return isErr(v) ? v : toBase(v, 8, args[1] == null ? null : num(ctx, args[1], null));
  });
  add("OCT2BIN", "eng", "OCT2BIN(number, [places])", "Octal to binary.", "Octal para binário.", "8進数を2進数に。", function (ctx, args) {
    const v = fromBase(toStr(scalar(ctx, args[0])), 8);
    return isErr(v) ? v : toBase(v, 2, args[1] == null ? null : num(ctx, args[1], null));
  });
  add("OCT2HEX", "eng", "OCT2HEX(number, [places])", "Octal to hex.", "Octal para hex.", "8進数を16進数に。", function (ctx, args) {
    const v = fromBase(toStr(scalar(ctx, args[0])), 8);
    return isErr(v) ? v : toBase(v, 16, args[1] == null ? null : num(ctx, args[1], null));
  });
  add("BITAND", "eng", "BITAND(number1, number2)", "Bitwise AND.", "E bit a bit.", "ビット AND。", function (ctx, args) {
    const a = num(ctx, args[0], 0);
    const b = num(ctx, args[1], 0);
    if (a < 0 || b < 0 || a > 281474976710655 || b > 281474976710655) return e(ERR.NUM);
    return Number(BigInt(Math.floor(a)) & BigInt(Math.floor(b)));
  });
  add("BITOR", "eng", "BITOR(number1, number2)", "Bitwise OR.", "OU bit a bit.", "ビット OR。", function (ctx, args) {
    const a = num(ctx, args[0], 0);
    const b = num(ctx, args[1], 0);
    if (a < 0 || b < 0) return e(ERR.NUM);
    return Number(BigInt(Math.floor(a)) | BigInt(Math.floor(b)));
  });
  add("BITXOR", "eng", "BITXOR(number1, number2)", "Bitwise XOR.", "OU exclusivo bit a bit.", "ビット XOR。", function (ctx, args) {
    const a = num(ctx, args[0], 0);
    const b = num(ctx, args[1], 0);
    if (a < 0 || b < 0) return e(ERR.NUM);
    return Number(BigInt(Math.floor(a)) ^ BigInt(Math.floor(b)));
  });
  add("BITLSHIFT", "eng", "BITLSHIFT(number, shift)", "Shift bits left.", "Desloca bits à esquerda.", "左ビットシフト。", function (ctx, args) {
    const a = num(ctx, args[0], 0);
    const s = Math.floor(num(ctx, args[1], 0));
    if (a < 0) return e(ERR.NUM);
    return s >= 0 ? Math.floor(a) * Math.pow(2, s) : Math.floor(Math.floor(a) / Math.pow(2, -s));
  });
  add("BITRSHIFT", "eng", "BITRSHIFT(number, shift)", "Shift bits right.", "Desloca bits à direita.", "右ビットシフト。", function (ctx, args) {
    const a = num(ctx, args[0], 0);
    const s = Math.floor(num(ctx, args[1], 0));
    if (a < 0) return e(ERR.NUM);
    return s >= 0 ? Math.floor(Math.floor(a) / Math.pow(2, s)) : Math.floor(a) * Math.pow(2, -s);
  });
  add("DELTA", "eng", "DELTA(number1, [number2])", "1 if equal, else 0.", "1 se iguais, senão 0.", "等しければ1。", function (ctx, args) {
    return num(ctx, args[0], 0) === num(ctx, args[1], 0) ? 1 : 0;
  });
  add("GESTEP", "eng", "GESTEP(number, [step])", "1 if number ≥ step.", "1 se número ≥ degrau.", "しきい値以上なら1。", function (ctx, args) {
    return num(ctx, args[0], 0) >= num(ctx, args[1], 0) ? 1 : 0;
  });
  add("CONVERT", "eng", "CONVERT(number, from_unit, to_unit)", "Convert units (m, km, ft, kg, lbm, l, gal, C, F, K, ...).", "Converte unidades (m, km, ft, kg, lbm, l, gal, C, F, K, ...).", "単位変換（m, km, ft, kg, lbm, l, gal, C, F, K など）。", function (ctx, args) {
    const v = num(ctx, args[0], 0);
    if (isErr(v)) return v;
    return convertUnit(v, toStr(scalar(ctx, args[1])), toStr(scalar(ctx, args[2])));
  });
  add("ERF", "eng", "ERF(x)", "Error function.", "Função erro.", "誤差関数。", function (ctx, args) {
    return erf(num(ctx, args[0], 0));
  });
  add("ERFC", "eng", "ERFC(x)", "Complementary error function.", "Função erro complementar.", "相補誤差関数。", function (ctx, args) {
    return 1 - erf(num(ctx, args[0], 0));
  });

  add("IFBLANK", "logical", "IFBLANK(value, value_if_blank)", "Fallback when empty.", "Valor se vazio.", "空白時の代替。", function (ctx, args) {
    const v = scalar(ctx, args[0]);
    return v == null || v === "" ? scalar(ctx, args[1]) : v;
  });
  add("ISBETWEEN", "logical", "ISBETWEEN(value, lower, upper)", "Value within bounds.", "Valor entre limites.", "範囲内か。", function (ctx, args) {
    const v = num(ctx, args[0], 0);
    const lo = num(ctx, args[1], 0);
    const hi = num(ctx, args[2], 0);
    if (isErr(v)) return v;
    return v >= Math.min(lo, hi) && v <= Math.max(lo, hi);
  });

  LIST.sort(function (a, b) {
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
  void rangeCells;
})();
