// Serve repository root: VC_URL=http://127.0.0.1:8765 node scripts/tests/comic_studio_project_files.mjs
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
page.on("pageerror", (error) => errors.push(error.message));
const open = async (p) => {
  await p.goto(`${base}/page/utils/comic-studio/index.html`);
  await p.waitForFunction(() => ready);
};
const name = async (value) => {
  await page.locator("#name-input").fill(value);
  await page.locator("#name-form button[type=submit]").click();
};
const image = async (color) =>
  page.evaluate(async (color) => {
    const c = document.createElement("canvas");
    c.width = 600;
    c.height = 400;
    const x = c.getContext("2d");
    x.fillStyle = color;
    x.fillRect(0, 0, 600, 400);
    x.fillStyle = "#fff";
    x.fillRect(50, 50, 150, 150);
    await importImage(
      new File([await canvasBlob(c, "image/png")], "original.png", {
        type: "image/png",
      }),
    );
  }, color);
const archive = async (p) => {
  if (!(await p.locator("#project-file-dialog").isVisible()))
    await p.locator("#project-file-open").click();
  const pending = p.waitForEvent("download");
  await p.locator("#project-file-export").click();
  const download = await pending,
    stream = await download.createReadStream(),
    chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  await p.waitForFunction(() => !projectIOBusy);
  assert(download.suggestedFilename().endsWith(".comic.json"));
  return JSON.parse(Buffer.concat(chunks).toString());
};
const upload = async (p, data) => {
  if (!(await p.locator("#project-file-dialog").isVisible()))
    await p.locator("#project-file-open").click();
  const chooser = p.waitForEvent("filechooser");
  await p.locator("#project-file-import").click();
  await (
    await chooser
  ).setFiles({
    name: "project.comic.json",
    mimeType: "application/json",
    buffer: Buffer.from(typeof data === "string" ? data : JSON.stringify(data)),
  });
  await p.waitForFunction(
    () => !projectIOBusy && $("project-file-status").textContent !== "",
  );
};
const storedCounts = (p) =>
  p.evaluate(async () => ({
    projects: await request(
      db.transaction("projects").objectStore("projects").count(),
    ),
    assets: await request(
      db.transaction("assets").objectStore("assets").count(),
    ),
  }));
