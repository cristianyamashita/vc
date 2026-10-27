// Serve the repository root, then run:
// VC_URL=http://127.0.0.1:8765 node scripts/tests/comic_studio.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
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
page.on("pageerror", (error) => errors.push(error.message));
const name = async (text) => {
  await page.locator("#name-input").fill(text);
  await page.locator("#name-form button[type=submit]").click();
};
const drag = async (a, b) => {
  const r = await page.locator("#sheet").boundingBox();
  await page.mouse.move(
    r.x + (a[0] * r.width) / 840,
    r.y + (a[1] * r.height) / 1188,
  );
  await page.mouse.down();
  await page.mouse.move(
    r.x + (b[0] * r.width) / 840,
    r.y + (b[1] * r.height) / 1188,
    { steps: 12 },
  );
  await page.mouse.up();
};
const panelCount = () => page.evaluate(() => current().panels.length);
try {
  await page.goto(`${base}/page/utils/comic-studio/index.html`);
  await page.waitForFunction(() => ready);
  await page.locator("#lang-switcher").selectOption("pt");
  await page.locator("#project-new").click();
  await name("História de teste");
  await page.locator("#issue-rename").click();
  await name("Volume A");
  const originalPage = await page.evaluate(() => current().id);
  await page.locator("#mode-cut").click();
  await drag([36, 450], [804, 450]);
  await drag([420, 36], [420, 450]); // A cut terminating on another cut.
  await drag([36, 700], [804, 980]); // Diagonal.
  assert.equal(await panelCount(), 4);
  const areaError = await page.evaluate(() =>
    Math.abs(
      current().panels.reduce((sum, p) => sum + area(p.points), 0) -
        (W - M * 2) * (H - M * 2),
    ),
  );
  assert(
    areaError < 0.001,
    "cuts partition the sheet without overlaps or lost area",
  );
  await drag([36, 1050], [260, 1050]); // Does not reach another edge.
  assert.equal(await panelCount(), 4, "incomplete cuts are rejected");
  await page.locator("#undo").click();
  assert.equal(await panelCount(), 3);
  await page.locator("#redo").click();
  assert.equal(await panelCount(), 4);
  await page.locator("#mode-edit").click();
  const r = await page.locator("#sheet").boundingBox();
  await page.mouse.click(
    r.x + (200 * r.width) / 840,
    r.y + (230 * r.height) / 1188,
  );
  const fixture = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 900;
    c.height = 600;
    const x = c.getContext("2d");
    x.fillStyle = "#008f7d";
    x.fillRect(0, 0, 900, 600);
    x.fillStyle = "#ffffff";
    x.fillRect(100, 100, 200, 200);
    return c.toDataURL().split(",")[1];
  });
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#image-add").click();
  await (
    await chooser
  ).setFiles({
    name: "scene.png",
    mimeType: "image/png",
    buffer: Buffer.from(fixture, "base64"),
  });
  await page.waitForFunction(() => !!panel()?.image && !saving);
  await page.locator("#image-zoom").fill("1.5");
  await page.locator("#image-zoom").dispatchEvent("change");
  await drag([220, 260], [250, 280]);
  const transform = await page.evaluate(() => ({ ...panel().image }));
  assert.equal(transform.zoom, 1.5);
  assert(Math.abs(transform.x - 30) < 0.1);
  for (const kind of [
    "speech",
    "thought",
    "expression",
    "shout",
    "narration",
  ]) {
    await page.locator("#new-balloon-kind").selectOption(kind);
    await page.locator("#balloon-add").click();
    await page.locator("#balloon-text").fill(`Olá! 日本語 ${kind}`);
    await page.locator("#balloon-text").blur();
    if (kind === "speech") {
      assert(await page.locator("#balloon-back").isDisabled());
      assert(await page.locator("#balloon-front").isDisabled());
    }
  }
  // Overlapping balloons must visibly change stacking, not merely update metadata.
  const topBalloon = await page.evaluate(() => ({ ...balloon() }));
  const sample = () =>
    page.evaluate(
      ({ x, y, h }) => [
        ...$("sheet")
          .getContext("2d")
          .getImageData(x + 30, y + h / 2, 1, 1).data,
      ],
      topBalloon,
    );
  await page.locator("#balloon-color").fill("#ff00ff");
  await page.locator("#balloon-color").dispatchEvent("change");
  assert.deepEqual(await sample(), [255, 0, 255, 255]);
  assert(await page.locator("#balloon-front").isDisabled());
  await page.locator("#balloon-back").click();
  assert.deepEqual(await sample(), [255, 255, 255, 255]);
  assert(await page.locator("#balloon-back").isDisabled());
  assert(
    (
      await page.locator("#balloon-layer option:checked").innerText()
    ).startsWith("1 / 5"),
  );
  await page.locator("#balloon-layer").selectOption("");
  await page.locator("#balloon-layer").selectOption(topBalloon.id);
  assert.equal(
    await page.locator("#balloon-text").inputValue(),
    topBalloon.text,
    "hidden balloons remain accessible",
  );
  await page.locator("#balloon-front").click();
  assert.deepEqual(await sample(), [255, 0, 255, 255]);
  assert(
    (
      await page.locator("#balloon-layer option:checked").innerText()
    ).startsWith("5 / 5"),
  );
  await page.locator("#undo").click();
  assert.deepEqual(await sample(), [255, 255, 255, 255]);
  await page.locator("#redo").click();
  assert.deepEqual(await sample(), [255, 0, 255, 255]);
  await page.locator("#balloon-layer").selectOption(topBalloon.id);
  const b = await page.evaluate(() => ({ ...balloon() }));
  await drag([b.x + 80, b.y + 60], [b.x + 280, b.y + 400]);
  const moved = await page.evaluate(() => ({ ...balloon() }));
  assert(Math.abs(moved.x - b.x - 200) < 0.1);
  await drag(
    [moved.x + moved.w, moved.y + moved.h],
    [moved.x + moved.w + 40, moved.y + moved.h + 30],
  );
  assert(Math.abs((await page.evaluate(() => balloon().w)) - 300) < 0.1);
  await page.waitForFunction(() => !saving);
  await page.reload();
  await page.waitForFunction(
    () => ready && [...images.values()].some((x) => x.image),
  );
  assert.equal(await panelCount(), 4);
  assert.equal(await page.evaluate(() => current().balloons.length), 5);
  assert.deepEqual(
    await page.evaluate(() => current().panels.find((x) => x.image).image),
    transform,
  );
  await page.locator("#page-new").click();
  await page.locator("#mode-cut").click();
  await page.locator("#reuse-page").selectOption(originalPage);
  await page.locator("#reuse").click();
  await page.locator("#confirm-yes").click();
  assert.equal(await panelCount(), 4);
  assert.equal(
    await page.evaluate(() => current().panels.filter((p) => p.image).length),
    0,
    "reuse copies geometry only",
  );
  await page.locator("#undo").click();
  assert.equal(await panelCount(), 1);
  await page.locator("#redo").click();
  await page.locator("#page-action").selectOption("before");
  const inserted = await page.evaluate(() => current().id);
  await page.locator("#page-position").selectOption("0");
  assert.equal(await page.evaluate(() => issue().pages[0].id), inserted);
  await page.locator("#page-action").selectOption("duplicate");
  await page.locator("#page-action").selectOption("delete");
  await page.locator("#confirm-yes").click();
  assert.equal(await page.evaluate(() => issue().pages.length), 3);
  await page.locator(`[data-page-id="${originalPage}"]`).click();
  for (const language of ["en", "ja", "pt"]) {
    await page.locator("#lang-switcher").selectOption(language);
    assert.equal(await page.locator("html").getAttribute("lang"), language);
  }
  assert.deepEqual(
    await page.evaluate(() =>
      Object.keys(I18N.en).filter((k) => !I18N.pt[k] || !I18N.ja[k]),
    ),
    [],
  );
  await page.locator("#theme-switcher").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  for (const [width, height] of [
    [960, 640],
    [900, 640],
    [720, 560],
    [390, 640],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    assert.equal(
      await page.evaluate(
        () =>
          document.body.scrollHeight > innerHeight ||
          document.body.scrollWidth > innerWidth,
      ),
      false,
    );
    assert(
      await page.evaluate(() => {
        const sheet = $("sheet").getBoundingClientRect(),
          stage = $("stage").getBoundingClientRect();
        return (
          sheet.left >= stage.left &&
          sheet.right <= stage.right &&
          sheet.top >= stage.top &&
          sheet.bottom <= stage.bottom
        );
      }),
      "sheet fits inside its panel",
    );
  }
  await page.setViewportSize({ width: 960, height: 640 });
  await context.setOffline(true);
  for (const [type, count] of [
    ["png", 1],
    ["pdf", 1],
    ["issue", 3],
  ]) {
    await page.locator("#export-open").click();
    await page.locator("#export-type").selectOption(type);
    const downloading = page.waitForEvent("download");
    await page.locator("#export-run").click();
    const download = await downloading,
      stream = await download.createReadStream(),
      chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const bytes = Buffer.concat(chunks);
    if (type === "png") {
      assert.equal(bytes.readUInt32BE(16), 2520);
      assert.equal(bytes.readUInt32BE(20), 3564);
    } else {
      const pdf = bytes.toString("latin1");
      assert(pdf.startsWith("%PDF-1.4"));
      assert.equal((pdf.match(/\/Type \/Page\b/g) || []).length, count);
      const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
      assert.equal(
        pdf.slice(xref, xref + 4),
        "xref",
        "PDF xref uses byte offsets",
      );
      assert(pdf.includes("/MediaBox [0 0 595.276 841.89]"));
    }
    await page.locator('[data-close="export-dialog"]').click();
  }
  await context.setOffline(false);
  // Exercise the shared backup serializer and restore into a separate, empty browser.
  const backup = await context.newPage();
  await backup.goto(`${base}/page/utils/backup.html`);
  const data = await backup.evaluate(async () => {
    const d = await openIDB("ComicStudioDB", 1, null),
      stores = {};
    for (const sn of ["projects", "assets"])
      stores[sn] = await Promise.all(
        (await readAllFromStore(d, sn)).map(async (r) => ({
          key: r.key,
          value: await serializeValue(r.value),
        })),
      );
    d.close();
    return {
      __backup_meta: { version: 1 },
      localStorage: {
        "comicStudio.prefs.v1": localStorage.getItem("comicStudio.prefs.v1"),
      },
      indexedDB: { ComicStudioDB: { version: 1, stores } },
    };
  });
  await backup.close();
  const cleanContext = await browser.newContext(),
    clean = await cleanContext.newPage();
  try {
    await clean.goto(`${base}/page/utils/backup.html`);
    assert.deepEqual(
      await clean.evaluate(async () => {
        const d = await openIDB("ComicStudioDB", 1, null);
        const keys = [...d.objectStoreNames].map(
          (n) => d.transaction(n).objectStore(n).keyPath,
        );
        d.close();
        return keys;
      }),
      ["id", "id"],
      "backup before first launch creates the correct empty schema",
    );
    await clean.evaluate(async (data) => {
      pendingBackup = data;
      await doImport("merge");
    }, data);
    await clean.goto(`${base}/page/utils/comic-studio/index.html`);
    await clean.waitForFunction(
      () => ready && [...images.values()].some((x) => x.image),
    );
    assert.equal(
      await clean.evaluate(() => projects[0].issues[0].pages.length),
      3,
    );
    assert.equal(
      await clean.evaluate(() =>
        projects[0].issues[0].pages.reduce((n, p) => n + p.balloons.length, 0),
      ),
      5,
    );
    assert.equal(
      await clean.evaluate(
        async () =>
          (
            await request(
              db.transaction("assets").objectStore("assets").getAll(),
            )
          )[0].blob instanceof Blob,
      ),
      true,
    );
  } finally {
    await cleanContext.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: cuts, geometry, undo/redo, image import/position/zoom, five balloon styles, page insertion/reorder, persistence, offline PNG/PDF, backup restore, EN/PT/JA, themes and responsive layout.",
  );
} finally {
  await browser.close();
}
