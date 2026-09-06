// Validation for the five document kinds. Anything that arrives here may have
// been pasted in by a visitor, so this is a trust boundary, not a formality:
// nothing is ever eval'd, unknown fields are dropped rather than carried, and
// every number is clamped. A set with fifty thousand props or a story that
// claims to last ten hours does not fail politely on its own — it locks up the
// tab — so the limits below are the real defence, not the type checks.
//
// Errors carry a field path (`cast[1].outfit`) because the editing loop is
// paste, run, read the error, fix. "Invalid document" would make that loop
// useless.

import { HAIR_STYLE_KEYS } from '../cast/hair.js';
import { WAVE_NAMES, ROOT_FIELDS, AXES } from '../anim/channels.js';
import { JOINT_NAMES } from '../cast/rig.js';
import { POSE_NAMES } from '../anim/poses.js';

export const FORMAT_VERSION = 1;

export const KINDS = ['character', 'prop', 'set', 'story', 'action', 'bundle'];

export const LIMITS = {
  idLength: 64,
  nameLength: 120,
  textLength: 400,
  coord: 5000,
  height: [0.2, 3.0],
  scale: [0.01, 100],
  duration: [0, 600],
  storyDuration: 3600,
  timeline: 2000,
  cast: 40,
  setProps: 4000,
  setEdits: 1000,
  propBoxes: 4000,
  wardrobe: 24,
  repeat: 200,
  bundleDocs: 200,
  channels: 200,
  roles: 8,
};

const ACTION_TYPES = ['posture', 'overlay', 'move', 'turn', 'speech', 'wait', 'hold', 'camera', 'cameraFollow', 'stage'];
const ACTION_CATEGORIES = ['solo', 'group'];

const ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/;
const LANGS = ['en', 'pt', 'ja'];

// `child` is kept for documents written before boys and girls were separate
// plans; it resolves to `boy` and is not offered as a choice any more.
const BODY_PLANS = ['man', 'woman', 'boy', 'girl'];
const ACCEPTED_PLANS = [...BODY_PLANS, 'child'];
const SKIES = ['day', 'dawn', 'dusk', 'night', 'indoor'];

class Ctx {
  constructor() {
    this.errors = [];
  }

  fail(path, message) {
    if (this.errors.length < 100) this.errors.push({ path, message });
    return undefined;
  }
}

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function num(ctx, path, v, min, max, fallback) {
  if (v === undefined || v === null) return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return ctx.fail(path, `expected a number, got ${JSON.stringify(v)}`) ?? fallback;
  if (n < min || n > max) {
    ctx.fail(path, `must be between ${min} and ${max}, got ${n}`);
    return Math.max(min, Math.min(max, n));
  }
  return n;
}

function id(ctx, path, v, required = true) {
  if (typeof v !== 'string' || !ID_RE.test(v)) {
    if (v === undefined && !required) return undefined;
    return ctx.fail(path, 'must be an id: letters, digits, dot, dash or underscore');
  }
  return v;
}

/** Names may be a plain string or a per-language object; both normalise to
 *  the object form so the UI never has to test which one it got. */
function name(ctx, path, v, fallback) {
  if (typeof v === 'string') {
    const s = v.slice(0, LIMITS.nameLength);
    return { en: s, pt: s, ja: s };
  }
  if (!isObj(v)) return { en: fallback, pt: fallback, ja: fallback };
  const out = {};
  for (const lang of LANGS) {
    const s = typeof v[lang] === 'string' ? v[lang].slice(0, LIMITS.nameLength) : '';
    out[lang] = s;
  }
  const first = out.en || out.pt || out.ja || fallback;
  for (const lang of LANGS) if (!out[lang]) out[lang] = first;
  return out;
}

function text(ctx, path, v) {
  if (typeof v === 'string') {
    const s = v.slice(0, LIMITS.textLength);
    return { en: s, pt: s, ja: s };
  }
  if (!isObj(v)) return ctx.fail(path, 'expected text, or an object keyed by language');
  const out = {};
  for (const lang of LANGS) {
    out[lang] = typeof v[lang] === 'string' ? v[lang].slice(0, LIMITS.textLength) : '';
  }
  const first = out.en || out.pt || out.ja || '';
  for (const lang of LANGS) if (!out[lang]) out[lang] = first;
  return out;
}

function vec3(ctx, path, v, fallback = [0, 0, 0]) {
  if (v === undefined) return fallback.slice();
  if (!Array.isArray(v) || v.length < 2) return ctx.fail(path, 'expected [x, y, z]') ?? fallback.slice();
  const c = LIMITS.coord;
  // A two-number form is a ground position, which is what most of a document
  // wants to say and what nobody wants to write a zero into.
  if (v.length === 2) return [num(ctx, `${path}[0]`, v[0], -c, c, 0), 0, num(ctx, `${path}[1]`, v[1], -c, c, 0)];
  return [
    num(ctx, `${path}[0]`, v[0], -c, c, 0),
    num(ctx, `${path}[1]`, v[1], -c, c, 0),
    num(ctx, `${path}[2]`, v[2], -c, c, 0),
  ];
}

