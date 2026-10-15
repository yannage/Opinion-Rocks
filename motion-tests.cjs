// Motion and integrated sharing regression checks. Backend and native share APIs
// are fully mocked; all application files and downloaded PNGs are real.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const root = __dirname;
const failures = [];
const launch = {
  headless: true,
  executablePath: process.env.OPINION_BROWSER_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process']
};

async function fixture(page) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'motion.test') return route.abort();
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
  await page.goto('https://motion.test/');
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

async function instrumentMotion(page) {
  await page.waitForFunction(() => Boolean(window.RockFX));
  await page.evaluate(() => {
    window.motionCalls = [];
    const fx = window.RockFX;
    window.RockFX = Object.fromEntries(Object.entries(fx).map(([name, original]) => [name, (...args) => {
      motionCalls.push(name);
      return original(...args);
    }]));
    window.maxParticles = 0;
    new MutationObserver(() => {
      window.maxParticles = Math.max(window.maxParticles, document.querySelectorAll('.fx-fleck, .fx-ring').length);
    }).observe(document.body, { subtree: true, childList: true });
  });
}

async function settled(page) {
  await page.waitForTimeout(1300);
  assert.equal(await page.locator('.fx-fleck, .fx-ring').count(), 0, 'Transient decoration is cleaned up');
  assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length), 0, 'No continuously running animation remains');
}

