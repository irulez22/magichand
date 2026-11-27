# Session Handoff

## 2026-11-27 (latest) — Magic Piano, launcher splash, car tuning
- **Magic Piano is original, not an APK port (D31).** Hold the **power switch** on the hold side (`holdStyle='power'`, `keepLit=true`), then play 12 white + 5 black keys with animal faces; multi-touch and glissando are tracked per contact via `_pianoKey`. Six instruments (piano, xylophone, flute, music box, drums, animals) and four public-domain songs (Twinkle, Mary, Ode, Happy Birthday), all unlocked. Songs highlight the next key and pause/resume with power. Keys sound only while powered; releasing silences/dims them but never dims the scene or enters rest.
- **Audio.** `MG.Audio.note(midi, timbre, gain, pan, voice)` synthesises the six timbres; no samples. The scene lives in `js/games/piano.js`.
- **Launcher splash (D30).** `pc\Start-MagicHand.ps1` shows a topmost Magic Hand window with a marquee bar while a runspace checks/fetches GitHub; it closes before Edge. Adds `-NoSplash`/`-NoLaunch`; after an update it stages a newer launcher for the next start. Existing PCs need `Setup.cmd` once to get this launcher.
- **Car tuning.** Top speed 40, quicker steering, softer exposure/bloom/headlights/shadows, traffic additive glows removed, and only deliberate taps honk (sweep/continuous silent).
- **Tests.** `node --check` clean; both smoke suites PASS with piano checks (powered note, instrument switch, song start, silent-but-lit power-off) and the 3D car reopen check. Launcher tested against a local bare remote for update, up-to-date, `-NoSplash` and `-NoLaunch`; PSScriptAnalyzer passes with legacy warnings.
- **Next.** Run `Setup.cmd` on each kiosk PC once; judge the piano with the child; exact APK parity needs written permission for its assets.


## 2026-11-27 — Magic Car 3D asset pipeline
- **Approved change.** The parent rejected the 2D/Flash look and chose a full 3D asset pipeline (D29), superseding D28 for Magic Car only.
- **Stack.** Three.js r187 + GLTFLoader + EffectComposer/UnrealBloomPass, built with esbuild. Source `src/car3d/main.js`; `npm run build:car3d` → `js/car3d.bundle.js` (~1.7 MB, committed). CC0 Kenney Car Kit GLBs are embedded as data URLs so `file://` works.
- **Integration.** Offscreen WebGL canvas blitted into `this.inset` by `draw()`; `layout()` resizes renderer + composer. The bundle overrides `MG.Games.car` only when WebGL exists; `js/games/car.js` remains the 2D fallback. `keepLit`/speed-only pedal carry over.
- **Scene.** Recoloured red hatchback with VW roundel/up! decals and a back-window dog; van/sedan/SUV traffic; guardrail, pines, lamps, mountains, moon/stars/Milky Way; bloom, headlights, taillight road streaks, crash particles; three rotating sky patterns.
- **Tests.** smoke-1 is 3D-aware: `is3D`, all four models loaded, steering, coasting/no-dim, crash/star, sky picture. `tools\run-smoke-tests.ps1` both suites PASS, 0 failures, no page errors. Screenshots reviewed.
- **Next.** Tune 3D fidelity and frame rate on the panel; source a closer VW up! model if desired; verify the no-WebGL fallback and rebuild the bundle after any `src/car3d` change.


