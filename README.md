# THOUSAND

A responsive, dependency-free arcade shoot ’em up. One ship, ten sectors, 10,000 enemy units to destroy.

## Play on this computer

Open `index.html` in a modern browser. No installation, build, account, or internet connection is needed.

Alternatively, double-click `start.cmd` (Node.js required), then open **http://localhost:4173**. From a terminal:

```powershell
cd C:\Users\encor\shmup
node serve.mjs
```

## Play on Android or iOS

Run `start.cmd` on this computer. Connect your phone to the same Wi-Fi and enter the **Phone / same Wi-Fi** address printed in the terminal in Safari, Chrome, or another modern browser. If Windows Firewall prompts, allow Node.js on your private network. Keep the terminal open while playing. Public deployment is not needed for same-network play.

The interface fits portrait and landscape screens, supports safe areas, and prevents page scrolling while dragging in the game field. The game pauses when you switch apps or tabs. Desktop mobile emulation is useful for checking layouts, but real-device browser behavior can differ.

## Controls

| Action | Touch / mouse | Keyboard |
| --- | --- | --- |
| Move | Drag anywhere in the game field | WASD / arrow keys |
| Fire | Automatic | Automatic |
| Nova bomb | NOVA button | Space |
| Pause / resume | Pause button | P / Escape |
| Sound | Speaker button | Tab to speaker button, Enter |

Drag from below the ship to keep your finger out of the way. Movement is relative, so the ship will not jump to your finger. Nova bombs destroy enemies currently in the field and clear their shots. You begin with three and regain one every 100 kills (maximum three). Collect plus pickups to restore your five-point shield. Every 1,000 kills takes you into the next sector, and exactly 10,000 destroyed units completes the mission. If the shield runs out, try again.

Sound starts muted. Your personal best is saved in this browser when a run ends, pauses, or the page closes; storage restrictions do not prevent play.

## Files

- `index.html`: responsive interface, instructions, and accessible buttons.
- `styles.css`: desktop, phone, landscape, and reduced-motion layouts.
- `game.js`: canvas rendering, controls, simulation, enemies, effects, and optional sound.
- `main.js`: counters, overlays, controls, and local best record.
- `screen-effects.js`: page-wide post-processing and viewport particle layer.
- `icon.svg`: local icon.
- `serve.mjs` / `start.cmd`: optional Node.js static server for phone testing.

All visual and audio assets are generated locally. The game makes no external requests and has no third-party dependencies. The server exposes only the browser assets. Stop it with Ctrl+C.

## Current gameplay and effects

The 10,000-kill goal, drag movement and automatic firing remain. Enemies have no simultaneous-count ceiling. Formation spawning is doubled from the previous release (about 3.92 waves/sec initially); the other speed settings are unchanged. Keyboard movement is 945 world units/sec, three times its previous speed, with normalized diagonal movement. Touch drag sensitivity is unchanged.

Chromatic aberration is disabled and its offscreen compositing buffers are removed. Each kill emits the original rich expanding rings: a thick colored ring, a cyan outer ring, a horizontal flash, eight rays and a translucent glow disc, fading over 0.5 seconds. At most 24 rings coexist. Sparks stay limited to 96, player bullets to 320, enemy bullets to 64, pickups to five and chain popups to twelve. Full-page effects and camera shake remain disabled.

Time adds 0.01x every 0.3 seconds. Every 1,000 kills doubles the current multiplier, including time-earned gains. Enemy travel uses the square root of the current multiplier (16x becomes 4x movement). Firing and spawning use the full multiplier. There is no multiplier cap. Run tests with node --test tests/game.test.cjs.