function color(ctx, path, v, fallback = '#888888') {
  if (v === undefined) return fallback;
  if (typeof v === 'number' && Number.isFinite(v)) {
    return `#${(v & 0xffffff).toString(16).padStart(6, '0')}`;
  }
  if (typeof v !== 'string') return ctx.fail(path, 'expected a colour like "#c8a07a"') ?? fallback;
  const s = v.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(s)) return ctx.fail(path, `not a #rrggbb colour: ${JSON.stringify(v)}`) ?? fallback;
  return s.startsWith('#') ? s : `#${s}`;
}

function array(ctx, path, v, limit) {
  if (v === undefined) return [];
  if (!Array.isArray(v)) return ctx.fail(path, 'expected an array') ?? [];
  if (v.length > limit) {
    ctx.fail(path, `has ${v.length} entries, the limit is ${limit}`);
    return v.slice(0, limit);
  }
  return v;
}

// ------------------------------------------------------------------ kinds

function character(ctx, doc) {
  const out = {
    kind: 'character',
    version: FORMAT_VERSION,
    id: id(ctx, 'id', doc.id),
    name: name(ctx, 'name', doc.name, doc.id || 'Character'),
    base: ACCEPTED_PLANS.includes(doc.base) ? doc.base : 'man',
    height: num(ctx, 'height', doc.height, LIMITS.height[0], LIMITS.height[1], undefined),
    build: num(ctx, 'build', doc.build, 0, 1, 0.5),
    look: {},
    regions: {},
    wardrobe: [],
    defaultOutfit: undefined,
  };
  if (doc.base !== undefined && !ACCEPTED_PLANS.includes(doc.base)) {
    ctx.fail('base', `unknown body plan ${JSON.stringify(doc.base)}; expected ${BODY_PLANS.join(', ')}`);
  }

  const look = isObj(doc.look) ? doc.look : {};
  out.look = {
    skin: look.skin !== undefined ? color(ctx, 'look.skin', look.skin) : undefined,
    hair: look.hair !== undefined ? color(ctx, 'look.hair', look.hair) : undefined,
    eyeScale: num(ctx, 'look.eyeScale', look.eyeScale, 0.5, 2, 1),
    beard: !!look.beard,
    hairStyle: undefined,
    hairLength: num(ctx, 'look.hairLength', look.hairLength, 0, 1, undefined),
  };
  if (look.hairStyle !== undefined) {
    if (HAIR_STYLE_KEYS.includes(look.hairStyle)) out.look.hairStyle = look.hairStyle;
    else ctx.fail('look.hairStyle', `unknown hair style ${JSON.stringify(look.hairStyle)}; expected one of ${HAIR_STYLE_KEYS.join(', ')}`);
  }

  const regions = isObj(doc.regions) ? doc.regions : {};
  for (const [key, entry] of Object.entries(regions)) {
    const path = `regions.${key}`;
    const raw = Array.isArray(entry) ? entry : isObj(entry) ? entry.scale : entry;
    if (typeof raw === 'number') {
      const s = num(ctx, path, raw, 0.5, 2, 1);
      out.regions[key] = { scale: [s, s, s] };
    } else if (Array.isArray(raw)) {
      out.regions[key] = {
        scale: [
          num(ctx, `${path}[0]`, raw[0], 0.5, 2, 1),
          num(ctx, `${path}[1]`, raw[1], 0.5, 2, 1),
          num(ctx, `${path}[2]`, raw[2], 0.5, 2, 1),
        ],
      };
    } else {
      ctx.fail(path, 'expected a scale number or [x, y, z]');
    }
  }

  for (const [i, w] of array(ctx, 'wardrobe', doc.wardrobe, LIMITS.wardrobe).entries()) {
    const path = `wardrobe[${i}]`;
    if (!isObj(w)) {
      ctx.fail(path, 'expected an object');
      continue;
    }
    out.wardrobe.push({
      id: id(ctx, `${path}.id`, w.id) || `outfit${i}`,
      outfit: typeof w.outfit === 'string' || isObj(w.outfit) ? w.outfit : 'casual',
      color: color(ctx, `${path}.color`, w.color, '#2a5caa'),
    });
  }
  if (!out.wardrobe.length) {
    out.wardrobe.push({ id: 'default', outfit: 'casual', color: '#2a5caa' });
  }
  if (doc.defaultOutfit !== undefined) {
    const want = String(doc.defaultOutfit);
    if (!out.wardrobe.some((w) => w.id === want)) {
      ctx.fail('defaultOutfit', `no wardrobe entry with id ${JSON.stringify(want)}`);
    } else {
      out.defaultOutfit = want;
    }
  }
  if (!out.defaultOutfit) out.defaultOutfit = out.wardrobe[0].id;
  return out;
}

