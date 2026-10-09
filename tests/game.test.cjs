'use strict';
// Behavior tests for the actual browser engine, using a deterministic virtual clock.
// Run: node --test tests/game.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(process.argv[2] || require('node:path').join(__dirname, '../game.js'), 'utf8');

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, fn) {
    const list = this.listeners.get(name) || [];
    list.push(fn); this.listeners.set(name, list);
  }
  removeEventListener(name, fn) {
    this.listeners.set(name, (this.listeners.get(name) || []).filter(item => item !== fn));
  }
  emit(name, values = {}) {
    const event = { preventDefault() {}, target: this, ...values };
    for (const listener of this.listeners.get(name) || []) listener(event);
  }
}

function setup() {
  let seed = 7217;
  let now = 0;
  let nextId = 1;
  const raf = new Map();
  const context2d = new Proxy({}, { get(obj, key) {
    if (key in obj) return obj[key];
    if (key === 'createRadialGradient' || key === 'createLinearGradient') return () => ({ addColorStop() {} });
    return () => {};
  }});
  const window = new Events();
  const document = new Events();
  document.createElement = () => ({ width: 0, height: 0, getContext: () => context2d });
  document.hidden = false;
  window.devicePixelRatio = 3;
  const canvas = new Events();
  canvas.style = {};
  canvas.rect = { width: 360, height: 570, left: 12, top: 80 };
  canvas.getBoundingClientRect = () => canvas.rect;
  canvas.getContext = () => context2d;
  canvas.setPointerCapture = id => { canvas.capturedId = id; };
  canvas.releasePointerCapture = () => { canvas.capturedId = null; };
  const math = Object.create(Math);
  math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const sandbox = { window, document, Math: math, console,
    requestAnimationFrame(fn) { const id = nextId++; raf.set(id, fn); return id; },
    cancelAnimationFrame(id) { raf.delete(id); }
  };
  vm.runInNewContext(source, sandbox, { filename: 'game.js' });
  const updates = [], events = [];
  const game = new window.ShmupGame({ canvas, onUpdate: state => updates.push(state), onEvent: event => events.push(event) });
  function frame(ms = 1000 / 60) {
    now += ms;
    const pending = [...raf.values()]; raf.clear();
    for (const fn of pending) fn(now);
  }
  function quiet() {
    // Isolate gameplay scenarios from unrelated timed spawns and firing.
    game.spawnTimer = game.shotTimer = game.enemyShotTimer = 10000;
  }
  return { game, canvas, window, document, events, updates, frame, quiet, raf };
}

function enemy(overrides = {}) {
  return { x: 120, baseX: 120, y: 120, type: 0, age: 0, phase: 0, sway: 0,
    swayRate: 0, speed: 0, r: 13, hp: 1, color: '#ff866c', hit: 0, dead: false, ...overrides };
}
function shot(x, y) { return { x, y, vx: 0, vy: 0, r: 5, dead: false }; }
function json(value) { return JSON.parse(JSON.stringify(value)); }

test('ready state, launch, auto-fire and actual moving waves', () => {
  const h = setup();
  assert.equal(h.game.snapshot().status, 'ready');
  assert.equal(h.game.snapshot().target, 10000);
  h.game.start();
  for (let i = 0; i < 90; i++) h.frame();
  assert.equal(h.game.status, 'playing');
  assert(h.game.elapsed > 1);
  assert(h.game.enemies.length > 0);
  assert(h.game.bullets.length > 0);
  assert(h.game.enemies.some(item => item.y > 0));
  h.game.destroy();
});

test('escaping enemies and armor hits do not count; actual destruction counts once', () => {
  const h = setup(); h.game.start(); h.quiet();
  h.game.enemies = [enemy({ y: h.game.height + 60 }), enemy({ hp: 2 })];
  h.game.bullets = [shot(120, 120)];
  h.frame();
  assert.equal(h.game.kills, 0);
  assert.equal(h.game.enemies.length, 1);
  assert.equal(h.game.enemies[0].hp, 1);
  h.game.bullets = [shot(120, 120), shot(120, 120)];
  h.frame();
  assert.equal(h.game.kills, 1);
  assert.equal(h.game.enemies.length, 0);
  assert.equal(h.game.score, 100);
  h.frame();
  assert.equal(h.game.kills, 1);
  h.game.destroy();
});

test('ordinary fire completes the objective at exactly 10000 and finishes only once', () => {
  const h = setup(); h.game.start(); h.quiet();
  h.game.kills = 9999;
  h.game.enemies = [enemy(), enemy({ x: 240, baseX: 240 })];
  h.game.bullets = [shot(120, 120), shot(240, 120)];
  h.frame();
  assert.equal(h.game.kills, 10000);
  assert.equal(h.game.status, 'victory');
  assert.equal(h.events.filter(event => event.type === 'victory').length, 1);
  const terminal = json(h.game.snapshot());
  for (let i = 0; i < 20; i++) h.frame();
  assert.deepEqual(json(h.game.snapshot()), terminal);
  assert.equal(h.game.bomb(), false);
  h.game.destroy();
});

