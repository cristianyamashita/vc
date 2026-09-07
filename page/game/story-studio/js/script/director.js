import { FALLBACK_ACTION, isActorAction, speechDuration, pathLength } from './actions.js';
import { performAction, actionDuration } from '../anim/perform.js';
import { channelValue, clockOf } from '../anim/channels.js';
import { blendPose, overlayPose, ease } from '../anim/blend.js';

// The compiler. A story goes in; a thing that can be sampled at any time comes
// out. Nothing here runs per frame with memory of the last frame, because the
// whole design rests on one property:
//
//     sample(t) must not depend on how the viewer reached t.
//
// Drag the progress bar to 0:31 and you must get exactly the picture you would
// have got by watching from the start. That is why an action's motion is
// resolved into absolute keyframes up front instead of being integrated frame
// by frame, and why every clip is a pure function of its own local time.

const FADE = 0.25;
const TAIL = 1.0;
const TAU = Math.PI * 2;

/** Unwraps `next` to the revolution nearest `prev`, so interpolating a turn
 *  from 350 deg to 10 deg goes the short way instead of spinning backward. */
function nearestAngle(prev, next) {
  let a = next;
  while (a - prev > Math.PI) a -= TAU;
  while (prev - a > Math.PI) a += TAU;
  return a;
}

function lerp(a, b, k) {
  return a + (b - a) * k;
}

function vecLerp(a, b, k) {
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
}

/** Binary search: index of the last keyframe at or before `t`. Every track
 *  sampled through here must name its time field `t`; a track that spells it
 *  differently does not error, it silently pins to frame zero. */
