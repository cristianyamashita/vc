import { shadeHex } from '../render/geometry.js';
import { resolveCut, palette, legIsBare, sleeveReach } from './wardrobe.js';
import { hairParts, resolveStyle, defaultHairLength } from './hair.js';

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
  // Boy and girl are separate plans, not one "child". The anatomical
  // difference at this age is genuinely small — a shade narrower across the
  // shoulders, a shade wider at the hip — and most of what actually reads is
  // hair and clothing. Keeping them apart anyway means a document can say
  // which it means instead of leaving it to the reader.
  boy: {
    ankle: 0.042, knee: 0.260, hip: 0.485, waist: 0.590, chest: 0.690,
    shoulder: 0.790, neck: 0.812, chin: 0.825,
    shoulderW: 0.194, chestD: 0.096, waistW: 0.150, hipW: 0.174, hipD: 0.096,
    armW: 0.042, foreW: 0.038, thighW: 0.064, shinW: 0.052, footL: 0.090,
  },
  girl: {
    ankle: 0.042, knee: 0.262, hip: 0.482, waist: 0.592, chest: 0.688,
    shoulder: 0.786, neck: 0.810, chin: 0.824,
    shoulderW: 0.182, chestD: 0.092, waistW: 0.142, hipW: 0.182, hipD: 0.094,
    armW: 0.039, foreW: 0.035, thighW: 0.062, shinW: 0.050, footL: 0.086,
  },
};

export const BODY_PLANS = Object.keys(PLANS);

// `child` predates the split and still appears in documents written before
// it. It resolves to `boy` rather than erroring, because an old document
// should keep playing; the README says to write `boy` or `girl` now.
const ALIASES = { child: 'boy' };

export function planOf(base) {
  const named = ALIASES[base] || base;
  return PLANS[named] ? named : 'man';
}

/** True for the two child plans, which share most of their treatment. */
export function isChildPlan(base) {
  const named = planOf(base);
  return named === 'boy' || named === 'girl';
}

/** Default standing height in metres, used when a document omits `height`. */
export const DEFAULT_HEIGHT = { man: 1.76, woman: 1.66, boy: 1.24, girl: 1.22 };

/** Where the bust dial sits when a document says nothing. A girl is a child,
 *  so hers is barely there; the masculine plans ignore the dial entirely. */
export const DEFAULT_BUST = { man: 0, woman: 0.45, boy: 0, girl: 0.12 };

/**
 * @param {object} spec
 *   base    'man' | 'woman' | 'child'
 *   height  metres
 *   build   0..1, slim to heavy
 *   bust    0..1, flat to full; feminine plans only, default per plan
 *   outfit  outfit id, or a cut written out longhand
 *   color   main garment colour
 *   fit     { swell } how far the cloth stands off the body, in metres
 *   paint   Map of garment pid -> Map(cellIndex -> colour), the sprayed cells
 *   look    { skin, hair, eyeScale, noseScale, beard }
 * @returns {{ parts: Array, joints: Object, height: number }}
 */
