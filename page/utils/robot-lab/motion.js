/**
 * Browser-local, declarative joint trajectories. No code evaluation, middleware,
 * inverse kinematics, physics or hardware connection is performed here.
 * Angles are compiled to degrees; ROS JointTrajectory exports use radians.
 * Smooth segments are quintic polynomials with zero velocity and acceleration
 * at BOTH waypoints (10u³ − 15u⁴ + 6u⁵), matching position/velocity/acceleration
 * waypoint interpolation in ros2_control when all derivatives are zero.
 */

const DEG = 180 / Math.PI;
const MAX_POINTS = 500;
const MAX_DURATION = 600;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function fail(code, message, detail = {}) {
  const error = new Error(message);
  error.name = 'TrajectoryError';
  error.code = code;
  error.detail = detail;
  throw error;
}

function jointMap(joints) {
  if (!Array.isArray(joints) || !joints.length) fail('JOINTS', 'A joint definition is required.');
  const map = new Map();
  for (const joint of joints) {
    if (!record(joint) || typeof joint.id !== 'string' || !joint.id ||
        ['__proto__', 'constructor', 'prototype'].includes(joint.id) || map.has(joint.id) ||
        !Number.isFinite(joint.min) || !Number.isFinite(joint.max) ||
        !Number.isFinite(joint.home) || joint.min > joint.max ||
        joint.home < joint.min || joint.home > joint.max) {
      fail('JOINTS', 'Invalid or duplicate joint definition.', {joint: joint?.id});
    }
    map.set(joint.id, joint);
  }
  return map;
}

/** Validate an editor JSON object and fill omitted joints from the last pose. */
export function validateProgram(program, joints) {
  const definitions = jointMap(joints);
  if (!record(program)) fail('PROGRAM', 'The program must be a JSON object.');
  if (program.version !== 1) fail('VERSION', 'Program version must be 1.');
  if (program.units !== 'deg' && program.units !== 'rad') fail('UNITS', 'Units must be deg or rad.');
  const interpolation = program.interpolation ?? 'smooth';
  if (interpolation !== 'linear' && interpolation !== 'smooth') {
    fail('INTERPOLATION', 'Interpolation must be linear or smooth.');
  }
  if (!Array.isArray(program.points) || program.points.length < 2 || program.points.length > MAX_POINTS) {
    fail('POINTS', 'Use between 2 and 500 trajectory points.');
  }

  const factor = program.units === 'rad' ? DEG : 1;
  let previous = Object.fromEntries(joints.map(joint => [joint.id, joint.home]));
  let lastTime = -1;
  let lastNanoseconds = -1;
  const points = program.points.map((point, index) => {
    const detail = {point: index};
    if (!record(point) || !Number.isFinite(point.time) || point.time < 0 ||
        point.time > MAX_DURATION || (index === 0 && point.time !== 0) || point.time <= lastTime ||
        Math.round(point.time * 1e9) <= lastNanoseconds) {
      fail('TIME', 'Times must start at 0, increase strictly at nanosecond precision and stay within 600 seconds.', detail);
    }
    if (!record(point.positions)) fail('POSITIONS', 'Each point needs a positions object.', detail);
    const positions = {...previous};
    for (const [id, rawValue] of Object.entries(point.positions)) {
      if (!definitions.has(id)) fail('UNKNOWN_JOINT', `Unknown joint: ${id}.`, {...detail, joint: id});
      if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
        fail('VALUE', `The angle for ${id} must be a finite number.`, {...detail, joint: id});
      }
      const value = rawValue * factor;
      const {min, max} = definitions.get(id);
      // A tiny tolerance permits round trips at radian-converted limits.
      if (!Number.isFinite(value) || value < min - 1e-8 || value > max + 1e-8) {
        fail('LIMIT', `${id}: ${value}° is outside ${min}°…${max}°.`, {...detail, joint: id, value, min, max});
      }
      positions[id] = Math.min(max, Math.max(min, value));
    }
    previous = positions;
    lastTime = point.time;
    lastNanoseconds = Math.round(point.time * 1e9);
    return {time: point.time, positions};
  });
  return {version: 1, units: 'deg', interpolation, points, duration: lastTime};
}

