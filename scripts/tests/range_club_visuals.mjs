// Same Playwright setup and static server as range_club.mjs; isolated browser data.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const url = process.env.RANGE_CLUB_URL || "http://127.0.0.1:8765";
const visual = () => page.evaluate(() => rangeClub.visualState);
async function leave() {
  await page.keyboard.up("Space");
  await page.keyboard.press("Escape");
  await page.locator("#leave").click();
  assert.equal((await visual()).flying.length, 0);
}
async function equip(id) {
  await page.locator("#armory").click();
  await page.locator(`[data-equip="${id}"]`).click();
  await page.locator("#close-modal").click();
}
async function pointAtTarget(offset = 0) {
  const target = await page.evaluate(() => rangeClub.targetScreens[2]);
  await page.mouse.move(target.x, target.y + offset);
  await page.waitForTimeout(70);
}
async function captureFlight() {
  // Sample frames rather than depending on a screenshot catching a fast bullet.
  await page.evaluate(() => {
    window.flightSamples = [];
    let observed = false;
    const until = performance.now() + 5000;
    const frame = () => {
      const v = rangeClub.visualState;
      if (v.flying.length) {
        observed = true;
        flightSamples.push(structuredClone(v.flying));
      }
      if ((observed && !v.flying.length) || performance.now() > until) return;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await page.mouse.down();
  await page.mouse.up();
}
try {
  await page.goto(url + "/page/game/range-club/index.html");
  await page.waitForFunction(() => window.rangeClub);
  await page.locator("#sway").uncheck();
  await page.locator("#wind").fill("0");
  await page.locator("#wind").dispatchEvent("input");
  await equip("bow");
  await page.locator("#start").click();
  await pointAtTarget(-34);
  assert.equal((await visual()).bowRoll, 0);
  assert.equal((await visual()).nockedArrow, true);
  await captureFlight();
  await page.waitForFunction(() => rangeClub.state.projectiles === 1);
  assert.equal((await visual()).nockedArrow, false);
  await page.keyboard.press("Escape");
  const paused = await visual();
  await page.waitForTimeout(220);
  assert.deepEqual(
    (await visual()).flying,
    paused.flying,
    "Flying arrow freezes while paused",
  );
  await page.locator("#resume").click();
  await page.waitForFunction(() => rangeClub.visualState.embeddedArrows === 1);
  const samples = await page.evaluate(() => flightSamples.flat());
  assert(samples.length > 2);
  assert(samples.every((sample) => sample.arrow && sample.direction[2] < 0));
  assert(
    samples.at(-1).position[2] < samples[0].position[2] - 3,
    "Arrow advances toward target",
  );
  assert.equal((await visual()).nockedArrow, false);
  await page.keyboard.press("r");
  await page.waitForFunction(
    () => rangeClub.state.reloadLeft === 0 && rangeClub.visualState.nockedArrow,
  );
  assert.equal((await visual()).bowRoll, 0, "Reload does not roll the bow");
  await leave();
  for (const id of ["revolver", "pistol", "shotgun", "rifle"]) {
    await equip(id);
    await page.locator("#start").click();
    await page.keyboard.down("Space");
    await page.waitForFunction(() => rangeClub.visualState.sightBlend > 0.999);
    await pointAtTarget(-4);
    await page.waitForTimeout(80);
    const sights = await visual();
    if (id === "rifle") {
      assert(await page.locator("#scope-view").isVisible());
      assert(sights.fov < 14.3, "Scope magnifies the actual 3D camera");
    } else {
      assert(await page.locator("#scope-view").isHidden());
      assert(Math.abs(sights.sights[0][0] - sights.sights[1][0]) < 0.002);
      assert(
        Math.abs(sights.sights[0][1] - sights.sights[1][1]) < 0.002,
        "Front and rear sights align on screen",
      );
    }
    await captureFlight();
    await page.waitForFunction(() => rangeClub.state.round.hits > 0);
    await page.waitForFunction(() => rangeClub.state.projectiles === 0);
    const bullets = await page.evaluate(() => flightSamples);
    assert(bullets.length > 0, `${id} has visible bullets in flight`);
    assert(bullets.flat().every((bullet) => !bullet.arrow));
    if (id === "shotgun") assert(bullets.some((frame) => frame.length === 7));
    await page.keyboard.press("r");
    if (id === "rifle")
      await page.locator("#scope-view").waitFor({ state: "hidden" });
    await page.keyboard.press("Escape");
    await page.locator("#scope-view").waitFor({ state: "hidden" });
    await page.locator("#leave").click();
    await page.keyboard.up("Space");
    assert.equal((await visual()).flying.length, 0);
  }
  // Touch zoom must expose the same scope and remain usable at narrow widths.
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobile = await mobileContext.newPage();
  await mobile.goto(url + "/page/game/range-club/index.html");
  await mobile.waitForFunction(() => window.rangeClub);
  await mobile.locator("#weapon-card").click();
  await mobile.locator('[data-equip="rifle"]').click();
  await mobile.locator("#close-modal").click();
  await mobile.locator("#start").tap();
  await mobile.locator("#touch-zoom").tap();
  await mobile.waitForFunction(
    () => !document.querySelector("#scope-view").hidden,
  );
  const lens = await mobile.locator("#scope-view").boundingBox();
  assert(lens.width < 390);
  assert(await mobile.locator("#touch-fire").isVisible());
  await mobile.locator("#touch-zoom").tap();
  await mobile.locator("#scope-view").waitFor({ state: "hidden" });
  await mobileContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: upright bow, visible flight, pause/reload, embedded arrows, bullets and seven pellets, aligned iron sights, scoped hits and touch scope.",
  );
} finally {
  await browser.close();
}
