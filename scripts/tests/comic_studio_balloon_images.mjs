import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 640 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(
    `${process.env.VC_URL || "http://127.0.0.1:8765"}/page/utils/comic-studio/index.html`,
  );
  await page.waitForFunction(() => ready);
  await page.locator("#project-new").click();
  await page.locator("#name-input").fill("Memories");
  await page.locator("#name-form button[type=submit]").click();
  await page.locator("#balloon-add").click();
  await page.locator("#balloon-font").fill("47");
  await page.locator("#balloon-font").dispatchEvent("change");
  await page.locator("#balloon-add").click();
  assert.equal(await page.evaluate(() => balloon().font), 47);
  await page.reload();
  await page.waitForFunction(() => ready);
  await page.locator("#new-balloon-kind").selectOption("circle");
  await page.locator("#balloon-add").click();
  assert.equal(await page.evaluate(() => balloon().font), 47);
  assert.equal(await page.evaluate(() => balloon().w === balloon().h), true);
  await page.locator("#balloon-kind").selectOption("oval");
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 100;
    c.height = 100;
    const x = c.getContext("2d");
    x.fillStyle = "#ee4433";
    x.fillRect(0, 0, 100, 100);
    await importBalloonImage(
      new File([await canvasBlob(c, "image/png")], "memory.png", {
        type: "image/png",
      }),
    );
  });
  assert.equal(await page.locator("#balloon-text").isDisabled(), true);
  assert.equal(await page.evaluate(() => balloon().text), "");
  await page.locator("#balloon-image-zoom").fill("1.5");
  await page.locator("#balloon-image-zoom").dispatchEvent("change");
  await page.locator("#balloon-duplicate").click();
  assert.equal(await page.evaluate(() => balloon().image.zoom), 1.5);
  await page.evaluate(async () => {
    await collectUnusedAssets();
    await persist();
  });
  const result = await page.evaluate(async () => {
    const c = await exportCanvas(current()),
      b = balloon();
    const pixel = [
      ...c
        .getContext("2d")
        .getImageData(
          Math.round((b.x + b.w / 2) * 3),
          Math.round((b.y + b.h / 2) * 3),
          1,
          1,
        ).data,
    ];
    const raw = JSON.parse(await (await createProjectFile(project())).text());
    const imported = await importProjectFile(
      new File([JSON.stringify(raw)], "memories.comic.json", {
        type: "application/json",
      }),
    );
    await ensureImages(imported.issues[0].pages[0]);
    const c2 = await exportCanvas(imported.issues[0].pages[0]);
    return {
      pixel,
      assets: raw.assets.length,
      equal: c.toDataURL() === c2.toDataURL(),
    };
  });
  assert.deepEqual(result.pixel, [238, 68, 51, 255]);
  assert.equal(result.assets, 1);
  assert(result.equal);
  await page.reload();
  await page.waitForFunction(() => ready);
  await page.evaluate(async () => {
    await ensureImages(current());
    selectedBalloon = current().balloons.at(-1).id;
    syncInspector();
    render();
  });
  assert.equal(await page.locator("#balloon-text").isDisabled(), true);
  await page.locator("#balloon-image-remove").click();
  assert.equal(await page.locator("#balloon-text").isDisabled(), false);
  await page.locator("#undo").click();
  await page.evaluate(() => {
    selectedBalloon = current().balloons.at(-1).id;
    syncInspector();
    render();
  });
  await page.screenshot({ path: "_local/comic-balloon-image.png" });
  assert.equal(await page.locator("#balloon-text").isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: remembered font across reload, circle/oval styles, image-only balloons, image controls, duplication, asset retention, exact portable export/import, reload, removal and undo.",
  );
} finally {
  await browser.close();
}
