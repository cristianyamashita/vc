// Serve the repository root, then run: node scripts/tests/vision_photo_lab.mjs
// Requires Chrome and Playwright. Fixtures, runtime and real models are local.
// All requests outside the tested host are blocked, including on a fresh cache.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = (process.env.VC_URL || "http://127.0.0.1:8777").replace(/\/$/, "");
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
const errors = [];
const modelRequests = [];
page.on("request", (request) => {
  if (new URL(request.url()).pathname.endsWith(".task"))
    modelRequests.push(request.url());
});
let clipboardSnapshot;
page.on("pageerror", (e) => errors.push(e.message));
const dir = await mkdtemp(path.join(tmpdir(), "vision-photo-"));
const externalRequests = [];
await page.context().route("**/*", (route) => {
  const url = new URL(route.request().url());
  if (
    ["http:", "https:"].includes(url.protocol) &&
    url.origin !== new URL(base).origin
  ) {
    externalRequests.push(url.href);
    return route.abort();
  }
  return route.continue();
});
const sample = (name) =>
  readFile(new URL(`./fixtures/vision-photo-lab/${name}.jpg`, import.meta.url));
const upload = async (buffer) => {
  await page
    .locator("#file")
    .setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer });
  await page.waitForFunction(
    () => !document.querySelector("#analyze").disabled,
  );
};
const analyze = async () => {
  await page.locator("#analyze").click();
  await page.waitForFunction(
    () => !document.querySelector("#analyze").disabled,
    null,
    { timeout: 120000 },
  );
  assert.equal(await page.locator("#status").innerText(), "Analysis complete.");
};
const download = async (id) => {
  const pending = page.waitForEvent("download");
  await page.locator(id).click();
  const file = await pending;
  const destination = path.join(dir, file.suggestedFilename());
  await file.saveAs(destination);
  return readFile(destination);
};
const json = async () =>
  JSON.parse((await download("#export-json")).toString());
