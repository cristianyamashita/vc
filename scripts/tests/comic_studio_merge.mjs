// VC_URL=http://127.0.0.1:8765 node scripts/tests/comic_studio_merge.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
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
const base = (process.env.VC_URL || "http://127.0.0.1:8765").replace(/\/$/, "");
const click = async (x, y) => {
  const r = await page.locator("#sheet").boundingBox(),
    s = await page.evaluate(() => pageSize());
  await page.mouse.click(r.x + (x * r.width) / s.w, r.y + (y * r.height) / s.h);
};
const pixel = async (x, y) =>
  page.evaluate(
    async ([x, y]) => [
      ...(await exportCanvas(current()))
        .getContext("2d")
        .getImageData(x * 3, y * 3, 1, 1).data,
    ],
    [x, y],
  );
const addImage = async (index, color) =>
  page.evaluate(
    async ({ index, color }) => {
      const c = document.createElement("canvas");
      c.width = 400;
      c.height = 600;
      const x = c.getContext("2d");
      x.fillStyle = color;
      x.fillRect(0, 0, 400, 600);
      await importImage(
        new File([await canvasBlob(c, "image/png")], "image.png", {
          type: "image/png",
        }),
        current(),
        current().panels[index],
      );
    },
    { index, color },
  );
const split = () =>
  page.evaluate(() => {
    checkpoint();
    current().panels = splitPanels(
      current(),
      { x: 420, y: 36 },
      { x: 420, y: 1152 },
    );
    changed(true);
  });