function findIndex(frames, t) {
  let lo = 0;
  let hi = frames.length - 1;
  if (!frames.length || t < frames[0].t) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

class Film {
  constructor(data) {
    Object.assign(this, data);
  }

  /** The whole scene at time `t`. Pure. */
  sample(t) {
    const time = Math.max(0, Math.min(this.duration, t));
    const actors = {};
    for (const [id, a] of Object.entries(this.actors)) {
      actors[id] = this.sampleActor(id, a, time);
    }
    return {
      time,
      actors,
      camera: this.sampleCamera(time, actors),
      balloons: this.balloons.filter((b) => time >= b.start && time < b.end),
      stage: this.sampleStage(time),
      groupProps: this.samplePropSpans(time, actors),
    };
  }

  sampleActor(id, a, t) {
    const place = samplePlacement(a.frames, t);

    // The posture underneath, cross-faded from the one before it.
    const ri = Math.max(0, findIndex(a.resting, t));
    const rest = a.resting[ri];
    let pose = performAction(rest.action, rest.params, t - rest.t, rest.part);
    if (ri > 0 && t - rest.t < FADE) {
      const prev = a.resting[ri - 1];
      pose = blendPose(performAction(prev.action, prev.params, t - prev.t, prev.part), pose,
        ease((t - rest.t) / FADE));
    }

    // Then whatever transient action is playing on top of it.
    const span = lastSpanAt(a.overlays, t);
    if (span) {
      const weight = Math.min(
        1,
        ease((t - span.start) / FADE),
        ease((span.end - t) / FADE),
      );
      if (weight > 0) {
        const over = performAction(span.action, span.params, t - span.start, span.part);
        pose = span.gesture ? overlayPose(pose, over, weight) : blendPose(pose, over, weight);
      }
    }

    const hold = heldAt(a, t);
    return {
      x: place.x, y: place.y, z: place.z, yaw: place.yaw, pose,
      doc: a.doc, outfit: a.outfit,
      holds: hold.prop, hand: hold.hand, grip: hold.grip || null,
    };
  }

  sampleCamera(t, actors) {
    const frames = this.camera;
    const i = findIndex(frames, t);
    const cur = i < 0 ? frames[0] : frames[i];
    let at = cur.at;
    let look = cur.look;
    let fov = cur.fov;
    const next = frames[i + 1];
    // A cut is a hard change: hold the previous framing right up to it rather
    // than sliding into it, or every cut becomes a two-second dolly.
    if (i >= 0 && next && !next.hard) {
      const raw = (t - cur.t) / Math.max(1e-6, next.t - cur.t);
      // Both ends have to be marked, so `glide` describes a RUN of moves.
      // Easing only where the run begins and ends is what makes a walk read
      // as one travel rather than as a series of little arrivals.
      const k = cur.glide && next.glide ? Math.max(0, Math.min(1, raw)) : ease(raw);
      at = vecLerp(cur.at, next.at, k);
      fov = lerp(cur.fov, next.fov, k);
      if (Array.isArray(cur.look) && Array.isArray(next.look)) look = vecLerp(cur.look, next.look, k);
      else look = k < 0.5 ? cur.look : next.look;
    }

    const follow = lastSpanAt(this.follows, t);
    const target = follow ? follow.actor : (typeof look === 'string' ? look : null);
    if (target && actors[target]) {
      const a = actors[target];
      const height = a.doc?.height || 1.7;
      look = [a.x, a.y + height * 0.86, a.z];
    } else if (!Array.isArray(look)) {
      look = [0, 1, 0];
    }
    return { at, look, fov };
  }

  /**
   * Props an action puts in the world for its own duration — the rope arc
   * between two turners, the bar somebody is pressing. Anything held in a
   * hand travels on that actor's held track instead.
   *
   * The frame a prop is placed in is the action's own: a group's formation,
   * or the single actor's footprint for a solo action.
   */
  samplePropSpans(t, actors) {
    const out = [];
    for (const span of this.propSpans) {
      if (t < span.start || t >= span.end) continue;
      const frame = span.group
        ? { at: span.group.at, yaw: span.group.yaw }
        : (() => {
          const a = actors?.[span.actor];
          if (!a) return null;
          // Measured from the BODY, not from the patch of ground under it.
          // Otherwise a bar authored to sit at chest height ends up on the
          // floor the moment its owner lies down on a bench.
          const lift = (a.pose?.root?.lift || 0) * (a.doc?.height || 1.7);
          return { at: [a.x, a.y + lift, a.z], yaw: a.yaw };
        })();
      if (!frame) continue;
      const cos = Math.cos(frame.yaw);
      const sin = Math.sin(frame.yaw);
      const u = clockOf(span.action, t - span.start, span.params);

      for (const pr of span.action.props || []) {
        if (pr.hand) continue;
        const m = { x: 0, y: 0, z: 0, spin: 0 };
        for (const ch of pr.motion || []) {
          m[ch.field] += channelValue(ch, u, t - span.start);
        }
        const lx = pr.at[0] + m.x;
        const ly = pr.at[1] + m.y;
        const lz = pr.at[2] + m.z;
        out.push({
          key: `${span.action.id}.${span.start.toFixed(3)}.${pr.id}`,
          prop: pr.prop,
          at: [frame.at[0] + lx * cos + lz * sin, frame.at[1] + ly, frame.at[2] - lx * sin + lz * cos],
          yaw: frame.yaw + (pr.yaw * Math.PI) / 180,
          scale: pr.scale,
          // `spin` is turns per second about the prop's own long axis, which
          // is what makes a skipping rope a skipping rope.
          spin: ((t - span.start) * (pr.spin || 0) + (pr.spinPhase || 0)) * Math.PI * 2 + m.spin,
        });
      }
    }
    return out;
  }

  /** Every prop this film can ever need to build, so the renderer can load
   *  them up front and keep per-frame work synchronous. */
  propIds() {
    const ids = new Set();
    for (const track of Object.values(this.held || {})) {
      for (const h of track) if (h.prop) ids.add(h.prop);
    }
    for (const span of this.propSpans) {
      for (const pr of span.action.props || []) ids.add(pr.prop);
    }
    return [...ids];
  }

  sampleStage(t) {
    const hidden = new Set();
    const moved = new Map();
    let sky = this.sky;
    for (const e of this.stageEvents) {
      // Everything before `t` is replayed in order, so a move that started
      // earlier and has not finished is the last one this loop sees — which
      // is exactly the one that needs interpolating.
      if (e.t > t) break;
      if (e.op === 'propHide') hidden.add(e.id);
      else if (e.op === 'propShow') hidden.delete(e.id);
      else if (e.op === 'propMove') moved.set(e.id, movedAt(e, moved.get(e.id), t));
      else if (e.op === 'setTime') sky = e.sky;
    }
    return { sky, hidden, moved };
  }
}

/**
 * Where a prop is partway through a move.
 *
 * `prev` is where this same placement had got to earlier in the scan, which is
 * what a second move leaves from — the ball is thrown on from wherever it was
 * caught, not from where the set first put it. The fraction is clamped, so a
 * finished move reads as its own endpoint and a chain of them composes.
 */
function movedAt(e, prev, t) {
  const from = prev?.at || e.from;
  const fromYaw = prev?.yaw ?? e.fromYaw;
  if (!e.at || !from) return { at: e.at, yaw: e.yaw };
  const k = e.end > e.t ? Math.max(0, Math.min(1, (t - e.t) / (e.end - e.t))) : 1;
  // A parabola through both ends, highest in the middle. `arc` is that height
  // in metres, so an author writes the clearance they want over the net.
  const bow = e.arc ? e.arc * 4 * k * (1 - k) : 0;
  return {
    at: [lerp(from[0], e.at[0], k), lerp(from[1], e.at[1], k) + bow, lerp(from[2], e.at[2], k)],
    yaw: e.yaw === undefined ? fromYaw : lerp(fromYaw, e.yaw, k),
  };
}

function samplePlacement(frames, t) {
  const i = findIndex(frames, t);
  if (i < 0) return frames[0];
  const cur = frames[i];
  const next = frames[i + 1];
  if (!next || next.t <= cur.t) return cur;
  const k = t >= next.t ? 1 : (t - cur.t) / (next.t - cur.t);
  const e = cur.hold ? 0 : k;
  return {
    x: lerp(cur.x, next.x, e),
    y: lerp(cur.y, next.y, e),
    z: lerp(cur.z, next.z, e),
    yaw: lerp(cur.yaw, next.yaw, ease(k)),
  };
}

function lastSpanAt(spans, t) {
  let found = null;
  for (const s of spans) {
    if (s.start <= t && t < s.end) found = s;
    else if (s.start > t) break;
  }
  return found;
}

// --------------------------------------------------------------- compiling

class CompileError extends Error {}

/**
 * @param {object} story   a story document that already passed validation
 * @param {object} world   { anchor(placementId, name), character(id) }
 * @returns {{ ok: boolean, film: Film|null, errors: Array }}
 */
export function compile(story, world) {
  const errors = [];
  const fail = (path, message) => errors.push({ path, message });
  // Not everything wrong with a story is worth refusing to play it for.
  // A missing prop already draws a magenta box rather than a black screen;
  // this is the same idea for the timeline, and it is the difference between
  // "your film has a note on it" and "your film is gone".
  const warnings = [];
  const warn = (path, message) => warnings.push({ path, message });

  const actors = {};
  for (const c of story.cast) {
    const doc = world.character(c.character);
    if (!doc) {
      fail(`cast.${c.id}`, `no character document with id "${c.character}"`);
      continue;
    }
    actors[c.id] = {
      doc,
      outfit: c.outfit || doc.defaultOutfit,
      pos: [c.at[0], c.at[1], c.at[2]],
      yaw: (c.yaw * Math.PI) / 180,
      frames: [],
      resting: [{ t: 0, action: world.action('idle') || FALLBACK_ACTION, params: {} }],
      overlays: [],
      lastIndex: -1,
      // Where this actor stands after each of their entries, by entry index.
      // `facing: "<actor>"` reads it to aim at where the other character is
      // at that point in the script, which is what an author means when they
      // write the two lines next to each other.
      trail: [{ index: -1, pos: [c.at[0], c.at[1], c.at[2]] }],
      // What is in this actor's hands, over time. Sticky like a posture: you
      // keep holding the torch until you put it down.
      held: [{ t: 0, prop: c.holds || null, hand: c.hand || 'right', grip: c.grip || null }],
    };
    actors[c.id].frames.push({ t: 0, x: c.at[0], y: c.at[1], z: c.at[2], yaw: actors[c.id].yaw });
  }

  /** Where `id` stands once every entry before `index` has been accounted
   *  for. Script order, not clock order — the same rule the rest of pass A
   *  uses, so an actor's line reads sequentially. */
  const actorPosAt = (id, index) => {
    const trail = actors[id]?.trail;
    if (!trail) return null;
    let found = trail[0].pos;
    for (const step of trail) {
      if (step.index >= index) break;
      found = step.pos;
    }
    return found;
  };

  /** The direction an entry wants its actor to end up pointing, in radians,
   *  or null when it does not care. */
  const facingYaw = (e, a, index) => {
    if (typeof e.facing === 'string') {
      const target = actorPosAt(e.facing, index);
      if (!target) return null;
      const dx = target[0] - a.pos[0];
      const dz = target[2] - a.pos[2];
      return Math.hypot(dx, dz) < 1e-4 ? null : Math.atan2(dz, dx);
    }
    if (Array.isArray(e.facing)) {
      const dx = e.facing[0] - a.pos[0];
      const dz = e.facing[2] - a.pos[2];
      return Math.hypot(dx, dz) < 1e-4 ? null : Math.atan2(dz, dx);
    }
    if (e.yaw !== undefined) return (e.yaw * Math.PI) / 180;
    return null;
  };

  // ---- pass A: walk each actor's own entries in order, so a move knows
  // where it starts from and therefore how long it takes. This is array
  // order, not clock order: an actor's line is sequential by construction.
  const plans = [];
  let lastStage = -1;
  const cueIndex = new Map();

  for (const [i, e] of story.timeline.entries()) {
    const spec = world.action(e.do);
    if (!spec) {
      fail(`timeline[${i}].do`, `no action document with id "${e.do}"`);
      plans.push({ index: i, entry: e, spec: FALLBACK_ACTION, actor: e.actor || null, dur: 0, prev: -1 });
      continue;
    }
    const plan = { index: i, entry: e, spec, actor: e.actor || null, dur: 0, prev: -1 };
    const a = e.actor ? actors[e.actor] : null;
    if (e.actor && !a) {
      plans.push(plan);
      continue;
    }

    if (spec.category === 'group') {
      // A group action stands its cast in a formation and plays one part to
      // each. It is placed as a whole — `at` and `yaw` position the formation,
      // not any one person — which is what keeps three people turning the same
      // rope instead of three people each doing their own idea of it.
      plan.dur = actionDuration(spec, e);
      plan.group = { at: e.at || [0, 0, 0], yaw: ((e.yaw || 0) * Math.PI) / 180, roles: [] };
      for (const role of spec.roles) {
        const who = e.cast?.[role.id];
        if (!who) continue;
        const target = actors[who];
        if (!target) continue;
        const cos = Math.cos(plan.group.yaw);
        const sin = Math.sin(plan.group.yaw);
        const at = [
          plan.group.at[0] + role.at[0] * cos + role.at[2] * sin,
          plan.group.at[1] + role.at[1],
          plan.group.at[2] - role.at[0] * sin + role.at[2] * cos,
        ];
        const yaw = plan.group.yaw + (role.yaw * Math.PI) / 180;
        plan.group.roles.push({ role: role.id, actor: who, at, yaw });
        target.pos = [at[0], at[1], at[2]];
        target.yaw = nearestAngle(target.yaw, yaw);
        target.trail.push({ index: i, pos: target.pos.slice() });
        target.lastIndex = i;
      }
    } else if (spec.type === 'move') {
      const from = a.pos.slice();
      const via = Array.isArray(e.via) ? e.via : [];
      const to = e.to || from;
      plan.path = [from, ...via, to];
      const speed = e.speed || spec.speed || 1.25;
      const dist = pathLength(plan.path);
      plan.dur = e.for ?? Math.max(0.05, dist / speed);
      plan.speedParam = speed;
      const dx = to[0] - (plan.path[plan.path.length - 2]?.[0] ?? from[0]);
      const dz = to[2] - (plan.path[plan.path.length - 2]?.[2] ?? from[2]);
      plan.headings = headingsFor(plan.path);
      a.pos = to.slice();
      if (dist > 1e-4) a.yaw = nearestAngle(a.yaw, Math.atan2(dz, dx) || a.yaw);
    } else if (spec.type === 'turn') {
      plan.yawFrom = a.yaw;
      const target = e.to ? Math.atan2(e.to[2] - a.pos[2], e.to[0] - a.pos[0]) : null;
      plan.yawTo = target === null ? a.yaw : nearestAngle(a.yaw, target);
      a.yaw = plan.yawTo;
      plan.dur = e.for ?? spec.duration;
    } else if (spec.type === 'posture' && e.on) {
      // Sitting on something is placement as well as pose: the seat says
      // where the hips go and which way the actor ends up facing.
      const anchorName = e.anchor || spec.anchor || 'seat';
      const anchor = world.anchor(e.on, anchorName);
      if (!anchor) {
        // A warning, not an error. Naming something that turns out not to be
        // a seat is an ordinary authoring slip — one entry in twenty — and
        // losing the whole film over it teaches nothing and costs everything.
        // The actor performs the posture where they already stand, which is
        // visibly wrong in the one place that is wrong.
        warn(`timeline[${i}].on`, `"${e.on}" has no ${anchorName} anchor; performed where the actor stands`);
      } else {
        plan.snap = anchor;
        a.pos = [anchor.pos[0], a.pos[1], anchor.pos[2]];
        // The seat's own direction, unless the entry says otherwise below.
        a.yaw = nearestAngle(a.yaw, (anchor.yaw * Math.PI) / 180);
        plan.seatY = anchor.pos[1];
      }
      // Through `actionDuration`, because a posture can be repetitive too:
      // pedalling and rowing are both "sit on this and keep going".
      if (spec.reps) plan.period = spec.period > 0.01 ? spec.period : 1.2;
      plan.dur = actionDuration(spec, e);
    } else if (spec.reps) {
      plan.period = spec.period > 0.01 ? spec.period : 1.2;
      plan.dur = actionDuration(spec, e);
    } else if (spec.type === 'speech') {
      plan.dur = e.for ?? speechDuration(e.text);
    } else {
      plan.dur = e.for ?? spec.duration ?? 0;
    }

    if (!a && plan.group) {
      plan.prev = lastStage;
      lastStage = i;
      if (e.cue) cueIndex.set(e.cue, i);
      plans.push(plan);
      continue;
    }
    if (a) {
      const faced = facingYaw(e, a, i);
      if (faced !== null) {
        plan.faceYaw = nearestAngle(spec.type === 'turn' ? plan.yawFrom : a.yaw, faced);
        if (spec.type === 'turn') plan.yawTo = plan.faceYaw;
        a.yaw = plan.faceYaw;
      }
      plan.restPos = a.pos.slice();
      plan.restYaw = a.yaw;
      a.trail.push({ index: i, pos: a.pos.slice() });
      plan.prev = a.lastIndex;
      a.lastIndex = i;
    } else {
      plan.prev = lastStage;
      lastStage = i;
    }
    if (e.cue) cueIndex.set(e.cue, i);
    plans.push(plan);
  }

  // A duration that is not a number poisons every start time after it and
  // ends up as a blank stage with a NaN clock — far harder to trace back than
  // the one-line cause. Catch it where it is still local.
  for (const plan of plans) {
    if (!Number.isFinite(plan.dur)) {
      fail(`timeline[${plan.index}]`, `"${plan.entry.do}" produced no usable duration`);
      plan.dur = 0;
    }
  }
  if (errors.length) return { ok: false, film: null, errors, warnings };

  // ---- pass B: start times. An entry is anchored by `t`, chained after a
  // cue, or follows the previous entry on its own line. Those form a graph,
  // so resolve it with memoised recursion and refuse to loop forever.
  const starts = new Array(plans.length).fill(null);
  const state = new Array(plans.length).fill(0);   // 0 unvisited, 1 in progress, 2 done

  const resolve = (i) => {
    if (state[i] === 2) return starts[i];
    if (state[i] === 1) {
      throw new CompileError(`timeline[${i}]: circular timing, "after" chains back to itself`);
    }
    state[i] = 1;
    const plan = plans[i];
    const e = plan.entry;
    let start;
    if (e.t !== undefined) {
      start = e.t;
    } else if (e.after) {
      const src = cueIndex.get(e.after);
      start = src === undefined ? 0 : resolve(src) + plans[src].dur;
    } else if (plan.prev >= 0) {
      start = resolve(plan.prev) + plans[plan.prev].dur;
    } else {
      start = 0;
    }
    starts[i] = Math.max(0, start);
    state[i] = 2;
    return starts[i];
  };

  try {
    for (let i = 0; i < plans.length; i++) resolve(i);
  } catch (err) {
    if (err instanceof CompileError) {
      fail('timeline', err.message);
      return { ok: false, film: null, errors, warnings };
    }
    throw err;
  }

  if (errors.length) return { ok: false, film: null, errors, warnings };

  // ---- pass C: tracks.
  const balloons = [];
  const propSpans = [];
  const cameraFrames = [{
    t: 0,
    at: story.camera.at.slice(),
    look: story.camera.look.slice(),
    fov: story.camera.fov,
    hard: false,
  }];
  const follows = [];
  const stageEvents = [];
  let duration = 0;

  for (const plan of plans) {
    const e = plan.entry;
    const spec = plan.spec;
    const start = starts[plan.index];
    const end = start + plan.dur;
    duration = Math.max(duration, end);
    const a = e.actor ? actors[e.actor] : null;

    if (spec.type === 'move' && a) {
      pushMove(a, plan, start, end);
      a.overlays.push({ start, end, action: spec, params: { speed: plan.speedParam }, gesture: false });
      pushResting(a, start, world.action(spec.posture || 'stand') || FALLBACK_ACTION, {});
    } else if (spec.type === 'turn' && a) {
      const last = a.frames[a.frames.length - 1];
      a.frames.push({ t: start, x: last.x, y: last.y, z: last.z, yaw: plan.yawFrom });
      a.frames.push({ t: end, x: last.x, y: last.y, z: last.z, yaw: plan.yawTo });
    } else if (spec.type === 'posture' && a) {
      if (plan.snap) {
        // Sitting down is a short settle, not a travel. Spreading it over a
        // twenty-second pedal would spin the actor around the bike for the
        // whole exercise. Cap it the same way a spoken turn is capped; a
        // 0.6s `sit` still uses its full length.
        const last = a.frames[a.frames.length - 1];
        const settle = Math.min(0.6, Math.max(0.12, plan.dur));
        a.frames.push({ t: start, x: last.x, y: last.y, z: last.z, yaw: last.yaw });
        a.frames.push({ t: start + settle, x: plan.snap.pos[0], y: last.y, z: plan.snap.pos[2], yaw: plan.restYaw });
      }
      const params = {};
      if (e.do === 'lie') params.face = e.face === 'down' ? 'down' : 'up';
      if (plan.seatY !== undefined) {
        // Sitting and lying need different corrections, and one shared field
        // gets one of them wrong. Sitting is about a joint: put the HIPS on
        // the cushion. Lying is about a surface: the pose already rests the
        // body on the ground, so it only has to RISE to the surface.
        //
        // Which one applies is the action document's `seatLift`, not its
        // name. Keying on the name worked while `lie` was the only action
        // that lay on anything, and quietly did the wrong thing the moment a
        // bench press wanted the same treatment.
        //
        // Both are measured from the actor's own feet, not from world zero:
        // a room with a raised floor put everybody the thickness of that
        // floor above their chair, which is invisible on a lawn and obvious
        // in a gym.
        const height = a.doc.height || 1.7;
        const above = plan.seatY - a.pos[1];
        if (spec.seatLift === 'add') params.rise = above / height;
        else params.lift = (above - hipHeight(a.doc)) / height;
      }
      // A posture may pick its base pose from a parameter — lying face up and
      // face down are one action with two poses, not two actions.
      const part = spec.poseByFace && params.face
        ? { pose: spec.poseByFace[params.face] || spec.pose }
        : null;
      pushResting(a, start, spec, params, part);
      if (spec.props?.length) propSpans.push({ start, end, action: spec, actor: e.actor, params });
      if (!plan.snap) pushTurn(a, plan, start, end);
    } else if (spec.type === 'overlay' && a) {
      const params = {};
      if (spec.reps) params.period = plan.period;
      if (e.side) params.side = e.side;
      if (!spec.reps) params.duration = plan.dur;
      a.overlays.push({ start, end, action: spec, params, gesture: !!spec.gesture });
      if (spec.props?.length) propSpans.push({ start, end, action: spec, actor: e.actor, params });
      pushTurn(a, plan, start, end);
    } else if (spec.type === 'hold' && a) {
      pushHeld(a, start, spec.grabs === false ? null : e.prop,
        e.hand || spec.defaultHand || 'right', e.grip || null);
      pushTurn(a, plan, start, end);
    } else if (spec.type === 'speech' && a) {
      balloons.push({ actor: e.actor, start, end, text: e.text || { en: '', pt: '', ja: '' }, kind: spec.balloon });
      pushTurn(a, plan, start, end);
    } else if (spec.type === 'wait' && a) {
      pushTurn(a, plan, start, end);
    } else if (plan.group) {
      // Props a role holds for the length of the action: the rope handles,
      // the torch. They go back to whatever was in that hand afterwards.
      for (const pr of spec.props || []) {
        if (!pr.hand || !pr.role) continue;
        const holder = plan.group.roles.find((r) => r.role === pr.role);
        const target = holder && actors[holder.actor];
        if (!target) continue;
        const before = heldAt(target, start);
        pushHeld(target, start, pr.prop, pr.hand, pr.grip || null);
        pushHeld(target, end, before.prop, before.hand, before.grip || null);
      }
      for (const r of plan.group.roles) {
        const target = actors[r.actor];
        if (!target) continue;
        const last = target.frames[target.frames.length - 1];
        const yaw = nearestAngle(last ? last.yaw : r.yaw, r.yaw);
        const settle = Math.min(0.5, plan.dur || 0.5);
        if (last) target.frames.push({ t: start, x: last.x, y: last.y, z: last.z, yaw: last.yaw });
        target.frames.push({ t: start + settle, x: r.at[0], y: r.at[1], z: r.at[2], yaw });
        const part = spec.parts?.[r.role] || null;
        const params = {};
        if (spec.reps) params.period = spec.period;
        else params.duration = plan.dur;
        if (spec.hold === 'posture') pushResting(target, start, spec, params, part);
        else target.overlays.push({ start, end, action: spec, params, part, gesture: false });
      }
      propSpans.push({ start, end, action: spec, group: plan.group, params: groupParams(spec, plan) });
    } else if (spec.type === 'camera') {
      cameraFrames.push({
        t: start,
        at: e.at ? e.at.slice() : cameraFrames[cameraFrames.length - 1].at.slice(),
        look: e.look !== undefined ? (Array.isArray(e.look) ? e.look.slice() : e.look)
          : cameraFrames[cameraFrames.length - 1].look,
        fov: e.fov ?? cameraFrames[cameraFrames.length - 1].fov,
        hard: !!spec.instant,
        glide: !!e.glide,
      });
      if (!spec.instant && plan.dur > 0) {
        // A move needs a "leave from here" frame at its start, or the camera
        // creeps toward the target from the moment the story opens.
        const prev = cameraFrames[cameraFrames.length - 2];
        cameraFrames.splice(cameraFrames.length - 1, 0, { ...prev, t: start, hard: false });
        cameraFrames[cameraFrames.length - 1].t = end;
      }
    } else if (spec.type === 'cameraFollow') {
      follows.push({ start, actor: e.target || e.actor, end: e.for ? start + e.for : Infinity });
    } else if (spec.type === 'stage') {
      // A `propMove` with a `for` is a travel, not a teleport: it carries the
      // moment it ends and where it started, so `sampleStage` can read a
      // position at any instant in between. Without that a ball can only
      // jump from hand to hand, which is what a thrown ball must not do.
      stageEvents.push({
        t: start,
        end: e.do === 'propMove' && e.for > 0 ? start + e.for : start,
        op: e.do,
        id: e.id,
        at: e.at,
        yaw: e.yaw,
        arc: e.arc || 0,
        // Where the placement sits before anything has moved it. Read once,
        // here, because the compiler is the only place that can still ask.
        from: e.do === 'propMove' ? (world.placement?.(e.id)?.at || null) : null,
        fromYaw: e.do === 'propMove' ? (world.placement?.(e.id)?.yaw ?? 0) : 0,
        sky: e.sky,
      });
    }
  }

  const held = {};
  for (const [id, a] of Object.entries(actors)) {
    a.held.sort((x, y) => x.t - y.t);
    held[id] = a.held;
  }
  for (const a of Object.values(actors)) {
    a.frames.sort((x, y) => x.t - y.t);
    a.resting.sort((x, y) => x.t - y.t);
    a.overlays.sort((x, y) => x.start - y.start);
  }
  cameraFrames.sort((x, y) => x.t - y.t);
  stageEvents.sort((x, y) => x.t - y.t);
  follows.sort((x, y) => x.start - y.start);

  return {
    ok: true,
    errors: [],
    warnings,
    film: new Film({
      story,
      actors,
      balloons,
      camera: cameraFrames,
      follows,
      stageEvents,
      propSpans,
      held,
      // When each timeline entry starts and how long it runs, in array order.
      // The compiler is the only thing that knows — `t`, `after` and "follows
      // the actor's previous line" all resolve here — and a visual timeline
      // cannot draw a single block without it. Working it out a second time
      // in the editor is how the two would drift apart.
      schedule: plans.map((p, i) => ({
        index: p.index,
        start: starts[i],
        dur: p.dur,
        actor: p.actor,
        type: p.spec.type,
        category: p.spec.category,
      })),
      sky: story.sky || null,
      duration: Math.max(1, duration + TAIL),
    }),
  };
}

/** The clock parameters a group action's props should read. */
function groupParams(spec, plan) {
  return spec.reps ? { period: spec.period } : { duration: plan.dur };
}

/** Standing hip height in metres, matching the plans in cast/body.js. */
function hipHeight(doc) {
  const frac = doc.base === 'woman' ? 0.520 : doc.base === 'child' ? 0.485 : 0.530;
  return (doc.height || 1.7) * frac;
}

function headingsFor(path) {
  const out = [];
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i - 1][0];
    const dz = path[i][2] - path[i - 1][2];
    out.push(Math.hypot(dx, dz) < 1e-5 ? null : Math.atan2(dz, dx));
  }
  return out;
}

