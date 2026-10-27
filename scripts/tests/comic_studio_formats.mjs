// Serve repository root: VC_URL=http://127.0.0.1:8765 node scripts/tests/comic_studio_formats.mjs
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
});
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const formats = [
  ["portrait", 840, 1188, 595.276, 841.89],
  ["landscape", 1188, 840, 841.89, 595.276],
  ["b5Portrait", 704, 1000, 498.898, 708.661],
  ["b5Landscape", 1000, 704, 708.661, 498.898],
  ["b5JisPortrait", 728, 1028, 515.906, 728.504],
  ["b5JisLandscape", 1028, 728, 728.504, 515.906],
  ["stripVertical", 600, 1800, 425.197, 1275.591],
  ["stripHorizontal", 1800, 600, 1275.591, 425.197],
];
const name = async (value) => {
  await page.locator("#name-input").fill(value);
  await page.locator("#name-form button[type=submit]").click();
};
const drag = async (a, b) => {
  const r = await page.locator("#sheet").boundingBox();
  const size = await page.evaluate(() => pageSize());
  await page.mouse.move(
    r.x + (a[0] * r.width) / size.w,
    r.y + (a[1] * r.height) / size.h,
  );
  await page.mouse.down();
  await page.mouse.move(
    r.x + (b[0] * r.width) / size.w,
    r.y + (b[1] * r.height) / size.h,
    { steps: 12 },
  );
  await page.mouse.up();
};
const getDownload = async (type) => {
  await page.locator("#export-open").click();
  await page.locator("#export-type").selectOption(type);
  const downloading = page.waitForEvent("download");
  await page.locator("#export-run").click();
  const stream = await (await downloading).createReadStream(),
    chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  await page.locator('[data-close="export-dialog"]').click();
  return Buffer.concat(chunks);
};
try {
  await page.goto(`${base}/page/utils/comic-studio/index.html`);
  await page.waitForFunction(() => ready);
  await page.locator("#lang-switcher").selectOption("pt");
  await page.locator("#project-new").click();
  await name("Formatos");
  const firstProject = await page.evaluate(() => project().id);
  await page.locator("#mode-cut").click();
  await drag([36, 440], [804, 440]);
  await drag([420, 36], [420, 440]);
  await page.locator("#mode-edit").click();
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 800;
    c.height = 600;
    const x = c.getContext("2d");
    x.fillStyle = "#f1ce75";
    x.fillRect(0, 0, 800, 600);
    x.fillStyle = "#008f7d";
    x.fillRect(0, 180, 800, 420);
    const blob = await canvasBlob(c, "image/png");
    await importImage(new File([blob], "scene.png", { type: "image/png" }));
  });
  await page.locator("#balloon-add").click();
  await page
    .locator("#balloon-text")
    .fill("Uma história em todos os formatos.");
  await page.locator("#balloon-text").blur();
  const original = await page.evaluate(() => ({
    page: current().id,
    issue: issue().id,
    balloon: balloon().id,
    image: current().panels.find((p) => p.image).image.asset,
  }));
  // A project created before formats existed must keep its original layout.
  const geometry = await page.evaluate(async () => {
    delete project().format;
    project().issues.forEach((i) => i.pages.forEach((pg) => delete pg.format));
    await persist();
    return current().panels.map((p) => p.points);
  });
  await page.reload();
  await page.waitForFunction(() => ready);
  assert.equal(await page.locator("#project-format").inputValue(), "portrait");
  assert.deepEqual(
    await page.evaluate(() => current().panels.map((p) => p.points)),
    geometry,
  );
  await page.locator("#page-action").selectOption("duplicate");
  await page.locator("#issue-new").click();
  await name("Outra edição");
  const otherIssue = await page.evaluate(() => issue().id);
  await page.locator("#issue-select").selectOption(original.issue);
  await page.locator(`[data-page-id="${original.page}"]`).click();
  // Retain an undo entry across project format changes.
  await page.locator("#balloon-layer").selectOption(original.balloon);
  await page.locator("#balloon-text").fill("Texto preservado");
  await page.locator("#balloon-text").blur();
  for (const [format, w, h, pdfW, pdfH] of formats) {
    await page.locator("#project-format").selectOption(format);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const state = await page.evaluate(() => ({
      projectFormat: project().format,
      formats: project().issues.flatMap((i) => i.pages.map((pg) => pg.format)),
      sheet: [$("sheet").width, $("sheet").height],
      panels: current().panels.length,
      text: current().balloons[0].text,
      asset: current().panels.find((p) => p.image).image.asset,
      area: current().panels.reduce((sum, p) => sum + area(p.points), 0),
      bodyFits:
        document.body.scrollHeight === innerHeight &&
        document.body.scrollWidth === innerWidth,
      thumbnail: (() => {
        const r = document
          .querySelector(".page-card.active canvas")
          .getBoundingClientRect();
        return r.width / r.height;
      })(),
    }));
    assert.equal(state.projectFormat, format);
    assert(
      state.formats.every((f) => f === format),
      "all editions adapt",
    );
    assert.deepEqual(state.sheet, [w, h]);
    assert.equal(state.panels, 3);
    assert.equal(state.text, "Texto preservado");
    assert.equal(state.asset, original.image);
    assert(Math.abs(state.area - (w - 72) * (h - 72)) < 0.01);
    assert(state.bodyFits);
    assert(Math.abs(state.thumbnail - w / h) < 0.01);
    // Pointer cuts and page undo must still use the new coordinate space.
    await page.locator("#mode-cut").click();
    await drag([36, h * 0.7], [w - 36, h * 0.7]);
    assert.equal(await page.evaluate(() => current().panels.length), 4);
    await page.locator("#undo").click();
    assert.equal(await page.evaluate(() => current().panels.length), 3);
    assert.equal(await page.evaluate(() => current().format), format);
    await page.locator("#mode-edit").click();
    await page.locator("#balloon-layer").selectOption(original.balloon);
    await page.screenshot({ path: `_local/comic-format-${format}.png` });
    await context.setOffline(true);
    const png = await getDownload("png");
    assert.equal(png.readUInt32BE(16), w * 3);
    assert.equal(png.readUInt32BE(20), h * 3);
    const pdf = (await getDownload("issue")).toString("latin1");
    assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, 2);
    assert.equal(
      (pdf.match(new RegExp(`/MediaBox \\[0 0 ${pdfW} ${pdfH}\\]`, "g")) || [])
        .length,
      2,
    );
    assert(pdf.includes(`/Width ${w * 3} /Height ${h * 3}`));
    await context.setOffline(false);
  }
  await page.locator("#undo").click();
  assert.equal(
    await page.evaluate(() => current().balloons[0].text),
    "Uma história em todos os formatos.",
  );
  assert.equal(
    await page.evaluate(() => current().format),
    "stripHorizontal",
    "old undo snapshots adopt the project format",
  );
  await page.locator("#redo").click();
  await page.locator("#issue-select").selectOption(otherIssue);
  await page.locator("#page-new").click();
  assert.equal(
    await page.evaluate(() => current().format),
    "stripHorizontal",
    "inserted pages inherit format",
  );
  await page.locator("#issue-new").click();
  await name("Edição nova");
  assert.equal(
    await page.evaluate(() => current().format),
    "stripHorizontal",
    "new editions inherit format",
  );
  // Each format can also be chosen directly when creating a new project.
  for (const [format, w, h] of formats) {
    await page.locator("#project-new").click();
    await page.locator("#name-format").selectOption(format);
    await name(`Novo ${format}`);
    assert.deepEqual(
      await page.evaluate(() => [$("sheet").width, $("sheet").height]),
      [w, h],
    );
    await page.locator("#mode-cut").click();
    await drag([36, h / 2], [w - 36, h / 2]);
    assert.equal(await page.evaluate(() => current().panels.length), 2);
  }
  await page.locator("#project-select").selectOption(firstProject);
  assert.equal(
    await page.locator("#project-format").inputValue(),
    "stripHorizontal",
    "project settings are independent",
  );
  await page.waitForFunction(() => !saving);
  await page.reload();
  await page.waitForFunction(() => ready);
  assert.equal(
    await page.locator("#project-format").inputValue(),
    "stripHorizontal",
  );
  assert.deepEqual(
    await page.evaluate(() => [$("sheet").width, $("sheet").height]),
    [1800, 600],
  );
  for (const lang of ["en", "pt", "ja"]) {
    await page.locator("#lang-switcher").selectOption(lang);
    assert.equal(
      await page.locator("#project-format option").count(),
      formats.length,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: A4, B5 ISO, B5 JIS and strip formats, legacy migration, all-edition conversion, image/text preservation, cuts and undo after resizing, thumbnails, offline PNG/PDF dimensions, new projects/pages/issues and persistence.",
  );
} finally {
  await browser.close();
}
