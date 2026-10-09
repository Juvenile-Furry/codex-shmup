/* Page-wide effects driven by the engine's impact envelope. */
(() => {
  'use strict';
  window.ScreenEffects = class {
    constructor(arena) {
      this.arena = arena;
      this.shell = document.querySelector('.app-shell');
      this.canvas = document.getElementById('screen-effects');
      this.ctx = this.canvas.getContext('2d');
      this.red = document.getElementById('screen-red-offset');
      this.blue = document.getElementById('screen-blue-offset');
      this.glow = document.getElementById('screen-bloom-alpha');
    }
    draw(game) {
      const { strength, bloom } = game._effectProfile();
      const quiet = game.status === 'paused' || game.status === 'ready';
      const shake = quiet || game.reducedMotion ? 0 : game.shake;
      const x = Math.sin(game._visualTime * 73) * shake * 0.65;
      const y = Math.cos(game._visualTime * 61) * shake * 0.4;
      this.shell.style.transform = `translate(${x}px, ${y}px)`;
      const drift = game.reducedMotion ? 0 : Math.sin(game._visualTime * 2.3) * strength * 0.22;
      this.red.setAttribute('dx', -strength); this.red.setAttribute('dy', drift);
      this.blue.setAttribute('dx', strength); this.blue.setAttribute('dy', -drift);
      this.glow.setAttribute('slope', bloom);
      const w = window.innerWidth, h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
        this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      }
      const ctx = this.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      if (quiet) return;
      // Clip out only the arena: particles and blast waves spill across the rest of the viewport.
      const rect = this.arena.getBoundingClientRect();
      const scale = rect.width / game.width;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.rect(rect.left, rect.top, rect.width, rect.height); ctx.clip('evenodd');
      ctx.translate(rect.left, rect.top); ctx.scale(scale, scale);
      ctx.globalCompositeOperation = 'lighter';
      for (const ring of game.rings) {
        ctx.globalAlpha = Math.min(1, ring.life / ring.maxLife);
        ctx.strokeStyle = ring.color; ctx.lineWidth = 4 + ring.life * 14;
        ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.radius * 1.65, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = ring.color;
        ctx.fillRect(ring.x - ring.radius * 6, ring.y - 2, ring.radius * 12, 4);
      }
      for (const particle of game.particles) {
        ctx.globalAlpha = particle.life / particle.maxLife;
        ctx.strokeStyle = particle.color; ctx.lineWidth = particle.size;
        ctx.beginPath(); ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x - particle.vx * 0.09, particle.y - particle.vy * 0.09); ctx.stroke();
      }
      ctx.restore();
      if (game.bombPulse > 0) {
        ctx.globalAlpha = game.bombPulse * 0.5;
        ctx.strokeStyle = '#d8fa78'; ctx.lineWidth = 4 + game.bombPulse * 12;
        ctx.beginPath(); ctx.arc(rect.left + game.player.x * scale, rect.top + game.player.y * scale,
          (1 - game.bombPulse) * Math.hypot(w, h), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  };
})();