function boxList(ctx, path, list) {
  const out = [];
  for (const [i, b] of array(ctx, path, list, LIMITS.propBoxes).entries()) {
    const p = `${path}[${i}]`;
    if (!isObj(b)) {
      ctx.fail(p, 'expected a box object');
      continue;
    }
    out.push({
      w: num(ctx, `${p}.w`, b.w, 0.001, 200, 0.2),
      h: num(ctx, `${p}.h`, b.h, 0.001, 200, 0.2),
      d: num(ctx, `${p}.d`, b.d, 0.001, 200, 0.2),
      x: num(ctx, `${p}.x`, b.x, -200, 200, 0),
      y: num(ctx, `${p}.y`, b.y, -200, 200, 0),
      z: num(ctx, `${p}.z`, b.z, -200, 200, 0),
      rx: num(ctx, `${p}.rx`, b.rx, -7, 7, 0),
      ry: num(ctx, `${p}.ry`, b.ry, -7, 7, 0),
      rz: num(ctx, `${p}.rz`, b.rz, -7, 7, 0),
      color: color(ctx, `${p}.color`, b.color, '#a0a0a0'),
      n: Math.round(num(ctx, `${p}.n`, b.n, 1, 4, 1)),
      grain: num(ctx, `${p}.grain`, b.grain, 0, 1, undefined),
      flat: !!b.flat,
      detail: !!b.detail,
    });
  }
  return out;
}

function prop(ctx, doc) {
  const out = {
    kind: 'prop',
    version: FORMAT_VERSION,
    id: id(ctx, 'id', doc.id),
    name: name(ctx, 'name', doc.name, doc.id || 'Prop'),
    scale: num(ctx, 'scale', doc.scale, LIMITS.scale[0], LIMITS.scale[1], 1),
    yaw: num(ctx, 'yaw', doc.yaw, -3600, 3600, 0),
    footprint: [
      num(ctx, 'footprint[0]', doc.footprint?.[0], 0, 500, 0.5),
      num(ctx, 'footprint[1]', doc.footprint?.[1], 0, 500, 0.5),
    ],
    anchors: {},
    source: null,
  };

  const src = isObj(doc.source) ? doc.source : {};
  if (src.type === 'gltf') {
    if (typeof src.file !== 'string' || !/^[\w./-]+\.glb$/i.test(src.file) || src.file.includes('..')) {
      ctx.fail('source.file', 'expected a relative .glb path inside the app, with no ".."');
    } else {
      out.source = { type: 'gltf', file: src.file };
    }
  } else if (src.type === 'gltfBlob') {
    const blobId = id(ctx, 'source.blobId', src.blobId);
    if (blobId) out.source = { type: 'gltfBlob', blobId };
  } else if (src.type === 'boxes') {
    out.source = { type: 'boxes', boxes: boxList(ctx, 'source.boxes', src.boxes) };
    if (!out.source.boxes.length) ctx.fail('source.boxes', 'a boxes prop needs at least one box');
  } else {
    ctx.fail('source.type', 'expected "gltf", "gltfBlob" or "boxes"');
  }

  // A prop may give off light. Held or placed, the emitter travels with it.
  if (isObj(doc.light)) {
    out.light = {
      color: color(ctx, 'light.color', doc.light.color, '#ffd9a0'),
      intensity: num(ctx, 'light.intensity', doc.light.intensity, 0, 40, 2),
      distance: num(ctx, 'light.distance', doc.light.distance, 0.2, 200, 8),
      at: vec3(ctx, 'light.at', doc.light.at, [0, 0.5, 0]),
      // Flicker is driven from the film's own clock, never from a random
      // number: a fire that danced differently on every replay would break
      // the one promise the whole engine rests on.
      flicker: num(ctx, 'light.flicker', doc.light.flicker, 0, 1, 0),
      flickerHz: num(ctx, 'light.flickerHz', doc.light.flickerHz, 0.05, 40, 6),
    };
  }

  const anchors = isObj(doc.anchors) ? doc.anchors : {};
  for (const [key, a] of Object.entries(anchors)) {
    const path = `anchors.${key}`;
    if (!isObj(a)) {
      ctx.fail(path, 'expected { pos: [x, y, z], yaw }');
      continue;
    }
    out.anchors[key] = {
      pos: vec3(ctx, `${path}.pos`, a.pos),
      yaw: num(ctx, `${path}.yaw`, a.yaw, -3600, 3600, 0),
    };
  }
  return out;
}

/** One channel of an action: a joint or a root field driven by a wave. */
function channel(ctx, path, c, forRoot) {
  if (!isObj(c)) return ctx.fail(path, 'expected a channel object');
  const out = {};
  if (forRoot) {
    if (!ROOT_FIELDS.includes(c.field)) {
      return ctx.fail(`${path}.field`, `expected one of ${ROOT_FIELDS.join(', ')}`);
    }
    out.field = c.field;
  } else {
    if (!JOINT_NAMES.includes(c.joint)) {
      return ctx.fail(`${path}.joint`, `unknown joint ${JSON.stringify(c.joint)}`);
    }
    if (!AXES.includes(c.axis)) {
      return ctx.fail(`${path}.axis`, 'expected "x", "y" or "z"');
    }
    out.joint = c.joint;
    out.axis = c.axis;
  }
  if (c.wave !== undefined && !WAVE_NAMES.includes(c.wave)) {
    ctx.fail(`${path}.wave`, `unknown wave ${JSON.stringify(c.wave)}; expected ${WAVE_NAMES.join(', ')}`);
  }
  out.wave = WAVE_NAMES.includes(c.wave) ? c.wave : 'const';
  if (c.amp !== undefined) out.amp = num(ctx, `${path}.amp`, c.amp, -50, 50, 1);
  if (c.offset !== undefined) out.offset = num(ctx, `${path}.offset`, c.offset, -50, 50, 0);
  if (c.freq !== undefined) out.freq = num(ctx, `${path}.freq`, c.freq, -64, 64, 1);
  if (c.hz !== undefined) out.hz = num(ctx, `${path}.hz`, c.hz, -64, 64, 0);
  if (c.phase !== undefined) out.phase = num(ctx, `${path}.phase`, c.phase, -64, 64, 0);
  if (c.from !== undefined) out.from = num(ctx, `${path}.from`, c.from, 0, 1, 0);
  if (c.to !== undefined) out.to = num(ctx, `${path}.to`, c.to, 0, 1, 1);
  return out;
}