export function buildBody(spec) {
  const base = planOf(spec.base);
  const P = PLANS[base];
  const H = spec.height > 0 ? spec.height : DEFAULT_HEIGHT[base];
  // Experimental visual skin. It is intentionally opt-in from the character
  // builder so the shipped voxel characters keep their exact appearance.
  const softShell = !!spec.softShell;
  const cut = resolveCut(spec.outfit);
  const look = spec.look || {};
  const C = palette(base, cut, spec.color, look);

  const build = Math.max(0, Math.min(1, spec.build ?? 0.5));
  // Two separate dials: a heavier figure widens far more through the trunk
  // than through the forearms, and moving both by one factor reads as a
  // scaled-up person rather than a heavier one.
  const trunk = 0.86 + build * 0.44;
  const limb = 0.92 + build * 0.24;
  // How far past the middle of the range the build sits, in each direction.
  // Width alone reads as a broad person rather than a heavy one — what says
  // "heavy" is depth at the waist, and what says "thin" is the waist being
  // narrower than the ribs above it.
  const heavy = Math.max(0, build - 0.5) * 2;
  const lean = Math.max(0, 0.5 - build) * 2;

  const u = (f) => f * H;                       // fraction of height -> metres
  const headH = u(1 - P.chin);
  const headW = headH * 0.70;
  const headD = headH * 0.78;
  const isChild = base === 'boy' || base === 'girl';
  // The shapes a skirt hangs from and the waist is cut to are shared by the
  // two feminine plans, so they are asked about together rather than by name.
  const isFem = base === 'woman' || base === 'girl';
  // A dial of its own rather than a corner of `build`: a heavy figure is not
  // a busty one, and an author who wants one and not the other should not
  // have to fight the other. It does nothing on the masculine plans, which
  // is simpler than giving the same field two meanings.
  const bust = isFem
    ? Math.max(0, Math.min(1, spec.bust ?? DEFAULT_BUST[base]))
    : 0;

  // How far the cloth stands off the skin. One dial rather than a length per
  // garment: what an author wants is "looser everywhere", and a box grown by
  // the same amount on every axis is exactly that.
  const swell = Math.max(-0.02, Math.min(0.06, spec.fit?.swell ?? 0)) * (H / 1.76);
  const paint = spec.paint instanceof Map ? spec.paint : null;

  const parts = [];
  let limbTag = 'hips';
  let reg = 'torso';
  /**
   * One box. A `pid` marks it as cloth rather than body, and that one tag
   * carries everything the outfit layer does: it is what `swell` grows, what
   * the spray addresses, and what the editor lets you click. Skin, hair and
   * eyes have no pid, which is why paint can only ever land on a garment.
   */
  const p = (w, h, d, color, x, y, z, extra) => {
    const b = { w, h, d, color, x, y, z, limb: limbTag, reg };
    if (extra) Object.assign(b, extra);
    // Round the large masses, but leave small facial/clothing details alone.
    // The parts remain separate and attached to the same joints, so this is a
    // visual skin rather than a second, un-rigged character. Garments retain
    // their character: a skirt flares, while fitted tops and wraps follow the
    // rounded torso without becoming balloons.
    if (softShell && !b.detail) {
      if (reg === 'head') {
        b.shape = 'sphere';
        b.n = Math.max(b.n || 1, 5);
      } else if (b.pid === 'skirt') {
        // An elliptical frustum reads as fabric around two legs; a rounded
        // box still reads as a solid block, especially from the side.
        b.shape = 'cylinder';
        b.axis = 'y';
        b.scaleBottom = b.scaleBottom || [1, 1];
        b.scaleTop = b.scaleTop || [0.80, 0.80];
        b.n = Math.max(b.n || 1, 6);
      } else if (reg === 'belly' || reg === 'torso' || reg === 'hands' || reg === 'feet') {
        b.shape = 'rounded';
        b.roundness = reg === 'torso' || reg === 'belly' ? 0.18 : 0.22;
        b.n = Math.max(b.n || 1, 6);
      }
    }
    if (b.pid) {
      if (swell) {
        b.w += swell * 2;
        b.h += swell * 2;
        b.d += swell * 2;
      }
      const cells = paint?.get(b.pid);
      if (cells) b.paint = cells;
    }
    parts.push(b);
    return b;
  };
  /** Same box on both sides, tagged into the matching left/right joint.
   *
   *  It puts the joint back afterwards. It used to leave it pointing at the
   *  right arm, which silently bolted whatever was drawn next onto that arm —
   *  a bikini top, a jacket lapel and a tie all rode up when the wearer
   *  raised a hand. */
  const pair = (nameL, nameR, w, h, d, color, x, y, z, extra) => {
    const was = limbTag;
    // The two sides take their own pid. Sharing one would mirror every spray
    // stroke onto the other arm, and a stripe painted down one sleeve is not
    // a thing anybody asked the far sleeve to copy.
    const pid = extra?.pid;
    limbTag = nameL;
    p(w, h, d, color, x, y, z, pid ? { ...extra, pid: `${pid}L` } : extra);
    limbTag = nameR;
    p(w, h, d, color, x, y, -z, pid ? { ...extra, pid: `${pid}R` } : extra);
    limbTag = was;
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

  // Limbs are round. The torso and head stay square on purpose — that is
  // the voxel look, and it is what lets a character bake into one mesh — but
  // an arm or a leg is a tube in life, and a box one reads as a plank the
  // moment it swings.
  pair('lThigh', 'rThigh', thighW, thighH * 0.98, thighW * 1.06, thighColor,
    0, u(P.hip) - thighH / 2, hipZ,
    { shape: 'cylinder', n: 3, grain: 0.045, pid: legIsBare(cut, 'thigh') ? undefined : 'legThigh' });
  pair('lShin', 'rShin', shinW, shinH * 0.98, shinW * 1.08, shinColor,
    0, u(P.knee) - shinH / 2, hipZ,
    { shape: 'cylinder', n: 3, grain: 0.045, pid: legIsBare(cut, 'shin') ? undefined : 'legShin' });
  // A knee cap keeps the thigh/shin seam from reading as a gap when the leg
  // bends hard, which is exactly what sitting and kneeling do.
  pair('lShin', 'rShin', shinW * 1.02, shinH * 0.16, shinW * 1.06, shadeHex(shinColor, 0.94),
    0, u(P.knee) - shinH * 0.06, hipZ,
    { shape: 'cylinder', n: 3, detail: true, pid: legIsBare(cut, 'shin') ? undefined : 'legKnee' });

  // ---------------------------------------------------------------- feet
  reg = 'feet';
  const footH = u(P.ankle) * (cut.feet === 'bare' ? 1.0 : 1.25);
  const footL = u(P.footL);
  const footW = shinW * 1.12;
  pair('lFoot', 'rFoot', footL, footH, footW, C.shoe,
    footL * 0.22, footH / 2, hipZ, { n: 2, pid: cut.feet === 'bare' ? undefined : 'shoe' });
  if (cut.feet === 'boot') {
    pair('lShin', 'rShin', shinW * 1.16, shinH * 0.36, shinW * 1.2, C.shoe,
      0, u(P.ankle) + shinH * 0.18, hipZ,
      { shape: 'cylinder', n: 3, detail: true, pid: 'bootShaft' });
  }
  if (cut.feet !== 'bare') {
    pair('lFoot', 'rFoot', footL * 0.5, footH * 0.34, footW * 1.02, shadeHex(C.shoe, 0.82),
      footL * 0.38, footH * 0.2, hipZ, { detail: true, pid: 'shoeToe' });
  }

  // ----------------------------------------------------------------- hips
  limbTag = 'hips';
  reg = 'torso';
  const hipW = u(P.hipW) * trunk;
  const hipD = u(P.hipD) * trunk;
  const hipH = u(P.waist - P.hip) * 1.05;
  p(hipD, hipH, hipW, cut.legs === 'bare' ? C.skin : C.legs,
    0, u(P.hip) + hipH * 0.32, 0,
    { n: 2, grain: 0.04, pid: cut.legs === 'bare' ? undefined : 'legHip' });
  if (cut.legs === 'briefs') {
    p(hipD * 1.03, hipH * 0.7, hipW * 1.02, C.legs, 0, u(P.hip) + hipH * 0.36, 0,
      { n: 2, pid: 'briefs' });
  }
  if (cut.belt) {
    p(hipD * 1.06, u(0.018), hipW * 1.04, C.belt, 0, u(P.waist) - u(0.012), 0,
      { detail: true, flat: true, pid: 'belt' });
  }
  // A towel and a tube dress reach past the hip as a straight wrap, so they
  // are drawn here rather than as a skirt: the skirt's flare is exactly what
  // neither of them has.
  if (cut.top === 'towel' || cut.top === 'tube') {
    const drop = cut.top === 'towel' ? 0.42 : 0.58;
    const hem = u(P.hip) - u(P.hip - P.knee) * drop;
    const wrapH = u(P.waist) - hem;
    p(hipD * 1.12, wrapH, hipW * 1.08, C.top, 0, hem + wrapH / 2, 0,
      { n: 3, grain: cut.top === 'towel' ? 0.09 : 0.04, pid: 'wrapHip' });
    // The tucked corner is what makes a towel a towel and not a short skirt.
    if (cut.top === 'towel') {
      p(hipD * 1.16, u(0.05), hipW * 0.34, shadeHex(C.top, 0.9),
        0, u(P.waist) - u(0.03), hipW * 0.34, { detail: true, pid: 'wrapTuck' });
    }
  }
  if (cut.skirt) {
    if (cut.top === 'nightie') {
      // Measured between two landmarks rather than given a length, so it
      // reaches mid-thigh on a woman and on a girl alike instead of ending
      // at the knee on one of them.
      const hem = u(P.hip) - u(P.hip - P.knee) * 0.5;
      const skirtH = u(P.waist) - hem;
      p(hipD * 1.32, skirtH * 1.03, hipW * 1.32, C.top,
        0, hem + skirtH * 0.515, 0,
        { n: 2, grain: 0.04, pid: 'skirt', scaleTop: [0.82, 0.82] });
    } else {
      const skirtH = u(isChild ? 0.18 : 0.20);
      // The top overlaps the waist by a few millimetres, avoiding a visible
      // skin band between the bodice and skirt while the actor moves.
      p(hipD * 1.38, skirtH, hipW * 1.38, C.top,
        0, u(P.waist) - skirtH * 0.46, 0,
        { n: 2, grain: 0.04, pid: 'skirt', scaleTop: [0.78, 0.78] });
    }
  }

  // ---------------------------------------------------------------- torso
  limbTag = 'chest';
  const waistW = u(P.waistW) * trunk * (1 - lean * 0.07);
  const chestD = u(P.chestD) * trunk;
  const waistD = chestD * (isFem ? 0.86 : 0.92) * (1 + heavy * 0.34 - lean * 0.08);
  // A bare chest, a bikini and a bra all leave the trunk as skin; the band
  // is drawn over it afterwards.
  // A bare chest, a bikini, a bra, a crop top, a towel and a tube dress all
  // leave the trunk as skin; the band or the wrap is drawn over it below.
  const topBare = cut.top === 'bare' || cut.top === 'bikini' || cut.top === 'bra'
    || cut.top === 'croptop' || cut.top === 'towel' || cut.top === 'tube';
  const torsoColor = topBare ? C.skin : C.top;

  reg = 'belly';
  const bellyH = u(P.chest - P.waist);
  // The belly of a heavy figure hangs forward and a shade low, rather than
  // being a wider version of the same barrel.
  if (softShell) {
    // One tapered, overlapping abdominal volume: narrow at the waist, full at
    // the ribs. It meets both hip and chest instead of reading as a separate
    // rounded brick between them.
    p(chestD, bellyH * 1.16, chestW, torsoColor,
      0, u(P.waist) + bellyH * 0.52, 0,
      {
        n: 6, grain: 0.04, pid: topBare ? undefined : 'topBelly',
        shape: 'rounded', roundness: 0.16,
        scaleBottom: [waistD / chestD, waistW / chestW],
        scaleTop: [1, 1],
      });
  } else {
    p(waistD, bellyH, waistW, torsoColor,
      (waistD - chestD) * 0.42, u(P.waist) + bellyH * (0.5 - heavy * 0.04), 0,
      { n: 2, grain: 0.04, pid: topBare ? undefined : 'topBelly' });
  }
  reg = 'torso';
  const chestH = u(P.shoulder - P.chest);
  p(chestD, chestH * (softShell ? 1.16 : 1.04), chestW, torsoColor,
    0, u(P.chest) + chestH * (softShell ? 0.46 : 0.5), 0,
    softShell
      ? {
        n: 6, grain: 0.04, pid: topBare ? undefined : 'topChest',
        shape: 'rounded', roundness: 0.15,
        scaleBottom: [0.96, 0.94], scaleTop: [1, 1.04],
      }
      : { n: 2, grain: 0.04, pid: topBare ? undefined : 'topChest' });
  // Shoulder caps: the box torso ends square, and a small pad on each side is
  // what stops the arm from looking bolted to a plank.
  pair('lArm', 'rArm', chestD * 0.92, u(0.042), armW * 1.02, topBare ? C.skin : C.top,
    0, u(P.shoulder) - u(0.014), shoulderZ,
    { shape: 'sphere', n: 3, detail: true, pid: topBare ? undefined : 'topShoulder' });

  // ----------------------------------------------------------------- bust
  // Its own region, hung off `chest` like the shoulder caps: a raised arm
  // must not carry it, which is the same mistake the bikini top made when it
  // was tagged onto the arm.
  const bustSpan = u(P.shoulder - P.chest);
  const bustY = u(P.chest) + bustSpan * 0.44;
  // A tiny child bust reads as two stuck-on balls at this resolution. The
  // tapered torso already carries the subtle volume more convincingly.
  const visibleBust = softShell && isChild && bust < 0.18 ? 0 : bust;
  const bustOut = visibleBust > 0.02 ? chestD * (0.34 + visibleBust * 0.52) : 0;
  if (bustOut > 0) {
    reg = 'bust';
    limbTag = 'chest';
    pair('chest', 'chest', bustOut, bustSpan * (0.50 + bust * 0.34), chestW * (0.30 + bust * 0.12),
      torsoColor, chestD * 0.5, bustY, chestW * 0.23,
      { shape: 'sphere', n: 3, grain: 0.04, pid: topBare ? undefined : 'topBust' });
    reg = 'torso';
  }
  // How far the band has to reach forward to sit on top of all that, and
  // where it sits: on a flat chest it stays where it always was.
  const bandOut = bustOut * 0.62;
  const bandY = bustOut > 0 ? bustY : u(P.chest) + u(0.05);

  if (cut.top === 'bikini' || cut.top === 'bra') {
    p(chestD * 1.04 + bandOut, u(0.045) + bustOut * 0.28, chestW * 1.02, C.top,
      bandOut * 0.5, bandY, 0, { detail: true, pid: 'band' });
  }
  // Straps over the shoulder are what tells a bra from a bikini top at this
  // size, so they are not decoration.
  if (cut.top === 'bra') {
    pair('chest', 'chest', u(0.022), bustSpan * 0.92, u(0.022), C.top,
      chestD * 0.34, bustY + bustSpan * 0.42, chestW * 0.30, { detail: true, pid: 'strap' });
  }
  // Above the waist a towel only exists on the feminine plans — a man out of
  // the shower wears it at the hip — while a tube dress always does. Both are
  // one straight wrap meeting the one drawn at the hip, topped just above the
  // bust so it reads as strapless rather than as a vest.
  if (cut.top === 'tube' || (cut.top === 'towel' && isFem)) {
    const wrapTop = u(P.chest) + bustSpan * 0.82;
    const wrapH = wrapTop - u(P.waist);
    p(chestD * 1.05 + bandOut, wrapH, chestW * 1.06, C.top,
      bandOut * 0.45, u(P.waist) + wrapH / 2, 0,
      { n: 3, grain: cut.top === 'towel' ? 0.09 : 0.04, pid: 'wrapChest' });
    if (cut.top === 'towel') {
      p(chestD * 1.08 + bandOut, u(0.05), chestW * 0.3, shadeHex(C.top, 0.9),
        bandOut * 0.45, wrapTop - u(0.035), chestW * 0.36, { detail: true, pid: 'wrapKnot' });
    }
  }
  if (cut.top === 'croptop') {
    // A band deep enough to be a garment rather than a bikini top, and thin
    // straps: the two together are what tells a crop top from a bra.
    p(chestD * 1.05 + bandOut, bustSpan * 0.62 + bustOut * 0.3, chestW * 1.04, C.top,
      bandOut * 0.45, bandY + bustSpan * 0.05, 0, { n: 2, grain: 0.04, pid: 'band' });
    pair('chest', 'chest', u(0.024), bustSpan * 0.88, u(0.024), C.top,
      chestD * 0.32, bustY + bustSpan * 0.46, chestW * 0.29, { detail: true, pid: 'strap' });
  }
  if (cut.top === 'nightie') {
    pair('chest', 'chest', u(0.026), bustSpan * 0.86, u(0.030), C.top,
      chestD * 0.30, u(P.chest) + bustSpan * 0.72, chestW * 0.32, { detail: true, pid: 'strap' });
  }
  if (cut.top === 'jacket') {
    p(chestD * 1.06, u(P.shoulder - P.waist) * 0.98, chestW * 0.34, C.topDark,
      0, u(P.waist) + u(P.shoulder - P.waist) / 2, 0, { detail: true, pid: 'lapel' });
  }
  if (cut.top === 'fatigues') {
    // Patch pockets and a collar. At this size they are the whole difference
    // between a uniform and an olive long-sleeved tee.
    pair('chest', 'chest', chestD * 0.07, u(0.08), chestW * 0.28, C.topDark,
      chestD * 0.5 + bandOut, u(P.chest) + bustSpan * 0.26, chestW * 0.27,
      { flat: true, detail: true, pid: 'pocket' });
    p(chestD * 1.04, u(0.032), chestW * 1.05, C.topDark,
      0, u(P.shoulder) - u(0.022), 0, { detail: true, pid: 'collar' });
  }
  if (cut.tie) {
    p(chestD * 1.1, u(P.shoulder - P.waist) * 0.62, u(0.026), C.tie,
      0, u(P.chest) + u(0.03), 0, { detail: true, flat: true, pid: 'tie' });
  }
  if (cut.straps) {
    pair('chest', 'chest', chestD * 1.08, u(P.shoulder - P.chest) * 1.1, u(0.026), C.legs,
      0, u(P.chest) + u(P.shoulder - P.chest) / 2, chestW * 0.28,
      { detail: true, pid: 'brace' });
  }

  // ----------------------------------------------------------------- arms
  reg = 'arms';
  const reach = sleeveReach(cut);
  const sleeveH = Math.min(1, reach) * armLen;
  const bareArmH = armLen - sleeveH;

  if (sleeveH > 0.001) {
    pair('lArm', 'rArm', armW * 1.08, sleeveH, armW * 1.08, C.top,
      0, u(P.shoulder) - sleeveH / 2, shoulderZ,
      { shape: 'cylinder', n: 3, grain: 0.045, pid: 'sleeve' });
  }
  if (bareArmH > 0.001) {
    pair('lArm', 'rArm', armW, bareArmH, armW, C.skin,
      0, u(P.shoulder) - sleeveH - bareArmH / 2, shoulderZ, { shape: 'cylinder', n: 3, grain: 0.04 });
  }
  const foreClothed = reach > 1;
  pair('lFore', 'rFore', foreClothed ? foreW * 1.1 : foreW, foreLen, foreClothed ? foreW * 1.1 : foreW,
    foreClothed ? C.top : C.skin, 0, elbowY - foreLen / 2, shoulderZ,
    { shape: 'cylinder', n: 3, grain: 0.04, pid: foreClothed ? 'sleeveFore' : undefined });
  if (foreClothed) {
    pair('lFore', 'rFore', foreW * 1.14, u(0.02), foreW * 1.14, C.topDark,
      0, wristY + u(0.014), shoulderZ,
      { shape: 'cylinder', n: 3, detail: true, pid: 'cuff' });
  }

  reg = 'hands';
  const handH = u(isChild ? 0.052 : 0.062);
  pair('lHand', 'rHand', foreW * 1.05, handH, foreW * 1.12, C.skinDark,
    0, wristY - handH / 2, shoulderZ, { n: 2 });

  // ----------------------------------------------------------------- head
  limbTag = 'neck';
  reg = 'torso';
  // Extend the neck into both the head and the shoulder line. The old short
  // cylinder left a visible air gap above the torso, especially on children.
  const neckBottom = u(P.shoulder) - u(0.008);
  const neckTop = u(P.chin) + u(0.006);
  const neckH = neckTop - neckBottom;
  p(headD * 0.42, neckH, headW * 0.46, C.skinDark, 0, neckBottom + neckH / 2, 0,
    { shape: 'cylinder', n: 3 });

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
  for (const b of hairParts({
    headW, headD, headH, headY,
    hair: C.hair, hairDark: C.hairDark,
    style: resolveStyle(look.hairStyle, base),
    length: Number.isFinite(look.hairLength) ? look.hairLength : defaultHairLength(base),
  })) {
    p(b.w, b.h, b.d, b.color, b.x, b.y, b.z, b);
  }

  if (look.beard && base === 'man') {
    p(headD * 0.72, headH * 0.26, headW * 1.0, C.hairDark, headD * 0.2, u(P.chin) + headH * 0.12, 0,
      { detail: true });
  }
  if (cut.cap) {
    p(headD * 1.1, headH * 0.2, headW * 1.1, C.top, 0, headY + headH * 0.44, 0,
      { n: 2, pid: 'cap' });
    p(headD * 0.5, headH * 0.06, headW * 1.02, C.topDark, headD * 0.72, headY + headH * 0.36, 0,
      { detail: true, flat: true, pid: 'capBrim' });
  }

  return { parts, joints, height: H };
}
