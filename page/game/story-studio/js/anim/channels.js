import { sampleKeys } from './keyframes.js';
// The little language an action document is written in.
//
// Every clip in this app turned out to be the same shape: take a base pose,
// then push some joints around with a sine, a rectified cosine, or a rise-and-
// fall envelope. So rather than let actions be JavaScript — which would mean
// importing a story from someone else runs their code on this origin, with
// the whole collection's storage in reach — actions are data, and this file
// is the only thing that reads them.
//
// A channel is:   value = offset + amp * wave(freq * u + phase)
//
// `u` is the action's own clock, and which clock that is depends on the
// action: one turn per repetition, one turn per stride, or one pass over the
// whole action for a one-shot. A channel can opt out with `hz`, which counts
// in seconds instead — breathing does not speed up because you walk faster.

const TAU = Math.PI * 2;

function ease(k) {
  const t = k <= 0 ? 0 : k >= 1 ? 1 : k;
  return t * t * (3 - 2 * t);
}

/** Waves take turns, not radians: `freq: 2` is plainly two cycles. */
export const WAVES = {
  const: () => 1,
  sin: (x) => Math.sin(x * TAU),
  cos: (x) => Math.cos(x * TAU),
  absSin: (x) => Math.abs(Math.sin(x * TAU)),
  absCos: (x) => Math.abs(Math.cos(x * TAU)),
  // Rectified: a knee folds one way only, so the other half of the cycle has
  // to be flat rather than negative.
  posSin: (x) => Math.max(0, Math.sin(x * TAU)),
  posCos: (x) => Math.max(0, Math.cos(x * TAU)),
  // Out and back once per turn — the shape of a repetition.
  rise: (x) => (1 - Math.cos(x * TAU)) / 2,
  // Zero to one and held there, for one-shots that settle.
  ramp: (x) => ease(x),
  lin: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x),
  saw: (x) => x - Math.floor(x),
};

export const WAVE_NAMES = Object.keys(WAVES);

export const ROOT_FIELDS = ['tiltZ', 'lift', 'shift'];
export const AXES = ['x', 'y', 'z'];

/**
 * The action's own clock at `localT`.
 * @returns {number} turns elapsed
 */
export function clockOf(action, localT, params) {
  if (action.rate) {
    const speed = Number.isFinite(params?.speed) ? params.speed : (action.rate.speed ?? 1);
    return (localT * (action.rate.base + speed * (action.rate.perSpeed || 0))) / TAU;
  }
  const period = Number.isFinite(params?.period) ? params.period : action.period;
  if (period > 0.01) return localT / period;
  const dur = Number.isFinite(params?.duration) ? params.duration : (action.duration || 1);
  return dur > 0.01 ? localT / dur : 0;
}

/** One channel's contribution. */
export function channelValue(ch, u, localT) {
  if (ch.keys?.length) return sampleKeys(ch.keys, u, ch.interpolation, ch.loop);
  const wave = WAVES[ch.wave] || WAVES.const;
  const x = Number.isFinite(ch.hz)
    ? ch.hz * localT + (ch.phase || 0)
    : (ch.freq ?? 1) * u + (ch.phase || 0);
  let v = (ch.offset || 0) + (ch.amp ?? 1) * wave(x);

  // A window makes a channel piecewise: it contributes only across that slice
  // of the action, with its own clock stretched to fill the slice. That is
  // what lets one document hold a crouch, a launch and a landing.
  if (ch.from !== undefined || ch.to !== undefined) {
    const from = ch.from ?? 0;
    const to = ch.to ?? 1;
    const span = to - from;
    if (span <= 0) return 0;
    const k = (u - from) / span;
    if (k < 0 || k > 1) return 0;
    const wx = Number.isFinite(ch.hz) ? ch.hz * localT + (ch.phase || 0) : (ch.freq ?? 1) * k + (ch.phase || 0);
    v = (ch.offset || 0) + (ch.amp ?? 1) * wave(wx);
  }
  return v;
}

/** Left/right mirror of a joint name. */
export function mirrorJointName(name) {
  if (name.startsWith('l') && name[1] === name[1].toUpperCase()) return `r${name.slice(1)}`;
  if (name.startsWith('r') && name[1] === name[1].toUpperCase()) return `l${name.slice(1)}`;
  return name;
}