/** The movement half of an action: which pose it starts from and what it
 *  pushes around. A group action has one of these per role. */
function motion(ctx, path, src) {
  const out = { root: [], joints: [] };
  if (src.pose !== undefined) {
    if (POSE_NAMES.includes(src.pose)) out.pose = src.pose;
    else ctx.fail(`${path}.pose`, `unknown pose ${JSON.stringify(src.pose)}; expected ${POSE_NAMES.join(', ')}`);
  }
  if (src.breathe !== undefined) out.breathe = num(ctx, `${path}.breathe`, src.breathe, 0, 4, 0);
  for (const [i, c] of array(ctx, `${path}.root`, src.root, LIMITS.channels).entries()) {
    const ch = channel(ctx, `${path}.root[${i}]`, c, true);
    if (ch) out.root.push(ch);
  }
  for (const [i, c] of array(ctx, `${path}.joints`, src.joints, LIMITS.channels).entries()) {
    const ch = channel(ctx, `${path}.joints[${i}]`, c, false);
    if (ch) out.joints.push(ch);
  }
  return out;
}

function action(ctx, doc) {
  const out = {
    kind: 'action',
    version: FORMAT_VERSION,
    id: id(ctx, 'id', doc.id),
    name: name(ctx, 'name', doc.name, doc.id || 'Action'),
    category: ACTION_CATEGORIES.includes(doc.category) ? doc.category : 'solo',
    type: ACTION_TYPES.includes(doc.type) ? doc.type : 'overlay',
    ...motion(ctx, '', doc),
  };
  if (doc.type !== undefined && !ACTION_TYPES.includes(doc.type)) {
    ctx.fail('type', `unknown type ${JSON.stringify(doc.type)}; expected ${ACTION_TYPES.join(', ')}`);
  }
  if (doc.duration !== undefined) out.duration = num(ctx, 'duration', doc.duration, 0, LIMITS.duration[1], 1);
  if (doc.period !== undefined) out.period = num(ctx, 'period', doc.period, 0.05, 60, 1);
  if (doc.defaultReps !== undefined) out.defaultReps = Math.round(num(ctx, 'defaultReps', doc.defaultReps, 1, 200, 5));
  if (doc.speed !== undefined) out.speed = num(ctx, 'speed', doc.speed, 0.05, 30, 1.25);
  if (doc.reps) out.reps = true;
  if (doc.gesture) out.gesture = true;
  if (doc.mirrorable) out.mirrorable = true;
  if (doc.instant) out.instant = true;
  if (doc.balloon === 'say' || doc.balloon === 'think') out.balloon = doc.balloon;
  if (doc.anchor !== undefined) out.anchor = id(ctx, 'anchor', doc.anchor);
  if (doc.posture !== undefined) out.posture = id(ctx, 'posture', doc.posture);
  if (doc.seatLift === 'set' || doc.seatLift === 'add') out.seatLift = doc.seatLift;
  if (doc.hold === 'posture') out.hold = 'posture';
  if (doc.grabs === false) out.grabs = false;
  if (doc.defaultHand === 'left' || doc.defaultHand === 'right') out.defaultHand = doc.defaultHand;
  if (isObj(doc.rate)) {
    out.rate = {
      base: num(ctx, 'rate.base', doc.rate.base, 0, 64, 4.4),
      perSpeed: num(ctx, 'rate.perSpeed', doc.rate.perSpeed, -64, 64, 0),
    };
  }
  if (isObj(doc.poseByFace)) {
    out.poseByFace = {};
    for (const [k, v] of Object.entries(doc.poseByFace)) {
      if (POSE_NAMES.includes(v)) out.poseByFace[k] = v;
      else ctx.fail(`poseByFace.${k}`, `unknown pose ${JSON.stringify(v)}`);
    }
  }

  if (out.category === 'group') groupBody(ctx, doc, out);
  return out;
}

