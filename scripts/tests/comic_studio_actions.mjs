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
  await page.locator("#name-input").fill("Actions");
  await page.locator("#name-form button[type=submit]").click();
  await page.locator("#balloon-add").click();
  await page.locator("#balloon-text").fill("Copy me");
  await page.locator("#balloon-text").blur();
  const original = await page.evaluate(() => structuredClone(balloon()));
  await page.locator("#balloon-duplicate").click();
  const copied = await page.evaluate(() => structuredClone(balloon()));
  assert.notEqual(original.id, copied.id);
  assert.equal(copied.x, original.x + 20);
  assert.equal(copied.y, original.y + 20);
  for (const key of Object.keys(original).filter(
    (k) => !["id", "x", "y"].includes(k),
  ))
    assert.deepEqual(copied[key], original[key]);
  await page.locator("#undo").click();
  assert.equal(await page.evaluate(() => current().balloons.length), 1);
  await page.locator("#redo").click();
  assert.equal(await page.evaluate(() => current().balloons.length), 2);
  await page.evaluate(async () => {
    selectedBalloon = null;
    selectedPanel = current().panels[0].id;
    const c = document.createElement("canvas");
    c.width = 120;
    c.height = 90;
    c.getContext("2d").fillStyle = "#008f7d";
    c.getContext("2d").fillRect(0, 0, 120, 90);
    await importImage(
      new File([await canvasBlob(c, "image/png")], "image.png", {
        type: "image/png",
      }),
    );
    window.clipboardWrites = [];
    Object.defineProperty(navigator.clipboard, "write", {
      configurable: true,
      value: async (items) => {
        const blob = await items[0].getType("image/png");
        const im = await createImageBitmap(blob);
        window.clipboardWrites.push([blob.type, im.width, im.height]);
      },
    });
  });
  await page.locator("#sheet").focus();
  await page.keyboard.press("Meta+c");
  await page.waitForFunction(() => window.clipboardWrites.length === 1);
  assert.deepEqual(await page.evaluate(() => window.clipboardWrites[0]), [
    "image/png",
    120,
    90,
  ]);
  await page.keyboard.press("Control+c");
  await page.waitForFunction(() => window.clipboardWrites.length === 2);
  await page.locator("#balloon-layer").selectOption(original.id);
  await page.locator("#balloon-text").focus();
  await page.keyboard.press("Meta+c");
  assert.equal(await page.evaluate(() => window.clipboardWrites.length), 2);
  await page.locator("#mode-cut").click();
  const move = async (x, y) => {
    const r = await page.locator("#sheet").boundingBox();
    await page.mouse.move(
      r.x + (x * r.width) / 840,
      r.y + (y * r.height) / 1188,
    );
  };
  await move(36, 300);
  await page.mouse.down();
  await move(804, 340);
  await page.keyboard.down("Shift");
  assert(Math.abs((await page.evaluate(() => gesture.b.y)) - 300) < 0.001);
  await page.keyboard.up("Shift");
  assert.notEqual(await page.evaluate(() => gesture.b.y), 300);
  await page.keyboard.down("Shift");
  await page.mouse.up();
  await page.keyboard.up("Shift");
  assert.equal(await page.evaluate(() => current().panels.length), 2);
  assert(
    await page.evaluate(() =>
      layoutGeometry(current()).cuts.every(
        (c) => Math.abs(c.a.y - c.b.y) < 1e-6,
      ),
    ),
  );
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => ready);
  assert.equal(await page.evaluate(() => current().balloons.length), 2);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: balloon duplication and undo/redo, PNG clipboard at original size with Cmd/Ctrl+C, text-field shortcut isolation, Shift axis lock/release and persistence.",
  );
} finally {
  await browser.close();
}
