// Share links (gzip + base64url in the URL hash) and GLB export.
import { exportProject } from "./store.js";

const b64 = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

async function gzip(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}
/** URL of the current page carrying the whole project (and its custom props). */
export async function shareLink(project, customProps) {
  const bytes = await gzip(exportProject(project, customProps));
  const url = new URL(location.href);
  url.hash = `share=${b64(bytes)}`;
  return url.href;
}
/** Project JSON text from a share hash, or null. */
export async function readShareHash(hash = location.hash) {
  const m = /[#&]share=([A-Za-z0-9_-]+)/.exec(hash || "");
  if (!m) return null;
  try {
    return await gunzip(unb64(m[1]));
  } catch {
    return null;
  }
}
/** Export the visible world as a binary glTF. Materials are flattened to
 *  plain standard materials (the triplanar shader has no exportable map). */
export async function exportGLB(world, filename) {
  const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
  const { MeshStandardMaterial, Group } = await import("three");
  const copy = new Group();
  world.updateMatrixWorld(true);
  world.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.visible || o.material?.visible === false) return;
    let visible = true;
    for (let p = o; p; p = p.parent) if (!p.visible) visible = false;
    if (!visible) return;
    const m = o.material;
    const mesh = o.clone(false);
    mesh.material = new MeshStandardMaterial({
      color: m.color ? m.color.clone() : 0xffffff,
      vertexColors: !!m.vertexColors,
      transparent: !!m.transparent,
      opacity: m.opacity ?? 1,
      roughness: m.roughness ?? 0.9,
      metalness: m.metalness ?? 0,
    });
    mesh.matrix.copy(o.matrixWorld);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.matrixAutoUpdate = true;
    copy.add(mesh);
  });
  const exporter = new GLTFExporter();
  const buffer = await Promise.race([
    exporter.parseAsync(copy, { binary: true }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 30000)),
  ]);
  const blob = new Blob([buffer], { type: "model/gltf-binary" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return blob.size;
}
