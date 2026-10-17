// Night lighting. With project.sun.night the sky goes dark, the sun becomes
// a moon (js/sun.js) and every light source comes on: placed lamps (catalog
// objects with a `light` descriptor or of the "lighting" category) and the
// standalone light points of storeys and the site. Three.js lights come
// from fixed pools (points, spots, each with a few shadow casters) handed
// every frame to the sources nearest the camera, so the shader never
// recompiles while orbiting. Shadow-casting lights are blocked by walls and
// pass through glass, so a lamp indoors lights the garden through the
// window. Window panes get an emissive material so the house glows from
// inside, and pools with `lights` get cyan lights under the water.
import * as THREE from "three";
import { propGlow } from "./props.js";
import { waterMaterial } from "./materials.js";
import { polygonOutline, polygonLevels } from "./build/outdoor.js";
import { insetPolygon, polygonBounds, pointInPolygon } from "./geom.js";
import { M } from "./scene.js";

export const MAX_LIGHTS = 24;
const POINTS = 20, POINT_SHADOWS = 4, SPOTS = 6, SPOT_SHADOWS = 2;
const LAMP_COLOR = "#ffc37a", LAMP_RANGE = 260, LAMP_INTENSITY = 1.7, DEG = Math.PI / 180;
const POOL_COLOR = 0x5fd0ff, POOL_RANGE = 4.5, POOL_INTENSITY = 4;

