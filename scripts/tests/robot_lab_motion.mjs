// Pure trajectory tests: no browser, network, or installed dependencies required.
// Run: node scripts/tests/robot_lab_motion.mjs
import assert from 'node:assert/strict';
import {validateProgram, sampleProgram, estimatePeakSpeed, toROSTrajectory, makeDemo} from '../../page/utils/robot-lab/motion.js';

const joints = [
  {id: 'neck_yaw', min: -85, max: 85, home: 0},
  {id: 'neck_pitch', min: -40, max: 40, home: 0},
  {id: 'right_shoulder_roll', min: -165, max: 30, home: 0},
  {id: 'right_shoulder_yaw', min: -110, max: 110, home: 0},
  {id: 'right_elbow_pitch', min: -145, max: 0, home: 0},
  {id: 'right_wrist_roll', min: -35, max: 35, home: 0},
  {id: 'left_knee_pitch', min: 0, max: 140, home: 0},
];
const close = (actual, expected, epsilon = 1e-8) => assert(Math.abs(actual - expected) <= epsilon, `${actual} ≈ ${expected}`);
const base = () => ({version: 1, units: 'deg', interpolation: 'smooth', points: [
  {time: 0, positions: {neck_yaw: -40}},
  {time: 2, positions: {neck_yaw: 40, right_elbow_pitch: -90}},
  {time: 3, positions: {neck_pitch: 20}},
]});
const invalid = (mutate, code) => {
  const program = base();
  mutate(program);
  assert.throws(() => validateProgram(program, joints), error => error.code === code && error.detail && error.name === 'TrajectoryError');
};

const source = base();
const trajectory = validateProgram(source, joints);
assert.equal(trajectory.duration, 3);
assert.equal(trajectory.units, 'deg');
assert.equal(trajectory.points[0].positions.right_elbow_pitch, 0, 'omitted joints begin at home');
assert.equal(trajectory.points[2].positions.right_elbow_pitch, -90, 'omitted joints inherit last waypoint');
assert.equal(trajectory.points[2].positions.neck_yaw, 40, 'sparse poses inherit prior values');
source.points[1].positions.neck_yaw = -70;
assert.equal(trajectory.points[1].positions.neck_yaw, 40, 'compiled data is independent of editor mutations');
assert.equal(sampleProgram(trajectory, -10).neck_yaw, -40);
assert.equal(sampleProgram(trajectory, 100).neck_pitch, 20);
assert.equal(sampleProgram(trajectory, 2).right_elbow_pitch, -90);
assert.equal(sampleProgram(trajectory, 1).neck_yaw, 0);
close(sampleProgram(trajectory, 0.5).neck_yaw, -40 + 80 * 0.103515625);
const sampled = sampleProgram(trajectory, 0);
sampled.neck_yaw = 12;
assert.equal(sampleProgram(trajectory, 0).neck_yaw, -40, 'samples do not mutate compiled waypoints');
assert.throws(() => sampleProgram(trajectory, NaN), error => error.code === 'TIME');

// Quintic interpolation must stop smoothly at every waypoint and never overshoot.
for (let t = 0; t <= 2; t += 0.01) {
  const current = sampleProgram(trajectory, t);
  assert(current.neck_yaw >= -40 && current.neck_yaw <= 40);
  assert(current.right_elbow_pitch >= -90 && current.right_elbow_pitch <= 0);
}
const h = 1e-4;
close((sampleProgram(trajectory, h).neck_yaw - sampleProgram(trajectory, 0).neck_yaw) / h, 0, 0.0001);
close((sampleProgram(trajectory, 2).neck_yaw - sampleProgram(trajectory, 2-h).neck_yaw) / h, 0, 0.0001);
close(estimatePeakSpeed(trajectory).neck_yaw, 75);
close(estimatePeakSpeed(trajectory).neck_pitch, 37.5);
close(estimatePeakSpeed(trajectory).right_elbow_pitch, 84.375);

