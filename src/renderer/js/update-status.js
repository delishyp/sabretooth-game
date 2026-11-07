/**
 * Update status for the running app. The bar stays hidden when there is nothing to do.
 * Restart asks the main process to replace this installation silently and relaunch it.
 */
(async () => {
  const api = window.sabretooth;
  if (!api || !api.update) return;
  const $ = (id) => document.getElementById(id);
  const bar = $('update-bar');
  if (!bar) return;
  const copy = await api.copy.get();
  const t = I18n.create(copy.strings);
  const text = $('update-text');
  const track = $('update-track');
  const fill = $('update-fill');
  const detail = $('update-detail');
  const buttons = {
    restart: $('update-restart'),
    later: $('update-later'),
    retry: $('update-retry'),
    cancel: $('update-cancel')
  };

  function showButton(name, on) {
    const b = buttons[name];
    if (b) b.hidden = !on;
  }

  function render(s) {
    const phase = s && s.phase;
    const visible = phase && phase !== 'idle' && phase !== 'current';
    bar.hidden = !visible;
    if (!visible) return;
    const version = (s && s.version) || '';
    const percent = s && s.percent != null ? Math.round(s.percent) : 0;
    if (phase === 'checking') text.textContent = t('update.checking');
    else if (phase === 'downloading') text.textContent = t('update.downloading', { percent });
    else if (phase === 'ready' || phase === 'restarting') text.textContent = phase === 'restarting' ? t('update.restarting') : t('update.ready', { version });
    else if (phase === 'later') text.textContent = t('update.later');
    else if (phase === 'cancelled') text.textContent = t('update.cancelled');
    else text.textContent = t('update.error');
    const showTrack = phase === 'downloading' || phase === 'ready' || phase === 'later' || phase === 'restarting';
    track.hidden = !showTrack;
    fill.style.width = (showTrack ? percent : 0) + '%';
    track.setAttribute('aria-valuenow', String(percent));
    const err = phase === 'error' && s.message ? s.message : '';
    detail.hidden = !err;
    detail.textContent = err;
    showButton('restart', phase === 'ready' || phase === 'later');
    showButton('later', phase === 'ready');
    showButton('retry', phase === 'error' || phase === 'cancelled');
    showButton('cancel', phase === 'checking' || phase === 'downloading');
  }

  bar.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-update]');
    if (!b || b.hidden) return;
    const act = b.dataset.update;
    if (api.update[act]) api.update[act]().then(render).catch(() => {});
  });
  window.addEventListener('keydown', (ev) => {
    if (bar.hidden || !bar.contains(ev.target)) return;
    if (ev.key === 'Escape' && buttons.later && !buttons.later.hidden) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      buttons.later.click();
      return;
    }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest('#update-bar button')) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      ev.target.click();
    }
  }, true);
  if (api.onUpdate) api.onUpdate(render);
  try { render(await api.update.get()); } catch { /* no updater yet */ }
})();