/**
 * A stationary turn, for the actions that are not about going anywhere.
 *
 * Turning is capped well below the action's own length: an actor who is told
 * to speak for six seconds facing someone should turn to them and then talk,
 * not rotate slowly for the whole line.
 */
function pushTurn(a, plan, start, end) {
  if (plan.faceYaw === undefined) return;
  const last = a.frames[a.frames.length - 1];
  const from = last ? last.yaw : plan.faceYaw;
  if (Math.abs(plan.faceYaw - from) < 1e-4) return;
  const pos = plan.restPos || [last?.x ?? 0, last?.y ?? 0, last?.z ?? 0];
  const turn = Math.min(0.5, Math.max(0.08, end - start));
  a.frames.push({ t: start, x: pos[0], y: pos[1], z: pos[2], yaw: from });
  a.frames.push({ t: start + turn, x: pos[0], y: pos[1], z: pos[2], yaw: plan.faceYaw });
}

/** Lays a move down as keyframes: one per waypoint, timed by distance so the
 *  actor holds a steady pace through a dog-leg instead of racing one leg. */
function pushMove(a, plan, start, end) {
  const path = plan.path;
  const total = pathLength(path);
  const last = a.frames[a.frames.length - 1];
  let yaw = last.yaw;
  a.frames.push({ t: start, x: path[0][0], y: path[0][1], z: path[0][2], yaw });

  let travelled = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]);
    travelled += seg;
    const heading = plan.headings[i - 1];
    if (heading !== null) yaw = nearestAngle(yaw, heading);
    const t = total > 1e-6 ? start + (end - start) * (travelled / total) : end;
    const last = i === path.length - 1;
    if (last && plan.faceYaw !== undefined) {
      // Hold the travel heading until the actor is nearly there, then turn.
      // Spreading the turn over the whole walk would have them stride
      // sideways across the room, because the walk cycle plays along
      // whatever direction they face.
      const turn = Math.min(0.6, (end - start) * 0.35);
      if (t - turn > (a.frames[a.frames.length - 1]?.t ?? start)) {
        a.frames.push({ t: t - turn, x: path[i][0], y: path[i][1], z: path[i][2], yaw });
      }
      a.frames.push({ t, x: path[i][0], y: path[i][1], z: path[i][2], yaw: plan.faceYaw });
    } else {
      a.frames.push({ t, x: path[i][0], y: path[i][1], z: path[i][2], yaw });
    }
  }
}