const remove = async () => {
  await page.locator("#mode-cut").click();
  await page.locator("#cut-edit").click();
  await click(420, 600);
  await page.locator("#cut-remove").click();
};
try {
  await page.goto(`${base}/page/utils/comic-studio/index.html`);
  await page.waitForFunction(() => ready);
  await page.locator("#lang-switcher").selectOption("pt");
  await page.locator("#project-new").click();
  await page.locator("#name-input").fill("Merge real");
  await page.locator("#name-form button[type=submit]").click();
  await split();
  await addImage(0, "#ff4040");
  await page.locator("#balloon-add").click();
  await page.locator("#balloon-text").fill("Preservado");
  await page.locator("#balloon-text").blur();
  const balloonBefore = await page.evaluate(() =>
    structuredClone(current().balloons),
  );
  await remove();
  assert.equal(
    await page.evaluate(() => current().panels.length),
    1,
    "deletion physically merges panels",
  );
  assert.equal(
    await page.evaluate(() => layoutGeometry(current()).cuts.length),
    0,
  );
  await page.locator("#mode-edit").click();
  await click(650, 850);
  const right = await page.evaluate(() => panel().id);
  await click(200, 850);
  assert.equal(
    await page.evaluate(() => panel().id),
    right,
    "both sides select the same panel",
  );
  await page.locator("#image-fit").click();
  assert.deepEqual(
    await pixel(650, 850),
    [255, 64, 64, 255],
    "a fitted image covers the former opposite panel",
  );
  assert.deepEqual(
    await page.evaluate(() => current().balloons),
    balloonBefore,
  );
  await page.locator("#undo").click();
  await page.locator("#undo").click();
  assert.equal(await page.evaluate(() => current().panels.length), 2);
  await page.locator("#redo").click();
  assert.equal(await page.evaluate(() => current().panels.length), 1);
  // Both original images become editable layers of one panel.
  await page.locator("#page-new").click();
  await split();
  await addImage(0, "#ff4040");
  await addImage(1, "#4080ff");
  const assets = await page.evaluate(() =>
    current()
      .panels.flatMap(panelImages)
      .map((im) => im.asset),
  );
  await remove();
  assert.equal(await page.evaluate(() => current().panels.length), 1);
  assert.equal(
    await page.evaluate(() => panelImages(current().panels[0]).length),
    2,
  );
  assert.deepEqual(
    await page.evaluate(() =>
      panelImages(current().panels[0]).map((im) => im.asset),
    ),
    assets,
  );
  await page.locator("#mode-edit").click();
  await click(200, 850);
  assert(await page.locator("#image-layers").isVisible());
  await page.locator("#image-layer").selectOption("1");
  await page.locator("#image-fit").click();
  assert.deepEqual(await pixel(650, 850), [64, 128, 255, 255]);
  await page.locator("#image-layer").selectOption("0");
  await page.locator("#image-fit").click();
  await page.locator("#image-front").click();
  assert.deepEqual(await pixel(650, 850), [255, 64, 64, 255]);
  await page.locator("#image-x").fill("250");
  await page.locator("#image-x").dispatchEvent("change");
  assert.equal(await page.evaluate(() => activeImage().x), 250);
  const mergedPage = await page.evaluate(() => current().id),
    rendered = await page.evaluate(async () =>
      (await exportCanvas(current())).toDataURL(),
    );
  await page.screenshot({ path: "_local/comic-real-merge.png" });
  await page.waitForFunction(() => !saving);
  await page.reload();
  await page.waitForFunction(() => ready);
  assert.equal(await page.evaluate(() => current().panels.length), 1);
  assert.equal(
    await page.evaluate(() => panelImages(current().panels[0]).length),
    2,
  );
  assert.equal(
    await page.evaluate(async () =>
      (await exportCanvas(current())).toDataURL(),
    ),
    rendered,
  );
  const file = await page.evaluate(async () =>
    JSON.parse(await (await createProjectFile(project())).text()),
  );
  assert.equal(file.version, 2);
  await page.evaluate(
    async (file) =>
      importProjectFile(new File([JSON.stringify(file)], "merged.comic.json")),
    file,
  );
  const imported = await page.evaluate(() => project().issues[0].pages[1].id);
  await page.locator(`[data-page-id="${imported}"]`).click();
  assert.equal(await page.evaluate(() => current().panels.length), 1);
  assert.equal(
    await page.evaluate(() => panelImages(current().panels[0]).length),
    2,
  );
  assert.equal(
    await page.evaluate(async () =>
      (await exportCanvas(current())).toDataURL(),
    ),
    rendered,
    "portable JSON preserves merged geometry and all layers",
  );
  // A new cut subdivides the merged area, and both new panels retain its layers.
  await split();
  assert.equal(await page.evaluate(() => current().panels.length), 2);
  assert(
    await page.evaluate(() =>
      current().panels.every((p) => panelImages(p).length === 2),
    ),
  );
  await page.locator("#mode-cut").click();
  await page.locator("#cut-edit").click();
  await click(420, 600);
  await page.keyboard.press("ArrowRight");
  assert(
    await page.evaluate(() =>
      current().panels.every((p) =>
        panelCells(p).some((c) => c.some((q) => Math.abs(q.x - 422) < 0.1)),
      ),
    ),
  );
  // Version 1's hidden-divider files are migrated to actual merged panels.
  const legacy = await page.evaluate(async () => {
    const pg = blankPage();
    pg.panels = splitPanels(pg, { x: 420, y: 36 }, { x: 420, y: 1152 });
    pg.removedCuts = [{ a: { x: 420, y: 36 }, b: { x: 420, y: 1152 } }];
    return {
      format: PROJECT_FILE_FORMAT,
      version: 1,
      project: {
        id: "old",
        name: "Legacy",
        format: "portrait",
        issues: [{ id: "issue", name: "Old", pages: [pg] }],
      },
      assets: [],
    };
  });
  await page.evaluate(
    async (file) =>
      importProjectFile(new File([JSON.stringify(file)], "legacy.comic.json")),
    legacy,
  );
  assert.equal(await page.evaluate(() => current().panels.length), 1);
  // Concave unions retain the unmerged neighbor and do not fill its area.
  await page.evaluate(() => {
    const cell = (x, y, w, h) => [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ];
    current().panels = [
      { id: uid(), points: cell(36, 36, 384, 400), image: null },
      { id: uid(), points: cell(36, 436, 384, 716), image: null },
      { id: uid(), points: cell(420, 436, 384, 716), image: null },
      { id: uid(), points: cell(420, 36, 384, 400), image: null },
    ];
    current().panels = mergedPanels(current(), [
      { a: { x: 420, y: 436 }, b: { x: 804, y: 1152 } },
    ]);
    const units = current().panels;
    current().panels = [
      panelFromCells(
        [units[0].points, units[1].points, units[2].points],
        uid(),
      ),
      units[3],
    ];
    changed(true);
  });
  assert.equal(await page.evaluate(() => current().panels.length), 2);
  await page.locator("#mode-edit").click();
  await click(200, 200);
  const left = await page.evaluate(() => panel().id);
  await click(600, 800);
  assert.equal(await page.evaluate(() => panel().id), left);
  await click(600, 200);
  assert.notEqual(await page.evaluate(() => panel().id), left);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real panel union, full-region image fitting, selectable preserved image layers, stacking, undo/redo, saving, JSON v2/v1 migration, re-cutting, moving merged geometry and concave hit regions.",
  );
} finally {
  await browser.close();
}