async function main() {
  await scenario('motion control sync, persistence and OS preference changes', {}, async page => {
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'full');
    const motionControlCount = 3;
    assert.equal(await page.locator('[data-motion-toggle]').count(), motionControlCount);
    await page.locator('[data-motion-toggle]:visible').click();
    assert.equal(await page.locator('html').getAttribute('data-motion'), 'calm');
    assert.deepEqual(await page.locator('[data-motion-toggle]').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-pressed'))), Array(motionControlCount).fill('true'));
    assert.equal(await page.evaluate(() => localStorage.getItem('opinion_motion')), 'calm');
    await page.locator('#input').fill('Still lovely without motion.');
    await settled(page);
    await page.reload();
    await page.waitForFunction(() => window.RockFX);
    assert.equal(await page.locator('html').getAttribute('data-motion'), 'calm');
    await page.locator('[data-motion-toggle]:visible').click();
    assert.equal(await page.locator('html').getAttribute('data-motion'), 'full');
    assert.equal(await page.evaluate(() => localStorage.getItem('opinion_motion')), 'full');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'calm');
    assert.deepEqual(await page.locator('[data-motion-toggle]').evaluateAll(buttons => buttons.map(button => ({ disabled: button.disabled, text: button.querySelector('[data-motion-label]').textContent }))), Array.from({ length: motionControlCount }, () => ({ disabled: true, text: 'Motion off' })));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'full');
    assert.deepEqual(await page.locator('[data-motion-toggle]').evaluateAll(buttons => buttons.map(button => button.disabled)), Array(motionControlCount).fill(false));
    await page.locator('[data-motion-toggle]:visible').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    assert.equal(await page.locator('html').getAttribute('data-motion'), 'calm', 'Stored calm choice survives OS preference round trip');
    await page.getByRole('button', { name: 'Store', exact: true }).click();
    await page.locator('#phase3 [data-motion-toggle]').click();
    assert.equal(await page.locator('html').getAttribute('data-motion'), 'full', 'Store motion toggle updates the shared preference');
    assert.deepEqual(await page.locator('[data-motion-toggle]').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-pressed'))), Array(motionControlCount).fill('false'));
  });

  await scenario('initial reduced-motion keeps all interaction readable and effect-free', { reducedMotion: 'reduce' }, async page => {
    await instrumentMotion(page);
    assert.equal(await page.locator('html').getAttribute('data-motion'), 'calm');
    await page.locator('#input').fill('A quiet little wonder.');
    assert.equal(await page.locator('#previewText').textContent(), 'A quiet little wonder.');
    assert.equal(await page.locator('#previewText').evaluate(el => getComputedStyle(el).opacity), '1');
    await populate(page, 2);
    await page.locator('#opinionValley .rock').first().tap();
    await page.waitForFunction(() => document.querySelector('#opinionValley .rock').getAttribute('aria-pressed') === 'true');
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await page.locator('#submitBtn').click();
    await page.locator('#shareSection').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#downloadBtn').disabled);
    assert.equal(await page.evaluate(() => maxParticles), 0, 'No decorative particles ever created under OS reduction');
    await settled(page);
  });

  await scenario('pending and failed saves never trigger success effects', {}, async page => {
    await populate(page, 3);
    await instrumentMotion(page);
    await settled(page);
    await page.evaluate(() => { failWrite = 'update'; writeDelay = 200; motionCalls = []; });
    const rock = page.locator('#opinionValley .rock').first();
    await rock.tap();
    await page.waitForFunction(() => writes.length === 1);
    assert.equal(await page.evaluate(() => motionCalls.filter(name => name === 'echo').length), 0, 'No echo reward while save is pending');
    await page.waitForFunction(() => document.querySelector('#opinionValley .rock').getAttribute('aria-busy') !== 'true');
    assert.equal(await rock.getAttribute('aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => motionCalls.filter(name => name === 'echo').length), 0, 'Failed echo has no success reward');
    await page.evaluate(() => { failWrite = null; writeDelay = 0; });
    await rock.tap();
    await page.waitForFunction(() => document.querySelector('#opinionValley .rock').getAttribute('aria-pressed') === 'true');
    assert.equal(await page.evaluate(() => motionCalls.filter(name => name === 'echo').length), 1, 'Confirmed echo has one effect');
    await page.getByRole('button', { name: 'Write', exact: true }).click();
    await page.locator('#input').fill('Do less, notice more.');
    await page.evaluate(() => { failWrite = 'insert'; writeDelay = 200; motionCalls = []; });
    await page.locator('#submitBtn').click();
    await page.waitForFunction(() => writes.some(write => write.mode === 'insert'));
    assert.equal(await page.evaluate(() => motionCalls.filter(name => name === 'landed').length), 0, 'No landing reward during submission');
    await page.waitForFunction(() => !document.querySelector('#submitBtn').disabled);
    assert(await page.locator('#shareSection').isHidden());
    assert.equal(await page.locator('#input').inputValue(), 'Do less, notice more.');
    assert.equal(await page.evaluate(() => motionCalls.filter(name => name === 'landed').length), 0, 'Failed submission has no success reward');
    await page.evaluate(() => { failWrite = null; writeDelay = 0; });
    await page.locator('#submitBtn').click();
    await page.locator('#shareSection').waitFor({ state: 'visible' });
    assert.equal(await page.evaluate(() => motionCalls.filter(name => name === 'landed').length), 1, 'Confirmed submission has one landing effect');
  });

  await scenario('repeated writing, echoes and navigation clean up bounded effects', {}, async page => {
    await instrumentMotion(page);
    await page.locator('#input').fill('Little words, lovely rocks.');
    assert(await page.evaluate(() => motionCalls.includes('etch')), 'Writing integrates etch feedback');
    assert(await page.locator('.fx-fleck').count() > 0, 'Full motion creates visible writing particles');
    await populate(page, 14);
    await page.waitForTimeout(450);
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() => document.querySelector('#opinionValley .rock').click());
      await page.waitForFunction(() => document.querySelector('#opinionValley .rock').getAttribute('aria-busy') !== 'true');
    }
    await page.evaluate(() => {
      for (let i = 0; i < 80; i++) {
        const rock = document.querySelector('#opinionValley .rock');
        RockFX.echo(rock, i % 2 === 0);
      }
      for (let i = 0; i < 12; i++) { restart(); goToValley(); toggleView(); }
    });
    assert((await page.evaluate(() => maxParticles)) <= 34, 'Particles stay under the explicit mobile budget');
    await settled(page);
    assert.equal(await page.locator('.fx-layer').count(), 1, 'Repeated actions reuse a single overlay');
    await page.evaluate(() => {
      RockFX.echo(document.querySelector('#opinionValley .rock'));
      dispatchEvent(new Event('pagehide'));
    });
    assert.equal(await page.locator('.fx-fleck, .fx-ring').count(), 0, 'Page hide immediately removes effect nodes');
  });

  await scenario('full-motion touch scrolling never echoes and controls stay live', { viewport: { width: 390, height: 650 } }, async (page, context) => {
    await populate(page);
    await page.locator('#toggleViewBtn').click();
    const rock = page.locator('#opinionValley .rock').first();
    await rock.scrollIntoViewIfNeeded();
    const box = await rock.boundingBox();
    const before = await page.locator('#phase2').evaluate(el => el.scrollTop);
    const session = await context.newCDPSession(page);
    const x = box.x + box.width / 2;
    const y = Math.min(box.y + box.height / 2, 540);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 23 }] });
      await page.waitForTimeout(18);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    const after = await page.locator('#phase2').evaluate(el => el.scrollTop);
    assert(after > before + 15, `Touch gesture scrolls: ${before} → ${after}`);
    assert.equal(await page.evaluate(() => writes.length), 0, 'Scroll must not submit an echo');
    await rock.scrollIntoViewIfNeeded();
    await rock.tap();
    await page.waitForFunction(() => writes.length === 1);
    await page.getByRole('button', { name: 'Write', exact: true }).click({ timeout: 1500 });
    assert(await page.locator('#phase1').isVisible(), 'Navigation works during effect playback');
    await page.locator('#input').fill('A little room for wonder.');
    assert.equal(await page.locator('#previewText').textContent(), 'A little room for wonder.');
    assert(await page.locator('#submitBtn').isEnabled());
  });

  await scenario('full-motion saved rock produces complete PNG and native file handoff', {}, async page => {
    await page.locator('#input').fill('A little room for wonder.');
    await page.locator('#submitBtn').click();
    await page.locator('#shareSection').waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#downloadBtn').disabled);
    assert.equal(await page.locator('#shareImagePreview').evaluate(image => `${image.naturalWidth}x${image.naturalHeight}`), '1080x1350');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#downloadBtn').click()]);
    assert.equal(download.suggestedFilename(), 'opinion-rocks-2026-10-15.png');
    const exportPath = path.join(os.tmpdir(), 'opinion-motion-sharing-export.png');
    await download.saveAs(exportPath);
    const bytes = fs.readFileSync(exportPath);
    assert(bytes.length > 10000, 'Downloaded PNG contains real artwork');
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), 1080);
    assert.equal(bytes.readUInt32BE(20), 1350);
    await page.locator('#nativeShareBtn').click();
    assert.deepEqual(await page.evaluate(() => shareCalls), [{ type: 'image/png', active: true }]);
    await page.keyboard.press('Escape');
    assert(await page.locator('#shareSection').isHidden());
    assert(await page.locator('#phase2').isVisible());
  });

  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
    await scenario(`full-motion visual review at ${viewport.width}px`, { viewport, isMobile: viewport.width < 700, hasTouch: viewport.width < 700 }, async page => {
      await page.locator('#input').fill('Boredom is where ideas start.');
      await page.waitForTimeout(180);
      assert(await page.locator('#phase1').evaluate(el => el.scrollWidth <= innerWidth), 'Composer has no horizontal overflow');
      await page.locator('#input').blur();
      await page.screenshot({ path: path.join(os.tmpdir(), `opinion-polish-${viewport.width}-write.png`) });
      await populate(page, 7);
      await page.waitForTimeout(450);
      assert(await page.locator('#phase2').evaluate(el => el.scrollWidth <= innerWidth), 'Valley has no horizontal overflow');
      await page.screenshot({ path: path.join(os.tmpdir(), `opinion-polish-${viewport.width}-valley.png`) });
      await page.locator('#toggleViewBtn').click();
      await page.waitForTimeout(450);
      await page.screenshot({ path: path.join(os.tmpdir(), `opinion-polish-${viewport.width}-list.png`) });
    });
  }
}

main().then(() => {
  if (failures.length) { console.error(failures.join('\n\n')); process.exitCode = 1; }
  else console.log('Motion checks complete. No production opinions, votes or social posts were created.');
}).catch(error => { console.error(error); process.exitCode = 1; });
