const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

// All reads/writes are mocked. This suite never calls production services.
const appRoot = __dirname;
const failures = [];
const results = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fixture(page) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'test.local') return route.abort();
    const file = path.join(appRoot, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    if (!file.startsWith(appRoot) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const types = { '.png': 'image/png', '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
    return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
  });
  await page.addInitScript(() => {
    window.fixture = [];
    window.writes = [];
    window.queries = [];
    window.testDay = { date: '2026-10-15', updated_at: '2026-10-15T04:00:00', current_topic: 'Is doing nothing a waste of time?' };
    window.supabase = { createClient: () => ({ from(table) {
      let mode = 'read', payload;
      const filters = [];
      const query = {
        select() { return query; }, order() { return query; }, limit() { return query; },
        gte(field, value) { filters.push({ op: 'gte', field, value }); return query; },
        eq(field, value) { filters.push({ op: 'eq', field, value }); return query; },
        insert(value) { mode = 'insert'; payload = value; return query; },
        update(value) { mode = 'update'; payload = value; return query; },
        then(resolve) {
          window.queries.push({ table, mode, filters });
          let data;
          if (table === 'daily_state') data = [{ ...window.testDay }];
          else if (mode === 'insert') {
            data = payload.map((row, index) => ({ id: 100 + index, ...row, echo_count: 0, created_at: '2026-10-15T05:00:00Z' }));
            window.fixture.push(...data); window.writes.push({ mode, table, payload });
          } else {
            data = window.fixture.filter(row => filters.every(filter => filter.op === 'eq'
              ? row[filter.field] === filter.value
              : new Date(row[filter.field]) >= new Date(filter.value)));
            if (mode === 'update') {
              data.forEach(row => Object.assign(row, payload)); window.writes.push({ mode, table, payload });
            }
          }
          return Promise.resolve({ data: data.map(row => ({ ...row })), error: null }).then(resolve);
        }
      };
      return query;
    } }) };
  });
  await page.goto('https://test.local/');
  await page.waitForFunction(() => document.querySelector('.daily-question').textContent === window.testDay.current_topic);
}

