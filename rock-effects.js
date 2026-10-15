/* Little moments of weight and wonder. All effects are optional and decorative. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
  const MAX_PARTICLES = 34;
  const MAX_ANIMATIONS = 22;
  const particles = new Set();
  const animations = new Set();
  const etchTimes = new WeakMap();
  const revealTimes = new WeakMap();
  let layer;
  let preference = 'full';
  let hoverFrame = 0;
  let hovered = null;
  let hoverPoint = null;
  try { if (localStorage.getItem('opinion_motion') === 'calm') preference = 'calm'; } catch { /* Private browsing is fine. */ }

  const isCalm = () => Boolean(reduced?.matches) || preference === 'calm';
  const canMove = () => !isCalm() && document.visibilityState !== 'hidden';
  const visible = element => Boolean(element?.isConnected && element.getClientRects().length);
  const random = (min, max) => min + Math.random() * (max - min);

  function clearHover() {
    if (hoverFrame) cancelAnimationFrame(hoverFrame);
    hoverFrame = 0;
    if (hovered) {
      hovered.classList.remove('fx-hover');
      hovered.style.removeProperty('--fx-tilt');
    }
    hovered = null;
    hoverPoint = null;
  }

  function clearEffects() {
    clearHover();
    for (const entry of [...animations]) entry.animation.cancel();
    animations.clear();
    for (const item of [...particles]) item.remove();
  }

  function syncPreference() {
    const calm = isCalm();
    root.dataset.motion = calm ? 'calm' : 'full';
    document.querySelectorAll('[data-motion-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(calm));
      button.setAttribute('aria-label', reduced?.matches
        ? 'Motion off: your device prefers reduced motion'
        : calm ? 'Turn on playful motion' : 'Reduce motion');
      button.disabled = Boolean(reduced?.matches);
      button.title = reduced?.matches ? 'Following your device’s reduced motion setting' : '';
      const label = button.querySelector('[data-motion-label]');
      if (label) label.textContent = calm ? 'Motion off' : 'Motion on';
    });
    if (calm) clearEffects();
  }

  function animate(element, frames, options, channel = 'moment') {
    if (!canMove() || !visible(element) || typeof element.animate !== 'function') return;
    for (const entry of [...animations]) {
      if (entry.element === element && entry.channel === channel) entry.animation.cancel();
    }
    if (animations.size >= MAX_ANIMATIONS) return;
    const animation = element.animate(frames, {
      duration: 440, easing: 'cubic-bezier(.22,.7,.25,1)', fill: 'none', ...options
    });
    const entry = { element, channel, animation };
    animations.add(entry);
    const release = () => animations.delete(entry);
    animation.addEventListener('finish', release, { once: true });
    animation.addEventListener('cancel', release, { once: true });
    return animation;
  }

  function getLayer() {
    if (!layer?.isConnected) {
      layer = document.createElement('div');
      layer.className = 'fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      layer.inert = true;
      document.body.appendChild(layer);
    }
    return layer;
  }

  function particle(className, x, y, properties, lifetime = 1000) {
    if (!canMove()) return;
    // A rapid sequence can replace older flecks, never grow an unbounded layer.
    while (particles.size >= MAX_PARTICLES) particles.values().next().value.remove();
    const node = document.createElement('span');
    node.className = className;
    node.style.left = `${Math.round(x)}px`;
    node.style.top = `${Math.round(y)}px`;
    for (const [key, value] of Object.entries(properties)) node.style.setProperty(key, String(value));
    let timeout;
    const entry = { remove() {
      clearTimeout(timeout);
      node.remove();
      particles.delete(entry);
    } };
    particles.add(entry);
    node.addEventListener('animationend', entry.remove, { once: true });
    getLayer().appendChild(node);
    timeout = setTimeout(entry.remove, lifetime);
  }

  function flecks(x, y, count, spread = 52, gold = true, delay = 0) {
    for (let index = 0; index < count; index++) {
      const angle = -Math.PI + (Math.PI * (index + .5) / count) + random(-.2, .2);
      const distance = random(spread * .48, spread);
      particle(`fx-fleck${gold ? ' fx-fleck-gold' : ''}${index % 4 === 0 ? ' fx-fleck-star' : ''}`, x, y, {
        '--fx-x': `${Math.cos(angle) * distance}px`,
        '--fx-y': `${Math.sin(angle) * distance}px`,
        '--fx-fall': `${random(8, 26)}px`,
        '--fx-turn': `${random(-125, 125)}deg`,
        '--fx-size': `${random(3, 7)}px`,
        '--fx-duration': `${random(510, 760)}ms`,
        '--fx-delay': `${delay}ms`
      }, 1000 + delay);
    }
  }

  function ring(x, y, width = 88, height = width * .65, gold = true) {
    particle(`fx-ring${gold ? ' fx-ring-gold' : ''}`, x, y, {
      '--fx-width': `${width}px`, '--fx-height': `${height}px`
    }, 900);
  }

  function etch(element) {
    if (!canMove() || !visible(element)) return;
    const now = performance.now();
    if (now - (etchTimes.get(element) ?? -Infinity) < 640) return;
    etchTimes.set(element, now);
    const box = element.getBoundingClientRect();
    flecks(box.left + box.width * .72, box.top + box.height * .58, 3, 22, false);
    // The writing remains still; only a barely perceptible stone response.
    animate(element, [{ scale: '1' }, { scale: '.995', offset: .3 }, { scale: '1' }], { duration: 200 }, 'etch');
  }

  function echo(element, add = true) {
    if (!canMove() || !visible(element)) return;
    const badge = element.querySelector('.pebble-badge');
    const box = (badge || element).getBoundingClientRect();
    const x = box.left + box.width * .5;
    const y = box.top + box.height * .5;
    if (hovered === element) clearHover();
    animate(element, add ? [
      { scale: '1', rotate: '0deg', translate: '0 0' },
      { scale: '1.015 .975', rotate: '-.7deg', translate: '0 2px', offset: .18 },
      { scale: '.99 1.025', rotate: '.65deg', translate: '0 -5px', offset: .48 },
      { scale: '1.005 .995', rotate: '-.2deg', translate: '0 1px', offset: .78 },
      { scale: '1', rotate: '0deg', translate: '0 0' }
    ] : [
      { scale: '1' }, { scale: '.98', offset: .4 }, { scale: '1' }
    ], { duration: add ? 460 : 240 }, 'echo');
    if (badge) animate(badge, [{ scale: '1' }, { scale: '1.13', offset: .45 }, { scale: '1' }], { duration: 330 }, 'badge');
    ring(x, y, add ? 80 : 55, add ? 48 : 32, add);
    flecks(x, y, add ? 8 : 3, add ? 57 : 26, add);
  }

  function enterValley(element) {
    if (!canMove() || !visible(element)) return;
    const now = performance.now();
    if (now - (revealTimes.get(element) ?? -Infinity) < 220) return;
    revealTimes.set(element, now);
    const items = [...element.querySelectorAll('.rock-item, .empty-valley')].filter(item => {
      const box = item.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight;
    }).slice(0, 8);
    items.forEach((item, index) => animate(item, [
      { opacity: .45, translate: '0 16px', rotate: `${index % 2 ? 1.5 : -1.5}deg`, scale: '.97' },
      { opacity: 1, translate: '0 -2px', rotate: '0deg', scale: '1.005', offset: .72 },
      { opacity: 1, translate: '0 0', rotate: '0deg', scale: '1' }
    ], { duration: 430, delay: index * 48 }, 'reveal'));
  }

  function landed(element) {
    if (!canMove() || !visible(element)) return;
    animate(element, [
      { translate: '0 18px', scale: '.96', opacity: .75 },
      { translate: '0 -3px', scale: '1.01', opacity: 1, offset: .62 },
      { translate: '0 0', scale: '1', opacity: 1 }
    ], { duration: 540 }, 'landing');
    const target = element.querySelector('.share-preview') || element;
    const box = target.getBoundingClientRect();
    const x = box.left + box.width * .5;
    const y = Math.min(box.top + box.height * .78, window.innerHeight - 56);
    ring(x, y, Math.min(box.width * .75, 220), 50);
    flecks(x, y, 15, Math.min(box.width * .45, 115), true);
    const heading = element.querySelector('.share-heading');
    if (heading) animate(heading, [{ translate: '0 3px', rotate: '-1deg' }, { translate: '0 0', rotate: '0deg' }], { duration: 390, delay: 100 }, 'heading');
  }

  function phase(element) {
    if (!canMove() || !visible(element)) return;
    const heading = element.querySelector('.daily-heading');
    if (heading) animate(heading, [
      { opacity: .65, translate: '0 7px' }, { opacity: 1, translate: '0 0' }
    ], { duration: 320 }, 'phase');
    const preview = element.querySelector('#preview');
    if (visible(preview)) {
      const box = preview.getBoundingClientRect();
      animate(preview, [
        { translate: '0 -15px', rotate: '-3deg', scale: '1' },
        { translate: '0 2px', rotate: '.9deg', scale: '1.035 .95', offset: .34 },
        { translate: '0 -3px', rotate: '-.5deg', scale: '.99 1.015', offset: .59 },
        { translate: '0 1px', rotate: '.2deg', scale: '1.008 .992', offset: .8 },
        { translate: '0 0', rotate: '0deg', scale: '1' }
      ], { duration: 580 }, 'arrival');
      // CSS-delayed dust meets the stone on contact; no scheduled callback.
      flecks(box.left + box.width * .5, box.top + box.height * .78, 5, 42, false, 185);
    }
    const cairn = element.querySelector('.scene-cairn');
    if (cairn) animate(cairn, [
      { rotate: '-2deg', translate: '0 4px' }, { rotate: '.7deg', translate: '0 0', offset: .7 }, { rotate: '0deg', translate: '0 0' }
    ], { duration: 650 }, 'scene');
    const spark = element.querySelector('.scene-spark');
    if (spark) animate(spark, [
      { scale: '.75', rotate: '-12deg', opacity: .5 },
      { scale: '1.08', rotate: '4deg', opacity: 1, offset: .6 },
      { scale: '1', rotate: '0deg', opacity: 1 }
    ], { duration: 850 }, 'scene');
  }

  // A missing animation API, detached node or a cosmetic failure cannot break an action.
  const optional = fn => (...args) => { try { return fn(...args); } catch { /* Effects never own application state. */ } };
  window.RockFX = Object.freeze({
    etch: optional(etch), echo: optional(echo), enterValley: optional(enterValley),
    landed: optional(landed), phase: optional(phase), clear: optional(clearEffects)
  });

  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-motion-toggle]')) return;
    if (reduced?.matches) return;
    preference = isCalm() ? 'full' : 'calm';
    try { localStorage.setItem('opinion_motion', preference); } catch { /* Session preference still works. */ }
    syncPreference();
  });

  document.addEventListener('pointermove', event => {
    if (!canMove() || !finePointer?.matches || event.pointerType === 'touch') return;
    const rock = event.target.closest?.('.rock[role="button"]');
    if (!rock || event.buttons) { clearHover(); return; }
    if (hovered && hovered !== rock) clearHover();
    hovered = rock;
    hoverPoint = { x: event.clientX };
    if (hoverFrame) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      if (!hovered || !hoverPoint || !canMove()) return;
      const box = hovered.getBoundingClientRect();
      const tilt = Math.max(-1.3, Math.min(1.3, (hoverPoint.x - box.left - box.width / 2) / Math.max(box.width, 1) * 2.6));
      hovered.style.setProperty('--fx-tilt', `${tilt.toFixed(2)}deg`);
      hovered.classList.add('fx-hover');
    });
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    if (hovered && !hovered.contains(event.relatedTarget)) clearHover();
  }, { passive: true });
  document.addEventListener('pointerdown', clearHover, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') clearEffects(); });
  window.addEventListener('pagehide', clearEffects);
  window.addEventListener('blur', clearHover);
  if (reduced?.addEventListener) reduced.addEventListener('change', syncPreference);
  else reduced?.addListener?.(syncPreference);
  syncPreference();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncPreference, { once: true });
})();
