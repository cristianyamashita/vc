// Serve repository root: VC_URL=http://127.0.0.1:8765 node scripts/tests/comic_studio_cut_editing.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = (process.env.VC_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
const context = await browser.newContext({
    viewport: { width: 960, height: 640 },
  }),
  page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const drag = async (a, b, cancel = false) => {
  const r = await page.locator("#sheet").boundingBox(),
    size = await page.evaluate(() => pageSize());
  await page.mouse.move(
    r.x + (a[0] * r.width) / size.w,
    r.y + (a[1] * r.height) / size.h,
  );
  await page.mouse.down();
  await page.mouse.move(
    r.x + (b[0] * r.width) / size.w,
    r.y + (b[1] * r.height) / size.h,
    { steps: 15 },
  );
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
};
const click = async (x, y) => {
  const r = await page.locator("#sheet").boundingBox(),
    size = await page.evaluate(() => pageSize());
  await page.mouse.click(
    r.x + (x * r.width) / size.w,
    r.y + (y * r.height) / size.h,
  );
};
const geometry = () =>
  page.evaluate(() => current().panels.map((p) => p.points));
const pixel = async (x, y) =>
  page.evaluate(
    async ([x, y]) => {
      const c = await exportCanvas(current());
      return [...c.getContext("2d").getImageData(x * 3, y * 3, 1, 1).data];
    },
    [x, y],
  );
const snapshot = () =>
  page.evaluate(() => ({
    panels: current().panels.map((p) => ({ id: p.id, image: p.image })),
    balloons: current().balloons,
  }));
