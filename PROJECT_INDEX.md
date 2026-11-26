# Project Index

## Purpose
Dependency-free browser play activity for a child (3–4) with limited left-arm movement. One side is a big round hold button (a lamp); the other side holds seven gentle games. Configurable for a parent / occupational therapist. **Not a medical device and not a measure of recovery** — see README.

## Key paths
- `index.html` — page shell and script order (classic scripts, no modules, so `file://` works).
- `styles.css` — dashboard, calibration, scene tray, grown-up check and shared controls, on the night-lamp design system.
- `icon.svg` / `manifest.webmanifest` — vector app icon; installable-app metadata (linked only over http(s)).
- `js/theme.js` — `MG.Theme`: palette, grain, room, panels, cards, glow/vignette, fonts, star field. The single source of visual language.
- `js/icons.js` — shared inline-SVG icons for games and actions (dashboard + tray).
- `js/tray.js` — bottom scene switcher, built from `MG.GameTitles`; game icons only, no settings entry.
- `js/parentgate.js` — arithmetic check before the parent dashboard opens.
- `js/app.js` — session state machine, zone geometry, pointer routing, lamp/blackout, rendering, corner-lock trigger.
- `js/input.js` — Pointer Events multi-touch source; one `Map` of contacts by `pointerId`.
- `js/zones.js` — play / hold layout maths, swap and mirroring, bottom tray reserve, parent-pad position.
- `js/settings.js` — settings model (stable object identity) and local interaction metrics.
- `js/audio.js` — synthesised WebAudio sounds; no audio files; procedural room reverb.
- `js/fx.js` — capped particle/ring effects.
- `js/games/` — `base.js`, `balloons.js`, `garden.js`, `stars.js`, `painting.js`, `photos.js`, `goats.js`, `car.js`, `registry.js` (factory + `MG.GameTitles`).
- `js/pictures.js` — picture folder storage in IndexedDB; built-in doodles.
- `js/ui.js` — parent dashboard (Play / Pictures / Accessibility / Calibration / Touch test / Progress / Help).
- `js/calibration.js` — guided first-run wizard.
- `tools/` — dev-only headless smoke tests.
- `pc/` — one-time touchscreen setup, self-updating launcher, PC guide.
- `sprites/` — **reference images only** (copyrighted book cover and poster, not loaded); see `sprites/README.md`.
- `README.md` — install, parent guide, testing, hardware caveats.
- `GAME_GUIDE.md` — **game-layer change map**: contract, registration points, renewing loops, per-game internals, recipes, skeleton.
- `Launch-Kiosk.cmd` / `Launch-Browser.cmd` — Windows launchers.

## Documentation map
- `README.md` — the only document a parent needs.
- `GAME_GUIDE.md` — read first for any work inside `js/games/` or on the game picker.
- `CURRENT_STATE.md` — current behaviour and verified checks.
- `DECISIONS.md` — why the interaction, scope and look are what they are.
- `NEXT_STEPS.md` — on-device checks and follow-ups.
- `SESSION_HANDOFF.md` — continuation notes.

## Setup and verification
- Run: double-click `Launch-Kiosk.cmd` (Edge kiosk, dedicated profile) or open `index.html`.
- Fast check (any shell, from the project folder):
  `Get-ChildItem -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }`
- Full gate (needs Edge + Node 22+; starts its own headless Edge on port 9223 with a fresh profile):
  `powershell -ExecutionPolicy Bypass -File tools\run-smoke-tests.ps1`
  Prints PASS/FAIL for both suites, exits 0 only when both pass, and writes screenshots to `%TEMP%\magichand-smoke` (smoke-1) and `%TEMP%\opencode` (smoke-2).
  The runner stops leftover headless-Edge children by profile path before and after a run.
- Hardware behaviour (palm, knuckle, simultaneous hold + play) can only be confirmed on the target touchscreen; checklist is README section 6.

## Code map and pitfalls
- Pointerdown → `MG.createTouchSource` → `App.zoneOf` (pad / play / hold) → `App.onDown`.
- Activation per mode → `App.updatePointerModes` + `App.onMove` sweep → `App.activate` → `game.activate(x, y)`.
- Lamp → `App.light` (button held) and `App.dark` (resting) in `App.update`, applied in `App.drawLamp`.
- Session → `startSession` / `enterRest` / `resume` / `endSession` / `toReady`.
- Cards → `App.modeAt` (set when `App.update` notices a mode change) drives the ~0.55 s fade-in in `App.card`.
- Parent dashboard → tap the corner pad (`App.onUp`, role `pad`, <500 ms, <18 px) → `MG.ParentGate.ask` → `App.openParent`; `Ctrl + Shift + P` bypasses the check.
- Scene switching → `MG.Tray` → `Settings.set('game', id)` → `App.onSettingsChanged` → `newGame`.
- Layout → `Zones.compute(settings, W, H, bottom)` where `bottom = MG.Tray.inset()`; `App.zone.bottom` reserves the tray strip.
- Pitfalls:
  - `MG.Settings.data` must keep one object identity (`replaceData`); `App.settings` caches it. Never reassign `Settings.data`.
  - Games initialise their own fields **before** `MG.BaseGame.call(this, app)` because the base constructor runs `layout()`.
  - A contact's role is fixed at pointerdown; never reclassify on move, or the hold hand starts popping balloons.
  - Painting owns an offscreen canvas; `onResize` clears it when the size changes. Its strokes use `lighter` blending on a dark canvas.
  - Theme colours and surfaces belong in `js/theme.js`; scenes should not invent new palette values beyond their own hue-driven HSL accents.
  - `Theme.grain` caches a `CanvasPattern` on the context (`ctx.__mgGrain`); do not swap contexts without expecting a rebuild.
  - Canvas titles use `Theme.text(..., serif=true)`; body/hint text uses the sans stack via `U.text`.
  - The manifest must stay http-only; linking it on `file://` produces a CORS error the gate treats as a failure.
  - Never lay a full-screen scene out against the whole window height: the tray strip is reserved. `Photos.layout` uses `app.W` / `app.H - zone.bottom` and clamps card size, because during construction `App.game` is still the previous scene and `stageRect()` falls back to the play rect.
  - The parent settings are behind `MG.ParentGate`; the tray intentionally has no settings button. Do not add one or bypass the check.
  - Smoke tests assume a fresh browser profile (first-run calibration). Use the runner rather than running the suites by hand on a used profile.

## Game work (see `GAME_GUIDE.md`)
- A game is `js/games/<id>.js`, self-registers as `MG.Games.<id>`, and is created by `MG.createGame(app, id)`; unknown ids fall back to balloons.
- Registration points: script tag in `index.html`, `CHOICES.game` in `settings.js`, `GAMES` in `ui.js`, an icon in `icons.js`, `MG.GameTitles` (the bottom tray builds from it), and assertions in the smoke suites.
- Two scene patterns: **activation** games implement `activate(x, y)` and let the app gate the lamp and count rewards; **pointer scenes** (painting, photos) read `app.playPointers()` in `update()`. `goats` adds a **waiting phase**: it does nothing until a contact answers the troll, with no timeout.
- `update(dt)` is pre-scaled by mode and lamp light, and `this.t` accumulates that scaled time — animate from it, not wall clock.
- Every scene has a renewing, non-numeric loop (garden reseeds, constellations complete, album pages turn, the goat herd returns). Progress is never a score; see `GAME_GUIDE.md` → Renewing loops and `DECISIONS.md` D17.
- Per-game state, draw pieces, audio and gotchas are tabulated in `GAME_GUIDE.md`; use it instead of re-reading every scene.
