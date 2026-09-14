import { channelValue } from './channels.js';

const DEG = Math.PI / 180;
const clone = value => JSON.parse(JSON.stringify(value));

// Local positions are metres, rotations are unwrapped YXZ Euler radians.
// Keeping whole turns is essential for hoops and skipping ropes.
export function samplePropKeys(keys, time, interpolation = 'smooth', loop = false) {
  const u = loop ? ((time % 1) + 1) % 1 : Math.max(0, Math.min(1, time));
  if (u <= keys[0].t) return clone(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (u > b.t) continue;
    let k = (u - a.t) / Math.max(1e-8, b.t - a.t);
    if (interpolation === 'step') k = u === b.t ? 1 : 0;
    else if (interpolation === 'smooth') k = k * k * (3 - 2 * k);
    return { t: u, at: a.at.map((v, n) => v + (b.at[n] - v) * k),
      rotation: a.rotation.map((v, n) => v + (b.rotation[n] - v) * k),
      scale: a.scale + (b.scale - a.scale) * k };
  }
  return clone(keys[keys.length - 1]);
}

export function samplePropTransform(prop, time, seconds, endpoint = false) {
  if (prop.transform?.keys?.length) {
    const { keys, interpolation, loop } = prop.transform;
    return samplePropKeys(keys, time, interpolation, !endpoint && loop);
  }
  const at = [...(prop.at || [0, 0, 0])];
  const rotation = [0, (prop.yaw || 0) * DEG, 0];
  let spin = ((prop.spin || 0) * seconds + (prop.spinPhase || 0)) * Math.PI * 2;
  for (const channel of prop.motion || []) {
    const value = channelValue(endpoint ? { ...channel, loop: false } : channel, time, seconds);
    const axis = ['x', 'y', 'z'].indexOf(channel.field);
    if (axis >= 0) at[axis] += value;
    else if (channel.field === 'spin') spin += value;
  }
  rotation[['x', 'y', 'z'].indexOf(prop.spinAxis || 'z')] += spin;
  return { at, rotation, scale: prop.scale || 1 };
}

// A legacy held prop uses the library's grip origin and orientation. Convert
// it to an editable joint attachment without shifting its visible geometry.
export function editableProp(prop, definition) {
  const out = clone(prop);
  if (!out.hand) return out;
  const grip = definition?.anchors?.grip, tilt = out.grip || [0, 0, 0];
  const pose = { at: [0, 0, 0], rotation: [
    ((grip?.roll || 0) + tilt[2]) * DEG,
    ((grip?.yaw || 0) + tilt[1]) * DEG,
    ((grip?.pitch || 0) + tilt[0]) * DEG,
  ], scale: definition?.scale || 1 };
  out.joint = out.hand === 'left' ? 'lHand' : 'rHand';
  out.offset = (grip?.pos || [0, 0, 0]).map(v => -v);
  out.transform = { keys: [0, 1].map(t => ({ t, ...clone(pose) })), interpolation: 'smooth', loop: false };
  delete out.hand;
  delete out.grip;
  return out;
}

export function bakePropMotion(prop, duration) {
  if (prop.transform?.keys?.length) return clone(prop.transform.keys);
  const times = new Set([0, 1]);
  for (const ch of prop.motion || []) for (const key of ch.keys || []) times.add(key.t);
  if (prop.spin || prop.motion?.some(ch => !ch.keys?.length && (ch.amp ?? 1) !== 0)) {
    const count = Math.min(120, Math.max(16, Math.ceil(duration * 12)));
    for (let i = 0; i <= count; i++) times.add(i / count);
  }
  return [...times].sort((a, b) => a - b).map(t => ({ t, ...samplePropTransform(prop, t, t * duration, true) }));
}

export function upsertPropKey(keys, time, pose, loop = false) {
  const t = Math.max(0, Math.min(1, +time.toFixed(6)));
  const key = { ...clone(pose), t }, index = keys.findIndex(k => Math.abs(k.t - t) < 1e-5);
  if (index >= 0) keys[index] = key;
  else keys.push(key);
  if (loop && (t === 0 || t === 1)) {
    const other = keys.find(k => k.t === 1 - t);
    if (other) {
      other.at = [...key.at]; other.scale = key.scale;
      other.rotation = key.rotation.map((v, i) => v + Math.round((other.rotation[i] - v) / (Math.PI * 2)) * Math.PI * 2);
    }
  }
  return keys.sort((a, b) => a.t - b.t);
}
