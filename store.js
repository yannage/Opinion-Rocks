/* Store preview only. This module has no payment, order or fulfillment actions. */
(() => {
  'use strict';

  const phaseIds = Object.freeze({ write: 'phase1', explore: 'phase2', store: 'phase3' });
  const plannedPrices = Object.freeze({ XS: 29, S: 29, M: 29, L: 29, XL: 29, '2XL': 31, '3XL': 33, '4XL': 35, '5XL': 37 });
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

  document.querySelectorAll('input[name="store-size"]').forEach(input => {
    input.addEventListener('change', () => {
      if (!input.checked || !Object.hasOwn(plannedPrices, input.value)) return;
      document.getElementById('storePrice').textContent = `$${plannedPrices[input.value]}`;
      document.getElementById('storeSelectedSize').textContent = input.value;
    });
  });

  document.querySelectorAll('input[name="store-preview"]').forEach(input => {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      const artwork = input.value === 'artwork';
      document.getElementById('storeShirtPreview').hidden = artwork;
      document.getElementById('storeArtworkPreview').hidden = !artwork;
      document.getElementById('storePreviewNote').textContent = artwork
        ? 'Original sample artwork. This is a design preview, not a printed product.'
        : 'Illustrative placement. Final garment may differ.';
    });
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
