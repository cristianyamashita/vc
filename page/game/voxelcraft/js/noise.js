export function hash2(x, y, seed) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 982451653);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function hash3(x, y, z, seed) {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2146121221) + Math.imul(seed | 0, 982451653);
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function fade(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise2(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const tz = fade(z - z0);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}

export function valueNoise3(x, y, z, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = fade(x - x0);
  const ty = fade(y - y0);
  const tz = fade(z - z0);
  const n000 = hash3(x0, y0, z0, seed);
  const n100 = hash3(x0 + 1, y0, z0, seed);
  const n010 = hash3(x0, y0 + 1, z0, seed);
  const n110 = hash3(x0 + 1, y0 + 1, z0, seed);
  const n001 = hash3(x0, y0, z0 + 1, seed);
  const n101 = hash3(x0 + 1, y0, z0 + 1, seed);
  const n011 = hash3(x0, y0 + 1, z0 + 1, seed);
  const n111 = hash3(x0 + 1, y0 + 1, z0 + 1, seed);
  const nx00 = n000 + (n100 - n000) * tx;
  const nx10 = n010 + (n110 - n010) * tx;
  const nx01 = n001 + (n101 - n001) * tx;
  const nx11 = n011 + (n111 - n011) * tx;
  const nxy0 = nx00 + (nx10 - nx00) * ty;
  const nxy1 = nx01 + (nx11 - nx01) * ty;
  return nxy0 + (nxy1 - nxy0) * tz;
}

export function fbm2(x, z, seed, octaves = 4) {
  let v = 0;
  let a = 1;
  let f = 1;
  let s = 0;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise2(x * f, z * f, seed + i * 19) * a;
    s += a;
    a *= 0.5;
    f *= 2;
  }
  return v / s;
}

export function fbm3(x, y, z, seed, octaves = 3) {
  let v = 0;
  let a = 1;
  let f = 1;
  let s = 0;
  for (let i = 0; i < octaves; i++) {
    v += valueNoise3(x * f, y * f, z * f, seed + i * 31) * a;
    s += a;
    a *= 0.5;
    f *= 2;
  }
  return v / s;
}
