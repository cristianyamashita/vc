import { shadeHex } from '../render/geometry.js';
import { resolveCut, palette, legIsBare, sleeveReach } from './wardrobe.js';

// One dressed figure, laid out as boxes plus the rest position of every joint
// in `cast/rig.js`. Forked from VoxelCraft's js/outfits.js and reworked in two
// ways: every measurement is a fraction of the character's height, so `height`
// in a document is simply believed; and every box is tagged with the joint it
// belongs to, including the torso, head, forearms, hands and feet that the
// game left rigid.
//
// Nothing here is a document. A character document picks a plan and turns the
// dials; the anatomy that turns those dials into boxes stays in code, because
// it is an algorithm and not a parameter.

/** Vertical landmarks, as a fraction of total height. The child is not a
 *  small adult: its legs start lower and its head takes a far bigger share,
 *  which is most of what reads as "child" at this level of detail. */
const PLANS = {
  man: {
    ankle: 0.039, knee: 0.285, hip: 0.530, waist: 0.620, chest: 0.720,
    shoulder: 0.818, neck: 0.850, chin: 0.868,
    shoulderW: 0.235, chestD: 0.108, waistW: 0.170, hipW: 0.182, hipD: 0.104,
    armW: 0.049, foreW: 0.043, thighW: 0.074, shinW: 0.060, footL: 0.105,
  },
  woman: {
    ankle: 0.039, knee: 0.285, hip: 0.520, waist: 0.628, chest: 0.715,
    shoulder: 0.812, neck: 0.845, chin: 0.866,
    shoulderW: 0.202, chestD: 0.100, waistW: 0.142, hipW: 0.196, hipD: 0.102,
    armW: 0.041, foreW: 0.036, thighW: 0.069, shinW: 0.053, footL: 0.096,
  },
  child: {
    ankle: 0.042, knee: 0.260, hip: 0.485, waist: 0.590, chest: 0.690,
    shoulder: 0.790, neck: 0.812, chin: 0.825,
    shoulderW: 0.192, chestD: 0.096, waistW: 0.150, hipW: 0.176, hipD: 0.096,
    armW: 0.042, foreW: 0.038, thighW: 0.064, shinW: 0.052, footL: 0.090,
  },
};

export const BODY_PLANS = Object.keys(PLANS);

export function planOf(base) {
  return PLANS[base] ? base : 'man';
}

/** Default standing height in metres, used when a document omits `height`. */
export const DEFAULT_HEIGHT = { man: 1.76, woman: 1.66, child: 1.24 };

/**
 * @param {object} spec
 *   base    'man' | 'woman' | 'child'
 *   height  metres
 *   build   0..1, slim to heavy
 *   outfit  preset name or inline cut
 *   color   main garment colour
 *   look    { skin, hair, eyeScale, noseScale, beard }
 * @returns {{ parts: Array, joints: Object, height: number }}
 */
