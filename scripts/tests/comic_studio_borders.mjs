import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto(
    `${process.env.VC_URL || "http://127.0.0.1:8765"}/page/utils/comic-studio/index.html`,
  );
  await page.waitForFunction(() => ready);
  await page.locator("#project-new").click();
  await page.locator("#name-input").fill("Borders");
  await page.locator("#name-form button[type=submit]").click();
  await page.evaluate(() => {
    const pg = current();
    pg.panels = splitPanels(pg, { x: 36, y: 500 }, { x: 804, y: 540 });
    pg.panels = splitPanels(
      pg,
      { x: 380, y: 36 },
      { x: 350, y: 516.3541666667 },
    );
    pg.panels = splitPanels(
      pg,
      { x: 520, y: 525.2083333333 },
      { x: 300, y: 1152 },
    );
    changed(true);
  });
  await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 100;
    c.height = 100;
    c.getContext("2d").fillStyle = "#c3dccf";
    c.getContext("2d").fillRect(0, 0, 100, 100);
    const file = new File([await canvasBlob(c, "image/png")], "sample.png", {
      type: "image/png",
    });
    for (const p of current().panels) await importImage(file, current(), p);
  });
  await page.locator("#mode-cut").click();
  const pictures = {};
  for (const style of ["straight", "hand", "dashed", "none"]) {
    await page.locator("#border-style").selectOption(style);
    pictures[style] = await page.evaluate(() => {
      const pg = current(),
        c = document.createElement("canvas");
      c.width = 840;
      c.height = 1188;
      drawPage(c.getContext("2d"), pg, 1, false);
      const ctx = c.getContext("2d"),
        data = ctx.getImageData(0, 0, c.width, c.height).data;
      // Every gutter center and its inner neighborhood must remain paper white.
      for (const e of layoutGeometry(pg).edges.filter((e) => !e.hidden)) {
        const len = Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y),
          nx = -(e.b.y - e.a.y) / len,
          ny = (e.b.x - e.a.x) / len;
        for (let t = 0.02; t < 0.99; t += 0.013)
          for (const d of [-3, 0, 3]) {
            const x = Math.round(e.a.x + (e.b.x - e.a.x) * t + nx * d),
              y = Math.round(e.a.y + (e.b.y - e.a.y) * t + ny * d),
              i = (y * c.width + x) * 4;
            if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245)
              throw Error(`Outline leaked into gutter at ${x},${y}`);
          }
      }
      if (
        pg.borderStyle === "none" &&
        data.some((v, i) => i % 4 !== 3 && v < 100)
      )
        throw Error("Borderless export contains ink");
      const first = c.toDataURL();
      drawPage(ctx, pg, 1, false);
      if (first !== c.toDataURL()) throw Error("Unstable handmade stroke");
      return first;
    });
  }
  assert.equal(new Set(Object.values(pictures)).size, 4);
  await page.locator("#border-style").selectOption("hand");
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => ready);
  assert.equal(await page.evaluate(() => current().borderStyle), "hand");
  // JSON transfer retains appearance, while old documents default to straight.
  await page.evaluate(async () => {
    const source = JSON.parse(
      await (await createProjectFile(project())).text(),
    );
    const imported = validateProjectFile(source).project.issues[0].pages[0];
    if (imported.borderStyle !== "hand")
      throw Error("Import lost border style");
    const canvas = document.createElement("canvas");
    canvas.width = 840;
    canvas.height = 1188;
    drawPage(canvas.getContext("2d"), current(), 1, false);
    const expected = canvas.toDataURL();
    const restored = await importProjectFile(
      new File([JSON.stringify(source)], "borders.comic.json", {
        type: "application/json",
      }),
    );
    const restoredPage = restored.issues[0].pages[0];
    await ensureImages(restoredPage);
    drawPage(canvas.getContext("2d"), restoredPage, 1, false);
    if (expected !== canvas.toDataURL())
      throw Error("Import changed border rendering");
    delete source.project.issues[0].pages[0].borderStyle;
    if (
      validateProjectFile(source).project.issues[0].pages[0].borderStyle !==
      "straight"
    )
      throw Error("Legacy default failed");
    source.project.issues[0].pages[0].borderStyle = "invalid";
    let rejected = false;
    try {
      validateProjectFile(source);
    } catch {
      rejected = true;
    }
    if (!rejected) throw Error("Invalid style accepted");
  });
  await page.locator("#lang-switcher").selectOption("pt");
  await page.locator("#mode-cut").click();
  assert.equal(
    await page.locator("#border-style option:checked").textContent(),
    "Artesanal",
  );
  mkdirSync("_local", { recursive: true });
  for (const [style, data] of Object.entries(pictures))
    writeFileSync(
      `_local/comic-border-${style}.png`,
      Buffer.from(data.split(",")[1], "base64"),
    );
  await page.screenshot({ path: "_local/comic-borders-ui.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: angled/T junction gutters stay clear, four distinct border styles, deterministic export, saved preference and PT controls.",
  );
} finally {
  await browser.close();
}
