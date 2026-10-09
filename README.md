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
- `icon.svg`: local icon.
- `serve.mjs` / `start.cmd`: optional Node.js static server for phone testing.

All visual and audio assets are generated locally. The game makes no external requests and has no third-party dependencies. The server exposes only the five browser assets. Stop it with Ctrl+C.

## Overdrive mode

The objective is 10,000 kills. Enemy travel, initial firing, and initial wave frequency run at three times the original speed (1.5× the previous release): 246 units/sec for standard sector-one enemies, about 28.6 volleys/sec, and 2.94 formations/sec. Fire and wave rates then scale exponentially: `rate = 3 * originalRate * 2 ** (kills / 2000)`. The OVERDRIVE display reports progression relative to this new starting speed (1× to 32×). Volleys grow from three to eleven lanes. Nova recharge remains every 100 kills.

Visuals include strong full-field RGB channel separation, oversized bloom echoes, dual shockwaves, eight-ray impact bursts, horizontal lens flares, longer sparks, chain popups, and amplified camera shake. Color separation intensifies with overdrive, impacts, and nova bombs. Two reusable offscreen canvases avoid per-frame pixel readback. OS reduced-motion preferences disable camera shake and background acceleration and keep chromatic offsets static and smaller. HUD and controls remain outside the post-processing effect.

Performance budgets: 480 enemies, 2,400 player bullets, 2,400 particles, and 96 explosion rings. Rate timers process multiple volleys per frame; horizontal collision buckets limit collision work. At extreme load the entity budgets take priority over spawn/firing rates.

Run regression checks with `node --test tests/game.test.cjs`.

Idle and quiet-flight post-processing stays subtle (0.8-unit RGB separation, 2.5% bloom). Kills, hits and novas trigger a short impact envelope, with roughly double the previous event intensity: twice the sparks, spark velocity, shockwave expansion and camera shake, plus up to 36% bloom. The impact envelope settles in 0.4 seconds without new hits; nova waves fade over about 1.3 seconds. Pause suppresses post-processing intensity, and restarting clears the envelope.
