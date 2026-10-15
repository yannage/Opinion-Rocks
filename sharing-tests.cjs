// Isolated browser regression checks; every opinion/share/clipboard is mocked.
// Usage: node sharing-tests.cjs (OPINION_BROWSER_PATH may override Chromium).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
let browser;

(async () => {
  const executablePath = process.env.OPINION_BROWSER_PATH || undefined;
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let failArt = false;
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'sharing.test') return route.abort();
    if (url.pathname.endsWith('rock_sprite.png')) {
      if (failArt) return route.abort();
      return route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(__dirname, 'art/rock_sprite.png')) });
    }
    if (url.pathname === '/sharing.js') return route.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, 'sharing.js')) });
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><title>Share test</title>
      <style>[hidden]{display:none!important}img{width:260px}button,a,input{display:block;min-height:44px}</style>
      <div id="shareSection"><div id="shareCardWrapper"><h2 id="shareTopic"></h2><div id="shareCard"><div id="shareText"></div></div>
      <img id="shareImagePreview" hidden><p id="shareStatus" role="status"></p><button id="nativeShareBtn"></button>
      <button id="downloadBtn"></button><button id="copyShareLinkBtn">Copy link</button><button id="retryShareImageBtn" hidden>Retry image</button>
      <a id="shareXBtn">X</a><a id="shareFBBtn">Facebook</a></div></div><script src="sharing.js"></script>` });
  });
  await page.addInitScript(() => {
    window.currentCycle = JSON.stringify(['2026-10-15', '2026-10-15T00:00:00', 'What makes a good day?']);
    window.dailyCycleKey = () => currentCycle;
    window.shareMode = 'files'; window.shareError = null; window.shareCalls = []; window.clipboardError = false;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => window.shareMode === 'files' && data.files?.[0]?.type === 'image/png' });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      window.shareCalls.push({ data, active: navigator.userActivation.isActive });
      if (window.shareError) throw new DOMException('Mock share error', window.shareError);
    } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
      if (window.clipboardError) throw new DOMException('Denied', 'NotAllowedError');
      window.copied = text;
    } } });
    const nativeCreate = URL.createObjectURL.bind(URL);
    const nativeRevoke = URL.revokeObjectURL.bind(URL);
    window.createdUrls = []; window.revokedUrls = [];
    URL.createObjectURL = value => { const url = nativeCreate(value); window.createdUrls.push(url); return url; };
    URL.revokeObjectURL = url => { window.revokedUrls.push(url); nativeRevoke(url); };
  });
  await page.goto('https://sharing.test/');
  const show = async (text = 'Small joys. Very big rocks.') => page.evaluate(text => {
    showOpinionShare({ id: 42, text, created_at: '2026-10-15T00:00:00Z' }, 'What makes a good day?', currentCycle);
  }, text);
  const ready = () => page.waitForFunction(() => !document.getElementById('downloadBtn').disabled);
  await show();
  await ready();
  assert.equal(await page.locator('#shareImagePreview').evaluate(image => `${image.naturalWidth}x${image.naturalHeight}`), '1080x1350');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#downloadBtn').click()]);
  assert.equal(download.suggestedFilename(), 'opinion-rocks-2026-10-15.png');
  const exportPath = path.join(os.tmpdir(), 'opinion-sharing-export.png');
  await download.saveAs(exportPath);
  assert(fs.statSync(exportPath).size > 10000);
  await page.locator('#nativeShareBtn').click();
  assert.deepEqual(await page.evaluate(() => ({ count: shareCalls.length, active: shareCalls[0].active, file: shareCalls[0].data.files[0].type })), { count: 1, active: true, file: 'image/png' });
  assert.match(await page.locator('#shareStatus').textContent(), /Finish your post/);
  await page.evaluate(() => { shareError = 'AbortError'; });
  await page.locator('#nativeShareBtn').click();
  assert.match(await page.locator('#shareStatus').textContent(), /dismissed/);
  assert.equal(await page.locator('#nativeShareBtn').isEnabled(), true);
  await page.evaluate(() => { shareError = 'NotAllowedError'; });
  await page.locator('#nativeShareBtn').click();
  assert.match(await page.locator('#shareStatus').textContent(), /did not open/);
  await page.evaluate(() => { shareError = null; shareMode = 'text'; });
  await show('☀️ Coffee, friends, and tiny victories'); await ready();
  assert.equal(await page.locator('#nativeShareBtn').textContent(), 'Share link');
  await page.locator('#nativeShareBtn').click();
  assert.equal(await page.evaluate(() => shareCalls.at(-1).data.url), 'https://opinionrocks.com/');
  assert.equal(await page.evaluate(() => shareCalls.at(-1).data.files), undefined);
  await page.locator('#copyShareLinkBtn').click();
  assert.equal(await page.evaluate(() => copied), 'https://opinionrocks.com/');
  await page.evaluate(() => { clipboardError = true; });
  await page.locator('#copyShareLinkBtn').click();
  assert.equal(await page.locator('#shareLinkFallback').inputValue(), 'https://opinionrocks.com/');
  const xUrl = new URL(await page.locator('#shareXBtn').getAttribute('href'));
  assert.equal(xUrl.searchParams.get('url'), 'https://opinionrocks.com/');
  assert.match(xUrl.searchParams.get('text'), /Coffee/);
  assert.equal(new URL(await page.locator('#shareFBBtn').getAttribute('href')).searchParams.get('u'), 'https://opinionrocks.com/');
  // Revoke the display URL on close, while a download URL has its own grace time.
  await page.evaluate(() => { window.displayUrl = document.getElementById('shareImagePreview').src; cleanupOpinionShare(); });
  assert.equal(await page.evaluate(() => revokedUrls.includes(displayUrl)), true);
  assert.equal(await page.locator('#shareImagePreview').isHidden(), true);
  assert.equal(await page.locator('#shareLinkFallback').count(), 0);
  failArt = true;
  await page.reload();
  await show();
  await page.waitForFunction(() => !document.getElementById('retryShareImageBtn').hidden);
  assert.equal(await page.locator('#downloadBtn').isDisabled(), true);
  assert.equal(await page.locator('#nativeShareBtn').isEnabled(), true);
  failArt = false;
  await page.locator('#retryShareImageBtn').click(); await ready();
  assert.equal(await page.locator('#retryShareImageBtn').isHidden(), true);
  // Daily reset prevents the old image/link from being used.
  const previousShareCount = await page.evaluate(() => shareCalls.length);
  await page.evaluate(() => { currentCycle = JSON.stringify(['2026-10-16', '2026-10-16T00:00:00', 'New day']); });
  await page.locator('#nativeShareBtn').click();
  assert.equal(await page.evaluate(() => shareCalls.length), previousShareCount);
  assert.equal(await page.locator('#shareImagePreview').isHidden(), true);
  // Close during asynchronous render: no late preview or native share state.
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type) { original.call(this, blob => setTimeout(() => callback(blob), 150), type); };
  });
  await show('Closing now');
  await page.evaluate(() => cleanupOpinionShare());
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#shareImagePreview').isHidden(), true);
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: 1080×1350 PNG download; activation-safe file sharing; text/link fallback; cancellation; share failure recovery; canonical social links; clipboard fallback; image retry; close/reset cleanup. Native targets and actual publishing are mocked, not device-tested.');
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