async function main() {
  const launchOptions = { headless: true };
  if (process.env.OPINION_BROWSER_PATH) {
    launchOptions.executablePath = process.env.OPINION_BROWSER_PATH;
    launchOptions.args = process.env.OPINION_BROWSER_ARGS ? JSON.parse(process.env.OPINION_BROWSER_ARGS) : ['--no-sandbox'];
  }
  async function check(name, viewport, run) {
    // The compact Chromium runtime uses single-process mode; closing one
    // context can exit the process, so each scenario gets its own browser.
    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await fixture(page);
      await run(page, context);
      assert.deepEqual(errors, [], 'No uncaught page errors');
      results.push(name);
      console.log(`PASS ${name}`);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
      console.error(`FAIL ${name}: ${error.message}`);
    } finally { await browser.close(); }
  }

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    await check(`mobile layout and text at ${viewport.width}×${viewport.height}`, viewport, async page => {
      const initial = await page.locator('#input').boundingBox();
      if (viewport.width === 390) assert(initial.y < 650, `Writing should start near the initial viewport; textarea top ${initial.y}`);
      for (const text of ['W'.repeat(40), '🪨'.repeat(40), 'Small takes make room for big ideas.']) {
        await page.locator('#input').fill(text);
        assert.equal(await page.locator('#previewText').textContent(), text);
        assert(await page.locator('#submitBtn').isEnabled());
        const clipping = await page.locator('#previewText').evaluate(el => ({ h: el.clientHeight, sh: el.scrollHeight, w: el.clientWidth, sw: el.scrollWidth }));
        assert(clipping.sh <= clipping.h + 1 && clipping.sw <= clipping.w + 1, `Preview clips ${JSON.stringify(clipping)}`);
      }
      assert(await page.locator('#phase1').evaluate(el => el.scrollWidth <= innerWidth), 'No horizontal overflow');
      await page.locator('#submitBtn').scrollIntoViewIfNeeded();
      const target = await page.locator('#submitBtn').boundingBox();
      assert(target.height >= 44 && target.width >= 44, 'Submit has 44px touch target');
      assert(target.y >= 0 && target.y + target.height <= viewport.height + 1, 'Submit reachable in scroll container');
      if (viewport.width === 390) {
        await page.locator('#phase1').evaluate(el => el.scrollTop = 0);
        await page.screenshot({ path: path.join(appRoot, 'mobile-updated.png') });
      }
    });
  }

  await check('short viewport while typing (keyboard-sized resize)', { width: 390, height: 844 }, async page => {
    await page.locator('#input').fill('A tiny take with a big point.');
    await page.locator('#input').focus();
    await page.setViewportSize({ width: 390, height: 380 });
    await page.locator('#input').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#input').inputValue(), 'A tiny take with a big point.');
    assert(await page.locator('#input').evaluate(el => document.activeElement === el));
    await page.locator('#submitBtn').scrollIntoViewIfNeeded();
    const box = await page.locator('#submitBtn').boundingBox();
    assert(box.y >= 0 && box.y + box.height <= 381, 'Submit reachable after keyboard-sized viewport resize');
    assert(await page.locator('#phase1').evaluate(el => el.scrollWidth <= innerWidth), 'No overflow when keyboard is open');
  });

  await check('long question and existing 80-character rocks remain readable', { width: 320, height: 568 }, async page => {
    await page.evaluate(async () => {
      window.testDay.current_topic = 'Should you be allowed to take a nap at work if you can finish all your tasks before everyone else?';
      await loadDailyTopic();
      window.fixture = [{ id: 1, text: 'W'.repeat(80), echo_count: 0, created_at: '2026-10-15T05:00:00Z' }];
      goToValley();
    });
    await page.locator('#opinionValley .rock').first().waitFor();
    for (const view of ['rock', 'list']) {
      const text = page.locator('#opinionValley .rock-text').first();
      const clip = await text.evaluate(el => ({ h: el.clientHeight, sh: el.scrollHeight, w: el.clientWidth, sw: el.scrollWidth }));
      assert(clip.sh <= clip.h + 1 && clip.sw <= clip.w + 1, `${view} view clips legacy 80-character take: ${JSON.stringify(clip)}`);
      assert(await page.locator('#phase2').evaluate(el => el.scrollWidth <= innerWidth), `${view} view has no horizontal overflow`);
      if (view === 'rock') await page.locator('#toggleViewBtn').click();
    }
  });

  await check('touch echo toggles once; vertical swipe scrolls without echo', { width: 390, height: 650 }, async (page, context) => {
    await page.evaluate(async () => {
      window.fixture = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, text: `A tiny take ${i + 1}`, echo_count: 0, created_at: '2026-10-15T05:00:00Z' }));
      goToValley();
    });
    await page.locator('#opinionValley .rock').first().waitFor();
    await page.locator('#toggleViewBtn').click();
    const rock = page.locator('#opinionValley .rock').first();
    await rock.tap();
    await page.waitForFunction(() => window.writes.length === 1);
    assert.equal(await rock.getAttribute('aria-pressed'), 'true');
    await rock.tap();
    await page.waitForFunction(() => window.writes.length === 2);
    assert.equal(await rock.getAttribute('aria-pressed'), 'false');
    await page.locator('#toggleViewBtn').click();
    await page.locator('#phase2').evaluate(el => el.scrollTop = 0);
    await page.screenshot({ path: path.join(appRoot, 'mobile-explore-updated.png') });
    await page.locator('#toggleViewBtn').click();
    await rock.scrollIntoViewIfNeeded();
    const box = await rock.boundingBox();
    const before = await page.locator('#phase2').evaluate(el => el.scrollTop);
    const session = await context.newCDPSession(page);
    const x = box.x + box.width / 2;
    const y = Math.min(box.y + box.height / 2, 540);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 23 }] });
      await delay(18);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await delay(120);
    const after = await page.locator('#phase2').evaluate(el => el.scrollTop);
    assert(after > before + 15, `Touch gesture should scroll the valley: ${before} → ${after}`);
    assert.equal(await page.evaluate(() => window.writes.length), 2, 'Scrolling must not save an echo');
  });

  await check('share dialog controls remain reachable on short phone', { width: 320, height: 568 }, async page => {
    await page.locator('#input').fill('A little rock. A point of view.');
    await page.locator('#submitBtn').click();
    await page.locator('#shareSection').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#downloadBtn').disabled);
    await page.screenshot({ path: path.join(appRoot, 'share-dialog-mobile.png') });
    const buttons = page.locator('#shareSection button:visible:not([disabled]), #shareSection a[href]:visible');
    const count = await buttons.count();
    assert(count >= 3, 'Share/download/close controls exist');
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      assert(box.x >= -1 && box.x + box.width <= 321, `Share button fits width: ${await button.textContent()}`);
      assert(box.y >= -1 && box.y + box.height <= 569, `Share button reachable vertically: ${await button.textContent()}`);
      assert(box.height >= 44 && box.width >= 44, `44px share touch target: ${await button.textContent()}`);
    }
    assert(await page.locator('#phase1').evaluate(el => el.inert), 'Background cannot receive focus behind modal');
    await buttons.last().focus();
    await page.keyboard.press('Tab');
    assert(await buttons.first().evaluate(el => el === document.activeElement), 'Tab wraps within share dialog');
    await page.keyboard.press('Shift+Tab');
    assert(await buttons.last().evaluate(el => el === document.activeElement), 'Shift+Tab wraps within share dialog');
    await page.locator('#closeShareCard').click();
    assert(await page.locator('#shareSection').isHidden());
    assert(await page.locator('#phase2').isVisible());
    assert(!(await page.locator('#phase2').evaluate(el => el.inert)));
    await page.locator('#shareLastRockBtn').click();
    await page.waitForFunction(() => !document.querySelector('#downloadBtn').disabled);
    assert(await page.locator('#shareSection').isVisible(), 'Can reopen this session’s rock for sharing');
    await page.keyboard.press('Escape');
  });

  await check('daily reset hides old rocks and stale share; keeps current draft', { width: 390, height: 844 }, async page => {
    await page.locator('#input').fill('Today gets a fresh start.');
    await page.locator('#submitBtn').click();
    await page.locator('#shareSection').waitFor({ state: 'visible' });
    await page.evaluate(async () => {
      document.querySelector('#input').value = 'My unsent draft';
      window.testDay = { date: '2026-10-16', updated_at: '2026-10-16T04:00:00', current_topic: 'Is a hot dog a sandwich?' };
      await loadDailyTopic();
      await loadOpinions();
    });
    assert(await page.locator('#shareSection').isHidden(), 'Old day share dialog closes');
    assert(await page.locator('#shareLastRockBtn').isHidden(), 'Cannot reopen prior-day share');
    assert.equal(await page.locator('#input').inputValue(), 'My unsent draft', 'Unsent draft survives for review');
    assert.equal(await page.locator('#phase1 .daily-question').textContent(), 'Is a hot dog a sandwich?');
    assert.equal(await page.locator('#opinionValley .rock').count(), 0, 'Prior-day rocks no longer exposed');
    const scoped = await page.evaluate(() => window.queries.filter(q => q.table === 'opinions' && q.mode === 'read').every(q => q.filters.some(f => f.op === 'gte' && f.field === 'created_at')));
    assert(scoped, 'Every opinion read is scoped to the verified daily cycle');
  });
  await check('desktop screenshot', { width: 1440, height: 1000 }, async page => {
    await page.locator('#input').fill('Small takes make room for big ideas.');
    await page.screenshot({ path: path.join(appRoot, 'desktop-updated.png') });
  });
  console.log(`${results.length} passed; ${failures.length} failed. All data mocked; no production writes. Real iOS/Android keyboard and OS share-sheet behavior need physical-device confirmation.`);
  if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