const linearSource = base();
linearSource.interpolation = 'linear';
const linear = validateProgram(linearSource, joints);
close(sampleProgram(linear, 0.5).neck_yaw, -20);
close(estimatePeakSpeed(linear).neck_yaw, 40);
assert(!('velocities' in toROSTrajectory(linear, joints).points[0]), 'linear export has position-only waypoints');
assert(!('accelerations' in toROSTrajectory(linear, joints).points[0]));

const ros = toROSTrajectory(trajectory, joints);
assert.deepEqual(ros.joint_names, joints.map(j => j.id));
close(ros.points[1].positions[ros.joint_names.indexOf('right_elbow_pitch')], -Math.PI / 2);
assert.deepEqual(ros.points[1].time_from_start, {sec: 2, nanosec: 0});
assert.deepEqual(ros.points[1].velocities, joints.map(() => 0));
assert.deepEqual(ros.points[1].accelerations, joints.map(() => 0));
const fractions = base();
fractions.points[1].time = 1.9999999996;
assert.deepEqual(toROSTrajectory(validateProgram(fractions, joints), joints).points[1].time_from_start, {sec: 2, nanosec: 0}, 'nanosecond rounding carries into seconds');

const radians = {version: 1, units: 'rad', points: [{time: 0, positions: {}}, {time: 1, positions: {neck_yaw: Math.PI / 4}}]};
close(validateProgram(radians, joints).points[1].positions.neck_yaw, 45);
assert.equal(validateProgram(radians, joints).interpolation, 'smooth');
const limitRadians = structuredClone(radians);
limitRadians.points[1].positions.neck_yaw = 85 * Math.PI / 180;
close(validateProgram(limitRadians, joints).points[1].positions.neck_yaw, 85);

invalid(p => p.version = 2, 'VERSION');
invalid(p => p.units = 'turns', 'UNITS');
invalid(p => p.interpolation = 'arbitrary', 'INTERPOLATION');
invalid(p => p.points = [], 'POINTS');
invalid(p => p.points = [{time: 0, positions: {}}], 'POINTS');
invalid(p => p.points = Array.from({length: 501}, (_, i) => ({time: i, positions: {}})), 'POINTS');
invalid(p => p.points[0].time = 0.1, 'TIME');
invalid(p => p.points[1].time = 0, 'TIME');
invalid(p => p.points[1].time = -1, 'TIME');
invalid(p => p.points[1].time = Infinity, 'TIME');
invalid(p => p.points[1].time = '2', 'TIME');
invalid(p => p.points[1].time = 1e-12, 'TIME');
invalid(p => p.points[2].time = 601, 'TIME');
invalid(p => p.points[1].positions = [], 'POSITIONS');
invalid(p => p.points[1].positions = null, 'POSITIONS');
invalid(p => p.points[1].positions.unknown = 0, 'UNKNOWN_JOINT');
invalid(p => p.points[1].positions.neck_yaw = '12', 'VALUE');
invalid(p => p.points[1].positions.neck_yaw = NaN, 'VALUE');
invalid(p => p.points[1].positions.neck_yaw = 86, 'LIMIT');
invalid(p => p.points[1].positions.right_elbow_pitch = 1, 'LIMIT');
invalid(p => p.points[1].positions = JSON.parse('{"__proto__":0}'), 'UNKNOWN_JOINT');
assert.throws(() => validateProgram(null, joints), error => error.code === 'PROGRAM');
assert.throws(() => validateProgram(base(), []), error => error.code === 'JOINTS');
assert.throws(() => validateProgram(base(), [...joints, joints[0]]), error => error.code === 'JOINTS');

for (const demo of ['wave', 'crouch', 'scan']) {
  const raw = makeDemo(joints, demo);
  const compiled = validateProgram(raw, joints);
  assert(compiled.duration > 0);
  assert.deepEqual(sampleProgram(compiled, 0), sampleProgram(compiled, compiled.duration), `${demo} returns to home`);
}
assert(sampleProgram(validateProgram(makeDemo(joints, 'wave'), joints), 1.5).right_elbow_pitch < -90, 'wave bends the elbow forward');
assert.equal(validateProgram(makeDemo(joints, '__proto__'), joints).duration, 5.4, 'unknown demo uses wave safely');
console.log('PASS robot lab trajectory validation, interpolation, limits, ROS export and demos');
