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
  await page.locator("#name-input").fill("Typography");
  await page.locator("#name-form button[type=submit]").click();
  await page.locator("#balloon-add").click();
  await page.locator("#balloon-text").fill("Hello\nOi 日本語");
  await page.locator("#balloon-text").blur();
  const images = [];
  for (const family of ["sans", "serif", "mono", "hand"]) {
    await page.locator("#balloon-font-family").selectOption(family);
    images.push(
      await page.evaluate(async () =>
        (await exportCanvas(current())).toDataURL(),
      ),
    );
  }
  assert(new Set(images).size >= 3);
  const positions = [];
  for (const alignment of ["start", "center", "end"]) {
    await page.locator("#balloon-align").selectOption(alignment);
    positions.push(
      await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 840;
        c.height = 1188;
        const ctx = c.getContext("2d"),
          calls = [],
          original = ctx.fillText.bind(ctx);
        ctx.fillText = (...args) => {
          calls.push({ x: args[1], align: ctx.textAlign, text: args[0] });
          original(...args);
        };
        drawBalloon(ctx, balloon());
        return calls;
      }),
    );
  }
  assert(
    positions[0][0].x < positions[1][0].x &&
      positions[1][0].x < positions[2][0].x,
  );
  assert.deepEqual(
    positions.map((p) => p[0].align),
    ["left", "center", "right"],
  );
  await page.locator("#undo").click();
  await page.evaluate(() => {
    selectedBalloon = current().balloons[0].id;
    syncInspector();
  });
  assert.equal(await page.locator("#balloon-align").inputValue(), "center");
  await page.locator("#redo").click();
  await page.evaluate(() => {
    selectedBalloon = current().balloons[0].id;
    syncInspector();
  });
  assert.equal(await page.locator("#balloon-align").inputValue(), "end");
  await page.locator("#balloon-duplicate").click();
  assert.equal(await page.evaluate(() => balloon().fontFamily), "hand");
  assert.equal(await page.evaluate(() => balloon().textAlign), "end");
  await page.evaluate(async () => {
    await persist();
    const raw = JSON.parse(await (await createProjectFile(project())).text());
    const restored = validateProjectFile(raw).project.issues[0].pages[0];
    const a = await exportCanvas(current()),
      b = await exportCanvas(restored);
    if (a.toDataURL() !== b.toDataURL())
      throw Error("Typography lost in portable file");
    raw.project.issues[0].pages[0].balloons[0].fontFamily = "invalid";
    let rejected = false;
    try {
      validateProjectFile(raw);
    } catch {
      rejected = true;
    }
    if (!rejected) throw Error("Invalid font accepted");
  });
  await page.reload();
  await page.waitForFunction(() => ready);
  await page.evaluate(() => {
    selectedBalloon = current().balloons.at(-1).id;
    syncInspector();
    render();
  });
  assert.equal(await page.locator("#balloon-align").inputValue(), "end");
  assert.equal(await page.locator("#balloon-font-family").inputValue(), "hand");
  await page.locator("#lang-switcher").selectOption("pt");
  assert.equal(
    await page.locator("#balloon-align option:checked").textContent(),
    "Fim",
  );
  await page.screenshot({ path: "_local/comic-typography.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: four font families, multiline alignment, undo/redo, duplication, exact JSON rendering, validation, reload and translated selectors.",
  );
} finally {
  await browser.close();
}
