import * as THREE from 'three';

// Procedural kinematic rig. Units: metres, radians internally; public angles: degrees.
// +Y is up, +Z is forward. A positive X rotation bends a downward link backward.
export function createRobot() {
  const root = new THREE.Group();
  root.name = 'Aster humanoid';
  const joints = [];
  const jointMap = new Map();
  const helpers = [];
  const shell = new THREE.MeshPhysicalMaterial({ color: '#e4e9ed', metalness: .46, roughness: .3, clearcoat: .45 });
  const dark = new THREE.MeshStandardMaterial({ color: '#202933', metalness: .75, roughness: .34 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#10161c', metalness: .12, roughness: .65 });
  const metal = new THREE.MeshStandardMaterial({ color: '#727d86', metalness: .92, roughness: .24 });
  const accent = new THREE.MeshStandardMaterial({ color: '#00c8af', emissive: '#00c8af', emissiveIntensity: .4, metalness: .5, roughness: .28 });
  const visor = new THREE.MeshPhysicalMaterial({ color: '#070e18', metalness: .65, roughness: .13, clearcoat: 1 });
  const selectMaterial = new THREE.MeshBasicMaterial({ color: '#4bffd5', transparent: true, opacity: .65, depthTest: false });
  const selection = new THREE.Mesh(new THREE.TorusGeometry(.065, .003, 8, 40), selectMaterial);
  selection.renderOrder = 10;
  selection.visible = false;

  function roundedGeometry(w, h, d, r = .015) {
    r = Math.min(r, w / 3, h / 3, d / 3);
    const x = -w / 2 + r, y = -h / 2 + r;
    const shape = new THREE.Shape();
    shape.moveTo(x + r, y);
    shape.lineTo(x + w - 3 * r, y);
    shape.quadraticCurveTo(x + w - 2 * r, y, x + w - 2 * r, y + r);
    shape.lineTo(x + w - 2 * r, y + h - 3 * r);
    shape.quadraticCurveTo(x + w - 2 * r, y + h - 2 * r, x + w - 3 * r, y + h - 2 * r);
    shape.lineTo(x + r, y + h - 2 * r);
    shape.quadraticCurveTo(x, y + h - 2 * r, x, y + h - 3 * r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * r, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: r, bevelThickness: r, curveSegments: 5 });
    g.translate(0, 0, -d / 2 + r);
    g.computeBoundingBox();
    g.userData.collisionShape = { type: 'roundedBox', halfSize: g.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(.5).toArray(), radius: r };
    return g;
  }

  function mesh(parent, geometry, material, xyz = [0, 0, 0], id) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(...xyz);
    object.castShadow = true;
    object.receiveShadow = true;
    object.userData.jointId = id || parent.userData.jointId;
    parent.add(object);
    return object;
  }
  const box = (parent, dims, mat, xyz, id, radius = .014) => mesh(parent, roundedGeometry(...dims, radius), mat, xyz, id);
  const sphere = (parent, radius, mat, xyz, id) => {
    const geometry = new THREE.SphereGeometry(radius, 20, 14);
    geometry.userData.collisionShape = { type: 'sphere', radius };
    return mesh(parent, geometry, mat, xyz, id);
  };
  function cylinder(parent, radius, length, mat, xyz, axis = 'x', id) {
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 24);
    geometry.userData.collisionShape = { type: 'cylinder', radius, halfLength: length / 2, axis: 'y' };
    const part = mesh(parent, geometry, mat, xyz, id);
    if (axis === 'x') part.rotation.z = Math.PI / 2;
    if (axis === 'z') part.rotation.x = Math.PI / 2;
    return part;
  }
  function actuator(parent, radius, width, id, axis = 'x') {
    cylinder(parent, radius, width, rubber, [0, 0, 0], axis, id);
    for (const s of [-1, 1]) {
      const p = [0, 0, 0];
      p['xyz'.indexOf(axis)] = s * (width / 2 + .001);
      cylinder(parent, radius * .74, .006, metal, p, axis, id);
      p['xyz'.indexOf(axis)] += s * .004;
      cylinder(parent, radius * .35, .008, dark, p, axis, id);
    }
  }
  function joint(parent, id, group, axis, min, max, label, offset = [0, 0, 0], axisSign = 1) {
    const node = new THREE.Group();
    node.position.set(...offset);
    node.name = id;
    node.userData.jointId = id;
    parent.add(node);
    const info = { id, group, axis, axisSign, min, max, home: 0, node, label };
    joints.push(info);
    jointMap.set(id, info);
    const axes = new THREE.AxesHelper(group.includes('hand') ? .035 : .075);
    // The colored joint axis points in its positive commanded direction.
    axes.scale[axis] = axisSign;
    axes.visible = false;
    axes.renderOrder = 4;
    node.add(axes);
    helpers.push(axes);
    return node;
  }
  const label = (en, pt, ja) => ({ en, pt, ja });
  const torsoYaw = joint(root, 'torso_yaw', 'torso', 'y', -65, 65, label('Waist · yaw', 'Cintura · rotação', '腰・旋回'), [0, 1.005, 0]);
  // Legs attach to a fixed pelvis; torso rotations affect the upper body only.
  const pelvis = new THREE.Group();
  pelvis.position.y = 1.005;
  root.add(pelvis);
  pelvis.userData.jointId = 'torso_yaw';
  box(pelvis, [.32, .16, .22], dark, [0, -.02, 0]);
  box(pelvis, [.29, .095, .045], shell, [0, -.005, .107]);
  box(pelvis, [.075, .13, .055], shell, [0, -.085, .1]);
  cylinder(torsoYaw, .104, .09, rubber, [0, .025, 0], 'y');
  cylinder(torsoYaw, .108, .014, accent, [0, .045, 0], 'y');
  const torsoPitch = joint(torsoYaw, 'torso_pitch', 'torso', 'x', -35, 35, label('Waist · pitch', 'Cintura · inclinação', '腰・前後傾斜'), [0, .08, 0]);
  const torsoRoll = joint(torsoPitch, 'torso_roll', 'torso', 'z', -30, 30, label('Waist · roll', 'Cintura · lateral', '腰・左右傾斜'));
  box(torsoRoll, [.225, .2, .175], dark, [0, .07, 0]);
  for (let i = 0; i < 3; i++) box(torsoRoll, [.205 + i * .012, .029, .025], shell, [0, .015 + i * .047, .095]);

  // Tapered chest plate: broad shoulders, narrow waist, layered removable armor.
  const chestOutline = new THREE.Shape();
  chestOutline.moveTo(-.105, -.13);
  chestOutline.lineTo(.105, -.13);
  chestOutline.lineTo(.205, .055);
  chestOutline.lineTo(.173, .14);
  chestOutline.lineTo(-.173, .14);
  chestOutline.lineTo(-.205, .055);
  chestOutline.closePath();
  const chestGeometry = new THREE.ExtrudeGeometry(chestOutline, { depth: .16, bevelEnabled: true, bevelSegments: 3, bevelSize: .022, bevelThickness: .022, steps: 1 });
  chestGeometry.translate(0, 0, -.075);
  mesh(torsoRoll, chestGeometry, shell, [0, .255, 0]);
  box(torsoRoll, [.215, .045, .018], dark, [0, .326, .112]);
  box(torsoRoll, [.13, .007, .009], accent, [0, .325, .125], 'torso_roll', .002);
  cylinder(torsoRoll, .021, .012, visor, [0, .253, .117], 'z');
  cylinder(torsoRoll, .009, .014, accent, [0, .253, .125], 'z');
  for (const side of [-1, 1]) {
    const seam = box(torsoRoll, [.007, .12, .009], dark, [side * .125, .23, .114], 'torso_roll', .002);
    seam.rotation.z = side * -.42;
    box(torsoRoll, [.065, .16, .035], dark, [side * .085, .253, -.112]);
    for (let i = 0; i < 5; i++) box(torsoRoll, [.043, .005, .008], metal, [side * .085, .207 + i * .023, -.134], 'torso_roll', .001);
  }

  const neckYaw = joint(torsoRoll, 'neck_yaw', 'head', 'y', -85, 85, label('Neck · yaw', 'Pescoço · rotação', '首・旋回'), [0, .43, 0]);
  cylinder(neckYaw, .047, .075, metal, [0, .005, 0], 'y');
  const neckPitch = joint(neckYaw, 'neck_pitch', 'head', 'x', -40, 40, label('Neck · pitch', 'Pescoço · inclinação', '首・前後傾斜'), [0, .025, 0]);
  const neckRoll = joint(neckPitch, 'neck_roll', 'head', 'z', -35, 35, label('Neck · roll', 'Pescoço · lateral', '首・左右傾斜'));
  box(neckRoll, [.19, .22, .175], shell, [0, .115, 0], undefined, .035);
  box(neckRoll, [.175, .095, .054], visor, [0, .125, .079], undefined, .018);
  box(neckRoll, [.125, .006, .009], accent, [0, .127, .11], undefined, .002);
  box(neckRoll, [.08, .025, .014], dark, [0, .038, .092], undefined, .006);
  for (const side of [-1, 1]) {
    cylinder(neckRoll, .04, .018, dark, [side * .099, .115, 0], 'x');
    cylinder(neckRoll, .024, .02, metal, [side * .108, .115, 0], 'x');
    cylinder(neckRoll, .008, .021, accent, [side * .113, .115, 0], 'x');
  }

  for (const side of [1, -1]) {
    const prefix = side === 1 ? 'left' : 'right';
    const nameEn = side === 1 ? 'Left' : 'Right';
    const namePt = side === 1 ? 'E' : 'D';
    const nameJa = side === 1 ? '左' : '右';
    const arm = `${prefix}_arm`, leg = `${prefix}_leg`, hand = `${prefix}_hand`;
    const named = (en, pt, ja) => label(`${nameEn} ${en}`, `${pt} · ${namePt}`, `${nameJa}${ja}`);
    const digits = [
      ['index', 'index', 'Indicador', '人差し指', .031, .034],
      ['middle', 'middle', 'Médio', '中指', .011, .038],
      ['ring', 'ring', 'Anelar', '薬指', -.011, .035],
      ['little', 'little', 'Mínimo', '小指', -.031, .028]
    ];
    const fingerBaseY = -.112, segmentScales = [1, .78, .65], flexionAxisSign = -1, tipInset = .001;
    const thumbBase = [-side * .049, -.048, -.003], thumbMountRoll = -side * .75;
    const thumbLengths = [.032, .025, .025], oppositionAxisSign = -1;
    const handDigits = Object.fromEntries(digits.map(([digit, , , , x, length], index) => [digit, {
      base: [-side * x, fingerBaseY, 0], lengths: segmentScales.map(scale => length * scale),
      landmarks: [5, 6, 7, 8].map(landmark => landmark + index * 4), axisSign: flexionAxisSign, tipInset
    }]));
    handDigits.thumb = { base: thumbBase, mountRoll: THREE.MathUtils.radToDeg(thumbMountRoll),
      lengths: thumbLengths, landmarks: [1, 2, 3, 4], axisSign: flexionAxisSign,
      opposition: true, oppositionAxisSign, tipInset };
    const shoulderPitch = joint(torsoRoll, `${prefix}_shoulder_pitch`, arm, 'x', -170, 90, named('shoulder · pitch', 'Ombro · inclinação', '肩・前後'), [side * .255, .35, 0]);
    // Retargeting uses the visible rig dimensions to preserve hand contact
    // across different human/robot proportions. Surface offsets describe the
    // rubber palm face and crown; palmOffset remains the rigid palm midplane.
    jointMap.get(`${prefix}_shoulder_pitch`).retarget = {
      upperArm: .29, forearm: .27, shoulder: [side * .255, .35, 0],
      head: [0, .57, 0], neck: [0, .455, 0], headWidth: .198, headDepth: .11, headTop: .11,
      palmOffset: [0, -.064, 0], palmLength: .112,
      palmSurface: [0, -.065, -.0275], palmHalfSize: [.031, .0335, .0035],
      palmBack: [0, -.062, .034], palmSides: [[-.046, -.064, 0], [.046, -.064, 0]], handDigits
    };
    const shoulderRoll = joint(shoulderPitch, `${prefix}_shoulder_roll`, arm, 'z', side > 0 ? -30 : -165, side > 0 ? 165 : 30, named('shoulder · roll', 'Ombro · lateral', '肩・左右'));
    actuator(shoulderRoll, .071, .095, `${prefix}_shoulder_roll`);
    const shoulderYaw = joint(shoulderRoll, `${prefix}_shoulder_yaw`, arm, 'y', -200, 200, named('shoulder · yaw', 'Ombro · rotação', '肩・旋回'));
    box(shoulderYaw, [.13, .14, .15], shell, [side * .013, -.035, -.005], undefined, .027);
    box(shoulderYaw, [.115, .215, .12], shell, [0, -.155, 0], undefined, .024);
    box(shoulderYaw, [.035, .15, .012], dark, [side * .035, -.16, .061], undefined, .004);
    box(shoulderYaw, [.006, .075, .008], accent, [side * .037, -.15, .07], undefined, .002);
    const elbow = joint(shoulderYaw, `${prefix}_elbow_pitch`, arm, 'x', -145, 0, named('elbow', 'Cotovelo', '肘'), [0, -.29, 0]);
    actuator(elbow, .052, .105, `${prefix}_elbow_pitch`);
    // A captured half-turn may start at either equivalent±180° orientation.
    // Allow that turn in either direction plus20° tracking margin, without
    // rebasing a recorded angle mid-movement. Working limits may narrow this.
    const forearm = joint(elbow, `${prefix}_forearm_yaw`, arm, 'y', -380, 380, named('forearm · rotation', 'Antebraço · rotação', '前腕・旋回'), [0, -.045, 0]);
    box(forearm, [.104, .21, .113], shell, [0, -.095, 0], undefined, .025);
    box(forearm, [.055, .125, .016], dark, [0, -.085, .06], undefined, .009);
    box(forearm, [.04, .024, .01], accent, [0, -.044, .072], undefined, .004);
    cylinder(forearm, .043, .022, metal, [0, -.2, 0], 'y');
    const wristPitch = joint(forearm, `${prefix}_wrist_pitch`, arm, 'x', -75, 75, named('wrist · pitch', 'Punho · inclinação', '手首・前後'), [0, -.225, 0]);
    const wristRoll = joint(wristPitch, `${prefix}_wrist_roll`, arm, 'z', -35, 35, named('wrist · roll', 'Punho · lateral', '手首・左右'));
    sphere(wristRoll, .036, rubber, [0, 0, 0]);
    box(wristRoll, [.092, .105, .042], dark, [0, -.064, 0], undefined, .011);
    // Prone hand: the palm faces -Z with the thumb toward the body's center.
    // When the arm points forward, the palm and closing fingers face down.
    // Reflecting Z (rather than rotating the whole hand) keeps each thumb on
    // its anatomical side. Public negative flexion angles remain compatible
    // with existing poses, captures and JSON trajectories.
    box(wristRoll, [.08, .073, .014], shell, [0, -.062, .027], undefined, .01).name = `${prefix}_hand_back`;
    box(wristRoll, [.04, .008, .006], accent, [0, -.05, .037], undefined, .002);
    box(wristRoll, [.062, .067, .007], rubber, [0, -.065, -.024], undefined, .006).name = `${prefix}_hand_palm`;
    for (const [digit, en, pt, ja, x, length] of digits) {
      let parent = wristRoll;
      for (let i = 1; i <= 3; i++) {
        const segmentLength = length * segmentScales[i - 1];
        const offset = i === 1 ? handDigits[digit].base : [0, -length * segmentScales[i - 2], 0];
        const finger = joint(parent, `${prefix}_${digit}_${i}`, hand, 'x', -95, 10, named(`${en} · ${i}`, `${pt} · ${i}`, `${ja}・${i}`), offset, flexionAxisSign);
        sphere(finger, .0105, metal, [0, 0, 0]);
        box(finger, [.017, segmentLength - 2 * tipInset, .021], i === 3 ? dark : shell, [0, -segmentLength / 2, 0], undefined, .004);
        parent = finger;
      }
    }
    const thumbMount = new THREE.Group();
    thumbMount.position.set(...thumbBase);
    thumbMount.rotation.z = thumbMountRoll;
    wristRoll.add(thumbMount);
    let thumbParent = joint(thumbMount, `${prefix}_thumb_opposition`, hand, 'y', -60, 60, named('thumb · opposition', 'Polegar · oposição', '親指・対立'), [0, 0, 0], oppositionAxisSign);
    for (let i = 1; i <= 3; i++) {
      const length = thumbLengths[i - 1];
      const thumb = joint(thumbParent, `${prefix}_thumb_${i}`, hand, 'x', -85, 10, named(`thumb · ${i}`, `Polegar · ${i}`, `親指・${i}`), i === 1 ? [0, 0, 0] : [0, -thumbLengths[i - 2], 0], flexionAxisSign);
      sphere(thumb, .012, metal, [0, 0, 0]);
      box(thumb, [.021, length - 2 * tipInset, .024], i === 3 ? dark : shell, [0, -length / 2, 0], undefined, .005);
      thumbParent = thumb;
    }

    const hipYaw = joint(pelvis, `${prefix}_hip_yaw`, leg, 'y', -65, 65, named('hip · yaw', 'Quadril · rotação', '股関節・旋回'), [side * .117, -.055, 0]);
    const hipRoll = joint(hipYaw, `${prefix}_hip_roll`, leg, 'z', -40, 40, named('hip · roll', 'Quadril · lateral', '股関節・左右'));
    const hipPitch = joint(hipRoll, `${prefix}_hip_pitch`, leg, 'x', -110, 45, named('hip · pitch', 'Quadril · inclinação', '股関節・前後'));
    actuator(hipPitch, .074, .14, `${prefix}_hip_pitch`);
    box(hipPitch, [.145, .315, .16], shell, [0, -.204, 0], undefined, .03);
    box(hipPitch, [.074, .23, .016], dark, [0, -.198, -.085], undefined, .008);
    box(hipPitch, [.013, .14, .011], accent, [side * .058, -.19, .079], undefined, .003);
    // Mechanical rails stay with their parent link, exposing the articulation gaps.
    cylinder(hipPitch, .013, .22, metal, [side * .077, -.215, -.025], 'y');
    const knee = joint(hipPitch, `${prefix}_knee_pitch`, leg, 'x', 0, 140, named('knee', 'Joelho', '膝'), [0, -.415, 0]);
    actuator(knee, .06, .148, `${prefix}_knee_pitch`);
    box(knee, [.115, .1, .047], shell, [0, -.005, .054], undefined, .019);
    box(knee, [.128, .305, .14], shell, [0, -.207, -.008], undefined, .025);
    box(knee, [.035, .21, .018], dark, [0, -.205, .066], undefined, .007);
    box(knee, [.007, .11, .009], accent, [0, -.17, .079], undefined, .002);
    cylinder(knee, .014, .235, metal, [side * .067, -.218, -.018], 'y');
    const anklePitch = joint(knee, `${prefix}_ankle_pitch`, leg, 'x', -45, 45, named('ankle · pitch', 'Tornozelo · inclinação', '足首・前後'), [0, -.415, 0]);
    const ankleRoll = joint(anklePitch, `${prefix}_ankle_roll`, leg, 'z', -30, 30, named('ankle · roll', 'Tornozelo · lateral', '足首・左右'));
    actuator(ankleRoll, .043, .105, `${prefix}_ankle_roll`);
    box(ankleRoll, [.147, .065, .265], rubber, [0, -.0875, .0525], undefined, .014);
    box(ankleRoll, [.142, .065, .235], shell, [0, -.047, .05], undefined, .018);
    box(ankleRoll, [.095, .025, .07], dark, [0, -.018, .112], undefined, .008);
    box(ankleRoll, [.075, .008, .009], accent, [0, -.058, .174], undefined, .002);
  }

  // Serializable collision geometry uses the same frames and primitive sizes
  // as the visible rig. The tapered chest keeps its convex boundary, rather
  // than filling the empty space beside the waist with a large bounding box.
  root.updateMatrixWorld(true);
  const frameByNode = new Map(joints.map(info => [info.node, info]));
  const parentFrame = node => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (frameByNode.has(parent)) return frameByNode.get(parent);
    }
    return null;
  };
  const relativeTransform = (node, parent) => {
    const matrix = parent ? parent.node.matrixWorld.clone().invert().multiply(node.matrixWorld) : node.matrixWorld;
    const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
    matrix.decompose(position, quaternion, scale);
    return { position: position.toArray(), quaternion: quaternion.toArray() };
  };
  const convexShape = geometry => {
    geometry.computeBoundingBox();
    const center = geometry.boundingBox.getCenter(new THREE.Vector3()), positions = geometry.getAttribute('position'), indices = geometry.index;
    const vertices = new Map(), planes = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      a.fromBufferAttribute(positions, i);
      vertices.set(a.toArray().map(value => Math.round(value * 1e7)).join(','), a.toArray());
    }
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      a.fromBufferAttribute(positions, indices ? indices.getX(i) : i);
      b.fromBufferAttribute(positions, indices ? indices.getX(i + 1) : i + 1);
      c.fromBufferAttribute(positions, indices ? indices.getX(i + 2) : i + 2);
      const normal = b.sub(a).cross(c.sub(a));
      if (normal.lengthSq() < 1e-16) continue;
      normal.normalize();let constant = -normal.dot(a);
      if (normal.dot(center) + constant > 0) { normal.negate();constant = -constant; }
      const key = [...normal.toArray(), constant].map(value => Math.round(value * 1e6)).join(',');
      planes.set(key, { normal: normal.toArray(), constant });
    }
    return { type: 'convex', vertices: [...vertices.values()], planes: [...planes.values()] };
  };
  const collision = { version: 1, neutral: { left_shoulder_roll: 8, right_shoulder_roll: -8 }, frames: joints.map(info => {
    const parent = parentFrame(info.node);
    return { id: info.id, parent: parent?.id ?? null, ...relativeTransform(info.node, parent), axis: info.axis, axisSign: info.axisSign };
  }), obstacles: [], parts: [] };
  const colliderCounts = new Map();
  root.traverse(object => {
    if (!object.isMesh || object === selection) return;
    const frame = parentFrame(object), group = frame?.group, id = frame?.id;
    let role, collection;
    if (!frame) {
      let ancestor = object.parent;while (ancestor && ancestor !== pelvis) ancestor = ancestor.parent;
      if (ancestor !== pelvis) return;
      role = 'pelvis';collection = collision.obstacles;
    } else if (group === 'torso' || group === 'head') {
      if (object.material === accent) return;
      const primitive = object.geometry.userData.collisionShape;
      if (primitive?.type === 'roundedBox' && Math.min(...primitive.halfSize) < .005) return;
      role = group === 'head' ? (id === 'neck_roll' ? 'head' : 'neck') : id === 'torso_yaw' ? 'waist' : 'torso';
      collection = collision.obstacles;
    } else if (group?.endsWith('_leg')) {
      // A corrected hand must not escape the trunk by entering a thigh or a
      // raised leg. Keep the actual leg armor, joints and rails; omit accents.
      if (object.material === accent) return;
      const primitive = object.geometry.userData.collisionShape;
      if (primitive?.type === 'roundedBox' && Math.min(...primitive.halfSize) < .005) return;
      role = 'leg';collection = collision.obstacles;
    } else if (group?.endsWith('_arm')) {
      // The shoulder socket overlaps its mounting plate by design. Protect
      // the free upper-arm link, elbow, forearm and hand beyond that mount.
      // The upper-link attachment exception applies only against the torso;
      // its full volume remains protected against the head and neck.
      if (id.endsWith('_shoulder_pitch') || id.endsWith('_shoulder_roll')) return;
      if (id.endsWith('_shoulder_yaw')) {
        if (object.material !== shell || object.position.y > -.1) return;
        role = 'upperArm';
      } else if (id.endsWith('_elbow_pitch')) role = 'elbow';
      else if (id.endsWith('_forearm_yaw')) role = 'forearm';
      else if (id.endsWith('_wrist_roll')) role = object.geometry.userData.collisionShape?.type === 'sphere' ? 'wrist' : 'palm';
      else return;
      collection = collision.parts;
    } else if (group?.endsWith('_hand')) {
      role = 'finger';collection = collision.parts;
    } else return;
    const key = id ?? 'pelvis', count = colliderCounts.get(key) ?? 0;
    colliderCounts.set(key, count + 1);
    const colliderId = `${key}:${count}`, transform = relativeTransform(object, frame);
    const shape = object.geometry.userData.collisionShape ?? convexShape(object.geometry);
    object.userData.collisionId = colliderId;
    collection.push({ id: colliderId, frame: id ?? null, center: transform.position, quaternion: transform.quaternion, shape,
      role, ...(role === 'upperArm' ? { clip: { axis: 'y', max: -.11, space: 'frame', obstacleRoles: ['torso'] } } : {}),
      ...(collection === collision.parts ? { side: id.startsWith('left_') ? 'left' : 'right' } : {}) });
  });
  jointMap.get('torso_yaw').collision = collision;

  function setJoint(id, degrees) {
    const j = jointMap.get(id);
    if (!j || !Number.isFinite(degrees)) return null;
    const value = THREE.MathUtils.clamp(degrees, j.min, j.max);
    j.node.rotation[j.axis] = THREE.MathUtils.degToRad(value) * j.axisSign;
    return value;
  }
  function setColors(colors = {}) {
    if (colors.shell) shell.color.set(colors.shell);
    if (colors.dark) dark.color.set(colors.dark);
    if (colors.accent) {
      accent.color.set(colors.accent);
      accent.emissive.set(colors.accent);
      selectMaterial.color.set(colors.accent);
    }
  }
  function setSelected(id) {
    const j = jointMap.get(id);
    selection.removeFromParent();
    selection.visible = !!j;
    if (!j) return;
    j.node.add(selection);
    selection.position.set(0, 0, 0);
    selection.rotation.set(0, 0, 0);
    if (j.axis === 'x') selection.rotation.y = Math.PI / 2;
    if (j.axis === 'y') selection.rotation.x = Math.PI / 2;
    selection.scale.setScalar(j.group.includes('hand') ? .28 : j.group === 'torso' ? 1.9 : 1);
  }
  function setHelpers(visible) { helpers.forEach(h => { h.visible = !!visible; }); }
  return { root, joints, setColors, setJoint, setSelected, setHelpers };
}