/** What an actor is holding at `t`, reading the track as written so far. */
function heldAt(a, t) {
  let found = a.held[0];
  for (const h of a.held) {
    if (h.t > t) break;
    found = h;
  }
  return found;
}

function pushHeld(a, t, prop, hand, grip = null) {
  const last = a.held[a.held.length - 1];
  if (last && last.t === t) {
    last.prop = prop || null;
    last.hand = hand;
    last.grip = grip;
    return;
  }
  if (last && last.prop === (prop || null) && last.hand === hand && sameGrip(last.grip, grip)) return;
  a.held.push({ t, prop: prop || null, hand, grip });
}

/** Two hold angles are the same hold. Compared rather than kept by identity
 *  so an unchanged grip does not add a keyframe to the held track. */
function sameGrip(a, b) {
  if (!a || !b) return !a === !b;
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/** Postures are sticky, so this appends to the resting track rather than
 *  producing a span with an end. */
function pushResting(a, t, action, params, part = null) {
  const last = a.resting[a.resting.length - 1];
  if (last && last.t === t) {
    last.action = action;
    last.params = params;
    last.part = part;
    return;
  }
  if (last && last.action === action && last.part === part
      && JSON.stringify(last.params) === JSON.stringify(params)) return;
  a.resting.push({ t, action, params, part });
}
