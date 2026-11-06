// Serve the repo, then: VC_URL=http://127.0.0.1:8765 node scripts/tests/desktop_spatial_sheets.mjs
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export async function run(browser, base = 'http://127.0.0.1:8765') {
  const context = await browser.newContext({ viewport: { width: 960, height: 640 } });
  await context.addInitScript(() => {
    if (!localStorage.getItem('app_lang')) localStorage.setItem('app_lang', 'pt');
    if (!localStorage.getItem('app_theme')) localStorage.setItem('app_theme', 'light');
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const go = async address => {
    await page.locator('.sheets-namebox').fill(address);
    await page.locator('.sheets-namebox').press('Enter');
  };
  const cell = (r, c) => page.locator(`.sheets-cell[data-r="${r}"][data-c="${c}"]`).first();
  const settleSave = () => page.waitForFunction(() => document.querySelector('.sheets-save-state')?.dataset.state === 'saved');
  const checkBounds = async () => {
    const bounds = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight,
      viewport: [innerWidth, innerHeight],
      bar: document.querySelector('.sheets-rtabs')?.getBoundingClientRect().height,
    }));
    assert(bounds.width <= bounds.viewport[0], 'no horizontal page scrolling');
    assert(bounds.height <= bounds.viewport[1], 'no vertical page scrolling');
    if (bounds.bar) assert(bounds.bar <= 44, 'compact app bar');
  };
  try {
    await page.goto(base + '/page/os/apps/sheets/');
    await page.locator('.sheets-body').waitFor();
    await page.locator('.sheets-file').setInputFiles({
      name: 'Vendas.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Produto,Quantidade,Preço,Total\nCaderno,3,8,\nCaneta,5,4,\nAgenda,2,25,\nPasta,4,6,\n'),
    });
    await page.waitForFunction(() => document.querySelector('.sheets-book-name')?.value === 'Vendas');
    await go('D2');
    await page.locator('.sheets-bar').fill('=B2*C2');
    await page.locator('.sheets-bar').press('Enter');
    assert.equal(await cell(1, 3).innerText(), '24');
    await go('A1:D5');
    await page.locator('[data-act="tableStyle"]').click();
    assert.equal(await page.locator('.sheets-style-range').innerText(), 'A1:D5');
    await page.locator('[data-style-choice="jade"]').click();
    assert.equal(await cell(0, 0).evaluate(el => el.style.backgroundColor), 'rgb(0, 107, 94)');
    assert.equal(await cell(1, 0).evaluate(el => el.style.backgroundColor), 'rgb(227, 242, 237)');
    assert.equal(await cell(2, 0).evaluate(el => el.style.backgroundColor), 'rgb(255, 255, 255)');
    await page.locator('[data-act="undo"]').click();
    assert.equal(await cell(0, 0).evaluate(el => el.style.backgroundColor), '', 'style is one undo step');
    await page.locator('[data-act="redo"]').click();
    assert.equal(await cell(0, 0).evaluate(el => el.style.backgroundColor), 'rgb(0, 107, 94)');
    await go('D2');
    assert.equal(await page.locator('.sheets-bar').inputValue(), '=B2*C2', 'styles preserve formulas');
    await settleSave();
    await page.reload();
    await page.locator('.sheets-body').waitFor();
    assert.equal(await cell(1, 3).innerText(), '24', 'formula survives reload');
    assert.equal(await cell(0, 0).evaluate(el => el.style.backgroundColor), 'rgb(0, 107, 94)', 'style survives reload');
    await go('B2:D5');
    assert.match(await page.locator('.sheets-status-stats').innerText(), /Soma/);
    await page.locator('[data-act="toggleRibbon"]').click();
    assert.equal(await page.locator('.sheets-ribbon-row.compact').count(), 0);
    await page.reload();
    await page.locator('.sheets-body').waitFor();
    assert.equal(await page.locator('.sheets-ribbon-row.compact').count(), 0, 'toolbar preference persists');
    await page.locator('[data-act="toggleRibbon"]').click();
    for (const language of ['en', 'pt', 'ja']) {
      await page.locator('#lang-switcher').selectOption(language);
      assert.equal(await page.locator('html').getAttribute('lang'), language);
      assert(!/sheets[A-Z]/.test(await page.locator('.sheets-ribbon').innerText()));
      await checkBounds();
    }
    await page.locator('#lang-switcher').selectOption('pt');
    await page.locator('#theme-switcher').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.setViewportSize({width: 640, height: 560});
    await checkBounds();
    await page.setViewportSize({width: 960, height: 640});
    // Large batch edits notify once and remain one undo step.
    const batch = await page.evaluate(() => {
      const api = OSSheetsEngine.createWorkbook('Batch');
      const sid = api.data.activeSheetId;
      let notifications = 0;
      api.onChange(() => notifications++);
      api.beginBatch();
      for (let r = 0; r < 100; r++) api.setCell(sid, r, 0, String(r + 1));
      api.endBatch();
      const count = notifications;
      api.undo();
      const empty = api.getRaw(sid, 99, 0);
      api.redo();
      return {count, empty, value: api.getValue(sid, 99, 0)};
    });
    assert.deepEqual(batch, {count: 1, empty: '', value: 100});

    await page.goto(base + '/page/os/');
    await page.waitForFunction(() => window.OS?.state);
    await page.evaluate(async () => { OS.state.onboarded = true; await OS.persistNow(); });
    await page.reload();
    await page.waitForFunction(() => window.OS?.state && !document.documentElement.dataset.setup);
    await page.evaluate(() => {
      OSWindows.open('sheets'); OSWindows.open('notepad'); OSWindows.open('calculator');
    });
    await page.frameLocator('.os-window[data-app-id="sheets"] iframe').locator('.sheets-body').waitFor();
    const sheets = page.frames().find(frame => frame.url().includes('/sheets/'));
    await sheets.locator('.sheets-body').waitFor();
    await sheets.evaluate(() => { window.frameSentinel = 'same document'; });
    const before = await page.evaluate(() => OSWindows.serialize().map(({id,x,y,w,h,minimized,maximized}) => ({id,x,y,w,h,minimized,maximized})));
    await page.locator('#space-btn').click();
    assert.equal(await page.locator('.space-target').count(), 3);
    assert.equal(await page.locator('#windows').getAttribute('role'), 'dialog');
    assert.equal(await page.locator('#desktop').evaluate(el => el.inert), true);
    // Live preview and click target occupy the same transformed rectangle.
    const alignment = await page.evaluate(() => {
      const button = document.querySelector('.space-selected');
      const win = OSWindows.list().sort((a,b) => b.z-a.z)[0].el;
      const a = button.getBoundingClientRect(), b = win.getBoundingClientRect();
      return Math.abs(a.x-b.x) + Math.abs(a.y-b.y) + Math.abs(a.width-b.width);
    });
    assert(alignment < 2, 'live preview aligns with its target');
    await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('.space-caption').innerText(), /2 \/ 3/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#desktop').evaluate(el => el.inert), false);
    const after = await page.evaluate(() => OSWindows.serialize().map(({id,x,y,w,h,minimized,maximized}) => ({id,x,y,w,h,minimized,maximized})));
    assert.deepEqual(after, before, 'overview preserves geometry and window state');
    assert.equal(await sheets.evaluate(() => window.frameSentinel), 'same document', 'overview never reloads frames');
    // Minimized windows are previewed and restored by selection.
    await page.evaluate(() => OSWindows.minimize('sheets'));
    await page.locator('#space-btn').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => OSWindows.get('sheets').minimized), false);
    assert.equal(await page.evaluate(() => OSWindows.focusedId()), 'sheets');
    assert.equal(await sheets.evaluate(() => window.frameSentinel), 'same document');
    await sheets.locator('.sheets-body').focus();
    await page.keyboard.press('Control+Alt+o');
    assert.equal(await page.locator('.space-view').count(), 1, 'shortcut works inside app iframe');
    await page.keyboard.press('Escape');
    await page.evaluate(() => OS.applyReducedMotion(true));
    await page.locator('#space-btn').click();
    assert.equal(await page.locator('.space-window').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    await page.keyboard.press('Escape');
    // All-minimized and empty desktops remain navigable.
    await page.evaluate(() => OSWindows.list().forEach(win => OSWindows.close(win.id)));
    await page.locator('#space-btn').click();
    assert.equal(await page.locator('.space-target').count(), 0);
    assert.match(await page.locator('.space-caption').innerText(), /Abra um app/);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    return 'PASS: editing, table styles, undo/redo, persistence, EN/PT/JA, themes, layout, batches, 3D switching, frame preservation, minimized windows, keyboard and reduced motion';
  } finally {
    await context.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { createRequire } = await import('node:module');
  const { chromium } = createRequire(import.meta.url)('playwright');
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true });
  try { console.log(await run(browser, process.env.VC_URL)); }
  finally { await browser.close(); }
}
