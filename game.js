/* ZERO / THOUSAND — dependency-free, touch-first canvas flight engine. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const TARGET = 10000;
  const WIDTH = 480;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const random = (low, high) => low + Math.random() * (high - low);
  const COLORS = { lime: '#d8fa78', coral: '#ff866c', cyan: '#6fdbe6', lilac: '#a7a2ff', white: '#e4f8ff' };

  class ShmupGame {
    constructor({ canvas, onUpdate, onEvent } = {}) {
      if (!canvas) throw new Error('ShmupGame requires a canvas.');
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      if (!this.ctx) throw new Error('Your browser does not support Canvas 2D.');
      this.onUpdate = typeof onUpdate === 'function' ? onUpdate : () => {};
      this.onEvent = typeof onEvent === 'function' ? onEvent : () => {};
      this.width = WIDTH;
      this.height = 720;
      this.status = 'ready';
      this.soundEnabled = false;
      this.audio = null;
      this.keys = new Set();
      this.pointer = null;
      this.enemies = [];
      this.bullets = [];
      this.enemyBullets = [];
      this.particles = [];
      this.pickups = [];
      this.rings = [];
      this.popups = [];
      this.reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      this.stars = Array.from({ length: 105 }, () => ({ x: Math.random(), y: Math.random(), z: random(0.2, 1), blink: random(0, TAU) }));
      this._listeners = [];
      this._visualTime = 0;
      this._lastTime = 0;
      this._uiTimer = 0;
      this._disposed = false;
      this._reset();
      this._bindInput();
      this.resize();
      if (typeof ResizeObserver !== 'undefined') {
        this._resizeObserver = new ResizeObserver(() => this.resize());
        this._resizeObserver.observe(canvas);
      } else {
        this._listen(window, 'resize', () => this.resize());
      }
      this._notify();
      this._loop = (timestamp) => {
        if (this._disposed) return;
        const dt = this._lastTime ? clamp((timestamp - this._lastTime) / 1000, 0, 0.035) : 1 / 60;
        this._lastTime = timestamp;
        this._visualTime += dt;
        if (this.status === 'playing') this._update(dt);
        if (this.status !== 'paused') this._updateEffects(dt);
        this._draw();
        this._uiTimer += dt;
        if (this._uiTimer >= 0.1) { this._uiTimer = 0; this._notify(); }
        this._rafId = requestAnimationFrame(this._loop);
      };
      this._rafId = requestAnimationFrame(this._loop);
    }

    _reset() {
      this.kills = 0;
      this.score = 0;
      this.health = 5;
      this.maxHealth = 5;
      this.bombs = 3;
      this.sector = 1;
      this.elapsed = 0;
      this.combo = 0;
      this.comboTimer = 0;
      this.wave = 0;
      this.spawnTimer = 0.15;
      this.shotTimer = 0;
      this.enemyShotTimer = 1.8;
      this.invulnerability = 0;
      this.shake = 0;
      this.flash = 0;
      this.bombPulse = 0;
      this.player = { x: WIDTH / 2, y: this.height * 0.82, r: 8, bank: 0 };
      this.enemies.length = 0;
      this.bullets.length = 0;
      this.enemyBullets.length = 0;
      this.pickups.length = 0;
      this.particles.length = 0;
      this.rings.length = 0;
      this.popups.length = 0;
      this.keys.clear();
      this.pointer = null;
    }

    snapshot() {
      return {
        status: this.status, kills: this.kills, target: TARGET,
        health: this.health, maxHealth: this.maxHealth, bombs: this.bombs,
        sector: this.sector, score: this.score, elapsed: this.elapsed, combo: this.combo,
        overdrive: this._pace(), fireRate: this._pace() / 0.105, spawnRate: this._pace() / 1.02
      };
    }

    start() {
      if (this._disposed) return;
      this._reset();
      this.status = 'playing';
      this._lastTime = 0;
      this.invulnerability = 2;
      this._unlockAudio();
      this._notify();
      this._event('start', 'Flight systems online.');
    }

    pause() {
      if (this.status !== 'playing') return;
      this.status = 'paused';
      this.keys.clear();
      this.pointer = null;
      this._notify();
    }

    resume() {
      if (this.status !== 'paused') return;
      this.status = 'playing';
      this._lastTime = 0;
      this._unlockAudio();
      this._notify();
    }

    togglePause() {
      if (this.status === 'playing') this.pause();
      else if (this.status === 'paused') this.resume();
    }

    bomb() {
      if (this.status !== 'playing' || this.bombs <= 0) return false;
      this.bombs--;
      this.bombPulse = 1;
      this.shake = 9;
      this.enemyBullets.length = 0;
      this.invulnerability = Math.max(this.invulnerability, 1.1);
      const targets = this.enemies.slice();
      for (const enemy of targets) this._killEnemy(enemy, true);
      this.enemies = this.enemies.filter(enemy => !enemy.dead);
      this._tone('bomb');
      this._event('bomb', 'Nova deployed.');
      this._notify();
      return true;
    }

    setSound(enabled) {
      this.soundEnabled = !!enabled;
      if (this.soundEnabled) this._unlockAudio();
      else if (this.audio && this.audio.state === 'running') {
        this.audio.suspend().catch(() => {});
      }
      return this.soundEnabled;
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const oldHeight = this.height;
      this.height = WIDTH * rect.height / rect.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
      this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
      this.scale = this.canvas.width / WIDTH;
      if (this.player) this.player.y = clamp(this.player.y / oldHeight * this.height, 40, this.height - 28);
      this._draw();
    }

    destroy() {
      this._disposed = true;
      cancelAnimationFrame(this._rafId);
      this._listeners.forEach(([target, name, callback, options]) => target.removeEventListener(name, callback, options));
      if (this._resizeObserver) this._resizeObserver.disconnect();
      if (this.audio) this.audio.close().catch(() => {});
    }

    _listen(target, name, callback, options) {
      target.addEventListener(name, callback, options);
      this._listeners.push([target, name, callback, options]);
    }

    _bindInput() {
      this.canvas.style.touchAction = 'none';
      this._listen(this.canvas, 'pointerdown', event => {
        if (this.status !== 'playing' || this.pointer || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        this._unlockAudio();
        this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        if (this.canvas.setPointerCapture) this.canvas.setPointerCapture(event.pointerId);
      });
      this._listen(this.canvas, 'pointermove', event => {
        if (this.status !== 'playing' || !this.pointer || this.pointer.id !== event.pointerId) return;
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const ratio = WIDTH / rect.width;
        const dx = (event.clientX - this.pointer.x) * ratio;
        this.player.x = clamp(this.player.x + dx, 22, WIDTH - 22);
        this.player.y = clamp(this.player.y + (event.clientY - this.pointer.y) * ratio, 48, this.height - 24);
        this.player.bank = clamp(dx / 8, -1, 1);
        this.pointer.x = event.clientX;
        this.pointer.y = event.clientY;
      }, { passive: false });
      const releasePointer = event => {
        if (this.pointer && this.pointer.id === event.pointerId) this.pointer = null;
      };
      this._listen(this.canvas, 'pointerup', releasePointer);
      this._listen(this.canvas, 'pointercancel', releasePointer);
      this._listen(this.canvas, 'lostpointercapture', releasePointer);
      this._listen(window, 'keydown', event => {
        const target = event.target;
        if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
        const key = event.key.toLowerCase();
        // Preserve native keyboard activation for focused UI controls.
        if (key === ' ' && target && (/^(BUTTON|A)$/.test(target.tagName) || target.getAttribute?.('role') === 'button')) return;
        if (!['playing', 'paused'].includes(this.status)) return;
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'p', 'escape'].includes(key)) {
          event.preventDefault();
          if (!event.repeat && (key === 'p' || key === 'escape')) this.togglePause();
          else if (!event.repeat && key === ' ') this.bomb();
          else this.keys.add(key);
        }
      });
      this._listen(window, 'keyup', event => this.keys.delete(event.key.toLowerCase()));
      this._listen(window, 'blur', () => this.pause());
      this._listen(document, 'visibilitychange', () => { if (document.hidden) this.pause(); });
    }

    _notify() { this.onUpdate(this.snapshot()); }
    _event(type, message) { this.onEvent({ type, message }); }
    _pace() { return 2 ** (Math.min(TARGET, this.kills) / 2000); }

    _update(dt) {
      if (this.status !== 'playing') return;
      this.elapsed += dt;
      this.invulnerability = Math.max(0, this.invulnerability - dt);
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
      const horizontal = Number(this.keys.has('arrowright') || this.keys.has('d')) - Number(this.keys.has('arrowleft') || this.keys.has('a'));
      const vertical = Number(this.keys.has('arrowdown') || this.keys.has('s')) - Number(this.keys.has('arrowup') || this.keys.has('w'));
      const diagonal = horizontal && vertical ? Math.SQRT1_2 : 1;
      this.player.x = clamp(this.player.x + horizontal * 315 * dt * diagonal, 22, WIDTH - 22);
      this.player.y = clamp(this.player.y + vertical * 315 * dt * diagonal, 48, this.height - 24);
      this.player.bank += (horizontal - this.player.bank) * Math.min(1, dt * 10);

      this.shotTimer -= dt;
      const pace = this._pace();
      while (this.shotTimer <= 0) {
        this.shotTimer += 0.105 / pace;
        this._fire();
      }
      this.spawnTimer -= dt;
      while (this.spawnTimer <= 0 && this.enemies.length < 480) {
        this._spawnWave();
        this.spawnTimer += 1.02 / pace;
      }
      this.spawnTimer = Math.max(this.spawnTimer, -1.02 / pace);
      this.enemyShotTimer -= dt;
      if (this.enemyShotTimer <= 0) {
        this.enemyShotTimer = Math.max(0.43, 0.93 - this.sector * 0.045);
        this._enemyFire();
      }

      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        enemy.age += dt;
        enemy.y += enemy.speed * dt;
        enemy.x = clamp(enemy.baseX + Math.sin(enemy.age * enemy.swayRate + enemy.phase) * enemy.sway, 16, WIDTH - 16);
        enemy.hit = Math.max(0, enemy.hit - dt);
        if (enemy.y > this.height + 45) enemy.dead = true;
        if (enemy.y > 0 && this._touches(enemy, this.player, enemy.r + this.player.r)) {
          this._damagePlayer();
          if (this.status !== 'playing') return;
          this._killEnemy(enemy, false);
          if (this.status !== 'playing') return;
        }
      }

      // Broad phase: nearby horizontal buckets keep dense late-game volleys cheap.
      const buckets = Array.from({ length: 16 }, () => []);
      for (const enemy of this.enemies) if (!enemy.dead) buckets[Math.min(15, Math.floor(enemy.x / 30))].push(enemy);
      for (const bullet of this.bullets) {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        if (bullet.y < -25 || bullet.x < -20 || bullet.x > WIDTH + 20) { bullet.dead = true; continue; }
        const bucket = Math.floor(bullet.x / 30);
        const nearby = [];
        for (let b = Math.max(0, bucket - 1); b <= Math.min(15, bucket + 1); b++) nearby.push(...buckets[b]);
        for (const enemy of nearby) {
          if (enemy.dead || enemy.y < -18 || Math.abs(bullet.x - enemy.x) > enemy.r + 4) continue;
          if (this._touches(bullet, enemy, enemy.r + 4)) {
            bullet.dead = true;
            enemy.hp--;
            enemy.hit = 0.075;
            if (enemy.hp <= 0) this._killEnemy(enemy, false);
            else this._sparks(bullet.x, bullet.y, enemy.color, 3, 45);
            break;
          }
        }
        if (this.status !== 'playing') return;
      }

      for (const bullet of this.enemyBullets) {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        if (bullet.y > this.height + 25 || bullet.y < -40 || bullet.x < -30 || bullet.x > WIDTH + 30) bullet.dead = true;
        else if (this._touches(bullet, this.player, this.player.r + bullet.r)) {
          bullet.dead = true;
          this._damagePlayer();
          if (this.status !== 'playing') return;
        }
      }

      for (const pickup of this.pickups) {
        pickup.y += 72 * dt;
        pickup.age += dt;
        const distance = Math.hypot(pickup.x - this.player.x, pickup.y - this.player.y);
        if (distance < 100) {
          pickup.x += (this.player.x - pickup.x) * dt * 5;
          pickup.y += (this.player.y - pickup.y) * dt * 5;
        }
        if (distance < 26) {
          pickup.dead = true;
          this.health = Math.min(this.maxHealth, this.health + 1);
          this.invulnerability = Math.max(this.invulnerability, 2.4);
          this._sparks(this.player.x, this.player.y, COLORS.cyan, 18, 100);
          this._tone('pickup');
          this._event('pickup', 'Shield restored.');
        }
        if (pickup.y > this.height + 20) pickup.dead = true;
      }
      this.enemies = this.enemies.filter(item => !item.dead);
      this.bullets = this.bullets.filter(item => !item.dead);
      this.enemyBullets = this.enemyBullets.filter(item => !item.dead);
      this.pickups = this.pickups.filter(item => !item.dead);
    }

    _touches(a, b, radius) {
      return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 < radius ** 2;
    }

    _fire() {
      const lanes = 3 + 2 * Math.min(4, Math.floor(this.kills / 1000));
      if (this.bullets.length + lanes > 2400) return;
      const spread = Array.from({ length: lanes }, (_, i) => (i - (lanes - 1) / 2) * 0.075);
      for (const angle of spread) {
        this.bullets.push({ x: this.player.x + angle * 70, y: this.player.y - 19, vx: Math.sin(angle) * 710, vy: -Math.cos(angle) * 710, dead: false });
      }
      this._tone('shoot');
    }

    _spawnWave() {
      const pattern = this.wave++ % 5;
      const count = Math.min(pattern === 3 ? 8 : 6, 480 - this.enemies.length);
      const offset = random(-20, 20);
      for (let i = 0; i < count; i++) {
        const type = (this.wave + i) % 9 === 0 ? 2 : ((this.wave + i) % 3 === 0 ? 1 : 0);
        let x = 52 + i * (376 / Math.max(1, count - 1)) + offset;
        let y = -30;
        let sway = 15;
        let swayRate = 1.6;
        if (pattern === 0) y -= Math.abs(i - (count - 1) / 2) * 29;
        if (pattern === 1) { y -= i * 24; sway = 27; }
        if (pattern === 2) { x = WIDTH / 2 + Math.sin(i * 1.05) * 160; y -= i * 34; sway = 36; }
        if (pattern === 3) { y -= (i % 2) * 50; sway = 7; }
        if (pattern === 4) { x = 95 + (i % 2) * 280; y -= Math.floor(i / 2) * 44; sway = 48; swayRate = 1.9; }
        this.enemies.push({
          x, baseX: x, y, type, age: 0, phase: i * 0.65, sway, swayRate,
          speed: 79 + this.sector * 3 + (type === 1 ? 23 : 0),
          r: type === 2 ? 17 : 13, hp: type === 2 ? 3 : 1,
          color: type === 2 ? COLORS.lilac : type === 1 ? COLORS.cyan : COLORS.coral,
          hit: 0, dead: false
        });
      }
    }

    _enemyFire() {
      if (this.enemyBullets.length >= 80) return;
      const candidates = this.enemies.filter(enemy => !enemy.dead && enemy.y > 20 && enemy.y < this.height * 0.65 && enemy.y < this.player.y - 80);
      if (!candidates.length) return;
      const enemy = candidates[Math.floor(Math.random() * candidates.length)];
      const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
      const spread = enemy.type === 2 && this.sector > 2 ? [-0.22, 0, 0.22] : [0];
      for (const offset of spread) {
        const speed = 134 + this.sector * 4;
        this.enemyBullets.push({ x: enemy.x, y: enemy.y + 12, vx: Math.cos(angle + offset) * speed, vy: Math.sin(angle + offset) * speed, r: 5, dead: false });
      }
    }

    _killEnemy(enemy, fromBomb) {
      if (enemy.dead || this.status !== 'playing' || this.kills >= TARGET) return false;
      enemy.dead = true;
      this.kills++;
      this.combo++;
      this.comboTimer = 2.8;
      this.score += (enemy.type === 2 ? 180 : 100) * (1 + Math.min(4, Math.floor(this.combo / 25)));
      this._sparks(enemy.x, enemy.y, enemy.color, fromBomb ? 28 : 35, enemy.type === 2 ? 260 : 190);
      this.shake = Math.min(9, this.shake + (enemy.type === 2 ? 2.5 : 0.8));
      if (this.rings.length < 96) this.rings.push({ x: enemy.x, y: enemy.y, radius: 5, life: 0.5, maxLife: 0.5, color: enemy.color });
      if (this.combo % 25 === 0 && this.popups.length < 24) this.popups.push({ x: enemy.x, y: Math.max(80, enemy.y), text: `${this.combo} CHAIN!`, life: 1, color: COLORS.lime });
      if (!fromBomb) this._tone('hit');
      if (this.kills % 45 === 0 && this.pickups.length < 5) {
        this.pickups.push({ x: clamp(enemy.x, 35, WIDTH - 35), y: Math.max(20, enemy.y), age: 0, dead: false });
      }
      if (this.kills % 100 === 0) {
        this.bombs = Math.min(3, this.bombs + 1);
        this.sector = Math.min(10, 1 + Math.floor(this.kills / 1000));
        if (this.kills < TARGET && this.kills % 1000 === 0) {
          this._event('sector', `OVERDRIVE ×${this._pace().toFixed(1)} · SECTOR ${this.sector}`);
          this.bombPulse = 0.6;
          this.popups.push({ x: WIDTH / 2, y: this.height * 0.4, text: 'OVERDRIVE UP!', life: 1.7, color: COLORS.cyan });
          this._tone('sector');
        }
      }
      if (this.kills === TARGET) this._finish('victory');
      return true;
    }

    _damagePlayer() {
      if (this.status !== 'playing' || this.invulnerability > 0) return;
      this.health = Math.max(0, this.health - 1);
      this.invulnerability = 2.2;
      this.combo = 0;
      this.comboTimer = 0;
      this.shake = 7;
      this.flash = 0.16;
      this._sparks(this.player.x, this.player.y, COLORS.white, 24, 160);
      this._tone('damage');
      this._event('damage', this.health === 1 ? 'Hull critical. Find a shield.' : 'Hull impact.');
      if (this.health === 0) this._finish('gameover');
      this._notify();
    }

    _finish(status) {
      if (this.status !== 'playing') return;
      this.status = status;
      this.keys.clear();
      this.pointer = null;
      this.enemyBullets.length = 0;
      this.bullets.length = 0;
      if (status === 'victory') {
        this.bombPulse = 1;
        this._sparks(this.player.x, this.player.y - 100, COLORS.lime, 90, 240);
        this._tone('victory');
      } else {
        this._sparks(this.player.x, this.player.y, COLORS.coral, 70, 230);
      }
      this._event(status, status === 'victory' ? '10,000 targets cleared. Mission complete.' : 'Signal lost. Ready for another run?');
      this._notify();
    }

    _sparks(x, y, color, count, speed) {
      const available = Math.max(0, 1200 - this.particles.length);
      for (let i = 0; i < Math.min(count, available); i++) {
        const angle = random(0, TAU);
        const velocity = random(speed * 0.25, speed);
        const life = random(0.3, 0.85);
        this.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life, maxLife: life, size: random(1.3, 3.7), color });
      }
    }

    _updateEffects(dt) {
      this.shake = Math.max(0, this.shake - dt * 24);
      this.flash = Math.max(0, this.flash - dt);
      this.bombPulse = Math.max(0, this.bombPulse - dt * 0.75);
      for (const particle of this.particles) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= Math.max(0, 1 - dt * 2.6);
        particle.vy *= Math.max(0, 1 - dt * 2.6);
        particle.life -= dt;
      }
      this.particles = this.particles.filter(particle => particle.life > 0);
      for (const ring of this.rings) { ring.radius += dt * 105; ring.life -= dt; }
      this.rings = this.rings.filter(ring => ring.life > 0);
      for (const popup of this.popups) { popup.y -= dt * 35; popup.life -= dt; }
      this.popups = this.popups.filter(popup => popup.life > 0);
    }

    _draw() {
      if (!this.ctx || !this.scale) return;
      const ctx = this.ctx;
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#09121a';
      ctx.fillRect(0, 0, WIDTH, this.height);
      this._drawBackground(ctx);
      ctx.save();
      if (!this.reducedMotion && this.shake && this.status !== 'paused') ctx.translate(random(-this.shake, this.shake), random(-this.shake, this.shake));

      if (this.status === 'ready') this._drawIdle(ctx);
      else {
        for (const pickup of this.pickups) this._drawPickup(ctx, pickup);
        this._drawBullets(ctx);
        for (const enemy of this.enemies) if (!enemy.dead) this._drawEnemy(ctx, enemy);
        if (this.status !== 'gameover') this._drawPlayer(ctx, this.player.x, this.player.y, this.player.bank);
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const ring of this.rings) {
        ctx.strokeStyle = ring.color;
        ctx.globalAlpha = ring.life / ring.maxLife * 0.55;
        ctx.lineWidth = 2 + ring.life * 7;
        ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.radius, 0, TAU); ctx.stroke();
        ctx.globalAlpha = ring.life / ring.maxLife * 0.12;
        ctx.fillStyle = ring.color;
        ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.radius * 1.6, 0, TAU); ctx.fill();
      }
      for (const particle of this.particles) {
        ctx.globalAlpha = particle.life / particle.maxLife;
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
        ctx.strokeStyle = particle.color;
        ctx.lineWidth = particle.size * 0.5;
        ctx.beginPath(); ctx.moveTo(particle.x, particle.y); ctx.lineTo(particle.x - particle.vx * 0.045, particle.y - particle.vy * 0.045); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.textAlign = 'center';
      ctx.font = 'bold 19px monospace';
      for (const popup of this.popups) {
        ctx.globalAlpha = Math.min(1, popup.life * 2);
        ctx.fillStyle = '#09121a'; ctx.fillText(popup.text, popup.x + 2, popup.y + 2);
        ctx.fillStyle = popup.color; ctx.fillText(popup.text, popup.x, popup.y);
      }
      ctx.globalAlpha = 1;
      if (this.bombPulse > 0) {
        const progress = 1 - this.bombPulse;
        ctx.strokeStyle = COLORS.lime;
        ctx.lineWidth = 3 + this.bombPulse * 7;
        ctx.globalAlpha = this.bombPulse * 0.7;
        ctx.beginPath(); ctx.arc(this.player.x, this.player.y, progress * Math.max(WIDTH, this.height) * 1.5, 0, TAU); ctx.stroke();
        ctx.fillStyle = COLORS.lime;
        ctx.globalAlpha = this.bombPulse * 0.06;
        ctx.fillRect(0, 0, WIDTH, this.height);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      if (this.flash > 0) {
        ctx.strokeStyle = `rgba(255,107,98,${this.flash * 3.5})`;
        ctx.lineWidth = 15;
        ctx.strokeRect(0, 0, WIDTH, this.height);
      }
      this._drawFrame(ctx);
    }

    _drawBackground(ctx) {
      const time = this._visualTime;
      const height = this.height;
      const glow = ctx.createRadialGradient(WIDTH * 0.63, height * 0.35, 5, WIDTH * 0.6, height * 0.4, WIDTH * 0.83);
      glow.addColorStop(0, 'rgba(43,88,102,0.17)');
      glow.addColorStop(0.5, 'rgba(24,56,75,0.08)');
      glow.addColorStop(1, 'rgba(9,18,26,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, WIDTH, height);
      ctx.lineWidth = 0.65;
      ctx.strokeStyle = 'rgba(103,163,174,0.055)';
      const gridOffset = (time * 12) % 60;
      ctx.beginPath();
      for (let x = 0; x <= WIDTH; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
      for (let y = gridOffset - 60; y <= height; y += 60) { ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); }
      ctx.stroke();
      ctx.save();
      ctx.translate(WIDTH * 0.74, height * 0.18);
      ctx.rotate(-0.45);
      ctx.scale(1, 0.7);
      ctx.strokeStyle = 'rgba(93,152,165,0.075)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(0, 0, 155 + i * 27, time * 0.015 + i, time * 0.015 + i + 4.8); ctx.stroke();
      }
      ctx.restore();
      for (const star of this.stars) {
        const warp = this.reducedMotion ? 1 : Math.sqrt(this._pace());
        const y = (star.y * height + time * (10 + star.z * 26) * warp) % height;
        const brightness = 0.25 + star.z * 0.55 + Math.sin(time + star.blink) * 0.09;
        ctx.fillStyle = `rgba(189,219,231,${brightness})`;
        const size = star.z > 0.85 ? 1.8 : 1;
        ctx.fillRect(star.x * WIDTH, y, size, size + (this.status === 'playing' ? star.z * 5 * warp : 0));
        if (star.z > 0.98) { ctx.fillRect(star.x * WIDTH - 2, y + 1, 6, 0.6); }
      }
    }

    _drawFrame(ctx) {
      ctx.strokeStyle = 'rgba(174,205,217,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const inset = 14, length = 14;
      for (const [x, y, dx, dy] of [[inset, inset, 1, 1], [WIDTH - inset, inset, -1, 1], [inset, this.height - inset, 1, -1], [WIDTH - inset, this.height - inset, -1, -1]]) {
        ctx.moveTo(x, y + dy * length); ctx.lineTo(x, y); ctx.lineTo(x + dx * length, y);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(151,186,201,0.25)';
      for (let y = 54; y < this.height - 35; y += 28) {
        ctx.fillRect(14, y, y % 56 === 26 ? 5 : 3, 1);
        ctx.fillRect(WIDTH - 17, y, 3, 1);
      }
    }

    _drawIdle(ctx) {
      const time = this._visualTime;
      const demos = [
        { x: 90, y: this.height * 0.2, type: 0, color: COLORS.coral },
        { x: 180, y: this.height * 0.13, type: 1, color: COLORS.cyan },
        { x: 294, y: this.height * 0.18, type: 0, color: COLORS.coral },
        { x: 387, y: this.height * 0.31, type: 2, color: COLORS.lilac },
        { x: 69, y: this.height * 0.52, type: 1, color: COLORS.cyan },
        { x: 380, y: this.height * 0.6, type: 0, color: COLORS.coral }
      ];
      ctx.globalAlpha = 0.62;
      for (let i = 0; i < demos.length; i++) this._drawEnemy(ctx, { ...demos[i], x: demos[i].x + Math.sin(time * 0.4 + i) * 11, y: demos[i].y + Math.sin(time * 0.7 + i) * 9, hit: 0 });
      ctx.globalAlpha = 1;
      this._drawPlayer(ctx, WIDTH / 2 + Math.sin(time * 0.65) * 12, this.height * 0.82 + Math.cos(time) * 4, Math.sin(time * 0.65) * 0.2);
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = COLORS.lime;
      for (let i = 0; i < 3; i++) {
        const y = this.height * 0.8 - ((time * 90 + i * 75) % (this.height * 0.5));
        ctx.fillRect(WIDTH / 2 - 2, y, 3, 12);
      }
      ctx.globalAlpha = 1;
    }

    _drawPlayer(ctx, x, y, bank) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(bank * 0.14);
      if (this.status === 'playing' && this.invulnerability > 0) {
        ctx.strokeStyle = `rgba(111,219,230,${0.28 + Math.sin(this._visualTime * 13) * 0.1})`;
        ctx.fillStyle = 'rgba(111,219,230,0.035)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, 29, 0, TAU); ctx.fill(); ctx.stroke();
        if (Math.sin(this._visualTime * 28) > 0.7) ctx.globalAlpha = 0.6;
      }
      const exhaust = 18 + Math.sin(this._visualTime * 35) * 5;
      const flame = ctx.createLinearGradient(0, 12, 0, 12 + exhaust);
      flame.addColorStop(0, COLORS.cyan);
      flame.addColorStop(0.55, '#57aec5');
      flame.addColorStop(1, 'rgba(80,179,207,0)');
      ctx.fillStyle = flame;
      this._polygon(ctx, [[-5, 12], [5, 12], [2, 13 + exhaust], [0, 21 + exhaust], [-2, 13 + exhaust]]);
      ctx.fillStyle = '#517282';
      this._polygon(ctx, [[0, -23], [8, -2], [23, 16], [10, 12], [5, 17], [-5, 17], [-10, 12], [-23, 16], [-8, -2]]);
      ctx.fillStyle = '#c4e6ef';
      this._polygon(ctx, [[0, -23], [6, 0], [19, 12], [8, 7], [3, 13], [-3, 13], [-8, 7], [-19, 12], [-6, 0]]);
      ctx.fillStyle = '#f0fbff';
      this._polygon(ctx, [[0, -23], [3, -1], [0, 13], [-3, -1]]);
      ctx.fillStyle = COLORS.lime;
      this._polygon(ctx, [[0, -12], [3, -3], [0, 1], [-3, -3]]);
      ctx.fillRect(-16, 9, 4, 2);
      ctx.fillRect(12, 9, 4, 2);
      ctx.restore();
    }

    _drawEnemy(ctx, enemy) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.fillStyle = enemy.hit > 0 ? '#fff7e6' : enemy.color;
      if (enemy.type === 2) {
        this._polygon(ctx, [[0, 21], [9, 11], [18, 5], [15, -14], [6, -9], [0, -15], [-6, -9], [-15, -14], [-18, 5], [-9, 11]]);
        ctx.fillStyle = '#293141';
        this._polygon(ctx, [[0, 12], [7, 3], [8, -6], [0, -3], [-8, -6], [-7, 3]]);
        ctx.fillStyle = COLORS.white;
        ctx.fillRect(-2, 3, 4, 6);
      } else if (enemy.type === 1) {
        this._polygon(ctx, [[0, 18], [7, 3], [18, -8], [7, -5], [0, -14], [-7, -5], [-18, -8], [-7, 3]]);
        ctx.fillStyle = '#1a3b4a';
        this._polygon(ctx, [[0, 9], [4, -3], [0, -8], [-4, -3]]);
        ctx.fillStyle = '#cbf5f7';
        ctx.fillRect(-1, 5, 2, 5);
      } else {
        this._polygon(ctx, [[0, 17], [7, 3], [17, 7], [13, -8], [6, -4], [0, -12], [-6, -4], [-13, -8], [-17, 7], [-7, 3]]);
        ctx.fillStyle = '#4a3037';
        this._polygon(ctx, [[0, 9], [4, 0], [0, -5], [-4, 0]]);
        ctx.fillStyle = '#ffdfab';
        ctx.fillRect(-2, 3, 4, 3);
      }
      ctx.restore();
    }

    _polygon(ctx, points) {
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath();
      ctx.fill();
    }

    _drawBullets(ctx) {
      ctx.fillStyle = 'rgba(216,250,120,0.12)';
      for (const bullet of this.bullets) ctx.fillRect(bullet.x - 4, bullet.y - 5, 8, 25);
      ctx.fillStyle = COLORS.lime;
      for (const bullet of this.bullets) ctx.fillRect(bullet.x - 1.4, bullet.y - 5, 2.8, 12);
      ctx.fillStyle = '#f4ffd8';
      for (const bullet of this.bullets) ctx.fillRect(bullet.x - 0.65, bullet.y - 5, 1.3, 7);
      for (const bullet of this.enemyBullets) {
        ctx.fillStyle = 'rgba(255,134,108,0.13)';
        ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 9, 0, TAU); ctx.fill();
        ctx.fillStyle = COLORS.coral;
        ctx.beginPath(); ctx.arc(bullet.x, bullet.y, bullet.r, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffe8c2';
        ctx.beginPath(); ctx.arc(bullet.x, bullet.y, 2.1, 0, TAU); ctx.fill();
      }
    }

    _drawPickup(ctx, pickup) {
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.rotate(Math.sin(pickup.age * 2) * 0.12);
      ctx.strokeStyle = COLORS.cyan;
      ctx.fillStyle = '#17313f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(12, -6); ctx.lineTo(12, 7); ctx.lineTo(0, 14); ctx.lineTo(-12, 7); ctx.lineTo(-12, -6); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = COLORS.cyan;
      ctx.fillRect(-2, -6, 4, 13);
      ctx.fillRect(-6, -2, 12, 4);
      ctx.restore();
    }

    _unlockAudio() {
      if (!this.soundEnabled) return;
      try {
        if (!this.audio) {
          const Context = window.AudioContext || window.webkitAudioContext;
          if (!Context) return;
          this.audio = new Context();
          this._voices = 0;
          this._lastShootSound = -1;
        }
        if (this.audio.state === 'suspended') this.audio.resume().catch(() => {});
      } catch (_) { /* Audio is optional; play continues if a browser blocks it. */ }
    }

    _tone(kind) {
      if (!this.soundEnabled || !this.audio || this.audio.state !== 'running' || this._voices > 16) return;
      const now = this.audio.currentTime;
      if (kind === 'shoot' && now - this._lastShootSound < 0.16) return;
      if (kind === 'shoot') this._lastShootSound = now;
      const sounds = {
        shoot: [640, 220, 0.055, 0.018, 'triangle'],
        hit: [140, 55, 0.09, 0.026, 'triangle'],
        damage: [180, 42, 0.3, 0.07, 'sawtooth'],
        bomb: [100, 28, 0.7, 0.1, 'triangle'],
        pickup: [480, 1040, 0.2, 0.045, 'sine'],
        sector: [330, 880, 0.4, 0.045, 'sine'],
        victory: [440, 1320, 0.9, 0.06, 'sine']
      };
      try {
        const [from, to, duration, volume, type] = sounds[kind];
        const oscillator = this.audio.createOscillator();
        const gain = this.audio.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, now);
        oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain); gain.connect(this.audio.destination);
        oscillator.start(now); oscillator.stop(now + duration);
        this._voices++;
        oscillator.onended = () => { this._voices--; oscillator.disconnect(); gain.disconnect(); };
      } catch (_) { /* Sound failures never interrupt flight. */ }
    }
  }

  window.ShmupGame = ShmupGame;
})();
