/* UI stays separate from the canvas simulation. Everything runs locally. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game-canvas');
  const overlay = $('game-overlay');
  const soundButton = $('sound-button');
  const help = $('help-dialog');
  let best = 0;
  let sound = false;
  let priorStatus;
  let toastTimer;
  try { best = Math.min(10000, Math.max(0, Number(localStorage.getItem('thousand-best')) || 0)); } catch (_) { /* Private browsing still works. */ }
  $('best-count').textContent = String(best).padStart(5, '0');

  function toast(message) {
    if (!message) return;
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2300);
  }
  const screenEffects = new window.ScreenEffects(canvas);
  const game = new window.ShmupGame({ canvas, onUpdate: update, onEvent: event => toast(event.message), onEffects: engine => screenEffects.draw(engine) });

  function update(state) {
    $('kill-count').textContent = String(state.kills).padStart(5, '0');
    $('kill-progress').style.width = `${Math.min(100, state.kills / state.target * 100)}%`;
    $('sector-label').textContent = `SECTOR ${String(state.sector).padStart(2, '0')} / 10`;
    $('bomb-count').textContent = String(state.bombs).padStart(2, '0');
    const minutes = Math.floor(state.elapsed / 60);
    $('time-count').textContent = `${String(minutes).padStart(2, '0')}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`;
    $('score-count').textContent = String(state.score).padStart(6, '0');
    $('combo-count').textContent = `×${state.combo}`;
    $('overdrive-count').textContent = `×${state.overdrive.toFixed(2)}`;
    $('hud-overdrive').textContent = `×${state.overdrive.toFixed(2)}`;
    $('fire-rate').textContent = `${Math.round(state.fireRate)}/s`;
    $('spawn-rate').textContent = `${state.spawnRate.toFixed(1)}/s`;
    $('shield-pips').setAttribute('aria-label', `Shield ${state.health} of ${state.maxHealth}`);
    [...$('shield-pips').children].forEach((pip, i) => pip.classList.toggle('empty', i >= state.health));
    $('bomb-button').disabled = state.status !== 'playing' || state.bombs <= 0;
    $('bomb-button').setAttribute('aria-label', `Nova bomb, ${state.bombs} remaining`);
    $('pause-button').disabled = !['playing', 'paused'].includes(state.status);
    $('pause-button').setAttribute('aria-label', state.status === 'paused' ? 'Resume game' : 'Pause game');
    $('pause-button').querySelector('use').setAttribute('href', state.status === 'paused' ? '#i-play' : '#i-pause');
    $('live-dot').classList.toggle('active', state.status === 'playing');
    const labels = { ready: 'AWAITING PILOT', playing: 'MISSION IN PROGRESS', paused: 'FLIGHT PAUSED', victory: 'MISSION COMPLETE', gameover: 'SIGNAL LOST' };
    $('run-status').textContent = labels[state.status];
    if (state.kills > best) {
      best = state.kills;
      $('best-count').textContent = String(best).padStart(5, '0');
      // Save only on run boundaries, rather than every frame.
    }
    if (priorStatus === state.status) return;
    priorStatus = state.status;
    overlay.hidden = state.status === 'playing';
    $('restart-button').hidden = state.status !== 'paused';
    if (['victory', 'gameover', 'paused'].includes(state.status)) {
      try { localStorage.setItem('thousand-best', String(best)); } catch (_) { /* Storage is optional. */ }
    }
    if (state.status === 'paused') {
      $('overlay-kicker').textContent = 'TAKE A BREATHER';
      $('overlay-title').innerHTML = 'HOLD THAT<br><em>THOUGHT.</em>';
      $('overlay-copy').textContent = `${state.kills.toLocaleString()} down. ${(state.target - state.kills).toLocaleString()} to go. Your mission is waiting.`;
      $('start-label').textContent = 'RESUME MISSION';
      $('overlay-note').textContent = 'P / ESC TO RESUME';
    } else if (state.status === 'gameover') {
      $('overlay-kicker').textContent = 'INTERCEPTOR OFFLINE';
      $('overlay-title').innerHTML = 'GOOD RUN.<br><em>GO AGAIN.</em>';
      $('overlay-copy').textContent = `${state.kills.toLocaleString()} / 10,000 units destroyed. Every great pilot starts with one more try.`;
      $('start-label').textContent = 'TRY AGAIN';
      $('overlay-note').textContent = `PERSONAL BEST / ${best.toLocaleString()} UNITS`;
      $('start-button').focus({ preventScroll: true });
    } else if (state.status === 'victory') {
      $('overlay-kicker').textContent = 'ALL TEN SECTORS CLEAR';
      $('overlay-title').innerHTML = 'TEN THOUSAND.<br><em>TO ZERO.</em>';
      $('overlay-copy').textContent = `Mission complete. 10,000 units destroyed in ${minutes}m ${Math.floor(state.elapsed % 60)}s. Space looks good on you.`;
      $('start-label').textContent = 'FLY AGAIN';
      $('overlay-note').textContent = `FINAL SCORE / ${state.score.toLocaleString()}`;
      $('start-button').focus({ preventScroll: true });
    }
  }

  $('start-button').addEventListener('click', () => {
    if (game.snapshot().status === 'paused') game.resume(); else game.start();
    canvas.focus({ preventScroll: true });
  });
  $('restart-button').addEventListener('click', () => { game.start(); canvas.focus({ preventScroll: true }); });
  $('pause-button').addEventListener('click', () => game.togglePause());
  $('bomb-button').addEventListener('click', () => { game.bomb(); canvas.focus({ preventScroll: true }); });
  soundButton.addEventListener('click', () => {
    sound = !sound;
    game.setSound(sound);
    soundButton.setAttribute('aria-pressed', String(sound));
    soundButton.setAttribute('aria-label', sound ? 'Mute sound' : 'Enable sound');
    soundButton.title = sound ? 'Mute sound' : 'Enable sound';
    soundButton.querySelector('use').setAttribute('href', sound ? '#i-sound' : '#i-muted');
  });
  $('help-button').addEventListener('click', () => {
    if (game.snapshot().status === 'playing') game.pause();
    help.showModal();
  });
  $('close-help').addEventListener('click', () => help.close());
  $('got-it').addEventListener('click', () => help.close());
  help.addEventListener('click', event => { if (event.target === help) { const rect = help.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) help.close(); } });
  // A dialog must consume game hotkeys, including Escape's native close action.
  window.addEventListener('keydown', event => { if (help.open) event.stopImmediatePropagation(); }, true);
  window.addEventListener('pagehide', () => { try { localStorage.setItem('thousand-best', String(best)); } catch (_) {} });
})();