/** Roles, where they stand relative to the group, and what each one does. */
function groupBody(ctx, doc, out) {
  out.roles = [];
  out.parts = {};
  out.props = [];
  const seen = new Set();
  for (const [i, r] of array(ctx, 'roles', doc.roles, LIMITS.roles).entries()) {
    const path = `roles[${i}]`;
    if (!isObj(r)) {
      ctx.fail(path, 'expected an object');
      continue;
    }
    const rid = id(ctx, `${path}.id`, r.id);
    if (!rid) continue;
    if (seen.has(rid)) ctx.fail(`${path}.id`, `duplicate role ${JSON.stringify(rid)}`);
    seen.add(rid);
    out.roles.push({
      id: rid,
      name: name(ctx, `${path}.name`, r.name, rid),
      at: vec3(ctx, `${path}.at`, r.at),
      yaw: num(ctx, `${path}.yaw`, r.yaw, -3600, 3600, 0),
      optional: !!r.optional,
    });
  }
  if (!out.roles.length) ctx.fail('roles', 'a group action needs at least one role');

  const parts = isObj(doc.parts) ? doc.parts : {};
  for (const [rid, part] of Object.entries(parts)) {
    if (!seen.has(rid)) {
      ctx.fail(`parts.${rid}`, `no role with id ${JSON.stringify(rid)}`);
      continue;
    }
    if (!isObj(part)) {
      ctx.fail(`parts.${rid}`, 'expected an object');
      continue;
    }
    out.parts[rid] = motion(ctx, `parts.${rid}`, part);
  }

  for (const [i, pr] of array(ctx, 'props', doc.props, 24).entries()) {
    const path = `props[${i}]`;
    if (!isObj(pr)) {
      ctx.fail(path, 'expected an object');
      continue;
    }
    const entry = {
      id: id(ctx, `${path}.id`, pr.id) || `prop${i}`,
      prop: id(ctx, `${path}.prop`, pr.prop),
      at: vec3(ctx, `${path}.at`, pr.at),
      yaw: num(ctx, `${path}.yaw`, pr.yaw, -3600, 3600, 0),
      scale: num(ctx, `${path}.scale`, pr.scale, LIMITS.scale[0], LIMITS.scale[1], 1),
      spin: pr.spin === undefined ? undefined : num(ctx, `${path}.spin`, pr.spin, -64, 64, 0),
      spinPhase: pr.spinPhase === undefined ? undefined : num(ctx, `${path}.spinPhase`, pr.spinPhase, -8, 8, 0),
    };
    if (pr.hand !== undefined) {
      if (!seen.has(pr.role)) ctx.fail(`${path}.role`, 'a held prop needs the role holding it');
      if (pr.hand !== 'left' && pr.hand !== 'right') ctx.fail(`${path}.hand`, 'expected "left" or "right"');
      entry.role = pr.role;
      entry.hand = pr.hand;
    }
    out.props.push(entry);
  }
}

function setDoc(ctx, doc) {
  const ground = isObj(doc.ground) ? doc.ground : {};
  const light = isObj(doc.light) ? doc.light : {};
  const out = {
    kind: 'set',
    version: FORMAT_VERSION,
    id: id(ctx, 'id', doc.id),
    name: name(ctx, 'name', doc.name, doc.id || 'Set'),
    ground: {
      size: [
        num(ctx, 'ground.size[0]', ground.size?.[0], 1, 2000, 40),
        num(ctx, 'ground.size[1]', ground.size?.[1], 1, 2000, 40),
      ],
      color: color(ctx, 'ground.color', ground.color, '#6d8f4a'),
    },
    sky: SKIES.includes(doc.sky) ? doc.sky : 'day',
    light: {
      sun: vec3(ctx, 'light.sun', light.sun, [-0.4, 0.9, 0.35]),
      intensity: num(ctx, 'light.intensity', light.intensity, 0, 4, 1),
    },
    props: [],
  };
  if (doc.sky !== undefined && !SKIES.includes(doc.sky)) {
    ctx.fail('sky', `unknown sky ${JSON.stringify(doc.sky)}; expected ${SKIES.join(', ')}`);
  }

  const seen = new Set();
  for (const [i, pl] of array(ctx, 'props', doc.props, LIMITS.setProps).entries()) {
    const path = `props[${i}]`;
    if (!isObj(pl)) {
      ctx.fail(path, 'expected an object');
      continue;
    }
    const placementId = id(ctx, `${path}.id`, pl.id) || `p${i}`;
    if (seen.has(placementId)) ctx.fail(`${path}.id`, `duplicate placement id ${JSON.stringify(placementId)}`);
    seen.add(placementId);
    const entry = {
      id: placementId,
      prop: id(ctx, `${path}.prop`, pl.prop),
      at: vec3(ctx, `${path}.at`, pl.at),
      yaw: num(ctx, `${path}.yaw`, pl.yaw, -3600, 3600, 0),
      scale: num(ctx, `${path}.scale`, pl.scale, LIMITS.scale[0], LIMITS.scale[1], 1),
      tint: pl.tint !== undefined ? color(ctx, `${path}.tint`, pl.tint) : undefined,
      repeat: undefined,
    };
    if (isObj(pl.repeat)) {
      entry.repeat = {
        count: Math.round(num(ctx, `${path}.repeat.count`, pl.repeat.count, 1, LIMITS.repeat, 1)),
        step: vec3(ctx, `${path}.repeat.step`, pl.repeat.step, [1, 0, 0]),
      };
    }
    out.props.push(entry);
  }
  return out;
}

const STAGE_TYPES = new Set(['camera', 'cameraFollow', 'stage']);

/**
 * @param {object} doc
 * @param {Map|null} known  id -> action document, when the caller has a
 *   library to check against. Without one the format is still checked and an
 *   unknown action is caught later, when the story is compiled.
 */
