// Store regression checks. Static assets are real; all backend operations and
// native sharing are mocked. Every non-fixture network request is blocked.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');

const root = __dirname;
const failures = [];
const prices = { S: 25, M: 25, L: 25, XL: 25, '2XL': 27, '3XL': 29 };
const embroideredPrices = { S: 35, M: 35, L: 35, XL: 35, '2XL': 37, '3XL': 39, '4XL': 41 };
const launchOptions = {
  headless: true,
  executablePath: process.env.OPINION_BROWSER_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process']
};

async function fixture(page, options = {}) {
  const requests = [];
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    requests.push({ url: url.href, method: route.request().method() });
    if (url.hostname !== 'store.test') return route.abort();
    if (url.pathname === '/qa-fredoka.ttf' && fs.existsSync('/tmp/opinion-fredoka.ttf'))
      return route.fulfill({ body: fs.readFileSync('/tmp/opinion-fredoka.ttf'), contentType: 'font/ttf' });
    const file = path.resolve(root, url.pathname === '/' ? 'index.html' : '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
    return route.fulfill({ body: fs.readFileSync(file), contentType: types[path.extname(file)] || 'application/octet-stream' });
  });
  await page.addInitScript(({ failBackend, topicDelay }) => {
    window.fixture = [];
    window.writes = [];
    window.queries = [];
    window.failBackend = failBackend;
    window.topicDelay = topicDelay;
    window.writeDelay = 0;
    window.testDay = { date: '2026-10-15', updated_at: '2026-10-15T04:00:00Z', current_topic: 'Is doing nothing a waste of time?' };
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} });
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
          if (mode !== 'read') window.writes.push({ mode, table, payload });
          const finish = result => new Promise(done => setTimeout(() => done(result), table === 'daily_state' ? window.topicDelay : mode !== 'read' ? window.writeDelay : 0)).then(resolve);
          if (window.failBackend) return finish({ data: null, error: { message: 'Expected mocked backend outage' } });
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
          return finish({ data: data.map(row => ({ ...row })), error: null });
        }
      };
      return query;
    } }) };
  }, { failBackend: Boolean(options.failBackend), topicDelay: options.topicDelay || 0 });
  await page.goto('https://store.test/' + (options.suffix || ''));
  await page.waitForFunction(() => Boolean(window.OpinionStore));
  if (!options.failBackend && options.waitForTopic !== false) await page.waitForFunction(() => document.querySelector('.daily-question').textContent === window.testDay.current_topic);
  if (fs.existsSync('/tmp/opinion-fredoka.ttf')) {
    await page.addStyleTag({ content: "@font-face { font-family: Fredoka; src: url('/qa-fredoka.ttf'); font-weight: 600; }" });
    await page.evaluate(() => document.fonts.load('600 16px Fredoka'));
  }
  return requests;
}