/** Sample a validated trajectory. Times outside its range clamp to the ends. */
export function sampleProgram(compiled, time) {
  if (!Number.isFinite(time)) fail('TIME', 'Playback time must be finite.');
  const points = compiled.points;
  if (time <= 0) return {...points[0].positions};
  if (time >= compiled.duration) return {...points[points.length - 1].positions};
  let low = 1, high = points.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (points[middle].time < time) low = middle + 1;
    else high = middle;
  }
  const a = points[low - 1], b = points[low];
  const u = (time - a.time) / (b.time - a.time);
  const blend = compiled.interpolation === 'smooth' ? u * u * u * (10 + u * (-15 + 6 * u)) : u;
  return Object.fromEntries(Object.keys(a.positions).map(id => [id, a.positions[id] + (b.positions[id] - a.positions[id]) * blend]));
}

/** Peak commanded joint speeds at 1× playback, in degrees per second. */
export function estimatePeakSpeed(compiled) {
  const peaks = Object.fromEntries(Object.keys(compiled.points[0].positions).map(id => [id, 0]));
  const factor = compiled.interpolation === 'smooth' ? 1.875 : 1;
  for (let i = 1; i < compiled.points.length; i++) {
    const a = compiled.points[i - 1], b = compiled.points[i];
    const duration = b.time - a.time;
    for (const id of Object.keys(peaks)) peaks[id] = Math.max(peaks[id], Math.abs(b.positions[id] - a.positions[id]) / duration * factor);
  }
  return peaks;
}

/**
 * A trajectory_msgs/msg/JointTrajectory-shaped object for the local model.
 * Hardware-specific joint mapping, limits, controller configuration and safety
 * checks remain separate. A JSON file alone does not run a ROS controller.
 */
export function toROSTrajectory(compiled, joints) {
  jointMap(joints);
  return {
    joint_names: joints.map(joint => joint.id),
    points: compiled.points.map(point => {
      const nanoseconds = Math.round(point.time * 1e9);
      const result = {
        positions: joints.map(joint => {
          if (!own(point.positions, joint.id)) fail('UNKNOWN_JOINT', `Missing joint: ${joint.id}.`, {joint: joint.id});
          return point.positions[joint.id] / DEG;
        }),
        time_from_start: {sec: Math.floor(nanoseconds / 1e9), nanosec: nanoseconds % 1e9},
      };
      if (compiled.interpolation === 'smooth') {
        result.velocities = joints.map(() => 0);
        result.accelerations = joints.map(() => 0);
      }
      return result;
    }),
  };
}

/** Small editable demonstrations. All omitted joints retain their previous pose. */
export function makeDemo(joints, type = 'wave') {
  const definitions = jointMap(joints);
  const home = Object.fromEntries(joints.map(joint => [joint.id, joint.home]));
  const pose = values => Object.fromEntries(Object.entries(values)
    .filter(([id]) => definitions.has(id))
    .map(([id, value]) => [id, Math.max(definitions.get(id).min, Math.min(definitions.get(id).max, value))]));
  const demos = {
    wave: [
      {time: 0, positions: home},
      {time: 1.5, positions: pose({right_shoulder_roll: -80, right_elbow_pitch: -100, right_shoulder_yaw: -70, neck_yaw: -12})},
      {time: 2.1, positions: pose({right_wrist_roll: -25})},
      {time: 2.7, positions: pose({right_wrist_roll: 25})},
      {time: 3.3, positions: pose({right_wrist_roll: -25})},
      {time: 3.9, positions: pose({right_wrist_roll: 25})},
      {time: 5.4, positions: home},
    ],
    crouch: [
      {time: 0, positions: home},
      {time: 2, positions: pose({left_hip_pitch: -35, right_hip_pitch: -35, left_knee_pitch: 70, right_knee_pitch: 70, left_ankle_pitch: -35, right_ankle_pitch: -35, torso_pitch: 10, left_shoulder_pitch: -30, right_shoulder_pitch: -30})},
      {time: 3, positions: {}},
      {time: 5, positions: home},
    ],
    scan: [
      {time: 0, positions: home},
      {time: 1.5, positions: pose({neck_yaw: -50, neck_pitch: -10, torso_yaw: -15})},
      {time: 3.5, positions: pose({neck_yaw: 50, neck_pitch: 10, torso_yaw: 15})},
      {time: 5, positions: home},
    ],
  };
  return {version: 1, units: 'deg', interpolation: 'smooth', points: own(demos, type) ? demos[type] : demos.wave};
}
