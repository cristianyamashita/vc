#!/usr/bin/env node
// Renders a thumbnail of every House Planner template into
// page/assets/house-planner/templates/<id>.png, shown in Project › New from
// template. Opens the page headless with Playwright (Chromium), loads each
// template and captures the 3D view.
//
//   node scripts/build_house_thumbs.mjs [--only=id,id] [--three=<dir>] [--size=384x240]
//
// --three points at an unpacked three@0.164.1 npm package when the CDN is
// not reachable (its files are served in place of cdn.jsdelivr.net).
// Playwright is resolved from node_modules or from $PLAYWRIGHT_MODULE.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "page", "assets", "house-planner", "templates");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const [width, height] = (args.size || "384x240").split("x").map(Number);
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require(process.env.PLAYWRIGHT_MODULE || "playwright"); }
const { TEMPLATE_IDS } = await import(pathToFileURL(path.join(ROOT, "page", "utils", "house-planner", "js", "templates.js")));
const ids = args.only ? args.only.split(",") : TEMPLATE_IDS;

const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await playwright.chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.error("[page]", e.message));
if (args.three) {
  await page.route("https://cdn.jsdelivr.net/npm/three@0.164.1/**", (route) => {
    const file = path.join(args.three, new URL(route.request().url()).pathname.replace("/npm/three@0.164.1/", ""));
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
    route.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(file) });
  });
}
await page.addStyleTag({ content: ".topbar, .toolbar, .panel, #room-labels, #dims, #notes, #compass, #toast, #walk-hint, #measure { display: none !important; } .workspace { grid-template-columns: 1fr !important; }" }).catch(() => {});
await page.goto(`${base}/page/utils/house-planner/index.html`, { waitUntil: "load" });
await page.addStyleTag({ content: ".topbar, .toolbar, .panel, #room-labels, #dims, #notes, #compass, #toast, #walk-hint, #measure { display: none !important; } .workspace { grid-template-columns: 1fr !important; }" });
await page.waitForFunction(() => window.HousePlanner?.project && document.querySelector("#storey-select option"), null, { timeout: 60000 });
await page.waitForTimeout(1500);
fs.mkdirSync(OUT, { recursive: true });
for (const id of ids) {
  await page.evaluate(async (id) => {
    const app = window.HousePlanner;
    const { makeTemplate } = await import("./js/templates.js");
    app.setProject(makeTemplate(id, id), { fit: true });
    for (const b of app.project.buildings) b.roof.visible = true;
    app.applyVisibility();
    app.scene.grid.visible = false;
    app.scene.renderer.setPixelRatio(2);
    app.scene.resize();
    // frame the main building with some of the lot around it, not the whole terrain
    const THREE = await import("three");
    const box = new THREE.Box3().setFromObject(app.buildingGroup(app.project.buildings[0].id));
    const size = box.getSize(new THREE.Vector3());
    box.expandByVector(new THREE.Vector3(size.x * 0.3 + 4, 0, size.z * 0.3 + 4));
    app.scene.fit(box);
    const c = app.scene.controls, cam = app.scene.perspective;
    const d = cam.position.clone().sub(c.target);
    d.y *= 0.75;
    cam.position.copy(c.target).add(d);
    c.update();
    app.scene.requestRender();
  }, id);
  await page.waitForTimeout(1200);
  const file = path.join(OUT, `${id}.png`);
  await page.locator("#view").screenshot({ path: file });
  console.log(`${id} → ${path.relative(ROOT, file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
}
await browser.close();
server.close();
