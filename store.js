/* Store preview only. This module has no payment, order or fulfillment actions. */
(() => {
  'use strict';

  const phaseIds = Object.freeze({ write: 'phase1', explore: 'phase2', store: 'phase3' });
  // Display-only catalog. These prices cannot create a payment or order.
  const products = Object.freeze({
    print: Object.freeze({
      title: 'Everyday Classic Print Tee', kind: 'Everyday Collection · Front print',
      slogan: 'A little valley. A lot of everyday.',
      description: 'Our six-stone cairn and friendly wordmark, centered on a Natural Gildan 64000. An easy-going brand staple with a plain back.',
      color: 'Natural', treatment: 'Front DTG print', art: 'art/everyday-print.webp',
      artAlt: 'Classic Print artwork: six warm-colored stones above the words OPINION ROCKS',
      details: 'Gildan 64000 in Natural, with an approximately 7.5-inch visible front design on an 8-inch artwork canvas. Sizes S–XL are $25, 2XL is $27 and 3XL is $29 USD, before shipping and tax. Final print colors and sample quality are still being checked. Garment and size availability may change.',
      prices: Object.freeze({ S: 25, M: 25, L: 25, XL: 25, '2XL': 27, '3XL': 29 }),
      shirtNote: 'Illustrative placement, not a product photo. Final garment and print colors may differ.',
      artNote: 'Original print artwork. Final printed colors and sample quality are still being checked.'
    }),
    embroidery: Object.freeze({
      title: 'Everyday Embroidered Tee', kind: 'Everyday Collection · Left-chest embroidery',
      slogan: 'Small stones. Quiet company.',
      description: 'A compact cairn and wordmark on the left chest of a Moss Comfort Colors 1717. A little piece of the valley, with a plain back.',
      color: 'Moss', treatment: 'Left-chest flat embroidery', art: 'art/everyday-embroidery.webp',
      artAlt: 'Embroidery design reference: six stones above the words OPINION ROCKS, pending digitization and sample review',
      details: 'Comfort Colors 1717 in Moss, with an approximately 3-inch visible left-chest design on a 3.25-inch artwork canvas. Sizes S–XL are $35, 2XL is $37, 3XL is $39 and 4XL is $41 USD, before shipping and tax. This design reference is not a stitch file. Embroidery digitization, source-quality review and sample approval are still pending. Final thread colors, garment and size availability may change.',
      prices: Object.freeze({ S: 35, M: 35, L: 35, XL: 35, '2XL': 37, '3XL': 39, '4XL': 41 }),
      shirtNote: 'Illustrative placement, not a stitched sample. Final garment, thread colors and stitching may differ.',
      artNote: 'Embroidery design reference only, not a stitch file. Digitization and sample-quality review are still pending.'
    })
  });
  const selectedSizes = { print: 'M', embroidery: 'M' };
  let selectedProduct = 'print';
  const byId = id => document.getElementById(id);
  const activeView = () => Object.keys(phaseIds).find(view => document.getElementById(phaseIds[view]).classList.contains('active'));
  const routeView = () => Object.hasOwn(phaseIds, window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'write';

  function navigate(view, { history = true, focus = true, load = true } = {}) {
    if (!Object.hasOwn(phaseIds, view)) return;
    const previous = activeView();
    // Browser Back also closes a share dialog instead of leaving an inert page.
    if (document.getElementById('shareSection').style.display === 'flex') window.closeShareCard(false);
    if (previous !== view) window.RockFX?.clear();
    const target = document.getElementById(phaseIds[view]);
    Object.values(phaseIds).forEach(id => document.getElementById(id).classList.toggle('active', id === target.id));
    document.querySelectorAll('.section-nav [data-view]').forEach(button => {
      if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (history && window.location.hash !== `#${view}`) {
      const url = new URL(window.location.href);
      url.hash = view;
      window.history.pushState(null, '', url);
    }
    if (focus) {
      const destination = view === 'write' ? document.getElementById('input') : target.querySelector('h1');
      if (destination.tagName !== 'TEXTAREA') destination.tabIndex = -1;
      destination.focus({ preventScroll: true });
    }
    if (previous !== view) window.RockFX?.phase(target);
    if (view === 'explore' && load) window.loadOpinions();
  }

  function updatePrice() {
    const size = selectedSizes[selectedProduct];
    byId('storePrice').textContent = `$${products[selectedProduct].prices[size]}`;
    byId('storeSelectedSize').textContent = size;
  }

  function updatePreview() {
    const preview = document.querySelector('input[name="store-preview"]:checked').value;
    byId('storeShirtPreview').hidden = preview !== 'shirt';
    byId('storeArtworkPreview').hidden = preview !== 'artwork';
    byId('storeCollectionPreview').hidden = preview !== 'collection';
    byId('storePreviewNote').textContent = preview === 'collection'
      ? 'Illustrative collection mockup, not manufactured samples. Final garments, placement and thread colors may differ.'
      : products[selectedProduct][preview === 'artwork' ? 'artNote' : 'shirtNote'];
  }

  function selectProduct(key) {
    if (!Object.hasOwn(products, key)) return;
    selectedProduct = key;
    const product = products[key];
    document.querySelector('.store-product').dataset.product = key;
    byId('storeProductTitle').textContent = product.title;
    byId('storeProductKind').textContent = product.kind;
    byId('storeSlogan').textContent = product.slogan;
    byId('storeProductDescription').textContent = product.description;
    byId('storeProductDetails').textContent = product.details;
    const treatment = document.createElement('span');
    treatment.textContent = `· ${product.treatment}`;
    byId('storeColor').replaceChildren(`${product.color} `, treatment);
    byId('storeShirtArt').src = product.art;
    byId('storeShirtArt').alt = `Six-stone Opinion Rocks cairn and wordmark on the illustrative ${product.color} shirt`;
    byId('storeArtwork').src = product.art;
    byId('storeArtwork').alt = product.artAlt;
    document.querySelector('.store-shirt').setAttribute('aria-label', `Illustrative ${product.color} T-shirt silhouette`);
    const options = Object.keys(product.prices).map(size => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio'; input.name = 'store-size'; input.value = size;
      input.checked = selectedSizes[key] === size;
      const text = document.createElement('span');
      text.textContent = size;
      label.append(input, text);
      return label;
    });
    byId('storeSizeOptions').replaceChildren(...options);
    updatePrice();
    updatePreview();
  }

  byId('storeSizeOptions').addEventListener('change', event => {
    const input = event.target;
    if (input.name !== 'store-size' || !input.checked || !Object.hasOwn(products[selectedProduct].prices, input.value)) return;
    selectedSizes[selectedProduct] = input.value;
    updatePrice();
  });

  document.querySelectorAll('input[name="store-product"]').forEach(input => {
    input.addEventListener('change', () => { if (input.checked) selectProduct(input.value); });
  });
  document.querySelectorAll('input[name="store-preview"]').forEach(input => {
    input.addEventListener('change', () => { if (input.checked) updatePreview(); });
  });

  window.OpinionStore = Object.freeze({ navigate });
  window.goToStore = () => navigate('store');
  window.addEventListener('hashchange', () => navigate(routeView(), { history: false }));
  // Route immediately, without waiting for the unrelated daily-question request.
  // The existing app initializes Explore's data once that first question resolves.
  const firstView = routeView();
  if (window.location.hash !== `#${firstView}`) {
    const url = new URL(window.location.href);
    url.hash = firstView;
    window.history.replaceState(null, '', url);
  }
  navigate(firstView, { history: false, focus: false, load: false });
})();