test('nova clears bullets and units, caps victory at exactly 10000, and respects paused state', () => {
  const h = setup(); h.game.start(); h.quiet();
  h.game.kills = 9995;
  h.game.enemies = Array.from({ length: 12 }, (_, i) => enemy({ x: 20 + i * 30 }));
  h.game.enemyBullets = [shot(100, 100), shot(200, 200)];
  h.game.pause();
  assert.equal(h.game.bomb(), false);
  assert.equal(h.game.bombs, 3);
  assert.equal(h.game.kills, 9995);
  h.game.resume();
  assert.equal(h.game.bomb(), true);
  assert.equal(h.game.kills, 10000);
  assert.equal(h.game.status, 'victory');
  assert.equal(h.game.enemyBullets.length, 0);
  assert.equal(h.events.filter(event => event.type === 'victory').length, 1);
  assert(h.game.bombs >= 0 && h.game.bombs <= 3);
  h.game.destroy();
});

test('novas are finite; 100 kills replenish one and never exceeds capacity', () => {
  const h = setup(); h.game.start(); h.quiet();
  for (let i = 0; i < 3; i++) assert.equal(h.game.bomb(), true);
  assert.equal(h.game.bombs, 0);
  assert.equal(h.game.bomb(), false);
  h.game.kills = 99;
  h.game.enemies = [enemy()]; h.game.bullets = [shot(120, 120)]; h.frame();
  assert.equal(h.game.kills, 100);
  assert.equal(h.game.bombs, 1);
  assert.equal(h.game.sector, 1);
  assert.equal(h.events.filter(event => event.type === 'sector').length, 0);
  h.game.destroy();
});

test('pause freezes simulation and resume does not fast-forward elapsed time', () => {
  const h = setup(); h.game.start(); h.quiet();
  h.game.enemies = [enemy({ speed: 20 })];
  h.game.enemyBullets = [shot(100, 100)];
  h.window.emit('keydown', { key: 'ArrowRight' }); h.frame();
  h.game.pause();
  const state = json({ snapshot: h.game.snapshot(), player: h.game.player, enemies: h.game.enemies,
    bullets: h.game.enemyBullets, invulnerability: h.game.invulnerability });
  for (let i = 0; i < 8; i++) h.frame(10000);
  assert.deepEqual(json({ snapshot: h.game.snapshot(), player: h.game.player, enemies: h.game.enemies,
    bullets: h.game.enemyBullets, invulnerability: h.game.invulnerability }), state);
  assert.equal(h.game.keys.size, 0);
  h.game.resume(); h.frame(60000);
  assert(h.game.elapsed - state.snapshot.elapsed < 0.04);
  h.game.destroy();
});

test('pointer drag is relative, single-owner, bounded, and stops on release/cancel/lost capture', () => {
  const h = setup(); h.game.start(); h.quiet();
  const first = { ...h.game.player };
  h.canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 4, clientX: 30, clientY: 100 });
  assert.equal(h.game.player.x, first.x, 'touching away from ship should not teleport it');
  h.canvas.emit('pointermove', { pointerId: 4, clientX: 60, clientY: 130 });
  assert.equal(h.game.player.x, first.x + 40);
  assert.equal(h.game.player.y, first.y + 40);
  h.canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 5, clientX: 10, clientY: 10 });
  h.canvas.emit('pointermove', { pointerId: 5, clientX: 100, clientY: 100 });
  assert.equal(h.game.player.x, first.x + 40);
  h.canvas.emit('pointerup', { pointerId: 5 });
  assert.equal(h.game.pointer.id, 4);
  h.canvas.emit('pointermove', { pointerId: 4, clientX: -10000, clientY: -10000 });
  assert(h.game.player.x >= 0 && h.game.player.y >= 0);
  h.canvas.emit('pointermove', { pointerId: 4, clientX: 10000, clientY: 10000 });
  assert(h.game.player.x < h.game.width && h.game.player.y < h.game.height);
  for (const release of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    h.canvas.emit(release, { pointerId: 4 });
    const stable = { ...h.game.player };
    h.canvas.emit('pointermove', { pointerId: 4, clientX: -10000, clientY: -10000 });
    assert.deepEqual(json(h.game.player), stable);
    assert.equal(h.game.pointer, null);
    h.canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 4, clientX: 20, clientY: 20 });
  }
  h.game.destroy();
});

