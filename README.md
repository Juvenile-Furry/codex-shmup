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

## Overdrive mode

Starting enemy travel, firing, and wave frequency are 4.5 times the original baseline (1.5 times the previous release): standard sector-one enemies start at 369 units/sec, firing at 42.86 volleys/sec, and formations at 4.41/sec.

Speed starts at 1x, gains +1x per 30 seconds of active play, and receives additive kill bonuses every 1,000 kills. Milestone n adds 2^(n/2) - 2^((n-1)/2). Thus the first two milestones add a total +1x, the next two add +2x, and so on; these additions preserve all speed already earned from time. The multiplier has no upper clamp. Enemy movement, firing, and waves all use the combined multiplier. Pause and switching apps freeze the clock; restart resets all bonuses. The score chain multiplier also has no upper cap. The mission still ends at exactly 10,000 kills.

Page-wide RGB separation, bloom and shake affect the entire interface. A fixed viewport overlay lets blast rings, flares, sparks and nova waves spill beyond the game canvas. Quiet flight stays subtle; impacts trigger the stronger effects. Reduced-motion settings suppress camera shake and moving chromatic offsets.

Performance budgets remain separate from the uncapped multiplier: 480 enemies, 2,400 player bullets, 2,400 particles, and 96 explosion rings. These protect rendering at extreme rates. Actual emission can be lower than the nominal rate when a budget is full. Touch controls remain usable through the pointer-transparent effects overlay.

Run regression checks with `node --test tests/game.test.cjs`. Restart the local server after updating its asset list.
