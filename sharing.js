/* A real image file, prepared before the next tap, keeps mobile sharing within
 * the Web Share API's user-activation requirement. No screenshot CDN required. */
(() => {
  'use strict';

  const SHARE_URL = 'https://opinionrocks.com/';
  const WIDTH = 1080;
  const HEIGHT = 1350;
  let active = null;

  const byId = id => document.getElementById(id);
  const abortError = () => new DOMException('Share card closed', 'AbortError');
  const segments = text => typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map(item => item.segment)
    : Array.from(text);

  function isCurrent(session) {
    if (active !== session || session.controller.signal.aborted) return false;
    // The app uses its server-verified reset key, not the viewer's local date.
    if (typeof window.dailyCycleKey === 'function' && window.dailyCycleKey() !== session.cycleKey) {
      window.cleanupOpinionShare();
      return false;
    }
    return true;
  }

  function status(session, message) {
    if (isCurrent(session)) byId('shareStatus').textContent = message;
  }

  function canShareFile(file) {
    try {
      return !!(file && navigator.share && navigator.canShare?.({ files: [file] }));
    } catch (_) {
      return false;
    }
  }

  function refreshButtons(session) {
    if (!isCurrent(session)) return;
    const nativeButton = byId('nativeShareBtn');
    nativeButton.hidden = typeof navigator.share !== 'function';
    nativeButton.disabled = session.preparing || session.sharing;
    nativeButton.textContent = session.preparing ? 'Preparing image…'
      : session.sharing ? 'Sharing…' : canShareFile(session.file) ? 'Share image' : 'Share link';
    byId('downloadBtn').disabled = !session.blob || session.preparing;
    byId('downloadBtn').textContent = session.preparing ? 'Preparing image…' : 'Download image';
    byId('retryShareImageBtn').hidden = !session.failed;
    byId('retryShareImageBtn').disabled = session.preparing;
  }

  function loadSprite(signal) {
    return new Promise((resolve, reject) => {
      const sprite = new Image();
      const timer = setTimeout(() => finish(new Error('Rock art took too long to load.')), 8000);
      function finish(error) {
        clearTimeout(timer);
        sprite.onload = sprite.onerror = null;
        signal.removeEventListener('abort', cancel);
        if (error) { sprite.src = ''; reject(error); } else resolve(sprite);
      }
      const cancel = () => finish(abortError());
      sprite.onload = () => finish();
      sprite.onerror = () => finish(new Error('Rock art could not load.'));
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) return cancel();
      sprite.src = new URL('art/rock_sprite.png', document.baseURI).href;
    });
  }

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  // Split by grapheme, so long words, emoji and CJK can fit without losing text.
  function wrapLines(ctx, text, width) {
    const lines = [];
    for (const paragraph of String(text).split(/\r?\n/u)) {
      let line = '';
      for (const part of segments(paragraph)) {
        const candidate = line + part;
        if (line && ctx.measureText(candidate).width > width) {
          const lastSpace = line.lastIndexOf(' ');
          if (lastSpace > 0) {
            lines.push(line.slice(0, lastSpace).trimEnd());
            line = line.slice(lastSpace + 1) + part;
          } else { lines.push(line); line = part; }
        } else line = candidate;
      }
      lines.push(line.trimEnd());
    }
    return lines;
  }

  function fitText(ctx, text, box, maxSize, minSize, color, family) {
    let lines, size;
    for (size = maxSize; size >= minSize; size -= 2) {
      ctx.font = `600 ${size}px ${family}`;
      lines = wrapLines(ctx, text, box.width);
      if (lines.length * size * 1.2 <= box.height && lines.every(line => ctx.measureText(line).width <= box.width)) break;
    }
    // A malicious/unbounded prompt must fail visibly, never export truncated text.
    if (size < minSize) throw new Error('This text is too long for the image.');
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const top = box.y + (box.height - lines.length * size * 1.2) / 2;
    lines.forEach((line, index) => ctx.fillText(line, box.x + box.width / 2, top + size * .6 + index * size * 1.2));
  }

  function dailyDate(session) {
    try {
      const [date] = JSON.parse(session.cycleKey);
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    } catch (_) { /* Date falls back to the saved server timestamp. */ }
    const date = String(session.opinion.created_at || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
  }

  async function renderImage(session) {
    const sprite = await loadSprite(session.controller.signal);
    // Local/system fallback keeps export working when Google Fonts is blocked.
    let timer;
    await Promise.race([
      document.fonts?.ready || Promise.resolve(),
      new Promise(resolve => { timer = setTimeout(resolve, 1200); })
    ]);
    clearTimeout(timer);
    if (!isCurrent(session)) throw abortError();
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image creation is unavailable in this browser.');
    const family = document.fonts?.check('600 24px Fredoka') ? 'Fredoka, sans-serif' : 'Arial, sans-serif';

    ctx.fillStyle = '#fffaf1';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#eae3f0';
    ctx.beginPath(); ctx.arc(1040, 90, 210, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#eae3f0';
    ctx.beginPath(); ctx.arc(40, 1160, 215, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6543a4';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = `600 37px ${family}`;
    ctx.fillText('OPINION ROCKS', 72, 80);
    ctx.font = '600 21px Arial, sans-serif';
    ctx.fillStyle = '#6a5745';
    ctx.fillText("ONE DAY. ONE QUESTION. YOUR TAKE.", 72, 135);

    fitText(ctx, session.prompt, { x: 76, y: 187, width: 928, height: 212 }, 62, 26, '#30251f', family);

    // Use the intact (top-left) frame of the existing 3x3 animation sprite.
    // A canvas mask follows its outline so the original rock can sit centrally.
    ctx.save();
    roundRect(ctx, 72, 438, 936, 650, 44);
    ctx.clip();
    const frameWidth = sprite.naturalWidth / 3;
    const frameHeight = sprite.naturalHeight / 3;
    const glow = ctx.createRadialGradient(540, 765, 80, 540, 765, 590);
    glow.addColorStop(0, '#f2edf7');
    glow.addColorStop(1, '#d9cce9');
    ctx.fillStyle = glow; ctx.fillRect(72, 438, 936, 650);
    ctx.translate(25, 322.5);
    ctx.scale(2.5, 2.5);
    ctx.beginPath();
    ctx.moveTo(77, 250);
    ctx.bezierCurveTo(84, 220, 83, 177, 101, 137);
    ctx.bezierCurveTo(119, 92, 145, 75, 198, 73);
    ctx.bezierCurveTo(233, 71, 274, 85, 292, 112);
    ctx.bezierCurveTo(309, 138, 312, 190, 331, 231);
    ctx.bezierCurveTo(348, 267, 313, 283, 269, 287);
    ctx.bezierCurveTo(219, 294, 197, 288, 157, 287);
    ctx.bezierCurveTo(111, 286, 68, 280, 77, 250);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(sprite, 0, 0, frameWidth, frameHeight, 0, 0, 1024 / 3, 1024 / 3);
    ctx.restore();

    fitText(ctx, session.opinion.text, { x: 314, y: 671, width: 452, height: 264 }, 72, 26, '#342319', family);
    ctx.fillStyle = '#77624d';
    ctx.font = '500 25px Arial, sans-serif'; ctx.textAlign = 'center';
    const date = dailyDate(session);
    ctx.fillText(date ? `A TAKE FROM ${date}` : 'A TAKE FROM TODAY’S VALLEY', WIDTH / 2, 1136);
    ctx.fillStyle = '#6543a4'; ctx.font = `600 51px ${family}`;
    ctx.fillText('What’s your take?', WIDTH / 2, 1201);
    ctx.fillStyle = '#6543a4'; ctx.font = '600 31px Arial, sans-serif';
    ctx.fillText('opinionrocks.com', WIDTH / 2, 1255);
    ctx.fillStyle = '#77624d'; ctx.font = '500 22px Arial, sans-serif';
    ctx.fillText('The valley resets daily. This image is your keepsake.', WIDTH / 2, 1310);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG export failed.')), 'image/png'));
  }

  async function prepareImage(session) {
    if (!isCurrent(session) || session.preparing) return;
    session.preparing = true;
    session.failed = false;
    refreshButtons(session);
    status(session, 'Your rock is in! Making its share image…');
    try {
      const blob = await renderImage(session);
      if (!isCurrent(session)) return;
      session.blob = blob;
      session.url = URL.createObjectURL(blob);
      const date = dailyDate(session) || 'today';
      session.filename = `opinion-rocks-${date}.png`;
      session.file = typeof File === 'function' ? new File([blob], session.filename, { type: 'image/png' }) : null;
      const preview = byId('shareImagePreview');
      if (preview) {
        preview.src = session.url;
        preview.alt = `${session.prompt} My take: ${session.opinion.text}. Opinion Rocks. The valley resets daily.`;
        preview.hidden = false;
        byId('shareCard').hidden = true;
        byId('shareTopic').hidden = true;
      }
      status(session, canShareFile(session.file)
        ? 'Your image is ready. Pick an app to pass your rock along.'
        : 'Your image is ready. Download it to attach to a post, or share the daily link.');
    } catch (error) {
      if (!isCurrent(session) || error.name === 'AbortError') return;
      session.failed = true;
      status(session, 'Your rock is saved, but its image could not be made. Retry the image or share the daily link.');
    } finally {
      session.preparing = false;
      refreshButtons(session);
    }
  }

  function downloadImage(session) {
    if (!isCurrent(session) || !session.blob) return;
    try {
      // A separate URL survives closing the dialog immediately after the tap.
      const downloadUrl = URL.createObjectURL(session.blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = session.filename;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
      status(session, 'Image download requested. Check Downloads or Files. You can also press and hold the image to save it.');
    } catch (_) {
      status(session, 'The download could not start. Try Share image, or press and hold the image to save it.');
    }
  }

  async function nativeShare(session) {
    if (!isCurrent(session) || session.sharing || session.preparing || !navigator.share) return;
    const data = canShareFile(session.file)
      ? { files: [session.file], title: 'Opinion Rocks' }
      : { title: 'Opinion Rocks', text: `${session.prompt}\nMy take: ${session.opinion.text}\nA new question every day.`, url: SHARE_URL };
    session.sharing = true;
    refreshButtons(session);
    try {
      // No await before this call: the click's transient activation is retained.
      await navigator.share(data);
      status(session, 'Handed to your device’s share menu. Finish your post in the app you chose.');
    } catch (error) {
      if (error.name === 'AbortError') {
        status(session, 'Share dismissed. Your image is still here to download or try again.');
      } else {
        status(session, 'Sharing did not open. Try again, or download the image and attach it in your app.');
      }
    } finally {
      session.sharing = false;
      refreshButtons(session);
    }
  }

  async function copyLink(session) {
    if (!isCurrent(session)) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(SHARE_URL);
      status(session, 'Link copied. It opens the current daily valley, not a saved opinion.');
    } catch (_) {
      if (!isCurrent(session)) return;
      let fallback = byId('shareLinkFallback');
      if (!fallback) {
        const label = document.createElement('label');
        label.id = 'shareLinkFallbackLabel';
        label.className = 'share-link-fallback';
        label.textContent = 'Copy the daily link';
        fallback = document.createElement('input');
        fallback.id = 'shareLinkFallback';
        fallback.type = 'url';
        fallback.readOnly = true;
        fallback.value = SHARE_URL;
        label.appendChild(fallback);
        byId('shareCardWrapper').appendChild(label);
      }
      fallback.focus();
      fallback.select();
      status(session, 'Copy is unavailable here. Press and hold the selected link, or use your keyboard to copy it.');
    }
  }

  window.cleanupOpinionShare = function cleanupOpinionShare() {
    if (active) {
      active.controller.abort();
      if (active.url) URL.revokeObjectURL(active.url);
    }
    active = null;
    const preview = byId('shareImagePreview');
    if (preview) { preview.hidden = true; preview.removeAttribute('src'); }
    byId('shareLinkFallbackLabel')?.remove();
    ['nativeShareBtn', 'downloadBtn', 'copyShareLinkBtn', 'retryShareImageBtn', 'shareXBtn', 'shareFBBtn'].forEach(id => {
      const element = byId(id);
      if (element) { element.onclick = null; element.removeAttribute('href'); }
    });
  };

  window.showOpinionShare = function showOpinionShare(savedOpinion, promptText, cycleKey) {
    window.cleanupOpinionShare();
    const session = active = {
      opinion: { text: String(savedOpinion.text), created_at: savedOpinion.created_at },
      prompt: String(promptText), cycleKey, controller: new AbortController(),
      preparing: false, sharing: false, failed: false, file: null, blob: null, url: null
    };
    byId('shareTopic').textContent = session.prompt;
    byId('shareTopic').hidden = false;
    byId('shareText').textContent = session.opinion.text;
    byId('shareCard').hidden = false;
    byId('shareCard').style.backgroundPosition = '0% 0%';
    byId('nativeShareBtn').onclick = () => nativeShare(session);
    byId('downloadBtn').onclick = () => downloadImage(session);
    byId('copyShareLinkBtn').onclick = () => copyLink(session);
    byId('retryShareImageBtn').onclick = () => prepareImage(session);
    const briefPrompt = segments(session.prompt).slice(0, 150).join('') + (segments(session.prompt).length > 150 ? '…' : '');
    const xLink = byId('shareXBtn');
    xLink.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${briefPrompt}\nMy take: ${session.opinion.text}\nWhat’s yours?`)}&url=${encodeURIComponent(SHARE_URL)}`;
    const fbLink = byId('shareFBBtn');
    fbLink.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`;
    [xLink, fbLink].forEach(link => { link.target = '_blank'; link.rel = 'noopener noreferrer'; });
    xLink.onclick = () => status(session, 'X opens a text-and-link draft. To include your rock image, download it and attach it in X.');
    fbLink.onclick = () => status(session, 'Facebook opens a link share. To post your rock image, download it and attach it in Facebook.');
    void prepareImage(session);
  };
})();