test('resize across phone/tablet/landscape preserves a bounded ship and caps pixel density', () => {
  const h = setup(); h.game.start(); h.quiet();
  for (const [width, height] of [[296, 350], [406, 745], [480, 660], [812, 220], [296, 570]]) {
    h.canvas.rect = { width, height, left: 0, top: 0 };
    h.window.emit('resize');
    assert.equal(h.canvas.width, width * 2);
    assert.equal(h.canvas.height, height * 2);
    assert(Number.isFinite(h.game.player.y));
    assert(h.game.player.y > 0 && h.game.player.y < h.game.height);
    h.frame();
    assert(h.game.player.x > 0 && h.game.player.x < h.game.width);
    assert(h.game.player.y > 0 && h.game.player.y < h.game.height);
  }
  h.game.destroy();
});

test('collisions deduct health with a grace period and the fifth hit ends the run', () => {
  const h = setup(); h.game.start(); h.quiet();
  h.game.invulnerability = 0;
  const hit = () => { h.game.enemyBullets = [shot(h.game.player.x, h.game.player.y)]; h.frame(); };
  hit(); assert.equal(h.game.health, 4);
  hit(); assert.equal(h.game.health, 4, 'repeat overlap must not drain all lives');
  for (let i = 0; i < 4; i++) { h.game.invulnerability = 0; hit(); }
  assert.equal(h.game.health, 0);
  assert.equal(h.game.status, 'gameover');
  assert.equal(h.events.filter(event => event.type === 'gameover').length, 1);
  const elapsed = h.game.elapsed;
  h.frame(10000); assert.equal(h.game.elapsed, elapsed);
  h.game.destroy();
});

test('shield pickups repair only to maximum and restore temporary protection', () => {
  const h = setup(); h.game.start(); h.quiet();
  h.game.health = 4; h.game.invulnerability = 0;
  const collect = () => { h.game.pickups = [{ x: h.game.player.x, y: h.game.player.y, age: 0, dead: false }]; h.frame(); };
  collect(); assert.equal(h.game.health, 5);
  assert(h.game.invulnerability > 0);
  collect(); assert.equal(h.game.health, 5);
  assert.equal(h.game.pickups.length, 0);
  h.game.destroy();
});

