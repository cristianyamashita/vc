// Run: NODE_PATH=<directory containing playwright> node scripts/tests/range_club.mjs
// Start a static server at RANGE_CLUB_URL (default http://127.0.0.1:8765).
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import {
  WEAPONS,
  stageConfig,
  award,
  paperScore,
  acceleration,
  sanitizeSave,
} from "../../page/game/range-club/core.js";
import { messages } from "../../page/game/range-club/i18n.js";
const require = createRequire(import.meta.url),
  { chromium } = require("playwright");
const url = process.env.RANGE_CLUB_URL || "http://127.0.0.1:8765";
for (const lang of ["pt", "ja"])
  assert.deepEqual(
    Object.keys(messages[lang]).sort(),
    Object.keys(messages.en).sort(),
    `Translation coverage ${lang}`,
  );
assert.equal(stageConfig(12).distance, 78);
assert(stageConfig(12).goal <= 12 * 40);
assert(stageConfig(5).moving);
assert.equal(stageConfig(1).moving, false);
assert.equal(paperScore(0, 0), 50);
assert.equal(paperScore(0.7, 0.8), 10);
assert.equal(award(600, 1), 800);
assert(acceleration(5, WEAPONS[3]).x > acceleration(5, WEAPONS[0]).x);
assert.deepEqual(sanitizeSave({ stage: 99, credits: -1, owned: ["bogus"] }), {
  stage: 12,
  credits: 0,
  owned: ["revolver"],
  completed: false,
  best: 0,
});
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await ctx.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const state = () => page.evaluate(() => rangeClub.state);
const ready = () =>
  page.waitForFunction(() => window.rangeClub, { timeout: 30000 });
