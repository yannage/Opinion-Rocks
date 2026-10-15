// Encore interaction checks. All external requests are blocked; Supabase,
// native sharing, and visitor content are fixtures. No production reads/writes.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const root = __dirname;
const failures = [];
const launch = { headless: true, executablePath: process.env.OPINION_BROWSER_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process'] };
async function fixture(page) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'encore.test') return route.abort();
    if (url.pathname === '/qa-fredoka.ttf' && fs.existsSync('/tmp/opinion-fredoka.ttf'))
      return route.fulfill({ body: fs.readFileSync('/tmp/opinion-fredoka.ttf'), contentType: 'font/ttf' });
    const file = path.resolve(root, url.pathname === '/' ? 'index.html' : '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
    return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
  });
  await page.addInitScript(() => {
    window.fixture = [];
    window.writes = [];
    window.failWrite = null;
    window.writeDelay = 0;
    window.shareCalls = [];
    window.testDay = { date: '2026-10-15', updated_at: '2026-10-15T04:00:00Z', current_topic: 'Is doing nothing a waste of time?' };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => data.files?.[0]?.type === 'image/png' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => window.shareCalls.push({ type: data.files?.[0]?.type, active: navigator.userActivation.isActive }) });
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
          if (mode !== 'read') window.writes.push({ mode, table, payload });
          return new Promise(done => setTimeout(() => {
            if (window.failWrite === mode) return done({ data: null, error: { message: 'Expected mocked write failure' } });
            let data;
            if (table === 'daily_state') data = [{ ...window.testDay }];
            else if (mode === 'insert') {
              data = payload.map((row, i) => ({ id: 100 + i, ...row, echo_count: 0, created_at: '2026-10-15T05:00:00Z' }));
              window.fixture.push(...data);
            } else {
              data = window.fixture.filter(row => filters.every(filter => filter.op === 'eq'
                ? row[filter.field] === filter.value : new Date(row[filter.field]) >= new Date(filter.value)));
              if (mode === 'update') data.forEach(row => Object.assign(row, payload));
            }
            done({ data: data.map(row => ({ ...row })), error: null });
          }, mode === 'read' ? 0 : window.writeDelay)).then(resolve);
        }
      };
      return query;
    } }) };
  });
  await page.goto('https://encore.test/');
  await page.waitForFunction(() => document.querySelector('.daily-question').textContent === window.testDay.current_topic);
  if (fs.existsSync('/tmp/opinion-fredoka.ttf')) {
    await page.addStyleTag({ content: "@font-face{font-family:Fredoka;src:url('/qa-fredoka.ttf')}" });
    await page.evaluate(() => document.fonts.ready);
  }
}

async function populate(page, count = 14) {
  await page.evaluate(count => {
    const takes = ['Rest is productive.', 'Boredom is where ideas start.', 'Sometimes a nap is the whole plan.', 'Leave room for a little wonder.'];
    window.fixture = Array.from({ length: count }, (_, i) => ({ id: i + 1, text: takes[i % takes.length], echo_count: i % 4, created_at: '2026-10-15T05:00:00Z' }));
    goToValley();
  }, count);
  await page.locator('#opinionValley .rock').first().waitFor();
}

