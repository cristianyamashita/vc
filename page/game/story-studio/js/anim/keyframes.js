// Key times are normalized to one action cycle. Values use the same units
// as procedural channels (radians for joints, height fractions for the root).
export function sampleKeys(keys, time, interpolation = 'smooth', loop = false) {
  if (!keys?.length) return 0;
  const u = loop ? ((time % 1) + 1) % 1 : Math.max(0, Math.min(1, time));
  if (u <= keys[0].t) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i], a = keys[i - 1];
    if (u > b.t) continue;
    let k = (u - a.t) / Math.max(1e-8, b.t - a.t);
    if (interpolation === 'step') k = u === b.t ? 1 : 0;
    else if (interpolation === 'smooth') k = k * k * (3 - 2 * k);
    return a.value + (b.value - a.value) * k;
  }
  return keys[keys.length - 1].value;
}
