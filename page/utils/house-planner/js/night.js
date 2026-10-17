// Night lighting. With project.sun.night the sky goes dark, the sun becomes
// a moon (js/sun.js) and the placed objects of the catalog category
// "lighting" become light sources: a warm point light at the bulb (a pool of
// at most MAX_LIGHTS, handed each frame to the lamps nearest the camera, so
// the shader never recompiles while orbiting) plus an emissive copy of the
// bulb parts. Window panes get an emissive material so the house glows from
// inside, and pools with `lights` get cyan lights under the water.
import * as THREE from "three";
import { propGlow } from "./props.js";
import { waterMaterial } from "./materials.js";
import { polygonOutline, polygonLevels } from "./build/outdoor.js";
import { insetPolygon, polygonBounds, pointInPolygon } from "./geom.js";
import { M } from "./scene.js";

export const MAX_LIGHTS = 24;
const LAMP_COLOR = 0xffc37a, LAMP_RANGE = 2.6, LAMP_INTENSITY = 5;
const POOL_COLOR = 0x5fd0ff, POOL_RANGE = 4.5, POOL_INTENSITY = 4;

const glowMaterial = new THREE.MeshStandardMaterial({ color: 0xfff1cc, emissive: 0xffc97a, emissiveIntensity: 1.6, roughness: 0.6 });
glowMaterial.userData.shared = true;
const nightGlass = new THREE.MeshPhysicalMaterial({ color: 0xffe3a6, emissive: 0xffc46a, emissiveIntensity: 0.9, transparent: true, opacity: 0.85, roughness: 0.3, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
nightGlass.userData.shared = true;
const litWater = new THREE.MeshPhysicalMaterial({ color: "#2d9cc4", emissive: 0x1e8fc4, emissiveIntensity: 0.55, transparent: true, opacity: 0.7, roughness: 0.08, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
litWater.userData.shared = true;

export class Night {
  constructor(app) {
    this.app = app;
    this.on = false;
    this.group = new THREE.Group();
    this.group.name = "nightLights";
    app.scene.scene.add(this.group);
    this.pool = []; // PointLights handed to the nearest lamps
    this.lamps = []; // {group, local: Vector3, intensity}
    this.poolLights = new THREE.Group();
    this.group.add(this.poolLights);
    this.tmp = new THREE.Vector3();
  }
  /** Is a placed object a light source (catalog category "lighting")? */
  isLamp(o, doc = o.inline || this.app.propDoc(o.prop)) {
    return !!doc && doc.category === "lighting";
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
      const lit = this.on && lamp && o.lightOn !== false && o.lightIntensity > 0;
      if (glow) glow.visible = lit;
      if (!lit) return;
      const local = glow ? glow.userData.centre.clone() : propGlow(doc)?.centre?.clone() || new THREE.Vector3(0, 1, 0);
      this.lamps.push({ group: g, local, intensity: LAMP_INTENSITY * o.lightIntensity, dist: 0 });
    };
    app.project.objects.forEach(visit);
    for (const b of app.project.buildings) for (const s of b.storeys) s.objects.forEach(visit);
    this.resizePool(Math.min(MAX_LIGHTS, this.lamps.length));
    this.updateGlass();
    this.updatePools();
    this.frame(true);
    app.scene.requestRender();
  }
  resizePool(n) {
    while (this.pool.length > n) {
      const l = this.pool.pop();
      this.group.remove(l);
      l.dispose();
    }
    while (this.pool.length < n) {
      const l = new THREE.PointLight(LAMP_COLOR, LAMP_INTENSITY, LAMP_RANGE, 2);
      l.castShadow = false;
      this.group.add(l);
      this.pool.push(l);
    }
  }
  /** Hand the pooled lights to the lamps nearest the camera (every rendered frame). */
  frame(force = false) {
    if (!this.pool.length) return;
    const cam = this.app.scene.camera;
    for (const lamp of this.lamps) {
      lamp.group.updateMatrixWorld();
      lamp.world = lamp.group.localToWorld(lamp.local.clone());
      lamp.dist = lamp.world.distanceToSquared(cam.position);
    }
    if (this.lamps.length > this.pool.length) this.lamps.sort((a, b) => a.dist - b.dist);
    for (let i = 0; i < this.pool.length; i++) {
      const lamp = this.lamps[i], light = this.pool[i];
      if (!lamp) continue;
      light.position.copy(lamp.world);
      light.intensity = lamp.intensity;
      light.visible = lamp.group.visible && lamp.group.parent?.visible !== false;
    }
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