async function scenario(name, options, run) {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', ...options.context });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    const requests = await fixture(page, options);
    await run(page, context, requests);
    assert.deepEqual(errors, [], 'No uncaught application errors');
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.stack}`);
    console.error(`FAIL ${name}: ${error.message}`);
  } finally { await browser.close(); }
}

const nav = (page, view) => page.locator(`.phase.active .section-nav [data-view="${view}"]`);
async function active(page, view) {
  const id = { write: 'phase1', explore: 'phase2', store: 'phase3' }[view];
  await page.waitForFunction(id => document.getElementById(id).classList.contains('active'), id);
  assert.equal(await page.locator('.phase.active').count(), 1, 'Only the selected screen is active');
  assert.equal(await nav(page, view).getAttribute('aria-current'), 'page', 'Navigation announces the selected screen');
  assert.equal(new URL(page.url()).hash, '#' + view);
}

async function main() {
  await scenario('Write, Explore, Store and browser history preserve the draft', {}, async page => {
    await page.locator('#input').fill('A tiny draft worth keeping.');
    await nav(page, 'store').click(); await active(page, 'store');
    await nav(page, 'explore').click(); await active(page, 'explore');
    await page.goBack(); await active(page, 'store');
    await page.goBack(); await active(page, 'write');
    assert.equal(await page.locator('#input').inputValue(), 'A tiny draft worth keeping.');
    assert.equal(await page.locator('#previewText').textContent(), 'A tiny draft worth keeping.');
    await page.goForward(); await active(page, 'store');
    await nav(page, 'write').click(); await active(page, 'write');
    assert.equal(await page.locator('#input').inputValue(), 'A tiny draft worth keeping.');
    assert.deepEqual(await page.evaluate(() => writes), [], 'Screen navigation does not write any backend data');
  });

  await scenario('Direct store link, complete size pricing and artwork selection', { suffix: '#store' }, async page => {
    await active(page, 'store');
    assert(await page.locator('input[name="store-size"][value="M"]').isChecked(), 'Medium is the initial size');
    assert.deepEqual(await page.locator('input[name="store-size"]').evaluateAll(inputs => inputs.map(input => input.value)), Object.keys(prices));
    for (const [size, price] of Object.entries(prices)) {
      await page.locator(`input[name="store-size"][value="${size}"]`).check();
      assert.equal((await page.locator('#storePrice').textContent()).trim(), '$' + price);
      assert.match(await page.locator('#storeSelectedSize').textContent(), new RegExp(`\\b${size}\\b`));
      assert(await page.locator('#storeOrderBtn').isDisabled());
    }
    assert(await page.locator('#storeShirtPreview').isVisible());
    assert(await page.locator('#storeArtworkPreview').isHidden());
    await page.locator('input[name="store-preview"][value="artwork"]').check();
    assert(await page.locator('#storeArtworkPreview').isVisible());
    assert(await page.locator('#storeShirtPreview').isHidden());
    await page.locator('input[name="store-preview"][value="shirt"]').check();
    assert(await page.locator('#storeShirtPreview').isVisible());
    await nav(page, 'write').click();
    await nav(page, 'store').click();
    assert(await page.locator('input[name="store-size"][value="3XL"]').isChecked(), 'Selection survives screen navigation');
    const images = await page.locator('#phase3 img').evaluateAll(images => images.map(image => ({ src: image.getAttribute('src'), loaded: image.complete && image.naturalWidth > 0 })));
    assert(images.length >= 1 && images.every(image => image.loaded), `Store artwork loads: ${JSON.stringify(images)}`);
  });

  await scenario('Both products have exact prices, honest availability and independent selections', { suffix: '#store' }, async (page, context, requests) => {
    for (const [product, productPrices] of Object.entries({ print: prices, embroidery: embroideredPrices })) {
      await page.locator(`input[name="store-product"][value="${product}"]`).check();
      assert.deepEqual(await page.locator('input[name="store-size"]').evaluateAll(inputs => inputs.map(input => input.value)), Object.keys(productPrices));
      for (const [size, price] of Object.entries(productPrices)) {
        await page.locator(`input[name="store-size"][value="${size}"]`).check();
        assert.equal((await page.locator('#storePrice').textContent()).trim(), '$' + price);
        assert.equal((await page.locator('#storeSelectedSize').textContent()).trim(), size);
        assert(await page.locator('#storeOrderBtn').isDisabled());
      }
      assert.equal(await page.locator('.store-product').getAttribute('data-product'), product);
      assert.match(await page.locator('#storeShirtArt').getAttribute('src'), new RegExp(product === 'print' ? 'everyday-print' : 'everyday-embroidery'));
      assert.match(await page.locator('#storeProductDescription').textContent(), new RegExp(product === 'print' ? 'Natural Gildan 64000' : 'Moss Comfort Colors 1717'));
    }
    await page.locator('input[name="store-preview"][value="artwork"]').check();
    assert.match(await page.locator('#storePreviewNote').textContent(), /not a stitch file/);
    await page.locator('input[name="store-product"][value="print"]').check();
    assert(await page.locator('input[name="store-size"][value="3XL"]').isChecked());
    assert(await page.locator('#storeArtworkPreview').isVisible(), 'Preview mode survives product switching');
    assert.match(await page.locator('#storePreviewNote').textContent(), /Original print artwork/);
    await page.locator('input[name="store-product"][value="embroidery"]').check();
    assert(await page.locator('input[name="store-size"][value="4XL"]').isChecked());
    await page.locator('input[name="store-preview"][value="collection"]').check();
    assert(await page.locator('#storeCollectionPreview').isVisible());
    assert(await page.locator('#storeShirtPreview').isHidden());
    assert(await page.locator('#storeArtworkPreview').isHidden());
    assert.match(await page.locator('#storePreviewNote').textContent(), /not manufactured samples/);
    assert.match(await page.locator('#storeLaunchNote').textContent(), /still hidden/);
    assert.match(await page.locator('#storeExternalNote').textContent(), /No public products/);
    assert.equal(await page.locator('#storeExternalLink').getAttribute('href'), 'https://opinionrocks.printful.me/');
    assert.equal(await page.locator('#storeExternalLink').getAttribute('target'), '_blank');
    assert.match(await page.locator('#storeExternalLink').getAttribute('rel'), /noopener/);
    assert.deepEqual(await page.evaluate(() => writes), [], 'Browsing the catalog performs no backend writes');
    assert(!requests.some(request => new URL(request.url).hostname.endsWith('printful.me')), 'There is no automatic external-store request');
    assert(!(await page.locator('#phase3').textContent()).includes('Middle Seat'));
  });

  await scenario('External store handoff opens only the verified destination', { suffix: '#store' }, async (page, context) => {
    const outbound = [];
    await context.route('**/*', route => {
      if (route.request().url() !== 'https://opinionrocks.printful.me/') return route.abort();
      outbound.push(route.request().url());
      return route.fulfill({ body: '<h1>Mock external store</h1>', contentType: 'text/html' });
    });
    const popupPromise = page.waitForEvent('popup');
    await page.locator('#storeExternalLink').click();
    const popup = await popupPromise;
    await popup.waitForLoadState();
    assert.equal(popup.url(), 'https://opinionrocks.printful.me/');
    assert.equal(await popup.evaluate(() => window.opener), null);
    assert.deepEqual(outbound, ['https://opinionrocks.printful.me/']);
    await active(page, 'store');
    assert.deepEqual(await page.evaluate(() => writes), []);
  });

  await scenario('Checkout is inert even after removing disabled or spoofing payment parameters', {
    suffix: '?success=true&payment_status=paid&session_id=cs_test_fake&upgraded=true#store'
  }, async (page, context, requests) => {
    await active(page, 'store');
    assert(await page.locator('#storeOrderBtn').isDisabled());
    assert.equal((await page.locator('#charCounter').textContent()).trim(), '0/40', 'Query parameters cannot grant paid text expansion');
    await page.waitForLoadState('networkidle');
    const requestCount = requests.length;
    const pageCount = context.pages().length;
    const originalUrl = page.url();
    await page.locator('#storeOrderBtn').evaluate(button => { button.disabled = false; button.click(); });
    await page.waitForTimeout(100);
    assert.equal(requests.length, requestCount, 'Tampering with the control cannot initiate a checkout or network request');
    assert.equal(context.pages().length, pageCount, 'Tampering cannot open a checkout tab');
    assert.equal(page.url(), originalUrl, 'Tampering cannot navigate to a checkout');
    assert.deepEqual(await page.evaluate(() => writes), [], 'Tampering cannot write an entitlement or order');
    await page.reload(); await active(page, 'store');
    assert(await page.locator('#storeOrderBtn').isDisabled(), 'Reload restores the disabled preview control');
  });

  await scenario('Same-day sharing survives store navigation; reset removes the previous opinion', {}, async page => {
    const take = 'Fresh rocks, fresh perspectives.';
    await page.locator('#input').fill(take);
    await page.locator('#submitBtn').click();
    await page.locator('#shareSection').waitFor({ state: 'visible' });
    await page.locator('#closeShareCard').click(); await active(page, 'explore');
    await nav(page, 'store').click(); await active(page, 'store');
    assert(!(await page.locator('#phase3').textContent()).includes(take), 'The shop never archives a submitted opinion');
    await nav(page, 'explore').click();
    await page.locator('#shareLastRockBtn').click();
    assert.equal(await page.locator('#shareText').textContent(), take);
    await page.keyboard.press('Escape');
    await nav(page, 'store').click();
    await page.evaluate(async () => {
      testDay = { date: '2026-10-16', updated_at: '2026-10-16T04:00:00Z', current_topic: 'What deserves a second chance?' };
      await loadDailyTopic();
    });
    await active(page, 'store');
    assert(await page.locator('#shareLastRockBtn').isHidden(), 'Daily reset invalidates the previous share');
    assert(!(await page.locator('#phase3').textContent()).includes(take), 'Reset does not copy the opinion into the shop');
    await nav(page, 'explore').click();
    assert.equal(await page.locator('#opinionValley .rock').count(), 0, 'Previous-day rocks are absent after reset');
    assert(!(await page.locator('#phase2').textContent()).includes(take));
  });

  await scenario('Backend outage still allows store preview without enabling purchases', { suffix: '#store', failBackend: true }, async page => {
    await active(page, 'store');
    await page.locator('input[name="store-size"][value="2XL"]').check();
    assert.equal((await page.locator('#storePrice').textContent()).trim(), '$27');
    await page.locator('input[name="store-preview"][value="artwork"]').check();
    assert(await page.locator('#storeArtworkPreview').isVisible());
    assert(await page.locator('#storeOrderBtn').isDisabled());
    await nav(page, 'write').click();
    await page.locator('#input').fill('Saved locally in this session.');
    assert(await page.locator('#submitBtn').isDisabled(), 'Backend outage does not silently enable posting');
    await nav(page, 'store').click();
    assert(await page.locator('#phase3').isVisible());
  });

  await scenario('A slow initial daily question cannot pull the visitor out of Store', { topicDelay: 750, waitForTopic: false }, async page => {
    await nav(page, 'store').click(); await active(page, 'store');
    await page.waitForFunction(() => document.querySelector('.daily-question').textContent === window.testDay.current_topic);
    await active(page, 'store');
    assert(await page.locator('#storeOrderBtn').isDisabled());
  });

  await scenario('A pending submission and browser Back keep store/modal focus usable', {}, async page => {
    await page.locator('#input').fill('Good things take their time.');
    await page.evaluate(() => { writeDelay = 450; });
    await page.locator('#submitBtn').click();
    await nav(page, 'store').click(); await active(page, 'store');
    await page.locator('#shareSection').waitFor({ state: 'visible' });
    assert(await page.locator('#phase3').evaluate(el => el.inert), 'A late successful save cannot leave Store interactive behind its dialog');
    await page.keyboard.press('Escape'); await active(page, 'explore');
    assert(await page.locator('#shareSection').isHidden());
    assert(await page.locator('#toggleViewBtn').evaluate(el => el === document.activeElement), 'Closing the delayed share restores useful focus');
    await nav(page, 'store').click();
    await nav(page, 'explore').click();
    await page.locator('#shareLastRockBtn').click();
    await page.goBack(); await active(page, 'store');
    assert(await page.locator('#shareSection').isHidden(), 'Browser Back dismisses the share dialog');
    assert.deepEqual(await page.locator('.phase').evaluateAll(phases => phases.map(phase => phase.inert)), [false, false, false], 'Back releases every screen from modal inert state');
    assert(await page.locator('#phase3').evaluate(el => el.contains(document.activeElement)), 'Back puts focus in the selected screen');
  });

  await scenario('Store controls work from the keyboard and respect reduced motion', { suffix: '#store' }, async page => {
    assert.equal(await page.locator('html').getAttribute('data-motion'), 'calm');
    await page.locator('input[name="store-product"][value="print"]').focus();
    await page.keyboard.press('ArrowRight');
    assert(await page.locator('input[name="store-product"][value="embroidery"]').isChecked(), 'Native product radios support arrow keys');
    await page.locator('input[name="store-size"][value="M"]').focus();
    await page.keyboard.press('ArrowRight');
    assert(await page.locator('input[name="store-size"][value="L"]').isChecked(), 'Native size radios support arrow keys');
    await page.locator('input[name="store-preview"][value="shirt"]').focus();
    await page.keyboard.press('ArrowRight');
    assert(await page.locator('#storeArtworkPreview').isVisible(), 'Native preview radios support arrow keys');
    await nav(page, 'write').focus();
    await page.keyboard.press('Enter'); await active(page, 'write');
    await nav(page, 'store').focus();
    await page.keyboard.press('Enter'); await active(page, 'store');
    const focused = await page.evaluate(() => ({ tag: document.activeElement.tagName, inStore: Boolean(document.activeElement.closest('#phase3')) }));
    assert(focused.inStore, `Screen navigation keeps focus in the selected screen: ${JSON.stringify(focused)}`);
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('.fx-fleck, .fx-ring').count(), 0, 'Store has no decorative motion under reduced-motion preference');
    assert.equal(await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length), 0, 'No running animations remain under reduced motion');
  });

  for (const width of [320, 390, 768, 1440]) {
    for (const textScale of [1, 2]) {
      await scenario(`Store reflow and controls at ${width}px / ${textScale * 100}% root text`, {
        suffix: '#store', context: { viewport: { width, height: width >= 768 ? 1000 : 844 } }
      }, async page => {
        await active(page, 'store');
        if (textScale !== 1) await page.addStyleTag({ content: `html { font-size: ${textScale * 100}% !important; }` });
        await page.locator('input[name="store-product"][value="embroidery"]').check();
        const bounds = await page.locator('#phase3').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth, viewport: innerWidth }));
        assert(bounds.scroll <= bounds.client + 1 && bounds.scroll <= bounds.viewport + 1, `Store has no horizontal overflow: ${JSON.stringify(bounds)}`);
        const controls = page.locator('#phase3 button, #phase3 label:has(input[name="store-size"]), #phase3 label:has(input[name="store-preview"]), #phase3 .store-details summary, #phase3 label:has(input[name="store-product"]), #storeExternalLink');
        const count = await controls.count();
        assert(count >= 18, 'Navigation, all seven embroidery sizes, three previews, two products, product details, motion, purchase, and return controls are present');
        for (let i = 0; i < count; i++) {
          const control = controls.nth(i);
          await control.scrollIntoViewIfNeeded();
          const geometry = await control.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return { text: el.textContent.trim(), width: rect.width, height: rect.height, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
              fitsText: el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1, viewport: { width: innerWidth, height: innerHeight } };
          });
          assert(geometry.width >= 44 && geometry.height >= 44, `44px target: ${JSON.stringify(geometry)}`);
          assert(geometry.left >= -1 && geometry.right <= width + 1, `Control fits width: ${JSON.stringify(geometry)}`);
          assert(geometry.top >= -1 && geometry.bottom <= geometry.viewport.height + 1, `Control reachable vertically: ${JSON.stringify(geometry)}`);
          assert(geometry.fitsText, `Control text does not clip: ${JSON.stringify(geometry)}`);
        }
        for (const product of ['print', 'embroidery']) {
          await page.locator(`input[name="store-product"][value="${product}"]`).check();
          for (const preview of ['shirt', 'artwork', 'collection']) {
            await page.locator(`input[name="store-preview"][value="${preview}"]`).check();
            const layout = await page.locator('#phase3').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth, viewport: innerWidth }));
            assert(layout.scroll <= layout.client + 1 && layout.scroll <= layout.viewport + 1, `${product}/${preview} fits at ${width}px: ${JSON.stringify(layout)}`);
            const gallery = await page.locator('.store-stage').evaluate(el => ({ scroll: el.scrollWidth, client: el.clientWidth }));
            assert(gallery.scroll <= gallery.client + 1, `${product}/${preview} does not overflow its gallery`);
            if (textScale === 1 && [390, 1440].includes(width)) {
              await page.locator('#phase3').evaluate(el => el.scrollTop = 0);
              await page.screenshot({ path: path.join(os.tmpdir(), `opinion-store-${product}-${preview}-${width}.png`) });
            }
          }
        }
      });
    }
  }

  if (failures.length) {
    console.error('\n' + failures.join('\n\n'));
    process.exitCode = 1;
  } else console.log('PASS: Store navigation/history, preserved drafts and sharing, all 13 size prices across two products and the external-store handoff, preview controls, disabled checkout/tampering, daily reset, backend outage, keyboard/reduced motion, and 320–1440px reflow. No production requests or orders.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