function story(ctx, doc, known) {
  const cam = isObj(doc.camera) ? doc.camera : {};
  const out = {
    kind: 'story',
    version: FORMAT_VERSION,
    id: id(ctx, 'id', doc.id),
    name: name(ctx, 'name', doc.name, doc.id || 'Story'),
    set: id(ctx, 'set', doc.set),
    camera: {
      at: vec3(ctx, 'camera.at', cam.at, [8, 4, 8]),
      look: vec3(ctx, 'camera.look', cam.look, [0, 1, 0]),
      fov: num(ctx, 'camera.fov', cam.fov, 15, 110, 50),
    },
    setEdits: [],
    cast: [],
    timeline: [],
    embeds: [],
  };

  for (const [i, e] of array(ctx, 'setEdits', doc.setEdits, LIMITS.setEdits).entries()) {
    const path = `setEdits[${i}]`;
    if (!isObj(e)) {
      ctx.fail(path, 'expected an object');
      continue;
    }
    if (e.op === 'add') {
      out.setEdits.push({
        op: 'add',
        id: id(ctx, `${path}.id`, e.id) || `edit${i}`,
        prop: id(ctx, `${path}.prop`, e.prop),
        at: vec3(ctx, `${path}.at`, e.at),
        yaw: num(ctx, `${path}.yaw`, e.yaw, -3600, 3600, 0),
        scale: num(ctx, `${path}.scale`, e.scale, LIMITS.scale[0], LIMITS.scale[1], 1),
        tint: e.tint !== undefined ? color(ctx, `${path}.tint`, e.tint) : undefined,
      });
    } else if (e.op === 'remove') {
      out.setEdits.push({ op: 'remove', id: id(ctx, `${path}.id`, e.id) });
    } else if (e.op === 'tint') {
      out.setEdits.push({
        op: 'tint',
        id: id(ctx, `${path}.id`, e.id),
        color: color(ctx, `${path}.color`, e.color),
      });
    } else {
      ctx.fail(`${path}.op`, `unknown op ${JSON.stringify(e.op)}; expected add, remove or tint`);
    }
  }

  const actors = new Set();
  for (const [i, c] of array(ctx, 'cast', doc.cast, LIMITS.cast).entries()) {
    const path = `cast[${i}]`;
    if (!isObj(c)) {
      ctx.fail(path, 'expected an object');
      continue;
    }
    const actorId = id(ctx, `${path}.id`, c.id) || `actor${i}`;
    if (actors.has(actorId)) ctx.fail(`${path}.id`, `duplicate actor id ${JSON.stringify(actorId)}`);
    actors.add(actorId);
    out.cast.push({
      id: actorId,
      character: id(ctx, `${path}.character`, c.character),
      outfit: c.outfit === undefined ? undefined : String(c.outfit).slice(0, LIMITS.idLength),
      at: vec3(ctx, `${path}.at`, c.at),
      yaw: num(ctx, `${path}.yaw`, c.yaw, -3600, 3600, 0),
      holds: c.holds === undefined ? undefined : id(ctx, `${path}.holds`, c.holds),
      hand: c.hand === 'left' ? 'left' : c.hand === 'right' ? 'right' : undefined,
    });
  }

  const cues = new Set();
  for (const [i, e] of array(ctx, 'timeline', doc.timeline, LIMITS.timeline).entries()) {
    const path = `timeline[${i}]`;
    if (!isObj(e)) {
      ctx.fail(path, 'expected an object');
      continue;
    }
    const act = typeof e.do === 'string' ? e.do : '';
    if (!ID_RE.test(act)) {
      ctx.fail(`${path}.do`, `expected an action id, got ${JSON.stringify(e.do)}`);
      continue;
    }
    const spec = known ? known.get(act) : null;
    if (known && !spec) {
      ctx.fail(`${path}.do`, `no action document with id ${JSON.stringify(act)}`);
      continue;
    }
    // A group action names no single actor — it casts its roles instead — so
    // it is grouped with the entries that do not carry one.
    // Without a library to ask, an entry naming an actor is an actor action.
    const isStage = spec
      ? (STAGE_TYPES.has(spec.type) || spec.category === 'group')
      : e.actor === undefined;
    // Built field by field rather than spread: an imported document must not
    // be able to smuggle keys past the validator into the director.
    const entry = { do: act };
    if (!isStage) {
      const actor = id(ctx, `${path}.actor`, e.actor);
      if (actor && !actors.has(actor)) {
        ctx.fail(`${path}.actor`, `no actor ${JSON.stringify(actor)} in cast`);
      }
      entry.actor = actor;
    } else {
      delete entry.actor;
    }
    // `t` is the only spelling of a start time. `at` means a position
    // everywhere in the format, including on this entry (cameraTo, propMove),
    // and letting it also mean seconds inside a timeline made the two
    // impossible to tell apart in exactly the entries that use both.
    if (typeof e.at === 'number') {
      ctx.fail(`${path}.at`, 'a start time is written as "t"; "at" is a position [x, y, z]');
    }
    entry.t = e.t === undefined ? undefined : num(ctx, `${path}.t`, e.t, 0, LIMITS.storyDuration, 0);
    entry.for = e.for === undefined ? undefined : num(ctx, `${path}.for`, e.for, 0, LIMITS.duration[1], undefined);
    entry.after = e.after === undefined ? undefined : id(ctx, `${path}.after`, e.after);
    entry.cue = e.cue === undefined ? undefined : id(ctx, `${path}.cue`, e.cue);
    if (e.at !== undefined && Array.isArray(e.at)) entry.at = vec3(ctx, `${path}.at`, e.at);
    if (entry.cue) {
      if (cues.has(entry.cue)) ctx.fail(`${path}.cue`, `duplicate cue ${JSON.stringify(entry.cue)}`);
      cues.add(entry.cue);
    }
    if (e.text !== undefined) entry.text = text(ctx, `${path}.text`, e.text);
    if (e.to !== undefined) entry.to = vec3(ctx, `${path}.to`, e.to);
    if (e.via !== undefined) {
      entry.via = array(ctx, `${path}.via`, e.via, 200).map((v, j) => vec3(ctx, `${path}.via[${j}]`, v));
    }
    if (e.speed !== undefined) entry.speed = num(ctx, `${path}.speed`, e.speed, 0.05, 30, 1.2);
    if (e.reps !== undefined) entry.reps = Math.round(num(ctx, `${path}.reps`, e.reps, 1, 200, 5));
    // A camera may look at a fixed point or at an actor, and "look at whoever
    // is talking" is the far more common intent, so both spellings are kept.
    if (Array.isArray(e.look)) {
      entry.look = vec3(ctx, `${path}.look`, e.look);
    } else if (typeof e.look === 'string') {
      const target = id(ctx, `${path}.look`, e.look);
      if (target && !actors.has(target)) ctx.fail(`${path}.look`, `no actor ${JSON.stringify(target)} in cast`);
      entry.look = target;
    } else if (e.look !== undefined) {
      ctx.fail(`${path}.look`, 'expected [x, y, z] or an actor id');
    }
    if (e.on !== undefined) entry.on = id(ctx, `${path}.on`, e.on);
    // Which way the actor ends up pointing. Every actor action takes it,
    // because "sit down facing the window" and "say this to her" are the
    // normal case, not something worth a separate turnTo before each one.
    if (Array.isArray(e.facing)) {
      entry.facing = vec3(ctx, `${path}.facing`, e.facing);
    } else if (typeof e.facing === 'string') {
      const target = id(ctx, `${path}.facing`, e.facing);
      if (target && !actors.has(target)) ctx.fail(`${path}.facing`, `no actor ${JSON.stringify(target)} in cast`);
      if (target === entry.actor) ctx.fail(`${path}.facing`, 'an actor cannot face itself');
      entry.facing = target;
    } else if (e.facing !== undefined) {
      ctx.fail(`${path}.facing`, 'expected [x, y, z] or an actor id');
    }
    if (e.face !== undefined) {
      if (e.face === 'up' || e.face === 'down') entry.face = e.face;
      else ctx.fail(`${path}.face`, 'expected "up" or "down"');
    }
    if (e.side !== undefined) {
      if (e.side === 'left' || e.side === 'right') entry.side = e.side;
      else ctx.fail(`${path}.side`, 'expected "left" or "right"');
    }
    if (e.target !== undefined) entry.target = id(ctx, `${path}.target`, e.target);
    if (e.prop !== undefined) entry.prop = id(ctx, `${path}.prop`, e.prop);
    if (e.hand !== undefined) {
      if (e.hand === 'left' || e.hand === 'right') entry.hand = e.hand;
      else ctx.fail(`${path}.hand`, 'expected "left" or "right"');
    }
    if (spec?.type === 'hold' && spec.grabs !== false && entry.prop === undefined) {
      ctx.fail(`${path}.prop`, `${act} needs the "prop" to pick up`);
    }
    // The stage actions address a placement by id and may re-aim it. These
    // were being dropped: the entry is built field by field so an import
    // cannot smuggle keys through, which also means every field a director
    // reads has to be listed here or it silently arrives undefined.
    if (e.id !== undefined) entry.id = id(ctx, `${path}.id`, e.id);
    if (e.yaw !== undefined) entry.yaw = num(ctx, `${path}.yaw`, e.yaw, -3600, 3600, 0);
    if (e.fov !== undefined) entry.fov = num(ctx, `${path}.fov`, e.fov, 15, 110, 50);
    if (spec?.type === 'stage' && act !== 'setTime' && entry.id === undefined) {
      ctx.fail(`${path}.id`, `${act} needs the "id" of a placement to act on`);
    }
    if (act === 'setTime' && e.sky === undefined) {
      ctx.fail(`${path}.sky`, 'setTime needs a "sky"');
    }
    // A group action casts its roles instead of naming a single actor.
    if (spec?.category === 'group') {
      const roles = isObj(e.cast) ? e.cast : {};
      entry.cast = {};
      for (const role of spec.roles || []) {
        const who = roles[role.id];
        if (who === undefined) {
          if (!role.optional) ctx.fail(`${path}.cast.${role.id}`, `this group action needs a "${role.id}"`);
          continue;
        }
        const actorId = id(ctx, `${path}.cast.${role.id}`, who);
        if (actorId && !actors.has(actorId)) {
          ctx.fail(`${path}.cast.${role.id}`, `no actor ${JSON.stringify(actorId)} in cast`);
        }
        entry.cast[role.id] = actorId;
      }
      for (const given of Object.keys(roles)) {
        if (!(spec.roles || []).some((r) => r.id === given)) {
          ctx.fail(`${path}.cast.${given}`, `"${act}" has no role called ${JSON.stringify(given)}`);
        }
      }
    }
    if (e.sky !== undefined) {
      if (SKIES.includes(e.sky)) entry.sky = e.sky;
      else ctx.fail(`${path}.sky`, `unknown sky ${JSON.stringify(e.sky)}; expected ${SKIES.join(', ')}`);
    }
    out.timeline.push(entry);
  }

  for (const [i, e] of out.timeline.entries()) {
    if (e.after && !cues.has(e.after)) {
      ctx.fail(`timeline[${i}].after`, `no entry carries the cue ${JSON.stringify(e.after)}`);
    }
  }
  checkTimingCycles(ctx, out.timeline);

  if (Array.isArray(doc.embeds)) {
    for (const [i, sub] of array(ctx, 'embeds', doc.embeds, LIMITS.bundleDocs).entries()) {
      const res = validate(sub, { actions: known });
      if (!res.ok) {
        for (const err of res.errors) ctx.fail(`embeds[${i}].${err.path}`, err.message);
      } else if (res.doc.kind === 'story') {
        ctx.fail(`embeds[${i}]`, 'a story cannot embed another story');
      } else {
        out.embeds.push(res.doc);
      }
    }
  }
  return out;
}