const glowMaterial = new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffc97a, emissiveIntensity: 1.6, roughness: 0.6 });
glowMaterial.userData.shared = true;
const nightGlass = new THREE.MeshPhysicalMaterial({ color: 0xffe3a6, emissive: 0xffc46a, emissiveIntensity: 0.45, transparent: true, opacity: 0.5, roughness: 0.3, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
nightGlass.userData.shared = true;
const litWater = new THREE.MeshPhysicalMaterial({ color: "#2d9cc4", emissive: 0x1e8fc4, emissiveIntensity: 0.55, transparent: true, opacity: 0.7, roughness: 0.08, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
litWater.userData.shared = true;

/** Effective light of a placed lamp: the prop's descriptor with the placement's overrides. */
export function lampLight(o, doc) {
  const d = doc?.light || {};
  return {
    color: o.lightColor || d.color || LAMP_COLOR,
    intensity: (d.intensity ?? LAMP_INTENSITY) * (o.lightIntensity ?? 1),
    range: o.lightRange ?? (d.distance ? d.distance * 100 : LAMP_RANGE),
    at: Array.isArray(d.at) ? d.at : null,
    shadows: !!o.lightShadows,
  };
}

export class Night {
  constructor(app) {
    this.app = app;
    this.on = false;
    this.group = new THREE.Group();
    this.group.name = "nightLights";
    app.scene.scene.add(this.group);
    this.points = []; // PointLights (first POINT_SHADOWS cast shadows)
    this.spots = []; // SpotLights (first SPOT_SHADOWS cast shadows)
    this.lamps = []; // sources: {group, local, color, intensity, range, type, angle, shadows}
    this.poolLights = new THREE.Group();
    this.group.add(this.poolLights);
    this.tmp = new THREE.Vector3();
  }
  /** Is a placed object a light source? */
  isLamp(o, doc = o.inline || this.app.propDoc(o.prop)) {
    return !!doc && (!!doc.light || doc.category === "lighting");
  }
  /** Emissive bulb mesh for a lamp's group, added by app.makeObjectGroup. */
  glowMesh(doc) {
    const glow = propGlow(doc);
    if (!glow) return null;
    const mesh = new THREE.Mesh(glow.geo, glowMaterial);
    mesh.userData = { glow: true, sharedGeometry: true, centre: glow.centre.clone() };
    mesh.visible = false;
    mesh.raycast = () => {};
    return mesh;
  }
  ensurePools() {
    if (this.points.length) return;
    for (let i = 0; i < POINTS; i++) {
      const l = new THREE.PointLight(LAMP_COLOR, 0, 2.6, 1.5);
      if (i < POINT_SHADOWS) {
        l.castShadow = true;
        l.shadow.mapSize.set(512, 512);
        l.shadow.bias = -0.002;
        l.shadow.camera.near = 0.05;
      }
      this.group.add(l);
      this.points.push(l);
    }
    for (let i = 0; i < SPOTS; i++) {
      const l = new THREE.SpotLight(LAMP_COLOR, 0, 4, 0.5, 0.45, 1.5);
      if (i < SPOT_SHADOWS) {
        l.castShadow = true;
        l.shadow.mapSize.set(1024, 1024);
        l.shadow.bias = -0.001;
        l.shadow.camera.near = 0.05;
      }
      this.group.add(l);
      this.group.add(l.target);
      this.spots.push(l);
    }
  }
  /** Sync everything with the project (after any rebuild or light change). */
  update() {
    const app = this.app;
    this.on = !!app.project.sun.night;
    app.scene.setNight(this.on);
    this.lamps = [];
    const visit = (o) => {
      const g = app.objectGroups.get(o.id);
      if (!g) return;
      const doc = o.inline || app.propDoc(o.prop);
      const lamp = this.isLamp(o, doc);
      const glow = g.children.find((c) => c.userData.glow);
      const lit = this.on && lamp && o.lightOn !== false && (o.lightIntensity ?? 1) > 0;
      if (glow) glow.visible = lit;
      if (!lit) return;
      const L = lampLight(o, doc);
      const local = L.at ? new THREE.Vector3(...L.at) : glow ? glow.userData.centre.clone() : propGlow(doc)?.centre?.clone() || new THREE.Vector3(0, 1, 0);
      this.lamps.push({ group: g, local, color: L.color, intensity: L.intensity * 3, range: L.range * M, type: "point", angle: 60, shadows: L.shadows, dist: 0 });
    };
    app.project.objects.forEach(visit);
    for (const b of app.project.buildings) for (const s of b.storeys) s.objects.forEach(visit);
    const visitPoint = (p) => {
      const g = app.lightMarkers?.get(p.id);
      if (!g || !this.on || p.on === false || p.intensity <= 0) return;
      this.lamps.push({ group: g, local: new THREE.Vector3(0, 0, 0), color: p.color, intensity: p.intensity * 3 * (p.type === "spot" ? 1.5 : 1), range: p.range * M, type: p.type, angle: p.angle, shadows: !!p.shadows, dist: 0 });
    };
    app.project.lights?.forEach(visitPoint);
    for (const b of app.project.buildings) for (const s of b.storeys) s.lights?.forEach(visitPoint);
    if (this.on && this.lamps.length) this.ensurePools();
    for (const l of [...this.points, ...this.spots]) l.visible = false;
    this.updateGlass();
    this.updatePools();
    this.frame(true);
    app.scene.requestRender();
  }
  /** Hand the pooled lights to the sources nearest the camera (every rendered frame). */
  frame(force = false) {
    if (!this.points.length || !this.lamps.length) return;
    const cam = this.app.scene.camera;
    for (const lamp of this.lamps) {
      lamp.group.updateMatrixWorld();
      lamp.world = lamp.group.localToWorld(lamp.local.clone());
      lamp.dist = lamp.world.distanceToSquared(cam.position);
      lamp.visible = lamp.group.visible && lamp.group.parent?.visible !== false;
    }
    const sorted = [...this.lamps].filter((l) => l.visible).sort((a, b) => a.dist - b.dist);
    const assign = (list, pool, shadowCount) => {
      const withShadow = list.filter((l) => l.shadows).slice(0, shadowCount);
      const rest = list.filter((l) => !withShadow.includes(l));
      const order = [...withShadow, ...rest];
      for (let i = 0; i < pool.length; i++) {
        const light = pool[i];
        const idx = i < shadowCount ? i : shadowCount + (i - shadowCount);
        const lamp = i < shadowCount ? withShadow[i] : rest[i - shadowCount];
        if (!lamp) {
          light.visible = false;
          continue;
        }
        light.visible = true;
        light.position.copy(lamp.world);
        light.color.set(lamp.color);
        light.intensity = lamp.intensity;
        light.distance = Math.max(0.5, lamp.range);
        if (light.isSpotLight) {
          light.angle = Math.max(5, Math.min(120, lamp.angle)) * DEG * 0.5;
          light.target.position.copy(lamp.world).add(new THREE.Vector3(0, -1, 0));
          light.target.updateMatrixWorld();
        }
        void idx;
      }
      void order;
    };
    assign(sorted.filter((l) => l.type !== "spot"), this.points, POINT_SHADOWS);
    assign(sorted.filter((l) => l.type === "spot"), this.spots, SPOT_SHADOWS);
    void force;
  }
  /** Window panes glow from inside at night. */
  updateGlass() {
    for (const g of this.app.buildingGroups.values())
      g.traverse((o) => {
        if (!o.isMesh || o.userData.kind !== "glass") return;
        if (this.on) {
          if (!o.userData.dayMaterial) o.userData.dayMaterial = o.material;
          o.material = nightGlass;
        } else if (o.userData.dayMaterial) {
          o.material = o.userData.dayMaterial;
          o.userData.dayMaterial = null;
        }
      });
  }
  /** Underwater lights in pools that asked for them. */
  updatePools() {
    for (const l of [...this.poolLights.children]) {
      this.poolLights.remove(l);
      l.dispose();
    }
    const app = this.app;
    app.siteGroup?.traverse((o) => {
      if (!o.isMesh || !o.userData.water) return;
      const poly = app.project.outdoor.find((d) => d.id === o.userData.id);
      const lit = this.on && poly?.type === "pool" && poly.lights;
      o.material = lit ? litWater : waterMaterial(o.userData.tint);
    });
    if (!this.on) return;
    for (const poly of app.project.outdoor) {
      if (poly.type !== "pool" || !poly.lights) continue;
      const pts = polygonOutline(poly);
      const inner = insetPolygon(pts, 40) || pts;
      const levels = polygonLevels(poly, "outdoor", app.terrain);
      if (!levels || inner.length < 3) continue;
      const b = polygonBounds(inner);
      const alongX = b.maxX - b.minX >= b.maxZ - b.minZ;
      const n = Math.max(1, Math.min(4, Math.round((alongX ? b.maxX - b.minX : b.maxZ - b.minZ) / 300)));
      const y = levels.top - 12 - 40;
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        const x = alongX ? b.minX + (b.maxX - b.minX) * f : (b.minX + b.maxX) / 2;
        const z = alongX ? (b.minZ + b.maxZ) / 2 : b.minZ + (b.maxZ - b.minZ) * f;
        if (!pointInPolygon(x, z, inner)) continue;
        const l = new THREE.PointLight(POOL_COLOR, POOL_INTENSITY, POOL_RANGE, 2);
        l.position.set(x * M, y * M, z * M);
        this.poolLights.add(l);
      }
    }
  }
}
