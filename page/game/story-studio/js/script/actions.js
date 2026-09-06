// What each action costs in time, and what kind of thing it is. The director
// reads this table; nothing here touches the scene.
//
// The three kinds matter a lot:
//   posture   sticky. Once an actor sits, it stays sitting until told
//             otherwise, so a posture rewrites the actor's resting clip from
//             that moment on rather than playing and reverting.
//   overlay   transient. A wave or a set of push-ups plays for its duration
//             and hands the body back to whatever posture was underneath.
//   stage     not about a body at all: camera, props, time of day.

export const DEFAULT_SPEED = { walkTo: 1.25, runTo: 3.4, crawlTo: 0.7, swimTo: 0.9 };

/** Seconds a repetition takes, per exercise. */
export const REP_PERIOD = { jumpingJacks: 0.9, squats: 1.6, pushups: 1.5, situps: 1.8 };

export const ACTIONS = {
  // ------------------------------------------------------------ locomotion
  walkTo: { type: 'move', clip: 'walk', speedKey: 'walkTo' },
  runTo: { type: 'move', clip: 'run', speedKey: 'runTo' },
  crawlTo: { type: 'move', clip: 'crawl', speedKey: 'crawlTo', posture: 'crawl' },
  swimTo: { type: 'move', clip: 'swim', speedKey: 'swimTo', posture: 'swim' },
  turnTo: { type: 'turn', duration: 0.6 },

  // --------------------------------------------------------------- posture
  stand: { type: 'posture', clip: 'stand', duration: 0.4 },
  idle: { type: 'posture', clip: 'idle', duration: 0.4 },
  sit: { type: 'posture', clip: 'sit', duration: 0.6 },
  kneel: { type: 'posture', clip: 'kneel', duration: 0.6 },
  crouch: { type: 'posture', clip: 'crouch', duration: 0.5 },
  lie: { type: 'posture', clip: 'lieUp', duration: 0.9 },

  // -------------------------------------------------------------- gestures
  // `gesture: true` means the clip only claims the joints it names, so these
  // read correctly on top of any posture: you can wave while seated, or point
  // while lying down, without the gesture standing the actor up.
  wave: { type: 'overlay', clip: 'wave', duration: 2.2, gesture: true },
  point: { type: 'overlay', clip: 'point', duration: 1.6, gesture: true },
  raiseArm: { type: 'overlay', clip: 'raiseArm', duration: 1.4, gesture: true },
  nod: { type: 'overlay', clip: 'nod', duration: 1.6, gesture: true },
  shakeHead: { type: 'overlay', clip: 'shakeHead', duration: 1.6, gesture: true },
  jump: { type: 'overlay', clip: 'jump', duration: 0.9 },

  // ------------------------------------------------------------- exercises
  jumpingJacks: { type: 'overlay', clip: 'jumpingJacks', reps: true },
  squats: { type: 'overlay', clip: 'squats', reps: true },
  pushups: { type: 'overlay', clip: 'pushups', reps: true },
  situps: { type: 'overlay', clip: 'situps', reps: true },

  // ----------------------------------------------------------------- other
  say: { type: 'speech', balloon: 'say' },
  think: { type: 'speech', balloon: 'think' },
  wait: { type: 'wait', duration: 1 },

  // ----------------------------------------------------------------- stage
  cameraTo: { type: 'camera', duration: 2 },
  cut: { type: 'camera', duration: 0, instant: true },
  cameraFollow: { type: 'cameraFollow', duration: 0 },
  propShow: { type: 'stage', duration: 0 },
  propHide: { type: 'stage', duration: 0 },
  propMove: { type: 'stage', duration: 0 },
  setTime: { type: 'stage', duration: 0 },
};

export function actionSpec(name) {
  return ACTIONS[name] || null;
}

export function isActorAction(name) {
  const spec = ACTIONS[name];
  if (!spec) return false;
  return !['camera', 'cameraFollow', 'stage'].includes(spec.type);
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