async function scenario(name, options, run) {
  if (process.env.ENCORE_TEST_FILTER && !name.includes(process.env.ENCORE_TEST_FILTER)) return;
  const browser = await chromium.launch(launch);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'no-preference', acceptDownloads: true, ...options });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await fixture(page);
    await run(page, context);
    assert.deepEqual(errors, [], 'No uncaught application errors');
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.stack}`);
    console.error(`FAIL ${name}: ${error.message}`);
  } finally { await browser.close(); }
}


const transient = '.fx-layer > *';
async function idle(page) {
  await page.waitForTimeout(1300);
  assert.equal(await page.locator(transient).count(), 0, 'All transient effects clean up');
  assert.equal(await page.locator('.fx-pressed').count(), 0, 'No stale press state');
  assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0, 'No infinite or abandoned animation');
}
async function pointer(page, selector, type, extras = {}) {
  await page.locator(selector).first().evaluate((el, { type, extras }) => {
    const b = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId: 7,
      pointerType: 'touch', isPrimary: true, clientX: b.x + b.width / 2, clientY: b.y + b.height / 2, ...extras }));
  }, { type, extras });
}
async function main() {
  await scenario('rock press releases on drag, cancel, blur and navigation', {}, async page => {
    await populate(page, 8);
    await idle(page);
    const selector = '#opinionValley .rock';
    const rock = page.locator(selector).first();
    await pointer(page, selector, 'pointerdown');
    assert(await rock.evaluate(el => el.classList.contains('fx-pressed')), 'Touch press gives local tactile feedback');
    await pointer(page, selector, 'pointermove', { clientX: 0, clientY: 0 });
    assert.equal(await page.locator('.fx-pressed').count(), 0, 'Dragging releases visual press');
    await pointer(page, selector, 'pointerdown');
    await pointer(page, selector, 'pointercancel');
    assert.equal(await page.locator('.fx-pressed').count(), 0, 'Browser scroll cancellation releases visual press');
    await pointer(page, selector, 'pointerdown');
    await pointer(page, selector, 'pointerup');
    assert.equal(await page.locator('.fx-pressed').count(), 0, 'Pointer release releases visual press');
    await pointer(page, selector, 'pointerdown');
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    assert.equal(await page.locator('.fx-pressed').count(), 0, 'Window blur releases visual press');
    await pointer(page, selector, 'pointerdown');
    await page.evaluate(() => restart());
    assert.equal(await page.locator('.fx-pressed').count(), 0, 'Navigation releases visual press');
    assert.equal(await page.evaluate(() => writes.length), 0, 'Decorative presses never write opinions or echoes');
    await idle(page);
  });

  await scenario('keyboard hold produces one echo and a released tactile state', { isMobile: false, hasTouch: false }, async page => {
    await populate(page, 2);
    const rock = page.locator('#opinionValley .rock').first();
    await rock.focus();
    await page.keyboard.down(' ');
    await page.keyboard.down(' ');
    await page.waitForFunction(() => writes.length === 1);
    assert.equal(await page.evaluate(() => writes.length), 1, 'Key repeat never toggles repeatedly');
    await page.keyboard.up(' ');
    assert.equal(await page.locator('.fx-pressed').count(), 0);
    await page.waitForFunction(() => document.querySelector('#opinionValley .rock').getAttribute('aria-pressed') === 'true');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => writes.length === 2);
    await page.waitForFunction(() => document.querySelector('#opinionValley .rock').getAttribute('aria-pressed') === 'false');
    await idle(page);
  });

  await scenario('etch progress is decorative and follows graphemes, deletion and restored draft', {}, async page => {
    const trail = page.locator('.etch-trail');
    assert.equal(await trail.count(), 1);
    assert.equal(await trail.getAttribute('aria-hidden'), 'true');
    assert.equal(await trail.locator('i').count(), 8);
    await page.locator('#input').fill('');
    assert.equal(await trail.locator('.is-filled').count(), 0);
    await page.locator('#input').fill('🪨'.repeat(20));
    assert.equal(await page.locator('#charCounter').textContent(), '20/40');
    assert.equal(await trail.locator('.is-filled').count(), 4);
    await page.locator('#input').fill('W'.repeat(40));
    assert.equal(await trail.locator('.is-filled').count(), 8);
    await page.locator('#input').fill('');
    assert.equal(await trail.locator('.is-filled').count(), 0);
    await page.locator('#input').fill('A small saved thought.');
    const fill = await trail.locator('.is-filled').count();
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    assert.equal(await page.locator('#input').inputValue(), 'A small saved thought.');
    assert.equal(await trail.locator('.is-filled').count(), fill);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await trail.locator('.is-filled').count(), fill, 'Quiet mode retains useful progress');
  });

  await scenario('turning motion off during feedback clears all transient types', {}, async page => {
    await populate(page, 4);
    await idle(page);
    await page.locator('#opinionValley .rock').first().tap();
    await page.waitForFunction(() => document.querySelector('#opinionValley .rock').getAttribute('aria-pressed') === 'true');
    assert(await page.locator(transient).count() > 0, 'Confirmed echo produces decorative feedback');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'calm');
    assert.equal(await page.locator('html').getAttribute('data-motion'), 'calm');
    assert.equal(await page.locator(transient).count(), 0, 'OS preference immediately cleans effects');
    assert.equal(await page.locator('#opinionValley .rock').first().getAttribute('aria-pressed'), 'true', 'Echo state survives effect cancellation');
    await page.locator('#opinionValley .rock').first().tap();
    await page.waitForFunction(() => document.querySelector('#opinionValley .rock').getAttribute('aria-pressed') === 'false');
    assert.equal(await page.locator(transient).count(), 0);
    await idle(page);
  });

  await scenario('new feedback shares one particle budget and clears on pagehide', {}, async page => {
    await populate(page, 4);
    await page.evaluate(() => {
      window.peakEffects = 0;
      const nativeAppend = Node.prototype.appendChild;
      Node.prototype.appendChild = function (node) {
        const result = nativeAppend.call(this, node);
        if (this.classList?.contains('fx-layer')) peakEffects = Math.max(peakEffects, this.children.length);
        return result;
      };
      const rock = document.querySelector('#opinionValley .rock');
      for (let i = 0; i < 100; i++) RockFX.echo(rock, i % 3 !== 0);
    });
    assert((await page.evaluate(() => peakEffects)) <= 34, 'All particle variants stay within shared mobile cap');
    assert.equal(await page.locator('.fx-layer').count(), 1);
    assert.equal(await page.locator('.fx-layer').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('.fx-layer').evaluate(el => el.inert), true);
    assert.equal(await page.locator('.fx-layer').evaluate(el => getComputedStyle(el).pointerEvents), 'none');
    assert.equal(await page.locator('.fx-layer').evaluate(el => getComputedStyle(el).overflow), 'hidden');
    await idle(page);
    await page.evaluate(() => {
      RockFX.echo(document.querySelector('#opinionValley .rock'));
      dispatchEvent(new Event('pagehide'));
    });
    assert.equal(await page.locator(transient).count(), 0, 'Pagehide removes every new particle type');
    await idle(page);
  });

  await scenario('a delayed echo stays quiet after leaving its scene', {}, async page => {
    await populate(page, 4);
    await idle(page);
    await page.evaluate(() => { writeDelay = 1900; });
    await page.locator('#opinionValley .rock').first().tap();
    await page.waitForFunction(() => writes.length === 1);
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.waitForTimeout(2100);
    assert(await page.locator('#phase3').isVisible());
    assert.equal(await page.locator(transient).count(), 0, 'No hidden-scene celebration leaks onto Store');
    assert.equal(await page.locator('.fx-pressed').count(), 0);
    assert.equal(await page.evaluate(() => writes.length), 1);
    await idle(page);
  });

  await scenario('scroll reveals each discovered rock once and stops for calm mode/navigation', { viewport: { width: 390, height: 650 } }, async page => {
    await populate(page, 14);
    await page.locator('#toggleViewBtn').click();
    await idle(page);
    await page.evaluate(() => {
      window.revealCalls = [];
      window.revealObservers = [];
      const OriginalObserver = window.IntersectionObserver;
      window.IntersectionObserver = class extends OriginalObserver {
        constructor(...args) { super(...args); this.testDisconnected = false; revealObservers.push(this); }
        disconnect() { this.testDisconnected = true; return super.disconnect(); }
      };
      const originalAnimate = Element.prototype.animate;
      Element.prototype.animate = function(frames, options) {
        if (this.classList.contains('rock-item')) revealCalls.push(this.querySelector('.rock')?.dataset.id);
        return originalAnimate.call(this, frames, options);
      };
      RockFX.enterValley(document.querySelector('#opinionValley'));
    });
    const last = page.locator('#opinionValley .rock-item').last();
    const lastID = await last.locator('.rock').getAttribute('data-id');
    assert.equal(await page.evaluate(id => revealCalls.filter(v => v === id).length, lastID), 0, 'Offscreen content is not animated early');
    await last.scrollIntoViewIfNeeded();
    await page.waitForFunction(id => revealCalls.includes(id), lastID);
    await idle(page);
    const revealed = await page.evaluate(id => revealCalls.filter(v => v === id).length, lastID);
    assert.equal(revealed, 1, 'Newly discovered rock is revealed once');
    await page.locator('#opinionValley .rock-item').first().scrollIntoViewIfNeeded();
    await last.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(id => revealCalls.filter(v => v === id).length, lastID), revealed, 'Scrolling back never replays that reveal');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'calm');
    assert.equal(await page.evaluate(() => revealObservers.every(o => o.testDisconnected)), true, 'Calm mode disconnects reveal observation');
    await page.locator('#opinionValley .rock-item').first().scrollIntoViewIfNeeded();
    await page.evaluate(() => { revealCalls.length = 0; });
    await last.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => revealCalls.length), 0, 'Calm scrolling never starts reveals');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'full');
    await page.evaluate(() => RockFX.enterValley(document.querySelector('#opinionValley')));
    assert.equal(await page.evaluate(() => revealObservers.at(-1).testDisconnected), false, 'New active scene owns its observer');
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    assert.equal(await page.evaluate(() => revealObservers.every(o => o.testDisconnected)), true, 'Navigation disconnects the active observer');
    await idle(page);
  });

  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    await scenario(`encore art stays readable at ${viewport.width}px`, { viewport, isMobile: viewport.width < 700, hasTouch: viewport.width < 700 }, async page => {
      await page.locator('#input').fill('Leave a little room for wonder.');
      await page.locator('#input').blur();
      await idle(page);
      assert(await page.locator('#phase1').evaluate(el => el.scrollWidth <= innerWidth), 'Composer fits viewport');
      assert.equal(await page.locator('#previewText').textContent(), 'Leave a little room for wonder.');
      await page.screenshot({ path: path.join(os.tmpdir(), `opinion-encore-${viewport.width}-write.png`) });
      await populate(page, 7);
      await idle(page);
      assert(await page.locator('#phase2').evaluate(el => el.scrollWidth <= innerWidth), 'Valley fits viewport');
      await page.screenshot({ path: path.join(os.tmpdir(), `opinion-encore-${viewport.width}-valley.png`) });
      await page.locator('#toggleViewBtn').click();
      await idle(page);
      assert(await page.locator('#phase2').evaluate(el => el.scrollWidth <= innerWidth), 'List fits viewport');
      await page.screenshot({ path: path.join(os.tmpdir(), `opinion-encore-${viewport.width}-list.png`) });
    });
  }
}
main().then(() => {
  if (failures.length) { console.error(failures.join('\n\n')); process.exitCode = 1; }
  else console.log('Encore checks complete. External requests blocked; no production content accessed or changed.');
}).catch(error => { console.error(error); process.exitCode = 1; });
