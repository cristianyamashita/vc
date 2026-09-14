export function createWorld(T, container) {
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(53, 1, 0.05, 330);
  camera.position.set(0, 1.85, 5);
  camera.lookAt(0, 2, -30);
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.append(renderer.domElement);
  const world = new T.Group(),
    targetsRoot = new T.Group(),
    effects = new T.Group();
  scene.add(world, targetsRoot, effects);
  const hemi = new T.HemisphereLight(0xe7f2d7, 0x344033, 2.2);
  scene.add(hemi);
  const sun = new T.DirectionalLight(0xffe9b8, 3.1);
  sun.position.set(-22, 35, -12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -35;
  sun.shadow.camera.right = 35;
  sun.shadow.camera.top = 25;
  sun.shadow.camera.bottom = -80;
  sun.shadow.camera.far = 170;
  sun.shadow.bias = -0.0006;
  scene.add(sun, sun.target);
  sun.target.position.set(0, 0, -30);
  const gunScene = new T.Scene(),
    gunCamera = new T.PerspectiveCamera(48, 1, 0.01, 10),
    gun = new T.Group();
  gunScene.add(gun);
  gunScene.add(new T.HemisphereLight(0xeaf4dc, 0x374539, 3));
  const gl = new T.DirectionalLight(0xffe4b5, 3);
  gl.position.set(-3, 4, 1);
  gunScene.add(gl);
  gunScene.add(new T.AmbientLight(0xd6e2ce, 1.2));
  gun.scale.setScalar(0.67);
  let targets = [],
    particles = [],
    tracers = [],
    trees = [],
    flags = [],
    env = "forest",
    seed = 310,
    gunType = "revolver",
    nockedArrow = null,
    bowString = null,
    sightBlend = 0;
  const flying = new Set();
  const forward = new T.Vector3(0, 0, 1);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const mat = (color, more = {}) =>
    new T.MeshStandardMaterial({ color, roughness: 0.85, ...more });
  function mesh(parent, geo, material, x = 0, y = 0, z = 0) {
    const m = new T.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(p, w, h, d, m, x = 0, y = 0, z = 0) {
    return mesh(p, new T.BoxGeometry(w, h, d), m, x, y, z);
  }
  function cyl(p, r1, r2, h, m, x = 0, y = 0, z = 0, n = 12) {
    return mesh(p, new T.CylinderGeometry(r1, r2, h, n), m, x, y, z);
  }
  function clear(group) {
    group.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          m.map?.dispose();
          m.dispose();
        }
      }
    });
    group.clear();
  }
  function texture(draw, w = 512, h = 512) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const tx = new T.CanvasTexture(c);
    tx.colorSpace = T.SRGBColorSpace;
    tx.anisotropy = 4;
    return tx;
  }
  function label(parent, text, w, h, x, y, z, bg = "#263a2a", fg = "#e0e9b9") {
    const tx = texture(
      (ctx, cw, ch) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = fg;
        ctx.font = "600 150px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, cw / 2, ch / 2);
      },
      512,
      256,
    );
    return mesh(
      parent,
      new T.PlaneGeometry(w, h),
      new T.MeshStandardMaterial({ map: tx, roughness: 0.9 }),
      x,
      y,
      z,
    );
  }
  function tree(x, z, scale = 1) {
    const g = new T.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    world.add(g);
    cyl(g, 0.12, 0.26, 6, mat(0x675644), 0, 3, 0, 7);
    const colors = [0x294e37, 0x345a3c, 0x416447];
    for (let j = 0; j < 5; j++) {
      const cone = mesh(
        g,
        new T.ConeGeometry(2.05 - j * 0.29, 3.4, 9),
        mat(colors[j % 3]),
        0,
        3 + j * 1.12,
        0,
      );
      cone.rotation.y = rand() * 6;
    }
    for (let j = 0; j < 10; j++) {
      const a = j * 2.4,
        y = 2.6 + (j % 4) * 0.85;
      const twig = mesh(
        g,
        new T.ConeGeometry(0.5, 0.95, 5),
        mat(colors[j % 3]),
        Math.cos(a) * (1.2 - (j % 4) * 0.18),
        y,
        Math.sin(a) * (1.2 - (j % 4) * 0.18),
      );
      twig.rotation.z = Math.sin(a) * 0.42;
      twig.rotation.x = Math.cos(a) * 0.42;
    }
    trees.push(g);
  }
  function fence(x) {
    const wood = mat(0x716f51);
    for (let z = 6; z > -102; z -= 5) {
      box(world, 0.16, 1.2, 0.16, wood, x, 0.6, z);
      box(world, 0.09, 0.12, 5, wood, x, 0.55, z - 2.5);
      box(world, 0.09, 0.12, 5, wood, x, 1, z - 2.5);
    }
  }
  // Bake stationary, untextured scenery into one draw call; trees retain their
  // individual face normals and colors without thousands of scene submissions.
  function batchScenery() {
    world.updateMatrixWorld(true);
    const items = [];
    world.traverse((o) => {
      if (
        o.isMesh &&
        !o.isInstancedMesh &&
        o.material?.isMeshStandardMaterial &&
        !o.material.map &&
        !o.material.transparent &&
        o.material.emissive.getHex() === 0 &&
        !flags.includes(o)
      )
        items.push(o);
    });
    const positions = [],
      normals = [],
      colors = [];
    for (const o of items) {
      const g = (
        o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
      ).applyMatrix4(o.matrixWorld);
      const p = g.getAttribute("position"),
        n = g.getAttribute("normal"),
        c = o.material.color;
      for (let i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(n.getX(i), n.getY(i), n.getZ(i));
        colors.push(c.r, c.g, c.b);
      }
      g.dispose();
      o.geometry.dispose();
      o.material.dispose();
      o.removeFromParent();
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    mesh(world, geometry, mat(0xffffff, { vertexColors: true }));
  }
  function buildEnvironment(type) {
    env = type;
    clear(world);
    trees = [];
    flags = [];
    seed = 310;
    const indoor = env === "indoor";
    scene.background = new T.Color(
      indoor ? 0x283431 : env === "field" ? 0xbdc9ba : 0x97b3a2,
    );
    scene.fog = new T.FogExp2(
      indoor ? 0x283431 : env === "field" ? 0xbdc9ba : 0x97b3a2,
      indoor ? 0.009 : env === "field" ? 0.0035 : 0.006,
    );
    hemi.intensity = indoor ? 1.1 : 2.2;
    sun.intensity = indoor ? 0.6 : 3.1;
    sun.color.set(indoor ? 0xd3efe2 : 0xffe9b8);
    const groundTx = texture(
      (c, w, h) => {
        c.fillStyle = indoor
          ? "#56605a"
          : type === "field"
            ? "#707548"
            : "#455e3d";
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 18000; i++) {
          const v = rand();
          c.fillStyle = v > 0.5 ? "#b4b89520" : "#192d2928";
          c.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 6);
        }
      },
      256,
      256,
    );
    groundTx.wrapS = groundTx.wrapT = T.RepeatWrapping;
    groundTx.repeat.set(65, 90);
    const ground = mesh(
      world,
      new T.PlaneGeometry(280, 350),
      mat(0xffffff, { map: groundTx }),
      0,
      -0.08,
      -65,
    );
    ground.rotation.x = -Math.PI / 2;
    const pathTx = texture(
      (c, w, h) => {
        c.fillStyle = indoor ? "#69736b" : "#a19873";
        c.fillRect(0, 0, w, h);
        for (let i = 0; i < 8500; i++) {
          c.fillStyle = rand() > 0.5 ? "#f1e5bd20" : "#4b533225";
          const x = rand() * w,
            y = rand() * h;
          c.fillRect(x, y, rand() * 2 + 1, rand() * 3 + 1);
        }
      },
      256,
      256,
    );
    pathTx.wrapS = pathTx.wrapT = T.RepeatWrapping;
    pathTx.repeat.set(3, 30);
    const path = mat(0xffffff, { map: pathTx });
    box(world, 11, 0.04, 110, path, 0, -0.035, -48);
    if (indoor) {
      const wall = mat(0x43534d),
        beam = mat(0x202e2a),
        pale = mat(0xc0c9b4),
        light = mat(0xe5ffdb, { emissive: 0xc9efc2, emissiveIntensity: 3 });
      box(world, 1, 8, 118, wall, -10, 4, -49);
      box(world, 1, 8, 118, wall, 10, 4, -49);
      box(world, 21, 0.3, 118, mat(0x293a34), 0, 8, -49);
      box(world, 21, 8, 0.6, wall, 0, 4, -106);
      for (let z = 6; z > -105; z -= 9) {
        box(world, 0.35, 8, 0.4, beam, -9.5, 4, z);
        box(world, 0.35, 8, 0.4, beam, 9.5, 4, z);
        box(world, 20, 0.35, 0.4, beam, 0, 7.6, z);
        box(world, 7, 0.04, 0.24, light, 0, 7.39, z);
        for (const x of [-9.42, 9.42]) {
          box(world, 0.1, 2.5, 5, pale, x, 2.6, z - 4);
          for (let k = 0; k < 8; k++)
            box(world, 0.15, 0.07, 5, wall, x, 1.5 + k * 0.3, z - 4);
        }
      }
      for (const z of [-5, -35, -65, -95]) {
        const l = new T.PointLight(0xd8ffe0, 75, 25, 2);
        l.position.set(0, 6, z);
        world.add(l);
      }
      for (const x of [-6, -2, 2, 6]) {
        box(world, 0.055, 0.01, 110, mat(0xbabe85), x, 0.01, -48);
        box(world, 0.12, 2.1, 3.4, beam, x, 1.05, 3.6);
        box(world, 3.7, 0.15, 0.9, mat(0x77775b), x + 2, 1, 2.1);
        label(
          world,
          String((x + 10) / 4).padStart(2, "0"),
          1.4,
          0.6,
          x + 2,
          3.6,
          -1,
        );
      }
    } else {
      const skyMaterial = new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new T.Color(env === "field" ? 0x8aaeb6 : 0x86ada8) },
          bottom: { value: new T.Color(env === "field" ? 0xe1d6ae : 0xc5d4b8) },
        },
        vertexShader:
          "varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader:
          "uniform vec3 top;uniform vec3 bottom;varying vec3 vPos;void main(){float h=clamp(normalize(vPos).y*1.8,0.0,1.0);gl_FragColor=vec4(mix(bottom,top,h),1.0);}",
      });
      mesh(
        world,
        new T.SphereGeometry(300, 24, 16),
        skyMaterial,
        0,
        0,
        5,
      ).castShadow = false;
      fence(-8.8);
      fence(8.8);
      for (let i = 0; i < (env === "forest" ? 85 : 19); i++) {
        const side = i % 2 ? 1 : -1;
        tree(side * (11 + rand() * 55), 8 - rand() * 155, 0.8 + rand() * 1.3);
      }
      for (let i = 0; i < 14; i++) {
        const m = mesh(
          world,
          new T.ConeGeometry(24 + rand() * 28, 25 + rand() * 30, 6),
          mat([0x748d76, 0x809780, 0x668572][i % 3]),
          -145 + i * 23,
          10,
          -180 - rand() * 40,
        );
        m.rotation.y = rand() * 3;
      }
      const rockGeo = new T.DodecahedronGeometry(1, 0),
        rockMat = mat(0x78806a);
      for (let i = 0; i < 55; i++) {
        const m = mesh(
          world,
          rockGeo,
          rockMat,
          (i % 2 ? 1 : -1) * (7 + rand() * 36),
          0.2,
          -rand() * 115,
        );
        m.scale.set(0.25 + rand(), 0.2 + rand() * 0.5, 0.3 + rand());
        m.rotation.set(rand(), rand() * 6, rand());
      }
      // Instanced blades keep a richly planted scene inexpensive to render.
      const grass = new T.InstancedMesh(
        new T.ConeGeometry(0.045, 0.48, 3),
        mat(env === "field" ? 0x8c9651 : 0x69814e),
        2200,
      );
      const dummy = new T.Object3D();
      for (let i = 0; i < 2200; i++) {
        dummy.position.set(
          (i % 2 ? 1 : -1) * (5.8 + rand() * 36),
          0.15,
          10 - rand() * 130,
        );
        dummy.rotation.set(0, rand() * 6, (rand() - 0.5) * 0.6);
        dummy.scale.setScalar(0.5 + rand());
        dummy.updateMatrix();
        grass.setMatrixAt(i, dummy.matrix);
      }
      world.add(grass);
      // A timber shelter, stacked logs and equipment crates flank the lanes.
      const wood = mat(0x74614a),
        dark = mat(0x39443a),
        roof = mat(0x354b42);
      for (const x of [-13, -20])
        for (const z of [-5, -17]) box(world, 0.25, 4, 0.25, wood, x, 2, z);
      box(world, 8, 0.2, 13, roof, -16.5, 4.1, -11);
      for (let z = -5; z > -17; z -= 0.65)
        box(world, 0.2, 2.2, 0.5, wood, -20, 1.1, z);
      box(world, 5, 0.18, 1.5, wood, -16.5, 1.2, -9);
      for (let i = 0; i < 6; i++) {
        const m = cyl(
          world,
          0.26,
          0.26,
          3,
          wood,
          -11 + (i % 3) * 0.53,
          0.3 + Math.floor(i / 3) * 0.48,
          -19,
        );
        m.rotation.x = Math.PI / 2;
      }
      for (let i = 0; i < 5; i++) {
        const x = 10 + (i % 2) * 1.1,
          z = -2 - Math.floor(i / 2) * 1.5;
        box(world, 1, 0.75, 1.1, dark, x, 0.38, z);
        for (const xx of [-0.4, 0.4])
          box(world, 0.05, 0.8, 1.12, wood, x + xx, 0.4, z);
      }
      for (const z of [-8, -26, -48, -74]) {
        cyl(world, 0.04, 0.04, 3.8, mat(0x6c7770), 7.7, 1.9, z);
        const flag = mesh(
          world,
          new T.PlaneGeometry(0.95, 0.35, 8, 1),
          new T.MeshStandardMaterial({ color: 0xdbe3a0, side: T.DoubleSide }),
          8.15,
          3.4,
          z,
        );
        flag.userData.base = Float32Array.from(
          flag.geometry.attributes.position.array,
        );
        flags.push(flag);
      }
      box(world, 22, 0.15, 2.8, wood, 0, -0.04, 5.6);
      for (let x = -10; x <= 10; x += 0.48)
        box(world, 0.018, 0.012, 2.8, dark, x, 0.045, 5.6);
    }
    for (let d = 10; d <= 90; d += 10) {
      label(world, `${d} m`, 0.9, 0.4, -6.2, 0.45, 5 - d);
      box(world, 0.06, 0.7, 0.06, mat(0x4e5942), -6.2, 0.12, 4.98 - d);
      box(
        world,
        10,
        0.015,
        0.045,
        mat(indoor ? 0xb6c789 : 0xcebc8c),
        0,
        0.005,
        5 - d,
      );
    }
    // Earth / ballistic backstop, safely beyond every playable distance.
    box(world, 18, 4, 2, mat(indoor ? 0x232f2b : 0x5c6946), 0, 1.9, -95);
    batchScenery();
  }
  function paperTexture(photo) {
    return texture((c, w, h) => {
      c.fillStyle = "#e9e5d1";
      c.fillRect(0, 0, w, h);
      if (photo) {
        const size = Math.min(photo.width, photo.height);
        c.drawImage(
          photo,
          (photo.width - size) / 2,
          (photo.height - size) / 2,
          size,
          size,
          24,
          24,
          w - 48,
          h - 48,
        );
      }
      c.save();
      c.translate(w / 2, h / 2);
      for (let r = 210; r >= 30; r -= 30) {
        c.beginPath();
        c.arc(0, 0, r, 0, Math.PI * 2);
        if (!photo) {
          c.fillStyle = r <= 90 ? "#263b33" : "#dfddc7";
          c.fill();
        }
        c.strokeStyle = r <= 90 ? "#e2e4c6" : "#536450";
        c.lineWidth = 3;
        c.stroke();
      }
      c.fillStyle = "#d6a85b";
      c.beginPath();
      c.arc(0, 0, 16, 0, 7);
      c.fill();
      c.restore();
      c.fillStyle = "#50614e";
      c.font = "14px monospace";
      c.fillText("RANGE / CLUB", 24, 490);
    });
  }
  function buildTargets(config, photos = []) {
    clear(targetsRoot);
    targets = [];
    const wood = mat(0x6e6450),
      metal = mat(0x5d6a61, { metalness: 0.6, roughness: 0.35 });
    for (let i = 0; i < 5; i++) {
      const group = new T.Group();
      const x = (i - 2) * 2.9,
        z = 5 - config.distance;
      group.position.set(x, 0, z);
      targetsRoot.add(group);
      const photo = photos.length ? photos[i % photos.length] : null;
      let hitMeshes = [];
      if (config.target === "paper") {
        box(group, 0.095, 3, 0.095, wood, -0.7, 1.5, -0.1);
        box(group, 0.095, 3, 0.095, wood, 0.7, 1.5, -0.1);
        box(group, 1.65, 1.95, 0.1, wood, 0, 2, -0.06);
        const face = mesh(
          group,
          new T.PlaneGeometry(1.5, 1.8),
          photo
            ? new T.MeshBasicMaterial({
                map: paperTexture(photo),
                toneMapped: false,
              })
            : new T.MeshStandardMaterial({
                map: paperTexture(),
                roughness: 1,
              }),
          0,
          2,
          0.001,
        );
        hitMeshes = [face];
        for (const sx of [-0.65, 0.65])
          box(group, 0.085, 0.13, 0.025, metal, sx, 2.85, 0.025);
      } else {
        box(group, 2, 0.16, 1, wood, 0, 0.95, -0.2);
        for (const sx of [-0.8, 0.8])
          box(group, 0.1, 0.9, 0.1, wood, sx, 0.45, -0.2);
        if (config.target === "can") {
          const body = cyl(
            group,
            0.31,
            0.31,
            0.8,
            mat([0xc5a765, 0xa6b79b, 0xc37758, 0x859d8b, 0xcfb977][i]),
            0,
            1.44,
            0,
            24,
          );
          hitMeshes.push(body);
          for (const y of [1.06, 1.83])
            hitMeshes.push(cyl(group, 0.32, 0.32, 0.035, metal, 0, y, 0, 24));
          const sticker = photo
            ? texture((c, w, h) => {
                c.drawImage(photo, 0, 0, w, h);
              })
            : paperTexture();
          const labelMesh = mesh(
            group,
            new T.PlaneGeometry(0.5, 0.54),
            photo
              ? new T.MeshBasicMaterial({ map: sticker, toneMapped: false })
              : mat(0xffffff, { map: sticker }),
            0,
            1.44,
            0.316,
          );
          hitMeshes.push(labelMesh);
        } else {
          const glass = mat(
            [0x427c58, 0x81a995, 0x946f35, 0x486f69, 0x678253][i],
            {
              metalness: 0.15,
              roughness: 0.18,
              transparent: true,
              opacity: 0.82,
            },
          );
          hitMeshes.push(cyl(group, 0.25, 0.28, 0.83, glass, 0, 1.45, 0, 20));
          hitMeshes.push(cyl(group, 0.1, 0.25, 0.25, glass, 0, 1.99, 0, 20));
          hitMeshes.push(cyl(group, 0.095, 0.095, 0.28, glass, 0, 2.24, 0, 16));
          hitMeshes.push(cyl(group, 0.11, 0.11, 0.055, metal, 0, 2.39, 0));
          const band = cyl(
            group,
            0.254,
            0.261,
            0.28,
            mat(0xdfd4ab),
            0,
            1.5,
            0,
            24,
          );
          hitMeshes.push(band);
        }
      }
      label(
        group,
        String(i + 1).padStart(2, "0"),
        0.4,
        0.24,
        0,
        config.target === "paper" ? 3.15 : 0.72,
        0.07,
      );
      const target = {
        group,
        hitMeshes,
        type: config.target,
        baseX: x,
        baseZ: z,
        index: i,
        down: 0,
        holes: [],
        bodyParts: hitMeshes,
      };
      for (const m of hitMeshes) m.userData.target = target;
      targets.push(target);
    }
    scene.updateMatrixWorld(true);
  }
  function makeGun(type) {
    clear(gun);
    gunType = type;
    nockedArrow = null;
    bowString = null;
    sightBlend = 0;
    gun.scale.setScalar(type === "bow" ? 0.43 : 0.67);
    const steel = mat(0x84938d, { metalness: 0.25, roughness: 0.4 }),
      black = mat(0x35443e, { metalness: 0.15, roughness: 0.5 }),
      wood = mat(0x63412a, { roughness: 0.72 }),
      gold = mat(0xc7a364, { metalness: 0.7, roughness: 0.3 });
    if (type === "bow") {
      // Both limbs share one vertical plane. Recurve is depth, never sideways lean.
      const curve = new T.CatmullRomCurve3([
        new T.Vector3(0, -0.66, -0.18),
        new T.Vector3(0, -0.52, -0.28),
        new T.Vector3(0, -0.3, -0.1),
        new T.Vector3(0, 0, 0),
        new T.Vector3(0, 0.3, -0.1),
        new T.Vector3(0, 0.52, -0.28),
        new T.Vector3(0, 0.66, -0.18),
      ]);
      mesh(gun, new T.TubeGeometry(curve, 40, 0.025, 8, false), wood);
      box(gun, 0.075, 0.2, 0.065, black, 0, 0, 0);
      for (const y of [-0.56, 0.56])
        box(gun, 0.054, 0.04, 0.055, gold, 0, y, -0.27);
      const stringGeo = new T.BufferGeometry().setFromPoints([
        new T.Vector3(0, -0.66, -0.18),
        new T.Vector3(0, 0, 0.26),
        new T.Vector3(0, 0.66, -0.18),
      ]);
      bowString = new T.Line(
        stringGeo,
        new T.LineBasicMaterial({ color: 0xf4e1b5 }),
      );
      gun.add(bowString);
      nockedArrow = arrowModel();
      nockedArrow.rotation.y = Math.PI;
      nockedArrow.position.set(0.035, 0, -0.6);
      gun.add(nockedArrow);
    } else {
      const long = type === "rifle" || type === "shotgun";
      const grip = box(gun, 0.15, 0.29, 0.16, wood, 0, -0.16, 0.12);
      grip.rotation.x = -0.25;
      box(gun, 0.19, 0.15, long ? 0.62 : 0.38, black, 0, 0, -0.08);
      const barrel = cyl(
        gun,
        type === "shotgun" ? 0.048 : 0.031,
        type === "shotgun" ? 0.05 : 0.037,
        long ? 0.8 : 0.38,
        steel,
        0,
        0.045,
        long ? -0.63 : -0.35,
        20,
      );
      barrel.rotation.x = Math.PI / 2;
      const bore = cyl(
        gun,
        type === "shotgun" ? 0.034 : 0.023,
        type === "shotgun" ? 0.034 : 0.023,
        0.009,
        mat(0x070c0a),
        0,
        0.045,
        long ? -1.034 : -0.544,
        20,
      );
      bore.rotation.x = Math.PI / 2;
      if (type === "revolver") {
        const drum = cyl(gun, 0.105, 0.105, 0.19, steel, 0, 0.002, -0.1, 20);
        drum.rotation.x = Math.PI / 2;
        for (let j = 0; j < 6; j++) {
          const a = (j * Math.PI) / 3;
          const flute = cyl(
            gun,
            0.022,
            0.022,
            0.2,
            black,
            Math.cos(a) * 0.098,
            Math.sin(a) * 0.098,
            -0.1,
            10,
          );
          flute.rotation.x = Math.PI / 2;
        }
      }
      if (type === "pistol") {
        box(gun, 0.195, 0.11, 0.49, steel, 0, 0.1, -0.1);
        for (let i = 0; i < 6; i++)
          box(gun, 0.202, 0.004, 0.013, black, 0, 0.11, 0.02 + i * 0.019);
      }
      if (long) {
        box(gun, 0.14, 0.11, 0.37, wood, 0, -0.06, -0.52);
        box(gun, 0.16, 0.22, 0.48, wood, 0, -0.07, 0.38);
      }
      if (type === "shotgun")
        for (let i = 0; i < 8; i++)
          box(gun, 0.145, 0.008, 0.017, black, 0, -0.025, -0.39 - i * 0.032);
      if (type === "rifle") {
        const scope = mesh(
          gun,
          new T.CylinderGeometry(0.062, 0.062, 0.36, 32, 1, true),
          black,
          0,
          0.18,
          -0.18,
        );
        scope.rotation.x = Math.PI / 2;
        box(gun, 0.04, 0.1, 0.07, steel, 0, 0.11, -0.15);
        for (const z of [0, -0.36])
          mesh(
            gun,
            new T.TorusGeometry(0.059, 0.009, 8, 32),
            steel,
            0,
            0.18,
            z,
          );
      }
      // A real rear notch leaves the front post and target visible in ADS.
      box(gun, 0.019, 0.07, 0.025, black, 0, 0.115, long ? -0.98 : -0.46);
      box(gun, 0.009, 0.013, 0.027, gold, 0, 0.1435, long ? -0.98 : -0.46);
      box(gun, 0.1, 0.02, 0.03, steel, 0, 0.1, 0.08);
      for (const x of [-0.036, 0.036])
        box(gun, 0.024, 0.04, 0.03, black, x, 0.13, 0.08);
      const guard = mesh(
        gun,
        new T.TorusGeometry(0.075, 0.011, 7, 18),
        steel,
        0,
        -0.115,
        -0.065,
      );
      guard.rotation.y = Math.PI / 2;
      box(gun, 0.015, 0.075, 0.02, black, 0, -0.075, -0.09);
      // Stylized shooting gloves and sleeves.
      const glove = mat(0x414b33),
        sleeve = mat(0x69704b);
      const hand = mesh(
        gun,
        new T.SphereGeometry(0.11, 12, 10),
        glove,
        0.03,
        -0.19,
        0.14,
      );
      hand.scale.set(0.85, 1.1, 1.35);
      const arm = cyl(gun, 0.09, 0.14, 0.48, sleeve, 0.045, -0.31, 0.32);
      arm.rotation.x = -0.95;
      if (long) {
        const hand2 = mesh(
          gun,
          new T.SphereGeometry(0.1, 12, 10),
          glove,
          -0.02,
          -0.14,
          -0.48,
        );
        hand2.scale.set(1.1, 0.7, 1.5);
        const arm2 = cyl(gun, 0.085, 0.135, 0.65, sleeve, -0.14, -0.28, -0.16);
        arm2.rotation.x = 0.9;
        arm2.rotation.z = -0.4;
      }
    }
  }
  function hitEffect(target, point) {
    if (target.type === "paper") {
      const hole = mesh(
        target.group,
        new T.CircleGeometry(0.032, 9),
        new T.MeshBasicMaterial({ color: 0x17251a }),
        0,
        0,
        0,
      );
      hole.position.copy(target.group.worldToLocal(point.clone()));
      hole.position.z = 0.012;
      target.holes.push(hole);
      if (target.holes.length > 40) {
        const h = target.holes.shift();
        h.geometry.dispose();
        h.material.dispose();
        h.removeFromParent();
      }
    } else {
      target.down = 1.6;
      for (const m of target.bodyParts) m.visible = false;
    }
    const count = target.type === "bottle" ? 18 : 7;
    for (let i = 0; i < count; i++) {
      const m = mesh(
        effects,
        new T.BoxGeometry(0.045, 0.065, 0.025),
        mat(
          target.type === "bottle"
            ? 0x80b59a
            : target.type === "can"
              ? 0xd9b86c
              : 0xd7d3b6,
        ),
        point.x,
        point.y,
        point.z,
      );
      particles.push({
        m,
        v: new T.Vector3(
          (Math.random() - 0.5) * 3,
          Math.random() * 3,
          (Math.random() - 0.5) * 2,
        ),
        life: 0.8 + Math.random() * 0.5,
      });
    }
  }
  function arrowModel() {
    // The tip is the origin; +Z is flight direction, the shaft extends behind it.
    const arrow = new T.Group();
    const shaft = cyl(
      arrow,
      0.008,
      0.008,
      0.79,
      mat(0xd0ac60),
      0,
      0,
      -0.435,
      10,
    );
    shaft.rotation.x = Math.PI / 2;
    const tip = mesh(
      arrow,
      new T.ConeGeometry(0.022, 0.085, 4),
      mat(0xb6c6c9, { metalness: 0.4, roughness: 0.3 }),
      0,
      0,
      -0.0425,
    );
    tip.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const feather = box(
        arrow,
        0.012,
        0.062,
        0.14,
        mat(i === 0 ? 0xe7b755 : 0xf0ebcf),
        0,
        0,
        -0.73,
      );
      feather.rotation.z = (i * Math.PI * 2) / 3;
    }
    return arrow;
  }
  function launchOrigin() {
    gun.updateMatrixWorld(true);
    const local =
      gunType === "bow"
        ? new T.Vector3(0.035, 0, -0.6)
        : new T.Vector3(
            0,
            0.045,
            gunType === "rifle" || gunType === "shotgun" ? -1.04 : -0.55,
          );
    const muzzle = gun.localToWorld(local);
    // Map the first-person model camera into the world camera, including zoom.
    const depth = muzzle.length();
    const ndc = muzzle.clone().project(gunCamera);
    return ndc
      .unproject(camera)
      .sub(camera.position)
      .normalize()
      .multiplyScalar(depth)
      .add(camera.position);
  }
  function createProjectile(type, position, velocity) {
    const arrow = type === "bow";
    if (arrow && nockedArrow) nockedArrow.visible = false;
    const body = arrow ? arrowModel() : new T.Group();
    if (!arrow) {
      const bullet = mesh(
        body,
        new T.CapsuleGeometry(0.024, 0.1, 4, 8),
        new T.MeshBasicMaterial({ color: 0xffe6a2 }),
        0,
        0,
        -0.065,
      );
      bullet.rotation.x = Math.PI / 2;
    }
    const trail = new T.Line(
      new T.BufferGeometry(),
      new T.LineBasicMaterial({
        color: arrow ? 0xf0d69e : 0xffdf79,
        transparent: true,
        opacity: arrow ? 0.42 : 0.85,
        depthWrite: false,
      }),
    );
    const glowTexture = texture(
      (ctx, width, height) => {
        const gradient = ctx.createRadialGradient(
          width / 2,
          height / 2,
          0,
          width / 2,
          height / 2,
          width / 2,
        );
        gradient.addColorStop(0, "#fffbea");
        gradient.addColorStop(0.2, arrow ? "#e6d5a5bb" : "#ffd781dd");
        gradient.addColorStop(1, "#e8c06a00");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      },
      32,
      32,
    );
    const glow = new T.Sprite(
      new T.SpriteMaterial({
        map: glowTexture,
        transparent: true,
        opacity: arrow ? 0.38 : 0.9,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    effects.add(body, trail, glow);
    const visual = {
      body,
      trail,
      glow,
      arrow,
      points: [position.clone()],
      done: false,
    };
    flying.add(visual);
    updateProjectile(visual, position, velocity);
    return visual;
  }
  function updateProjectile(visual, position, velocity) {
    visual.body.position.copy(position);
    visual.body.quaternion.setFromUnitVectors(
      forward,
      velocity.clone().normalize(),
    );
    visual.glow.position.copy(position);
    const unitsPerPixel =
      (2 *
        position.distanceTo(camera.position) *
        Math.tan(T.MathUtils.degToRad(camera.fov / 2))) /
      Math.max(1, container.clientHeight);
    visual.glow.scale.setScalar(
      Math.max(
        visual.arrow ? 0.055 : 0.075,
        unitsPerPixel * (visual.arrow ? 7 : 10),
      ),
    );
    if (!visual.arrow)
      visual.body.scale.setScalar(Math.max(1, (unitsPerPixel * 1.8) / 0.024));
    visual.points.push(position.clone());
    if (visual.points.length > (visual.arrow ? 18 : 7)) visual.points.shift();
    visual.trail.geometry.dispose();
    visual.trail.geometry = new T.BufferGeometry().setFromPoints(visual.points);
  }
  function finishProjectile(visual, target = null) {
    if (visual.done) return;
    visual.done = true;
    flying.delete(visual);
    if (visual.arrow && target?.type === "paper") {
      // Keep the tip at the collision point, so the arrow is actually in the paper.
      target.group.attach(visual.body);
      target.embedded ??= [];
      target.embedded.push(visual.body);
      if (target.embedded.length > 16) {
        const oldest = target.embedded.shift();
        clear(oldest);
        oldest.removeFromParent();
      }
    } else {
      clear(visual.body);
      visual.body.removeFromParent();
    }
    visual.glow.material.map.dispose();
    visual.glow.material.dispose();
    visual.glow.removeFromParent();
    // A short fade makes even fast bullets readable, without slowing collisions.
    tracers.push({
      m: visual.trail,
      life: visual.arrow ? 0.24 : 0.14,
      duration: visual.arrow ? 0.24 : 0.14,
    });
  }
  function update(
    dt,
    time,
    config,
    aim,
    recoil,
    reload,
    zoom,
    active,
    wind,
    ammoReady = true,
  ) {
    const aiming = active && zoom && reload === 0;
    sightBlend = T.MathUtils.lerp(
      sightBlend,
      aiming ? 1 : 0,
      Math.min(1, dt * 16),
    );
    camera.fov = T.MathUtils.lerp(
      camera.fov,
      aiming ? (gunType === "rifle" ? 14 : 23) : 53,
      Math.min(1, dt * 12),
    );
    camera.updateProjectionMatrix();
    for (const target of targets) {
      if (target.down > 0) {
        target.down -= dt;
        if (target.down <= 0)
          for (const m of target.bodyParts) m.visible = true;
      }
      target.group.position.x =
        target.baseX +
        (config.moving
          ? Math.sin(
              time * (0.55 + config.distance / 150) + target.index * 1.7,
            ) * 0.8
          : 0);
    }
    for (const flag of flags) {
      const pos = flag.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = flag.userData.base[i * 3];
        pos.array[i * 3 + 2] =
          Math.sin(x * 6 - time * 5) * Math.abs(wind) * 0.025 * (x + 0.5);
      }
      pos.needsUpdate = true;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.v.y -= 9.8 * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += dt * 4;
      if (p.life <= 0) {
        p.m.geometry.dispose();
        p.m.material.dispose();
        p.m.removeFromParent();
        particles.splice(i, 1);
      }
    }
    for (let i = tracers.length - 1; i >= 0; i--) {
      const tr = tracers[i];
      tr.life -= dt;
      tr.m.material.opacity = Math.max(0, tr.life / tr.duration) * 0.65;
      if (tr.life <= 0) {
        tr.m.geometry.dispose();
        tr.m.material.dispose();
        tr.m.removeFromParent();
        tracers.splice(i, 1);
      }
    }
    gun.scale.setScalar(
      gunType === "bow"
        ? 0.43
        : 0.67 * T.MathUtils.clamp(gunCamera.aspect / 0.8, 0.65, 1),
    );
    gun.position.set(
      ((zoom ? 0.025 : 0.3) + aim.x * 0.2) * Math.min(1, gunCamera.aspect),
      -0.29 + aim.y * 0.13 - reload * 0.35,
      -0.83 + recoil * 0.1,
    );
    gun.rotation.set(
      aim.y * 0.15 + recoil * 0.2 - reload * 0.7,
      -aim.x * 0.22,
      reload * 0.5,
    );
    if (gunType === "bow") {
      gun.position.x = -0.19 * Math.min(1, gunCamera.aspect) + aim.x * 0.07;
      gun.position.y = -0.07 + aim.y * 0.1 - reload * 0.12;
      gun.rotation.set(aim.y * 0.1 + recoil * 0.025, -aim.x * 0.12, 0);
      if (nockedArrow) nockedArrow.visible = ammoReady && reload === 0;
      if (bowString) {
        const positions = bowString.geometry.attributes.position;
        positions.setZ(
          1,
          ammoReady && reload === 0
            ? 0.26
            : -0.18 + Math.sin(time * 65) * recoil * 0.12,
        );
        positions.needsUpdate = true;
      }
    } else if (sightBlend > 0.001) {
      const direction = new T.Vector3(aim.x, aim.y, 0.5)
        .unproject(gunCamera)
        .normalize();
      const rotation = new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 0, -1),
        direction,
      );
      const rearSight = new T.Vector3(
        0,
        gunType === "rifle" ? 0.18 : 0.15,
        0.08,
      )
        .multiplyScalar(gun.scale.x)
        .applyQuaternion(rotation);
      const position = direction.clone().multiplyScalar(0.5).sub(rearSight);
      gun.position.lerp(position, sightBlend);
      gun.quaternion.slerp(rotation, sightBlend);
      gun.rotateX(recoil * 0.09 * sightBlend);
    }
    scene.updateMatrixWorld(true);
    renderer.autoClear = true;
    renderer.render(scene, camera);
    if (
      (active || !matchMedia("(max-width:760px)").matches) &&
      !(gunType === "rifle" && aiming)
    ) {
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(gunScene, gunCamera);
    }
  }
  function resize() {
    const w = container.clientWidth,
      h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    gunCamera.aspect = w / h;
    gunCamera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  return {
    T,
    scene,
    camera,
    renderer,
    targets: () => targets,
    buildEnvironment,
    buildTargets,
    makeGun,
    hitEffect,
    launchOrigin,
    createProjectile,
    updateProjectile,
    finishProjectile,
    get visualState() {
      return {
        sightBlend,
        fov: camera.fov,
        bowRoll: gunType === "bow" ? gun.rotation.z : null,
        nockedArrow: !!nockedArrow?.visible,
        sights:
          gunType === "bow"
            ? null
            : [
                new T.Vector3(0, 0.15, 0.08),
                new T.Vector3(
                  0,
                  0.15,
                  gunType === "rifle" || gunType === "shotgun" ? -0.98 : -0.46,
                ),
              ].map((point) =>
                gun.localToWorld(point).project(gunCamera).toArray(),
              ),
        flying: [...flying].map((p) => ({
          arrow: p.arrow,
          position: p.body.position.toArray(),
          direction: forward
            .clone()
            .applyQuaternion(p.body.quaternion)
            .toArray(),
          trailPoints: p.points.length,
        })),
        embeddedArrows: targets.reduce(
          (count, target) => count + (target.embedded?.length || 0),
          0,
        ),
      };
    },
    update,
    resize,
    clearEffects() {
      clear(effects);
      flying.clear();
      particles = [];
      tracers = [];
    },
    dispose() {
      renderer.dispose();
      clear(world);
      clear(targetsRoot);
      clear(gun);
      clear(effects);
    },
  };
}