async function lobby() {
  if ((await state()).active) {
    await page.keyboard.press("Escape");
    await page.locator("#leave").click();
  }
}
async function aimedShot(index = 2, offset = -4) {
  const p = await page.evaluate((i) => rangeClub.targetScreens[i], index);
  await page.mouse.move(p.x, p.y + offset);
  await page.waitForTimeout(80);
  await page.mouse.click(p.x, p.y + offset);
}
try {
  await page.goto(url + "/page/game/range-club/index.html");
  await ready();
  const startPlacement = await page.evaluate(() => {
    const setup = document.querySelector("#setup"),
      weapon = document.querySelector("#weapon-card"),
      start = document.querySelector("#start"),
      targets = document.querySelector("#photos-button").closest("section");
    setup.scrollTop = 0;
    return {
      afterEquipment: Boolean(
        weapon.compareDocumentPosition(start) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      beforeTargets: Boolean(
        start.compareDocumentPosition(targets) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      visibleWithoutScroll:
        start.getBoundingClientRect().bottom <=
        setup.getBoundingClientRect().bottom,
    };
  });
  assert.deepEqual(startPlacement, {
    afterEquipment: true,
    beforeTargets: true,
    visibleWithoutScroll: true,
  });
  for (const env of ["indoor", "field", "forest"]) {
    await page.locator(`[data-env="${env}"]`).click();
    assert.equal((await state()).config.env, env);
    if (env === "indoor") assert(await page.locator("#wind").isDisabled());
  }
  await page.locator("#sway").uncheck();
  await page.locator("#wind").fill("0");
  await page.locator("#wind").dispatchEvent("input");
  await page.locator("#start").click();
  await page.waitForTimeout(250);
  await aimedShot();
  await page.waitForFunction(() => rangeClub.state.projectiles === 0);
  assert.equal((await state()).round.hits, 1);
  await page.keyboard.press("r");
  await page.keyboard.press("Escape");
  const paused = await state();
  await page.waitForTimeout(300);
  assert.equal((await state()).reloadLeft, paused.reloadLeft);
  await page.locator("#resume").click();
  await page.waitForTimeout(1600);
  assert.equal((await state()).round.ammo, 6);
  await lobby();
  for (const id of ["pistol", "shotgun", "bow", "rifle"]) {
    await page.locator("#armory").click();
    await page.locator(`[data-equip="${id}"]`).click();
    await page.locator("#close-modal").click();
    assert.equal((await state()).weapon, id);
    await page.locator("#start").click();
    await page.waitForTimeout(150);
    await aimedShot(2, id === "bow" ? -34 : -5);
    await page.waitForTimeout(600);
    assert.equal((await state()).round.shots, 1);
    assert.equal((await state()).round.hits, 1, `${id} hits paper`);
    await lobby();
  }
  await page.locator("#armory").click();
  await page.locator('[data-equip="revolver"]').click();
  await page.locator("#close-modal").click();
  for (const type of ["can", "bottle"]) {
    await page.locator(`[data-target="${type}"]`).click();
    await page.locator("#start").click();
    await page.waitForTimeout(160);
    await aimedShot();
    await page.waitForTimeout(450);
    assert.equal((await state()).round.hits, 1, `${type} hit`);
    assert((await page.evaluate(() => rangeClub.targetScreens[2].down)) > 0);
    await page.waitForTimeout(1750);
    assert((await page.evaluate(() => rangeClub.targetScreens[2].down)) <= 0);
    await lobby();
  }
  await page.locator('[data-mode="tournament"]').click();
  await page.locator("#armory").click();
  await page.locator('[data-equip="rifle"]').click();
  assert.equal((await state()).save.credits, 0);
  assert.equal((await state()).weapon, "revolver");
  await page.locator("#close-modal").click();
  await page.locator("#start").click();
  for (let i = 0; i < 12; i++) {
    if (i === 6) {
      await page.keyboard.press("r");
      await page.waitForTimeout(1550);
    }
    await aimedShot();
    await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => document.querySelector("#modal").open);
  const result = await state();
  assert(result.round.finished);
  assert.equal(result.round.shots, 12);
  assert.equal(result.save.stage, 2);
  assert.equal(result.save.credits, award(result.round.score, 1));
  await page.locator("#result-armory").click();
  await page.locator('[data-equip="pistol"]').click();
  assert.equal((await state()).save.credits, result.save.credits - 650);
  assert((await state()).save.owned.includes("pistol"));
  await page.locator("#close-modal").click();
  await page.reload();
  await ready();
  assert.equal((await state()).save.stage, 2);
  assert.equal((await state()).weapon, "pistol");
  assert.equal((await state()).config.distance, 18);
  // A failed round must not award credits or advance the saved stage.
  const beforeFailure = (await state()).save;
  await page.locator("#start").click();
  for (let i = 0; i < 12; i++) {
    await page.mouse.click(220, 750);
    await page.waitForTimeout(270);
  }
  await page.waitForSelector("#result-club");
  assert.equal((await state()).save.stage, beforeFailure.stage);
  assert.equal((await state()).save.credits, beforeFailure.credits);
  await page.locator("#result-club").click();
  // The visible setup control uploads immediately; records survive reload and backup.
  assert.equal(await page.locator("#target-upload").count(), 1);
  assert(await page.locator(".target-upload-button").isVisible());
  await page.locator("#target-upload").setInputFiles({
    name: "target.png",
    mimeType: "image/png",
    buffer: await readFile(
      new URL(
        "../../page/assets/icons/png/game-range-club.png",
        import.meta.url,
      ),
    ),
  });
  await page.waitForFunction(() => rangeClub.state.photos === 1);
  assert(await page.locator("#target-upload-image").isVisible());
  assert.equal(
    await page.locator("#target-upload-status").innerText(),
    "1/4 imagens salvas",
  );
  assert.equal((await state()).config.usePhotos, true);
  await page.reload();
  await ready();
  assert.equal((await state()).photos, 1);
  const backupPage = await ctx.newPage();
  await backupPage.goto(url + "/page/utils/backup.html");
  const downloadPromise = backupPage.waitForEvent("download");
  await backupPage.locator("#btn-export").click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(exported.indexedDB.RangeClubDB.stores.photos.length, 1);
  assert(exported.localStorage["rangeClub.save.v1"]);
  assert(exported.localStorage["rangeClub.prefs.v1"]);
  await page.goto("about:blank");
  await backupPage.evaluate(async () => {
    localStorage.removeItem("rangeClub.save.v1");
    await new Promise((resolve, reject) => {
      const r = indexedDB.deleteDatabase("RangeClubDB");
      r.onsuccess = resolve;
      r.onerror = reject;
    });
  });
  backupPage.on("dialog", (dialog) => dialog.accept());
  await backupPage.locator("#file-input").setInputFiles({
    name: "range-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await backupPage.locator("#btn-import-merge").click();
  await backupPage.waitForFunction(
    () => !!localStorage.getItem("rangeClub.save.v1"),
  );
  await backupPage.waitForFunction(
    () => !document.querySelector("#btn-import-merge").disabled,
  );
  await backupPage.close();
  await page.goto(url + "/page/game/range-club/index.html");
  await ready();
  assert.equal((await state()).photos, 1);
  assert.equal((await state()).save.stage, 2);
  await page.locator("#target-use-photos").uncheck();
  assert.equal((await state()).config.usePhotos, false);
  await page.locator("#target-use-photos").check();
  assert(await page.locator("#target-remove-photo").isVisible());
  await page.locator("#target-remove-photo").click();
  await page.waitForFunction(() => rangeClub.state.photos === 0);
  assert(await page.locator("#target-upload-image").isHidden());
  assert(await page.locator("#target-remove-photo").isHidden());
  for (const lang of ["en", "ja", "pt"]) {
    await page.locator("#language").selectOption(lang);
    assert.equal(await page.locator("html").getAttribute("lang"), lang);
    assert.equal(
      await page.locator("#start span").innerText(),
      messages[lang].start,
    );
  }
  await page.locator("#theme").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.reload();
  await ready();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.setViewportSize({ width: 390, height: 844 });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.locator("#start").scrollIntoViewIfNeeded();
  assert(await page.locator("#start").isVisible());
  assert.deepEqual(errors, []);
  console.log(
    "PASS: physics, translations, three scenes, five weapons, reload/pause, target reactions, tournament rewards/failure/purchase, photos, backup export/restore, persistence and mobile layout.",
  );
} finally {
  await browser.close();
}