try {
  await page.goto(`${base}/page/utils/comic-studio/index.html`);
  await page.waitForFunction(() => ready);
  await page.locator("#lang-switcher").selectOption("pt");
  await page.locator("#project-new").click();
  await page.locator("#name-input").fill("Cortes editáveis");
  await page.locator("#name-form button[type=submit]").click();
  await page.locator("#mode-cut").click();
  await drag([36, 450], [804, 450]);
  await drag([420, 36], [420, 450]);
  assert.equal(await page.evaluate(() => current().panels.length), 3);
  await page.evaluate(async () => {
    for (const [n, p] of current().panels.entries()) {
      const c = document.createElement("canvas");
      c.width = 600;
      c.height = 400;
      const x = c.getContext("2d");
      x.fillStyle = ["#ff4040", "#4080ff", "#40b050"][n];
      x.fillRect(0, 0, 600, 400);
      x.fillStyle = "#ffe080";
      x.fillRect(0, 100, 600, 20);
      x.fillRect(150, 0, 20, 400);
      await importImage(
        new File([await canvasBlob(c, "image/png")], "panel.png", {
          type: "image/png",
        }),
        current(),
        p,
      );
    }
  });
  await page.locator("#balloon-add").click();
  await page.locator("#balloon-text").fill("Os balões ficam no lugar.");
  await page.locator("#balloon-text").blur();
  const original = await snapshot(),
    originalPixels = await Promise.all(
      [
        [200, 300],
        [600, 300],
        [200, 850],
      ].map(([x, y]) => pixel(x, y)),
    );
  const firstId = await page.evaluate(() => current().id);
  // Legacy pages have only polygons; editing must work without a stored cut history.
  await page.evaluate(async () => {
    delete current().removedCuts;
    await persist();
  });
  await page.reload();
  await page.waitForFunction(
    () => ready && [...images.values()].filter((e) => e.image).length === 3,
  );
  await page.locator("#mode-cut").click();
  await page.locator("#cut-edit").click();
  await drag([200, 450], [200, 600]);
  let shape = await geometry();
  assert(shape[0].some((p) => Math.abs(p.y - 600) < 0.1));
  assert(
    shape[1].some(
      (p) => Math.abs(p.x - 420) < 0.1 && Math.abs(p.y - 600) < 0.1,
    ),
    "the attached T junction follows its parent",
  );
  assert.equal(await page.evaluate(() => current().panels.length), 3);
  assert.deepEqual((await snapshot()).balloons, original.balloons);
  assert.deepEqual(
    await Promise.all(
      [
        [200, 300],
        [600, 300],
        [200, 850],
      ].map(([x, y]) => pixel(x, y)),
    ),
    originalPixels,
    "image placement and zoom are fixed in page coordinates",
  );
  await drag([420, 300], [500, 300]);
  shape = await geometry();
  assert(shape[0].some((p) => Math.abs(p.x - 500) < 0.1));
  const beforeCancel = await geometry();
  await drag([200, 600], [200, 640], true);
  assert.deepEqual(
    await geometry(),
    beforeCancel,
    "Escape cancels a live cut edit",
  );
  await drag([200, 600], [200, 1200]);
  assert.deepEqual(
    await geometry(),
    beforeCancel,
    "a collapsing cut is rejected without changing data",
  );
  // Remove the vertical divider: both images remain, with no exported gutter / border.
  const seamBefore = await pixel(500, 300);
  await click(500, 300);
  await page.keyboard.press("Delete");
  assert.equal(await page.evaluate(() => visiblePanelCount(current())), 2);
  assert.equal(
    await page.evaluate(() => current().panels.flatMap(panelImages).length),
    3,
  );
  const seamAfter = await pixel(500, 300);
  assert.notDeepEqual(
    seamAfter,
    seamBefore,
    "deleting removes the visible border and gutter",
  );
  assert.notDeepEqual(seamAfter, [255, 255, 255, 255]);
  assert.deepEqual((await snapshot()).balloons, original.balloons);
  await page.locator("#undo").click();
  assert.equal(await page.evaluate(() => visiblePanelCount(current())), 3);
  assert.deepEqual(await pixel(500, 300), seamBefore);
  await page.locator("#redo").click();
  assert.equal(await page.evaluate(() => visiblePanelCount(current())), 2);
  await drag([200, 600], [200, 650]);
  assert.equal(
    await page.evaluate(() => visiblePanelCount(current())),
    2,
    "a deleted adjoining line stays deleted when its parent moves",
  );
  const c = await page.evaluate(() => selectedCut());
  await drag([c.b.x, c.b.y], [c.b.x, c.b.y + 80]);
  assert(
    await page.evaluate(
      () => Math.abs(selectedCut().a.y - selectedCut().b.y) > 60,
    ),
    "endpoint handles change the angle",
  );
  assert.deepEqual((await snapshot()).balloons, original.balloons);
  const beforeNudge = await page.evaluate(() => selectedCut().a.y);
  await page.keyboard.press("ArrowDown");
  assert((await page.evaluate(() => selectedCut().a.y)) > beforeNudge);
  await page.screenshot({ path: "_local/comic-edit-cuts.png" });
  await page.locator("#reset-layout").click();
  assert.equal(await page.evaluate(() => visiblePanelCount(current())), 1);
  assert.equal(
    await page.evaluate(() => layoutGeometry(current()).cuts.length),
    0,
  );
  assert.equal(
    await page.evaluate(() => current().panels.flatMap(panelImages).length),
    3,
  );
  assert.deepEqual((await snapshot()).balloons, original.balloons);
  const artwork = await page.evaluate(async () =>
    (await exportCanvas(current())).toDataURL(),
  );
  await page.waitForFunction(() => !saving);
  await page.reload();
  await page.waitForFunction(
    () => ready && [...images.values()].filter((e) => e.image).length === 3,
  );
  assert.equal(await page.evaluate(() => visiblePanelCount(current())), 1);
  assert.equal(
    await page.evaluate(async () =>
      (await exportCanvas(current())).toDataURL(),
    ),
    artwork,
  );
  // Portable JSON must preserve removed dividers and frozen image frames.
  const saved = await page.evaluate(async () =>
    JSON.parse(await (await createProjectFile(project())).text()),
  );
  const portable = await page.evaluate(async (raw) => {
    await importProjectFile(new File([JSON.stringify(raw)], "cuts.comic.json"));
    return (await exportCanvas(current())).toDataURL();
  }, saved);
  assert.equal(portable, artwork);
  assert.equal(await page.evaluate(() => visiblePanelCount(current())), 1);
  assert(
    await page.evaluate(() => current().panels.every((p) => !!p.image.frame)),
  );
  // Reusing the layout keeps the visible merge, without copying images.
  const copiedFrom = await page.evaluate(() => current().id);
  await page.locator("#page-new").click();
  await page.locator("#mode-cut").click();
  await page.locator("#reuse-page").selectOption(copiedFrom);
  await page.locator("#reuse").click();
  await page.locator("#confirm-yes").click();
  assert.equal(await page.evaluate(() => visiblePanelCount(current())), 1);
  assert.equal(
    await page.evaluate(() => current().panels.flatMap(panelImages).length),
    0,
  );
  // Diagonals from corner to corner can move too, adding vertices as needed.
  await page.locator("#page-new").click();
  await page.locator("#cut-draw").click();
  await drag([36, 36], [804, 1152]);
  await page.locator("#cut-edit").click();
  await drag([420, 594], [470, 594]);
  assert.equal(await page.evaluate(() => current().panels.length), 2);
  assert(
    await page.evaluate(() =>
      current().panels.some((p) => p.points.length > 3),
    ),
    "moving a corner diagonal re-clips the page instead of dropping its corner",
  );
  const sum = await page.evaluate(() =>
    current().panels.reduce((s, p) => s + area(p.points), 0),
  );
  assert(Math.abs(sum - (840 - 72) * (1188 - 72)) < 0.01);
  await page.locator("#undo").click();
  assert(
    await page.evaluate(() =>
      current().panels.every((p) => p.points.length === 3),
    ),
  );
  await page.locator("#redo").click();
  // A line crossing a previous division moves both collinear sections together.
  await page.locator("#page-new").click();
  await page.locator("#cut-draw").click();
  await drag([36, 450], [804, 450]);
  await drag([420, 36], [420, 1152]);
  await page.locator("#cut-edit").click();
  await drag([420, 300], [470, 300]);
  assert.equal(await page.evaluate(() => current().panels.length), 4);
  assert(
    await page.evaluate(() =>
      current().panels.every((p) =>
        p.points.some((q) => Math.abs(q.x - 470) < 0.1),
      ),
    ),
  );
  assert.equal(
    await page.evaluate(() =>
      Math.round(current().panels.reduce((s, p) => s + area(p.points), 0)),
    ),
    (840 - 72) * (1188 - 72),
  );
  // Re-drawing a deleted cut restores it without replacing its images.
  await page.locator("#cut-remove").click();
  assert.equal(await page.evaluate(() => visiblePanelCount(current())), 2);
  await page.locator("#cut-draw").click();
  await drag([470, 36], [470, 1152]);
  assert.equal(await page.evaluate(() => visiblePanelCount(current())), 4);
  // Format changes preserve both the hidden line geometry and image frames.
  await page.locator(`[data-page-id="${copiedFrom}"]`).click();
  await page.locator("#project-format").selectOption("b5JisLandscape");
  assert.equal(await page.evaluate(() => visiblePanelCount(current())), 1);
  await page.evaluate(() =>
    validateProjectFile({
      format: PROJECT_FILE_FORMAT,
      version: 1,
      project: { ...project(), issues: [] },
      assets: [],
    }),
  );
  await page.evaluate(async () =>
    validateProjectFile(
      JSON.parse(await (await createProjectFile(project())).text()),
    ),
  );
  for (const lang of ["en", "pt", "ja"]) {
    await page.locator("#lang-switcher").selectOption(lang);
    assert.deepEqual(
      await page.evaluate(() =>
        Object.keys(I18N.en).filter((k) => !I18N[lang][k]),
      ),
      [],
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: legacy cut editing, T junctions, diagonal corner moves, endpoint rotation, invalid/canceled drags, image placement, balloon preservation, line deletion, clear all, undo/redo, persistence, JSON transfer, reuse, crossed lines, redraw and format changes.",
  );
} finally {
  await browser.close();
}