/**
 * Walks the same start-time graph the director builds, purely to find loops.
 *
 * The director already refuses to compile a circular `after` chain, but that
 * only surfaces on Play. Duplicating the walk here is worth the few lines: it
 * means the editor's "Valid." is not quietly promising something that will
 * fail the moment the story runs.
 */
function checkTimingCycles(ctx, timeline) {
  const cueOf = new Map();
  const prevOfActor = new Map();
  const prev = [];
  let lastStage = -1;
  for (const [i, e] of timeline.entries()) {
    if (e.cue) cueOf.set(e.cue, i);
    if (e.actor) {
      prev[i] = prevOfActor.has(e.actor) ? prevOfActor.get(e.actor) : -1;
      prevOfActor.set(e.actor, i);
    } else {
      prev[i] = lastStage;
      lastStage = i;
    }
  }

  const state = new Array(timeline.length).fill(0);
  const visit = (i) => {
    if (state[i] === 2) return false;
    if (state[i] === 1) return true;
    state[i] = 1;
    const e = timeline[i];
    let looped = false;
    if (e.t === undefined) {
      if (e.after !== undefined) {
        const src = cueOf.get(e.after);
        if (src !== undefined) looped = visit(src);
      } else if (prev[i] >= 0) {
        looped = visit(prev[i]);
      }
    }
    state[i] = 2;
    return looped;
  };

  for (let i = 0; i < timeline.length; i++) {
    if (state[i] === 0 && visit(i)) {
      ctx.fail(`timeline[${i}]`, 'circular timing: this entry\'s "after" chain leads back to itself');
      return;
    }
  }
}