export function buildBody(spec) {
  const base = planOf(spec.base);
  const P = PLANS[base];
  const H = spec.height > 0 ? spec.height : DEFAULT_HEIGHT[base];
  const cut = resolveCut(spec.outfit);
  const look = spec.look || {};
  const C = palette(base, cut, spec.color, look);

  const build = Math.max(0, Math.min(1, spec.build ?? 0.5));
  // Two separate dials: a heavier figure widens far more through the trunk
  // than through the forearms, and moving both by one factor reads as a
  // scaled-up person rather than a heavier one.
  const trunk = 0.86 + build * 0.44;
  const limb = 0.92 + build * 0.24;

  const u = (f) => f * H;                       // fraction of height -> metres
  const headH = u(1 - P.chin);
  const headW = headH * 0.70;
  const headD = headH * 0.78;
  const isChild = base === 'child';
  const isWoman = base === 'woman';

  const parts = [];
  let limbTag = 'hips';
  let reg = 'torso';
  const p = (w, h, d, color, x, y, z, extra) => {
    const b = { w, h, d, color, x, y, z, limb: limbTag, reg };
    if (extra) Object.assign(b, extra);
    parts.push(b);
    return b;
  };
  /** Same box on both sides, tagged into the matching left/right joint. */
  const pair = (nameL, nameR, w, h, d, color, x, y, z, extra) => {
    limbTag = nameL;
    p(w, h, d, color, x, y, z, extra);
    limbTag = nameR;
    p(w, h, d, color, x, y, -z, extra);
  };

  // ------------------------------------------------------------- skeleton
  // The trunk's width has to be known before the shoulder is placed, or the
  // arms hang inside the chest: a heavier build widens the torso past a
  // shoulder pinned to the plan's nominal width, and the limb disappears.
  const trunkW = u(P.shoulderW) * trunk;
  const chestW = trunkW * 0.86;
  const armW = u(P.armW) * limb;
  const foreW = u(P.foreW) * limb;
  const shoulderZ = chestW / 2 + armW * 0.42;
  const hipZ = u(P.hipW) * 0.27;
  const armLen = u(P.shoulder - P.hip) * 0.52;
  const foreLen = u(P.shoulder - P.hip) * 0.48;
  const elbowY = u(P.shoulder) - armLen;
  const wristY = elbowY - foreLen;

  const joints = {
    hips: { x: 0, y: u(P.hip), z: 0 },
    chest: { x: 0, y: u(P.waist), z: 0 },
    neck: { x: 0, y: u(P.neck), z: 0 },
    head: { x: 0, y: u(P.neck) + (u(P.chin) - u(P.neck)) * 0.4, z: 0 },
    lArm: { x: 0, y: u(P.shoulder), z: shoulderZ },
    rArm: { x: 0, y: u(P.shoulder), z: -shoulderZ },
    lFore: { x: 0, y: elbowY, z: shoulderZ },
    rFore: { x: 0, y: elbowY, z: -shoulderZ },
    lHand: { x: 0, y: wristY, z: shoulderZ },
    rHand: { x: 0, y: wristY, z: -shoulderZ },
    lThigh: { x: 0, y: u(P.hip), z: hipZ },
    rThigh: { x: 0, y: u(P.hip), z: -hipZ },
    lShin: { x: 0, y: u(P.knee), z: hipZ },
    rShin: { x: 0, y: u(P.knee), z: -hipZ },
    lFoot: { x: 0, y: u(P.ankle), z: hipZ },
    rFoot: { x: 0, y: u(P.ankle), z: -hipZ },
  };

  // ----------------------------------------------------------------- legs
  reg = 'legs';
  const thighW = u(P.thighW) * limb;
  const shinW = u(P.shinW) * limb;
  const thighH = u(P.hip - P.knee);
  const shinH = u(P.knee - P.ankle);
  const thighColor = legIsBare(cut, 'thigh') ? C.skin : C.legs;
  const shinColor = legIsBare(cut, 'shin') ? C.skin : C.legs;

  pair('lThigh', 'rThigh', thighW, thighH * 0.98, thighW * 1.06, thighColor,
    0, u(P.hip) - thighH / 2, hipZ, { n: 2, grain: 0.045 });
  pair('lShin', 'rShin', shinW, shinH * 0.98, shinW * 1.08, shinColor,
    0, u(P.knee) - shinH / 2, hipZ, { n: 2, grain: 0.045 });
  // A knee cap keeps the thigh/shin seam from reading as a gap when the leg
  // bends hard, which is exactly what sitting and kneeling do.
  pair('lShin', 'rShin', shinW * 1.02, shinH * 0.16, shinW * 1.06, shadeHex(shinColor, 0.94),
    0, u(P.knee) - shinH * 0.06, hipZ, { detail: true });

  // ---------------------------------------------------------------- feet
  reg = 'feet';
  const footH = u(P.ankle) * (cut.feet === 'bare' ? 1.0 : 1.25);
  const footL = u(P.footL);
  const footW = shinW * 1.12;
  pair('lFoot', 'rFoot', footL, footH, footW, C.shoe,
    footL * 0.22, footH / 2, hipZ, { n: 2 });
  if (cut.feet === 'boot') {
    pair('lShin', 'rShin', shinW * 1.16, shinH * 0.36, shinW * 1.2, C.shoe,
      0, u(P.ankle) + shinH * 0.18, hipZ, { detail: true });
  }
  if (cut.feet !== 'bare') {
    pair('lFoot', 'rFoot', footL * 0.5, footH * 0.34, footW * 1.02, shadeHex(C.shoe, 0.82),
      footL * 0.38, footH * 0.2, hipZ, { detail: true });
  }

  // ----------------------------------------------------------------- hips
  limbTag = 'hips';
  reg = 'torso';
  const hipW = u(P.hipW) * trunk;
  const hipD = u(P.hipD) * trunk;
  const hipH = u(P.waist - P.hip) * 1.05;
  p(hipD, hipH, hipW, cut.legs === 'bare' ? C.skin : C.legs,
    0, u(P.hip) + hipH * 0.32, 0, { n: 2, grain: 0.04 });
  if (cut.legs === 'briefs') {
    p(hipD * 1.03, hipH * 0.7, hipW * 1.02, C.legs, 0, u(P.hip) + hipH * 0.36, 0, { n: 2 });
  }
  if (cut.belt) {
    p(hipD * 1.06, u(0.018), hipW * 1.04, C.belt, 0, u(P.waist) - u(0.012), 0, { detail: true, flat: true });
  }
  if (cut.skirt) {
    const skirtH = u(isChild ? 0.10 : 0.13);
    p(hipD * 1.5, skirtH, hipW * 1.42, C.top, 0, u(P.hip) + skirtH * 0.42, 0, { n: 2, grain: 0.04 });
  }

  // ---------------------------------------------------------------- torso
  limbTag = 'chest';
  const waistW = u(P.waistW) * trunk;
  const chestD = u(P.chestD) * trunk;
  const waistD = chestD * (isWoman ? 0.86 : 0.92);
  const topBare = cut.top === 'bare' || cut.top === 'bikini';
  const torsoColor = topBare ? C.skin : C.top;

  reg = 'belly';
  p(waistD, u(P.chest - P.waist), waistW, torsoColor,
    0, u(P.waist) + u(P.chest - P.waist) / 2, 0, { n: 2, grain: 0.04 });
  reg = 'torso';
  p(chestD, u(P.shoulder - P.chest) * 1.04, chestW, torsoColor,
    0, u(P.chest) + u(P.shoulder - P.chest) / 2, 0, { n: 2, grain: 0.04 });
  // Shoulder caps: the box torso ends square, and a small pad on each side is
  // what stops the arm from looking bolted to a plank.
  pair('lArm', 'rArm', chestD * 0.92, u(0.042), armW * 1.02, topBare ? C.skin : C.top,
    0, u(P.shoulder) - u(0.014), shoulderZ, { detail: true });

  if (cut.top === 'bikini') {
    p(chestD * 1.04, u(0.045), chestW * 1.02, C.top, 0, u(P.chest) + u(0.05), 0, { detail: true });
  }
  if (cut.top === 'jacket') {
    p(chestD * 1.06, u(P.shoulder - P.waist) * 0.98, chestW * 0.34, C.topDark,
      0, u(P.waist) + u(P.shoulder - P.waist) / 2, 0, { detail: true });
  }
  if (cut.tie) {
    p(chestD * 1.1, u(P.shoulder - P.waist) * 0.62, u(0.026), C.tie,
      0, u(P.chest) + u(0.03), 0, { detail: true, flat: true });
  }
  if (cut.straps) {
    pair('chest', 'chest', chestD * 1.08, u(P.shoulder - P.chest) * 1.1, u(0.026), C.legs,
      0, u(P.chest) + u(P.shoulder - P.chest) / 2, chestW * 0.28, { detail: true });
  }

  // ----------------------------------------------------------------- arms
  reg = 'arms';
  const reach = sleeveReach(cut);
  const sleeveH = Math.min(1, reach) * armLen;
  const bareArmH = armLen - sleeveH;

  if (sleeveH > 0.001) {
    pair('lArm', 'rArm', armW * 1.08, sleeveH, armW * 1.08, C.top,
      0, u(P.shoulder) - sleeveH / 2, shoulderZ, { n: 2, grain: 0.045 });
  }
  if (bareArmH > 0.001) {
    pair('lArm', 'rArm', armW, bareArmH, armW, C.skin,
      0, u(P.shoulder) - sleeveH - bareArmH / 2, shoulderZ, { n: 2, grain: 0.04 });
  }
  const foreClothed = reach > 1;
  pair('lFore', 'rFore', foreClothed ? foreW * 1.1 : foreW, foreLen, foreClothed ? foreW * 1.1 : foreW,
    foreClothed ? C.top : C.skin, 0, elbowY - foreLen / 2, shoulderZ, { n: 2, grain: 0.04 });
  if (foreClothed) {
    pair('lFore', 'rFore', foreW * 1.14, u(0.02), foreW * 1.14, C.topDark,
      0, wristY + u(0.014), shoulderZ, { detail: true });
  }

  reg = 'hands';
  const handH = u(isChild ? 0.052 : 0.062);
  pair('lHand', 'rHand', foreW * 1.05, handH, foreW * 1.12, C.skinDark,
    0, wristY - handH / 2, shoulderZ, { n: 2 });

  // ----------------------------------------------------------------- head
  limbTag = 'neck';
  reg = 'torso';
  const neckH = u(P.chin - P.neck) * 1.4;
  p(headD * 0.42, neckH, headW * 0.46, C.skinDark, 0, u(P.neck) + neckH * 0.35, 0);

  limbTag = 'head';
  reg = 'head';
  const headY = u(P.chin) + headH / 2;
  p(headD, headH, headW, C.skin, 0, headY, 0, { n: 3, grain: 0.035 });
  p(headD * 0.16, headH * 0.16, headW * 0.14, C.skinDark,
    headD * 0.52, headY - headH * 0.05, 0,
    { detail: true, n: 1 });                              // nose
  pair('head', 'head', headD * 0.1, headH * 0.3, headW * 0.06, C.skinDark,
    -headD * 0.06, headY, headW * 0.5, { detail: true }); // ears

  reg = 'eyes';
  const eyeS = Math.max(0.6, Math.min(1.6, look.eyeScale ?? 1));
  pair('head', 'head', headD * 0.06, headH * 0.11 * eyeS, headW * 0.15 * eyeS, C.eye,
    headD * 0.5, headY + headH * 0.06, headW * 0.21, { flat: true, detail: true });

  reg = 'hair';
  const capH = headH * (isWoman ? 0.30 : 0.24);
  p(headD * 1.04, capH, headW * 1.05, C.hair, 0, headY + headH / 2 - capH * 0.32, 0,
    { n: 2, grain: 0.05 });
  p(headD * 0.2, headH * 0.5, headW * 1.05, C.hairDark, -headD * 0.46, headY + headH * 0.08, 0,
    { detail: true });                                    // back of the head
  if (isWoman) {
    p(headD * 1.06, headH * 0.62, headW * 0.3, C.hairDark, -headD * 0.1, headY - headH * 0.12, 0,
      { n: 2, detail: true });                            // hair falling behind
  }
  if (look.beard && base === 'man') {
    p(headD * 0.72, headH * 0.26, headW * 1.0, C.hairDark, headD * 0.2, u(P.chin) + headH * 0.12, 0,
      { detail: true });
  }
  if (cut.cap) {
    p(headD * 1.1, headH * 0.2, headW * 1.1, C.top, 0, headY + headH * 0.44, 0, { n: 2 });
    p(headD * 0.5, headH * 0.06, headW * 1.02, C.topDark, headD * 0.72, headY + headH * 0.36, 0,
      { detail: true, flat: true });
  }

  return { parts, joints, height: H };
}
