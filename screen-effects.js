/* Low-load mode draws effects once, inside the game canvas. */
(() => {
  'use strict';
  window.ScreenEffects = class {
    constructor() {
      const overlay = document.getElementById('screen-effects');
      overlay.hidden = true;
      overlay.width = overlay.height = 1;
      document.querySelector('.app-shell').style.transform = 'none';
    }
    draw() {}
  };
})();