try {
  const [pose, face, hands] = await Promise.all(
    ["pose", "portrait", "right_hands"].map(sample),
  );
  await page.goto(`${base}/page/misc/vision_photo_lab.html`);
  for (const lang of ["en", "pt", "ja"]) {
    await page.locator("#lang-switcher").selectOption(lang);
    assert.equal(await page.locator("html").getAttribute("lang"), lang);
    assert(
      await page.evaluate(
        () =>
          document.body.scrollWidth === innerWidth &&
          document.body.scrollHeight === innerHeight,
      ),
    );
    await page.keyboard.press("?");
    assert(await page.locator("#help").evaluate((d) => d.open));
    await page.keyboard.press("Escape");
  }
  await page.locator("#lang-switcher").selectOption("en");
  await page.locator("#theme-switcher").click();
  const theme = await page.locator("html").getAttribute("data-theme");
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
  await page.locator("#detection-mode").selectOption("faces");
  for (const [lang, action, limit] of [
    ["en", "Find faces", "Maximum faces"],
    ["pt", "Buscar rostos", "Máximo de rostos"],
    ["ja", "顔を検出", "最大の顔数"],
  ]) {
    await page.locator("#lang-switcher").selectOption(lang);
    assert.equal(await page.locator("#analyze").innerText(), action);
    assert.equal(await page.locator("#limit-label").innerText(), limit);
  }
  await page.locator("#lang-switcher").selectOption("en");
  const headshot = await page.evaluate(async (b64) => {
    const image = new Image();
    image.src = "data:image/jpeg;base64," + b64;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * 0.4);
    canvas.height = Math.round(image.height * 0.37);
    canvas
      .getContext("2d")
      .drawImage(
        image,
        image.width * 0.28,
        image.height * 0.02,
        image.width * 0.4,
        image.height * 0.37,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    return canvas.toDataURL("image/jpeg").split(",")[1];
  }, face.toString("base64"));
  await upload(Buffer.from(headshot, "base64"));
  await analyze();
  const faceOnly = await json();
  assert.equal(faceOnly.analysisMode, "faces");
  assert.equal(
    faceOnly.faces.length,
    1,
    "face-only photo works without a detected body",
  );
  assert.equal(faceOnly.faces[0].landmarks.length, 478);
  assert.equal(faceOnly.faces[0].blendshapes.length, 52);
  assert.deepEqual(faceOnly.bodies, []);
  assert.deepEqual(faceOnly.hands, []);
  assert.equal(await page.locator("#body-count").innerText(), "—");
  assert.equal(await page.locator("#hand-count").innerText(), "—");
  assert(!("pose" in faceOnly.models) && !("hand" in faceOnly.models));
  assert(modelRequests.some((url) => url.includes("face_landmarker.task")));
  assert(
    modelRequests.every((url) => url.includes("face_landmarker.task")),
    "face-only mode loads no pose or hand model",
  );
  await page.reload();
  assert.equal(
    await page.locator("#detection-mode").inputValue(),
    "faces",
    "analysis mode preference persists",
  );
  assert.equal(await page.locator("#analyze").innerText(), "Find faces");
  assert.equal(
    await page.locator("#expressions-tab").getAttribute("aria-selected"),
    "true",
  );
  await page.locator("#detection-mode").selectOption("all");
  // Drop a real image onto the toolbar: the whole page accepts file drops.
  const dropped = await page.evaluateHandle((b64) => {
    const transfer = new DataTransfer();
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    transfer.items.add(
      new File([bytes], "dropped-pose.jpg", { type: "image/jpeg" }),
    );
    return transfer;
  }, pose.toString("base64"));
  await page
    .locator(".topbar")
    .dispatchEvent("drop", { dataTransfer: dropped });
  await dropped.dispose();
  await page.waitForFunction(
    () => !document.querySelector("#analyze").disabled,
  );
  assert.match(
    await page.locator("#file-info").innerText(),
    /dropped-pose.jpg/,
  );
  await analyze();
  let data = await json();
  assert.equal(data.analysisMode, "all");
  assert.equal(data.bodies.length, 1);
  assert.equal(data.bodies[0].landmarks.length, 33);
  assert.equal(data.region, null);
  await upload(face);
  assert(
    await page.locator("#export-json").isDisabled(),
    "new image clears previous detections",
  );
  await analyze();
  data = await json();
  assert.equal(data.faces.length, 1);
  assert.equal(data.faces[0].landmarks.length, 478);
  assert.equal(data.faces[0].blendshapes.length, 52);
  assert(
    data.faces[0].blendshapes.every(
      (s) => Number.isFinite(s.score) && s.score >= 0 && s.score <= 1,
    ),
  );
  assert(
    data.faces[0].blendshapes.find((s) => s.categoryName === "mouthSmileLeft")
      .score > 0.5,
    "real smiling photo activates smile movement",
  );
  assert.equal(data.faces[0].analysisPass, "refined");
  assert(data.faces[0].refinement.region.width < 1);
  assert.equal(
    await page.locator("#expressions-tab").getAttribute("aria-selected"),
    "true",
  );
  assert.equal(await page.locator("#expression-list .expression").count(), 8);
  await page.locator("#all-expressions").check();
  assert.equal(await page.locator("#expression-list .expression").count(), 52);
  assert(
    await page
      .locator('#expression-list [data-signal="mouthSmileLeft"]')
      .innerText()
      .then((s) => s.includes("Smile")),
  );
  await page.locator("#lang-switcher").selectOption("pt");
  assert(
    await page
      .locator('#expression-list [data-signal="mouthSmileLeft"]')
      .innerText()
      .then((s) => s.includes("Sorriso")),
  );
  await page.locator("#lang-switcher").selectOption("ja");
  assert(
    await page
      .locator('#expression-list [data-signal="mouthSmileLeft"]')
      .innerText()
      .then((s) => s.includes("笑顔")),
  );
  await page.locator("#lang-switcher").selectOption("en");
  await page.locator("#all-expressions").uncheck();
  const png = await download("#export-png");
  assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), data.source.width);
  assert.equal(png.readUInt32BE(20), data.source.height);
  // Small faces missed by one full-image pass are recovered and refined individually.
  const groupPhoto = await page.evaluate(async (b64) => {
    const image = new Image();
    image.src = "data:image/jpeg;base64," + b64;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1100;
    const c = canvas.getContext("2d");
    c.fillStyle = "#ccc";
    c.fillRect(0, 0, 1600, 1100);
    for (const x of [100, 900])
      c.drawImage(image, x, 100, (600 * image.width) / image.height, 600);
    const lib =
      await import("../assets/mediapipe/tasks-vision/0.10.14/vision_bundle.mjs");
    const files = await lib.FilesetResolver.forVisionTasks(
      "../assets/mediapipe/tasks-vision/0.10.14/wasm",
    );
    const raw = await lib.FaceLandmarker.createFromOptions(files, {
      baseOptions: {
        modelAssetPath:
          "../assets/mediapipe/models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numFaces: 4,
    });
    let baseline;
    try {
      baseline = raw.detect(canvas).faceLandmarks.length;
    } finally {
      raw.close();
    }
    return { baseline, image: canvas.toDataURL("image/jpeg").split(",")[1] };
  }, face.toString("base64"));
  await upload(Buffer.from(groupPhoto.image, "base64"));
  await analyze();
  data = await json();
  assert.equal(
    data.faces.length,
    2,
    "small faces in a group are recovered without duplicates",
  );
  assert(
    groupPhoto.baseline < data.faces.length,
    "recovers faces missed by the previous single-pass approach",
  );
  assert(
    data.faces.every(
      (face) =>
        face.blendshapes.length === 52 && face.analysisPass === "refined",
    ),
  );
  assert.equal(await page.locator("#face-index option").count(), 2);
  await page.locator("#face-index").selectOption("1");
  await page.locator("#focus-face").click();
  await page.waitForFunction(
    () =>
      Number(document.querySelector("#zoom").value) > 100 &&
      document.querySelector("#viewport").scrollLeft > 0,
  );
  await page.locator("#zoom").fill("100");
  await page.waitForFunction(
    () =>
      document.querySelector("#canvas").getBoundingClientRect().width <=
      document.querySelector("#viewport").clientWidth,
  );
  await page.locator("#select-area").click();
  const groupBounds = await page.locator("#canvas").boundingBox();
  await page.mouse.move(
    groupBounds.x + groupBounds.width * 0.5,
    groupBounds.y + 1,
  );
  await page.mouse.down();
  await page.mouse.move(
    groupBounds.x + groupBounds.width - 1,
    groupBounds.y + groupBounds.height - 1,
    { steps: 8 },
  );
  await page.mouse.up();
  await analyze();
  data = await json();
  assert.equal(
    data.faces.length,
    1,
    "analyzing a selected area excludes the other face",
  );
  assert(
    data.faces[0].landmarks.every((p) => p.x >= 0.5),
    "refined face coordinates stay aligned with the original photo",
  );
  assert(data.faces[0].refinement.region.x >= 0.5);
  // Exercise a real OS clipboard image and the native paste keyboard shortcut.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  clipboardSnapshot = await page.evaluate(async () =>
    Promise.all(
      (await navigator.clipboard.read()).map((item) =>
        Promise.all(
          item.types.map(async (type) => [
            type,
            Array.from(
              new Uint8Array(await (await item.getType(type)).arrayBuffer()),
            ),
          ]),
        ),
      ),
    ),
  );
  await page.evaluate(async (b64) => {
    const image = new Image();
    image.src = "data:image/jpeg;base64," + b64;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext("2d").drawImage(image, 0, 0);
    const png = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
  }, hands.toString("base64"));
  await page.locator("#zoom").focus();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+V" : "Control+V",
  );
  await page.waitForFunction(() =>
    document.querySelector("#file-info").textContent.includes("720 × 382"),
  );
  assert(
    await page.locator("#export-json").isDisabled(),
    "pasting clears previous detections",
  );
  assert(
    await page.locator("#face-details").isHidden(),
    "pasting clears expression results too",
  );
  await analyze();
  data = await json();
  assert.equal(data.hands.length, 2);
  assert.equal(
    data.faces.length,
    0,
    "hand-only photo does not produce facial expressions",
  );
  assert(await page.locator("#face-details").isHidden());
  assert(data.hands.every((h) => h.landmarks.length === 21));
  // Two copies of a real person exercise multi-pose detection and crop mapping.
  const composite = await page.evaluate(async (b64) => {
    const image = new Image();
    image.src = "data:image/jpeg;base64," + b64;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width * 2;
    canvas.height = image.height;
    const c = canvas.getContext("2d");
    c.drawImage(image, 0, 0);
    c.drawImage(image, image.width, 0);
    return canvas.toDataURL("image/jpeg").split(",")[1];
  }, pose.toString("base64"));
  await upload(Buffer.from(composite, "base64"));
  await analyze();
  data = await json();
  assert.equal(data.bodies.length, 2, "detects two people");
  await page.locator("#select-area").click();
  const bounds = await page.locator("#canvas").boundingBox();
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + 1);
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width - 1,
    bounds.y + bounds.height - 1,
    { steps: 8 },
  );
  await page.mouse.up();
  await analyze();
  data = await json();
  assert.equal(data.bodies.length, 1);
  assert(Math.abs(data.region.x - 0.5) < 0.005);
  assert(
    data.bodies[0].landmarks.every((p) => p.x >= 0.5),
    "crop landmarks map to original image",
  );
  assert(
    data.bodies[0].landmarks.every(
      (p) => Math.abs(p.pixelX - p.x * data.source.width) < 0.001,
    ),
  );
  await page.locator("#layers-tab").click();
  await page.locator("#layer-photo").uncheck();
  await page.locator("#zoom").fill("400");
  await page.waitForFunction(
    () =>
      document.querySelector("#canvas").getBoundingClientRect().width >
      document.querySelector("#viewport").clientWidth,
  );
  const viewport = await page.locator("#viewport").boundingBox();
  await page.mouse.move(viewport.x + 160, viewport.y + 100);
  await page.mouse.down();
  await page.mouse.move(viewport.x + 80, viewport.y + 60, { steps: 8 });
  await page.mouse.up();
  assert(
    await page.locator("#viewport").evaluate((v) => v.scrollLeft > 0),
    "dragging an enlarged photo pans it",
  );
  assert(
    await page.evaluate(
      () =>
        document.body.scrollWidth === innerWidth &&
        document.body.scrollHeight === innerHeight,
    ),
  );
  await page.locator("#zoom").fill("100");
  for (const width of [900, 720, 390, 360]) {
    await page.setViewportSize({ width, height: 640 });
    assert(
      await page.evaluate(
        () =>
          document.body.scrollWidth === innerWidth &&
          document.body.scrollHeight === innerHeight,
      ),
      `no body overflow at ${width}px`,
    );
    assert(await page.locator("#analyze").isVisible());
  }
  await page.reload();
  assert.equal(
    await page.locator("#layer-photo").isChecked(),
    false,
    "layer preferences persist",
  );
  assert(
    await page.locator("#analyze").isDisabled(),
    "photos are not persisted",
  );
  await page.locator("#file").setInputFiles({
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("invalid image"),
  });
  await page.waitForFunction(() =>
    document.querySelector("#status").classList.contains("error"),
  );
  assert(await page.locator("#analyze").isDisabled());
  await page.route("**/assets/mediapipe/tasks-vision/0.10.14/**", (route) =>
    route.abort(),
  );
  await upload(pose);
  await page.locator("#analyze").click();
  await page.waitForFunction(() =>
    document.querySelector("#status").classList.contains("error"),
  );
  assert(
    await page.locator("#analyze").isEnabled(),
    "failed model download permits retry",
  );
  assert(
    await page.locator("#export-json").isDisabled(),
    "failed analysis has no stale result",
  );
  assert.deepEqual(
    externalRequests,
    [],
    "photo analysis makes no external requests",
  );
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS: zero external requests with a fresh cache; local real body/face/hand models, face-only mode without body/hand downloads, 52 facial movement signals, refined small/group faces and area coordinates, file drop, native clipboard paste, drag to pan, multiple people, crop coordinates, PNG/JSON, languages, help, preferences, responsive layout and invalid uploads.",
  );
} finally {
  if (clipboardSnapshot !== undefined) {
    await page
      .evaluate(async (snapshot) => {
        await navigator.clipboard.write(
          snapshot.map(
            (item) =>
              new ClipboardItem(
                Object.fromEntries(
                  item.map(([type, bytes]) => [
                    type,
                    new Blob([new Uint8Array(bytes)], { type }),
                  ]),
                ),
              ),
          ),
        );
      }, clipboardSnapshot)
      .catch(() => {});
  }
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}
