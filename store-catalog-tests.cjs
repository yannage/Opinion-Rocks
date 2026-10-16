// Fast, network-free catalog/DOM checks. This does not measure browser layout.
// Install the test-only dependency with: npm install --no-save --package-lock=false jsdom
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const source = fs.readFileSync(path.join(__dirname, 'store.js'), 'utf8');
const catalog = {
  print: { prices: { S: 25, M: 25, L: 25, XL: 25, '2XL': 27, '3XL': 29 }, color: 'Natural', blank: 'Gildan 64000', art: 'everyday-print' },
  embroidery: { prices: { S: 35, M: 35, L: 35, XL: 35, '2XL': 37, '3XL': 39, '4XL': 41 }, color: 'Moss', blank: 'Comfort Colors 1717', art: 'everyday-embroidery' }
};
const dom = new JSDOM(html, { url: 'https://store.test/?success=true&payment_status=paid#store', runScripts: 'outside-only' });
const { window } = dom;
const { document } = window;
let network = 0, loads = 0;
window.fetch = () => { network++; throw Error('Unexpected network request'); };
window.XMLHttpRequest = class { constructor() { network++; throw Error('Unexpected XHR'); } };
window.open = () => { network++; throw Error('Unexpected popup'); };
window.loadOpinions = () => loads++;
window.closeShareCard = () => { document.getElementById('shareSection').style.display = 'none'; };
window.eval(source);
const get = id => document.getElementById(id);
function choose(name, value) {
  const input = document.querySelector(`input[name="${name}"][value="${value}"]`);
  assert(input, `${name} contains ${value}`);
  input.checked = true;
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}
assert(get('phase3').classList.contains('active'), 'Direct hash enters Store immediately');
assert.equal(loads, 0, 'Opening Store never requests opinions');
assert(get('storeOrderBtn').disabled);
for (const [key, product] of Object.entries(catalog)) {
  choose('store-product', key);
  assert.deepEqual([...document.querySelectorAll('input[name="store-size"]')].map(input => input.value), Object.keys(product.prices));
  assert(get('storeProductDescription').textContent.includes(product.blank));
  assert(get('storeColor').textContent.includes(product.color));
  for (const [size, price] of Object.entries(product.prices)) {
    choose('store-size', size);
    assert.equal(get('storePrice').textContent, '$' + price);
    assert.equal(get('storeSelectedSize').textContent, size);
    assert(get('storeOrderBtn').disabled);
  }
  for (const mode of ['shirt', 'artwork', 'collection']) {
    choose('store-preview', mode);
    for (const [name, id] of Object.entries({ shirt: 'storeShirtPreview', artwork: 'storeArtworkPreview', collection: 'storeCollectionPreview' })) {
      assert.equal(get(id).hidden, name !== mode);
    }
  }
  assert(get('storeArtwork').src.includes(product.art));
  assert(get('storeShirtArt').src.includes(product.art));
}
choose('store-product', 'print');
assert.equal(get('storeSelectedSize').textContent, '3XL');
choose('store-product', 'embroidery');
assert.equal(get('storeSelectedSize').textContent, '4XL');
choose('store-preview', 'artwork');
assert.match(get('storePreviewNote').textContent, /not a stitch file/);
assert.match(get('storeProductDetails').textContent, /sample approval are still pending/);
choose('store-product', 'print');
assert.match(get('storePreviewNote').textContent, /Original print artwork/);
assert.equal(get('storeArtworkPreview').hidden, false);
assert.match(get('storeLaunchNote').textContent, /still hidden/);
assert.match(get('storeExternalNote').textContent, /No public products/);
assert.equal(get('storeExternalLink').href, 'https://opinionrocks.printful.me/');
assert.equal(get('storeExternalLink').target, '_blank');
assert.equal(get('storeExternalLink').rel, 'noopener noreferrer');
const url = window.location.href;
get('storeOrderBtn').disabled = false;
get('storeOrderBtn').click();
assert.equal(window.location.href, url);
assert.equal(network, 0, 'Catalog controls and a tampered button cannot create requests or popups');
get('input').value = 'Keep this draft';
window.OpinionStore.navigate('write');
window.OpinionStore.navigate('store');
assert.equal(get('input').value, 'Keep this draft');
assert.equal(get('storeSelectedSize').textContent, '3XL');
assert.equal(document.querySelectorAll('.phase.active').length, 1);
get('shareSection').style.display = 'flex';
window.OpinionStore.navigate('write');
assert.equal(get('shareSection').style.display, 'none');
assert.equal(document.activeElement, get('input'));
assert.equal(loads, 0);
assert(!get('phase3').textContent.includes('Middle Seat'));
assert.match(get('phase3').textContent, /no public archive/);
assert.equal(get('charCounter').textContent.trim(), '0/40');
for (const img of get('phase3').querySelectorAll('img')) {
  assert(fs.existsSync(path.join(__dirname, img.getAttribute('src'))), `Image exists: ${img.src}`);
}
const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
assert.equal(new Set(ids).size, ids.length, 'No duplicate IDs');
dom.window.close();
console.log('PASS: all 13 approved prices, exact sizes/materials/art, independent selections, three previews, quality/availability copy, safe external link, inert checkout tampering, draft/navigation, daily-model copy and IDs. No network. Layout and full app integration require browser tests.');
