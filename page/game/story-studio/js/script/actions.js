import { basePose } from '../anim/perform.js';

// Helpers around action documents. The actions themselves used to live here
// as a hard-coded table; they are documents now, in `data/actions/`, so this
// file is only what the director needs to reason about one.

/** Enough of an action to keep a story playing when its own is missing. A
 *  story that names an action nobody has should show a standing figure and a
 *  clear error, not stop the whole film. */
export const FALLBACK_ACTION = {
  kind: 'action', version: 1, id: '(missing)', type: 'overlay',
  pose: 'stand', duration: 1, breathe: 1,
};

/** The three kinds of thing an action can be, from the director's point of
 *  view. Postures stick, overlays play and hand the body back, and the rest
 *  are not about a body at all. */
export function isActorAction(action) {
  return !['camera', 'cameraFollow', 'stage'].includes(action?.type);
}

export function isStageAction(action) {
  return ['camera', 'cameraFollow', 'stage'].includes(action?.type);
}

/**
 * How long a speech balloon should stay up. Measured against the LONGEST
 * translation rather than the one on screen, so switching language reflows
 * the balloon without shifting every later cue in the story.
 */
export function speechDuration(text) {
  let longest = 0;
  for (const lang of ['en', 'pt', 'ja']) {
    longest = Math.max(longest, (text?.[lang] || '').length);
  }
  return Math.max(1.4, Math.min(9, 1.0 + longest * 0.055));
}

/** Total length of a path in the XZ plane. */
export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2]);
  }
  return total;
}

export { basePose };
