(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const experience = $('experience');
  const video = $('transition-video');
  const soundtrack = $('transition-audio');
  const BG_VOLUME = 0.15;
  let soundContext;
  let soundGain;
  const dialog = $('invitation-dialog');
  const feather = $('feather-button');
  const featherImage = $('feather-image');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const config = window.INVITATION || {};
  const storageKey = 'historia-invitation-v1:' + JSON.stringify(config);
  let state = 'start';
  let stallTimer;
  let revealTimer;
  let frameCallback;
  let playbackAttempt = 0;
  let alphaPixels;
  let previousOverflow = '';

  function setVolume(v) {
    if (soundGain) soundGain.gain.value = v;
    else soundtrack.volume = v;
  }
  function stopSound() {
    soundtrack.pause();
  }
  function startSound() {
    soundtrack.currentTime = 0;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!soundContext && AudioContext) {
      try {
        soundContext = new AudioContext();
        const source = soundContext.createMediaElementSource(soundtrack);
        soundGain = soundContext.createGain();
        source.connect(soundGain).connect(soundContext.destination);
      } catch { /* Fall back to media volume when Web Audio is unavailable. */ }
    }
    setVolume(BG_VOLUME);
    soundContext?.resume().catch(() => {});
    soundtrack.play().catch(() => {});
  }

  // Read the original PNG alpha only for hit testing. The displayed file is unchanged.
  function prepareFeatherHitArea() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = featherImage.naturalWidth;
      canvas.height = featherImage.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(featherImage, 0, 0);
      alphaPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    } catch { /* file:// may restrict canvas; use the feather's outline as fallback. */ }
  }
  if (featherImage.complete && featherImage.naturalWidth) prepareFeatherHitArea();
  else featherImage.addEventListener('load', prepareFeatherHitArea, { once: true });

  function hitsFeather(event) {
    const box = featherImage.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    if (x < 0 || y < 0 || x >= 1 || y >= 1) return false;
    if (alphaPixels) {
      const index = (Math.floor(y * featherImage.naturalHeight) * featherImage.naturalWidth + Math.floor(x * featherImage.naturalWidth)) * 4 + 3;
      return alphaPixels[index] > 30;
    }
    // Conservative outline of this supplied PNG, for browsers that block pixel reads.
    const outline = [[.71,.005],[.76,.04],[.75,.19],[.69,.34],[.63,.5],[.55,.65],[.49,.69],[.48,.85],[.455,.97],[.425,.85],[.42,.73],[.34,.68],[.3,.54],[.32,.39],[.41,.22],[.54,.075]];
    let inside = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const [xi, yi] = outline[i], [xj, yj] = outline[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  feather.addEventListener('pointermove', (event) => {
    feather.classList.toggle('is-hovered', state === 'start' && hitsFeather(event));
  });
  feather.addEventListener('pointerleave', () => feather.classList.remove('is-hovered'));

  function revealInvitation(message) {
    if (state !== 'ending') return;
    clearTimeout(revealTimer);
    state = 'final';
    experience.dataset.state = state;
    $('final-content').hidden = false;
    $('scene-footer').hidden = false;
    $('final-footer').hidden = false;
    $('experience-status').textContent = message || 'Приглашение готово. Нажмите «Открыть приглашение».';
    $('open-invitation').focus({ preventScroll: true });
  }
  function finish(message = '') {
    if (state !== 'starting' && state !== 'playing') return;
    clearTimeout(stallTimer);
    state = 'ending';
    video.pause();
    if (frameCallback !== undefined) video.cancelVideoFrameCallback?.(frameCallback);
    $('start-content').setAttribute('aria-hidden', 'true');
    $('start-content').inert = true;
    $('start-image').setAttribute('aria-hidden', 'true');
    $('end-image').removeAttribute('aria-hidden');
    experience.dataset.state = state;
    // Keep the same fullscreen geometry while the end image fades over the last frame.
    revealTimer = setTimeout(() => revealInvitation(message), reducedMotion.matches ? 0 : 760);
  }

  function armStallRecovery() {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => finish('Видео недоступно. Приглашение открыто без анимации.'), 20000);
  }
  function showVideoFrame(attempt) {
    if (attempt !== playbackAttempt || state !== 'starting') return;
    state = 'playing';
    experience.dataset.state = state;
    $('start-content').inert = true;
    $('start-content').setAttribute('aria-hidden', 'true');
  }
  feather.addEventListener('click', (event) => {
    if (state !== 'start' || (event.detail !== 0 && !hitsFeather(event))) return;
    const attempt = ++playbackAttempt;
    state = 'starting';
    experience.dataset.state = state;
    feather.disabled = true;
    feather.classList.remove('is-hovered');
    feather.blur();
    $('experience-status').textContent = 'Начинаем путешествие по истории.';
    video.currentTime = 0;
    startSound();
    armStallRecovery();
    if ('requestVideoFrameCallback' in video) {
      frameCallback = video.requestVideoFrameCallback(() => showVideoFrame(attempt));
    }
    video.play().then(() => {
      if (!('requestVideoFrameCallback' in video)) showVideoFrame(attempt);
    }).catch(() => {
      if (attempt === playbackAttempt) finish('Видео недоступно. Приглашение открыто без анимации.');
    });
  });
  video.addEventListener('playing', () => {
    clearTimeout(stallTimer);
  });
  video.addEventListener('waiting', armStallRecovery);
  video.addEventListener('stalled', armStallRecovery);
  video.addEventListener('timeupdate', () => {
    if (state === 'playing' && video.readyState >= 3) clearTimeout(stallTimer);
  });
  video.addEventListener('ended', () => finish());
  video.addEventListener('error', () => {
    finish('Видео недоступно. Приглашение открыто без анимации.');
  });
  $('replay-button').addEventListener('click', () => {
    ++playbackAttempt;
    clearTimeout(stallTimer);
    clearTimeout(revealTimer);
    state = 'start';
    video.pause();
    stopSound();
    soundtrack.currentTime = 0;
    video.currentTime = 0;
    experience.dataset.state = state;
    $('final-content').hidden = true;
    $('scene-footer').hidden = true;
    $('start-content').inert = false;
    $('start-content').removeAttribute('aria-hidden');
    $('start-image').removeAttribute('aria-hidden');
    $('end-image').setAttribute('aria-hidden', 'true');
    $('final-footer').hidden = true;
    feather.disabled = false;
    $('experience-status').textContent = 'Начальный экран. Нажмите на перо.';
    feather.focus({ preventScroll: true });
  });

  $('open-invitation').addEventListener('click', () => {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    dialog.scrollTop = 0;
    resizeName();
  });
  $('close-letter').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    $('open-invitation').focus({ preventScroll: true });
  });

  if (config.firstParticipant && $('first-participant')) {
    $('first-participant').textContent = config.firstParticipant;
  }
  const fields = { participant: $('participant'), date: $('event-date'), time: $('event-time'), meetUrl: $('meet-link') };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { /* Private browsing may disable storage. */ }
  for (const [key, input] of Object.entries(fields)) {
    input.value = typeof saved[key] === 'string' ? saved[key] : (config[key] || '');
    input.addEventListener('input', () => {
      try { localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value])))); } catch { const note = document.querySelector('.editing-note'); if (note) note.textContent = 'Сохранение в браузере недоступно. Изменения действуют до перезагрузки страницы.'; }
      if (key === 'participant') resizeName();
      if (key === 'meetUrl') updateMeet();
    });
  }
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  function resizeName() {
    const text = fields.participant.value || fields.participant.placeholder || '';
    if (measureCtx) {
      measureCtx.font = window.getComputedStyle(fields.participant).font || '500 32px var(--serif)';
      const textWidth = measureCtx.measureText(text).width;
      fields.participant.style.width = Math.max(70, Math.ceil(textWidth + 14)) + 'px';
    } else {
      fields.participant.style.width = Math.max(4.8, text.length * 1.05 + 1) + 'ch';
    }
  }
  if (document.fonts?.ready) document.fonts.ready.then(resizeName);
  window.addEventListener('resize', resizeName);
  function meetUrl() {
    try {
      const url = new URL(fields.meetUrl.value.trim());
      if (url.protocol !== 'https:' || url.hostname !== 'meet.google.com' || url.port || url.username || url.password || url.pathname === '/') return null;
      return url.href;
    } catch { return null; }
  }
  function showLinkStatus(message, error = false) {
    $('link-status').textContent = message;
    $('link-status').classList.toggle('error', error);
    fields.meetUrl.setAttribute('aria-invalid', String(error));
  }
  function updateMeet() {
    const url = meetUrl();
    const link = $('join-meet');
    link.href = url || '#meet-link';
    link.setAttribute('aria-disabled', String(!url));
    if (url) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    else { link.removeAttribute('target'); link.removeAttribute('rel'); }
    showLinkStatus(url ? 'Ссылка готова. До встречи в Google Meet!' : fields.meetUrl.value ? 'Укажите ссылку встречи: https://meet.google.com/…' : 'Вставьте ссылку Google Meet, чтобы присоединиться.', !url && !!fields.meetUrl.value);
  }
  $('join-meet').addEventListener('click', (event) => {
    if (meetUrl()) return;
    event.preventDefault();
    fields.meetUrl.focus();
    showLinkStatus('Сначала вставьте действительную ссылку Google Meet.', true);
  });
  $('copy-link').addEventListener('click', async () => {
    const url = meetUrl();
    if (!url) { fields.meetUrl.focus(); showLinkStatus('Сначала вставьте действительную ссылку Google Meet.', true); return; }
    try {
      await navigator.clipboard.writeText(url);
      showLinkStatus('Ссылка скопирована.');
    } catch {
      fields.meetUrl.focus();
      fields.meetUrl.select();
      showLinkStatus('Ссылка выделена. Нажмите Ctrl+C или выберите «Копировать».');
    }
  });
  resizeName();
  updateMeet();
})();