test('app switching and window blur pause, clear input, and require explicit resume', () => {
  const h = setup(); h.game.start(); h.quiet();
  h.window.emit('keydown', { key: 'd' });
  h.canvas.emit('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 1, clientY: 1 });
  h.document.hidden = true; h.document.emit('visibilitychange');
  assert.equal(h.game.status, 'paused');
  assert.equal(h.game.keys.size, 0);
  assert.equal(h.game.pointer, null);
  h.document.hidden = false; h.document.emit('visibilitychange');
  assert.equal(h.game.status, 'paused');
  h.game.resume(); h.window.emit('blur'); assert.equal(h.game.status, 'paused');
  h.game.destroy();
});

test('restarting resets mission, lives, ammunition, elapsed time, entities, and held input', () => {
  const h = setup(); h.game.start(); h.quiet();
  h.game.kills = 428; h.game.score = 82700; h.game.health = 1; h.game.bombs = 0;
  h.game.sector = 5; h.game.elapsed = 71; h.game.combo = 28;
  h.game.enemies = [enemy()]; h.game.bullets = [shot(100, 100)]; h.game.enemyBullets = [shot(10, 10)];
  h.window.emit('keydown', { key: 'w' });
  h.game.pause(); h.game.start();
  assert.deepEqual(json(h.game.snapshot()), { status: 'playing', kills: 0, target: 10000,
    health: 5, maxHealth: 5, bombs: 3, sector: 1, score: 0, elapsed: 0, combo: 0, overdrive: 1, fireRate: 3 / 0.105, spawnRate: 3 / 1.02 });
  assert.equal(h.game.enemies.length + h.game.bullets.length + h.game.enemyBullets.length, 0);
  assert.equal(h.game.keys.size, 0);
  assert.equal(h.game.pointer, null);
  assert(h.game.player.y < h.game.height);
  h.game.destroy();
});

test('destroy cancels animation and unregisters input handlers', () => {
  const h = setup(); h.game.start(); h.game.destroy();
  assert.equal(h.raf.size, 0);
  const state = json(h.game.snapshot());
  h.window.emit('keydown', { key: 'p' }); h.frame();
  assert.deepEqual(json(h.game.snapshot()), state);
  for (const target of [h.window, h.document, h.canvas]) {
    assert.equal([...target.listeners.values()].flat().length, 0);
  }
});

test('actual firing and waves double every 2000 kills, including multiple volleys per frame', () => {
  const samples = [];
  for (const kills of [0, 2000, 4000, 8000, 9999]) {
    const h = setup(); h.game.start(); h.game.kills = kills;
    let bullets = 0, enemies = 0;
    for (let i = 0; i < 120; i++) {
      h.game.enemies.length = h.game.bullets.length = 0;
      h.frame(); bullets += h.game.bullets.length; enemies += h.game.enemies.length;
    }
    const lanes = 3 + 2 * Math.min(4, Math.floor(kills / 1000));
    samples.push({ volleys: bullets / lanes, enemies });
    assert(h.game.enemies.every(e => Number.isFinite(e.x)));
    h.game.destroy();
  }
  assert(samples[1].volleys / samples[0].volleys > 1.8);
  assert(samples[2].volleys / samples[1].volleys > 1.8);
  assert(samples[4].volleys / samples[0].volleys > 28);
  assert(samples[4].enemies / samples[0].enemies > 25);
  assert(samples[4].volleys > 120, 'must fire multiple times in one frame');
});

test('sectors change every 1000 kills; late-game load stays finite and within budgets', () => {
  const h = setup(); h.game.start(); h.quiet(); h.game.kills = 999;
  h.game.enemies = [enemy()]; h.game.bullets = [shot(120, 120)]; h.frame();
  assert.equal(h.game.sector, 2);
  h.game.kills = 9000; h.game.sector = 10; h.game.spawnTimer = h.game.shotTimer = 0;
  h.game.invulnerability = 100;
  for (let i = 0; i < 900 && h.game.status === 'playing'; i++) {
    h.game.player.x = 240 + Math.sin(i / 45) * 195;
    h.frame();
    assert(h.game.enemies.length <= 480);
    assert(h.game.bullets.length <= 2400);
    assert(h.game.particles.length <= 2400);
    assert(h.game.rings.length <= 96);
    assert(h.game.enemies.every(e => Number.isFinite(e.x) && Number.isFinite(e.y)));
  }
  assert(h.game.kills > 9000);
  h.game.destroy();
});

test('a single remaining enemy slot never produces NaN coordinates', () => {
  const h = setup(); h.game.start();
  h.game.enemies = Array.from({ length: 479 }, () => enemy());
  h.game._spawnWave();
  assert.equal(h.game.enemies.length, 480);
  assert(h.game.enemies.every(e => Number.isFinite(e.x)));
  h.game.destroy();
});

test('initial volleys, formation frequency and enemy travel are three times the original baseline', () => {
  const h = setup(); h.game.start();
  let bullets = 0;
  for (let i = 0; i < 120; i++) {
    h.game.bullets.length = 0; h.frame(); bullets += h.game.bullets.length;
  }
  assert(bullets / 3 >= 56 && bullets / 3 <= 59, `volleys: ${bullets / 3}, kills: ${h.game.kills}`);
  assert.equal(h.game.wave, 6);
  assert(h.game.enemies.every(e => e.speed === (e.type === 1 ? 315 : 246)));
  const e = enemy({ speed: 246 });
  h.game.enemies = [e]; h.quiet();
  const y = e.y;
  for (let i = 0; i < 60; i++) h.frame();
  assert(Math.abs(e.y - y - 246) < 0.01);
  h.game.destroy();
});

test('RGB compositor separates all three color channels on resized reusable surfaces', () => {
  const h = setup();
  const colors = [], offsets = [];
  h.game.channelCtx = { drawImage() {}, fillRect() { colors.push(this.fillStyle); } };
  h.game.sceneCtx = { drawImage() {} };
  const ctx = { save() {}, restore() {}, fillRect() {}, drawImage(source, x) { if (source === h.game.channelCanvas) offsets.push(x); } };
  h.game._drawChromaticAberration(ctx);
  assert.deepEqual(colors, ['#ff0000', '#00ff00', '#0000ff']);
  assert(offsets[0] < 0 && offsets[1] === 0 && offsets[2] > 0);
  assert.equal(h.game.sceneCanvas.width, h.canvas.width);
  assert.equal(h.game.channelCanvas.height, h.canvas.height);
  h.game.destroy();
});

test('idle effects are subtle, kills double the prior burst, and quiet flight settles back down', () => {
  const h = setup();
  assert(h.game._effectProfile().strength < 1);
  assert(h.game._effectProfile().bloom < 0.03);
  h.game.start(); h.quiet();
  h.game.enemies = [enemy()]; h.game.bullets = [shot(120, 120)]; h.frame();
  assert.equal(h.game.particles.length, 120, 'previous standard kill emitted 60 sparks');
  assert(h.game._effectProfile().strength > 11);
  assert(h.game._effectProfile().bloom > 0.33);
  for (let i = 0; i < 120; i++) h.frame();
  assert(h.game._effectProfile().strength < 1);
  assert.equal(h.game.particles.length, 0);
  h.game.bomb();
  assert(h.game._effectProfile().strength > 50);
  h.game.pause();
  assert(h.game._effectProfile().strength < 1);
  h.game.start();
  assert.equal(h.game.impact, 0);
  h.game.reducedMotion = true; h.game.bomb();
  assert(h.game._effectProfile().strength < 1);
  h.game.destroy();
});