const normalized = (archive) => {
  const p = structuredClone(archive.project),
    assets = new Map(archive.assets.map((a) => [a.id, a.data]));
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    return Object.fromEntries(
      Object.entries(node)
        .filter(([key]) => key !== "id")
        .map(([key, value]) => [
          key,
          key === "asset" ? assets.get(value) : walk(value),
        ]),
    );
  };
  return walk(p);
};
try {
  await open(page);
  await page.locator("#lang-switcher").selectOption("pt");
  await page.locator("#project-new").click();
  await page.locator("#name-format").selectOption("b5JisLandscape");
  await name("História portátil 日本語");
  await page.locator("#issue-rename").click();
  await name("Primeira edição");
  await page.evaluate(() => {
    checkpoint();
    current().panels = splitPanels(
      current(),
      { x: 36, y: 350 },
      { x: 992, y: 350 },
    );
    changed(true);
  });
  await image("#008f7d");
  await page.locator("#image-zoom").fill("1.7");
  await page.locator("#image-zoom").dispatchEvent("change");
  await page.locator("#image-x").fill("45");
  await page.locator("#image-x").dispatchEvent("change");
  await page.locator("#balloon-add").click();
  await page
    .locator("#balloon-text")
    .fill("Olá, 日本語! <script>window.bad=true</script>");
  await page.locator("#balloon-text").blur();
  await page.locator("#new-balloon-kind").selectOption("thought");
  await page.locator("#balloon-add").click();
  await page.locator("#balloon-text").fill("Pensamento… 💭");
  await page.locator("#balloon-text").blur();
  await page.locator("#page-action").selectOption("duplicate");
  await page.locator("#page-position").selectOption("0");
  const originalPage = await page.evaluate(() => current().id);
  const expectedRender = await page.evaluate(async () =>
    (await exportCanvas(current())).toDataURL(),
  );
  await page.locator("#issue-new").click();
  await name("Edição 2");
  await image("#ffae55");
  await page.locator("#balloon-add").click();
  await page.locator("#balloon-text").fill("Outra edição");
  await page.locator("#balloon-text").blur();
  await page.waitForFunction(() => !saving);
  const source = await archive(page);
  assert.equal(source.format, "vc-comic-studio-project");
  assert.equal(source.version, 1);
  assert.equal(source.assets.length, 2, "shared images are embedded once");
  assert.equal(source.project.issues.length, 2);
  assert.equal(source.project.issues[0].pages.length, 2);
  assert.equal(
    source.project.issues[0].pages[0].id,
    originalPage,
    "reading order is preserved",
  );
  const countsBefore = await storedCounts(page);
  await upload(page, source);
  assert.equal(
    await page.evaluate(() => project().name),
    "História portátil 日本語 (2)",
  );
  const importedId = await page.evaluate(() => project().id);
  assert.notEqual(
    importedId,
    source.project.id,
    "same-browser imports create a distinct project",
  );
  assert.deepEqual(await storedCounts(page), {
    projects: countsBefore.projects + 1,
    assets: countsBefore.assets + 2,
  });
  const second = await archive(page);
  second.project.name = source.project.name;
  assert.deepEqual(
    normalized(second),
    normalized(source),
    "all editable data and original bytes survive a round trip",
  );
  const originalIds = new Set(
    source.project.issues.flatMap((i) => [
      i.id,
      ...i.pages.flatMap((pg) => [
        pg.id,
        ...pg.panels.map((p) => p.id),
        ...pg.balloons.map((b) => b.id),
      ]),
    ]),
  );
  const newIds = second.project.issues.flatMap((i) => [
    i.id,
    ...i.pages.flatMap((pg) => [
      pg.id,
      ...pg.panels.map((p) => p.id),
      ...pg.balloons.map((b) => b.id),
    ]),
  ]);
  assert(newIds.every((id) => !originalIds.has(id)));
  assert.equal(
    second.project.issues[0].pages[0].panels[0].image.asset,
    second.project.issues[0].pages[1].panels[0].image.asset,
    "shared image references remain shared",
  );
  assert.equal(
    await page.evaluate(async () =>
      (await exportCanvas(project().issues[0].pages[0])).toDataURL(),
    ),
    expectedRender,
    "artwork renders identically",
  );
  await page.locator("#project-file-close").click();
  await page.reload();
  await page.waitForFunction(() => ready);
  assert.equal(await page.evaluate(() => project().id), importedId);
  assert.equal(await page.evaluate(() => project().format), "b5JisLandscape");
  // Invalid files and transaction failure must not leave projects or orphan images behind.
  const before = await storedCounts(page),
    beforeSelection = await page.locator("#project-select").inputValue();
  const invalid = [
    "{bad json",
    { ...source, version: 99 },
    { ...source, format: "other-app" },
  ];
  const missing = structuredClone(source);
  missing.assets.pop();
  invalid.push(missing);
  const broken = structuredClone(source);
  broken.assets[1].data = Buffer.from("not an image").toString("base64");
  invalid.push(broken);
  const duplicate = structuredClone(source);
  duplicate.assets.push(duplicate.assets[0]);
  invalid.push(duplicate);
  const badGeometry = structuredClone(source);
  badGeometry.project.issues[0].pages[0].panels[0].points[0].x = null;
  invalid.push(badGeometry);
  const badFormat = structuredClone(source);
  badFormat.project.format = "__proto__";
  invalid.push(badFormat);
  for (const bad of invalid) {
    await upload(page, bad);
    assert.deepEqual(
      await storedCounts(page),
      before,
      "invalid input is atomic",
    );
    assert.equal(
      await page.locator("#project-select").inputValue(),
      beforeSelection,
    );
    assert(
      (await page.locator("#project-file-status").innerText()).includes(
        "Nada foi importado.",
      ),
    );
  }
  await page.evaluate(() => {
    window.originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === "projects")
        throw new DOMException("Test quota failure", "QuotaExceededError");
      return window.originalAdd.apply(this, args);
    };
  });
  await upload(page, source);
  assert.deepEqual(
    await storedCounts(page),
    before,
    "a failed metadata write rolls image writes back",
  );
  await page.evaluate(() => {
    IDBObjectStore.prototype.add = window.originalAdd;
    delete window.originalAdd;
  });
  await upload(page, source);
  assert.equal(
    (await storedCounts(page)).projects,
    before.projects + 1,
    "retrying the same file after failure works",
  );
  await page.locator("#project-file-close").click();
  for (const lang of ["en", "pt", "ja"]) {
    await page.locator("#lang-switcher").selectOption(lang);
    assert.equal(
      await page.evaluate(
        () => Object.keys(I18N.en).filter((k) => !I18N[lang][k]).length,
      ),
      0,
    );
  }
  // A separate browser can import while offline, even with no existing project.
  const cleanContext = await browser.newContext(),
    clean = await cleanContext.newPage();
  try {
    await open(clean);
    await cleanContext.setOffline(true);
    await clean.locator("#project-file-open").click();
    assert(await clean.locator("#project-file-export").isDisabled());
    await upload(clean, source);
    assert.equal(
      await clean.evaluate(() => project().name),
      source.project.name,
    );
    assert.equal(
      await clean.evaluate(async () =>
        (await exportCanvas(project().issues[0].pages[0])).toDataURL(),
      ),
      expectedRender,
    );
    assert.deepEqual(normalized(await archive(clean)), normalized(source));
    // Empty projects are portable too.
    await clean.locator("#project-file-close").click();
    await clean.locator("#issue-delete").click();
    await clean.locator("#confirm-yes").click();
    await clean.locator("#issue-delete").click();
    await clean.locator("#confirm-yes").click();
    const empty = await archive(clean);
    assert.equal(empty.project.issues.length, 0);
    assert.equal(empty.assets.length, 0);
    await upload(clean, empty);
    assert.equal(await clean.evaluate(() => project().issues.length), 0);
  } finally {
    await cleanContext.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: complete JSON transfer, embedded original images, shared assets, multi-issue page order, ID remapping, duplicate import, exact rendering, persistence, invalid input, atomic quota failure, offline clean-browser import and empty projects.",
  );
} finally {
  await browser.close();
}