function bundle(ctx, doc, known) {
  const out = { kind: 'bundle', version: FORMAT_VERSION, documents: [] };
  // Actions first: a story later in the same bundle may name one of them.
  const local = new Map(known || []);
  for (const sub of Array.isArray(doc.documents) ? doc.documents : []) {
    if (isObj(sub) && sub.kind === 'action') {
      const res = validate(sub);
      if (res.ok) local.set(res.doc.id, res.doc);
    }
  }
  for (const [i, sub] of array(ctx, 'documents', doc.documents, LIMITS.bundleDocs).entries()) {
    const res = validate(sub, { actions: local });
    if (!res.ok) {
      for (const err of res.errors) ctx.fail(`documents[${i}].${err.path}`, err.message);
    } else if (res.doc.kind === 'bundle') {
      ctx.fail(`documents[${i}]`, 'a bundle cannot contain another bundle');
    } else {
      out.documents.push(res.doc);
    }
  }
  if (!out.documents.length) ctx.fail('documents', 'a bundle needs at least one document');
  return out;
}

const VALIDATORS = { character, prop, set: setDoc, story, action, bundle };

/**
 * @returns {{ ok: boolean, doc: object|null, errors: Array<{path, message}> }}
 */
export function validate(input, options) {
  const ctx = new Ctx();
  if (!isObj(input)) {
    return { ok: false, doc: null, errors: [{ path: '', message: 'expected a JSON object' }] };
  }
  const kind = input.kind;
  if (!KINDS.includes(kind)) {
    return {
      ok: false,
      doc: null,
      errors: [{ path: 'kind', message: `expected one of ${KINDS.join(', ')}, got ${JSON.stringify(kind)}` }],
    };
  }
  if (input.version !== undefined && Number(input.version) > FORMAT_VERSION) {
    ctx.fail('version', `document is version ${input.version}, this app reads up to ${FORMAT_VERSION}`);
  }
  const doc = VALIDATORS[kind](ctx, input, options?.actions ?? null);
  return { ok: ctx.errors.length === 0, doc: ctx.errors.length ? null : doc, errors: ctx.errors };
}

/** Parses text and validates in one step, so the editor has one entry point. */
export function parseDocument(source, options) {
  let data;
  try {
    data = JSON.parse(source);
  } catch (err) {
    return { ok: false, doc: null, errors: [{ path: '', message: `not valid JSON: ${err.message}` }] };
  }
  return validate(data, options);
}

export function formatErrors(errors) {
  return errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message));
}
