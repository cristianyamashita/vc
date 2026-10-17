// Room finishes: a thin slab over the floor inside the room's net polygon
// when the room overrides the floor texture or colour, and a thin tinted
// slab under the ceiling when it has a ceiling colour. Both are picked as
// the room. Coordinates are building-local; the document is centimetres.
import * as THREE from "three";
import { surfaceMaterial } from "../materials.js";
import { M } from "../scene.js";

const SKIN = 0.6; // cm

/** Group with the overlays of one room, or null when it has none. */
export function buildRoomFinish(face, room, storey, { floorY, ceilingY }) {
  const wantFloor = !!(room.floorMaterial || room.floorTint);
  const wantCeiling = !!room.ceilingTint;
  if (!wantFloor && !wantCeiling) return null;
  const group = new THREE.Group();
  group.userData = { kind: "roomGroup", id: room.id, storeyId: storey.id };
  const shape = new THREE.Shape(face.net.map(([x, z]) => new THREE.Vector2(x * M, z * M)));
  for (const hole of face.holes || []) shape.holes.push(new THREE.Path(hole.polygon.map(([x, z]) => new THREE.Vector2(x * M, z * M))));
  const slab = (y, material, ceiling = false) => {
    // extrude along +z, then lay flat: shape y → world z, depth → world −y
    const geo = new THREE.ExtrudeGeometry(shape, { depth: SKIN * M, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, y * M, 0);
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    mesh.userData = { kind: "room", id: room.id, storeyId: storey.id, ceiling };
    group.add(mesh);
  };
  if (wantFloor) slab(floorY + SKIN, surfaceMaterial({ material: room.floorMaterial, tint: room.floorTint, offset: 3 }));
  if (wantCeiling) slab(ceilingY, surfaceMaterial({ tint: room.ceilingTint, offset: 3 }), true);
  return group;
}
