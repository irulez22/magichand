# Session Handoff

## 2026-11-27 (latest) — Magic Car 3D asset pipeline
- **Approved change.** The parent rejected the 2D/Flash look and chose a full 3D asset pipeline (D29), superseding D28 for Magic Car only.
- **Stack.** Three.js r187 + GLTFLoader + EffectComposer/UnrealBloomPass, built with esbuild. Source `src/car3d/main.js`; `npm run build:car3d` → `js/car3d.bundle.js` (~1.7 MB, committed). CC0 Kenney Car Kit GLBs are embedded as data URLs so `file://` works.
- **Integration.** Offscreen WebGL canvas blitted into `this.inset` by `draw()`; `layout()` resizes renderer + composer. The bundle overrides `MG.Games.car` only when WebGL exists; `js/games/car.js` remains the 2D fallback. `keepLit`/speed-only pedal carry over.
- **Scene.** Recoloured red hatchback with VW roundel/up! decals and a back-window dog; van/sedan/SUV traffic; guardrail, pines, lamps, mountains, moon/stars/Milky Way; bloom, headlights, taillight road streaks, crash particles; three rotating sky patterns.
- **Tests.** smoke-1 is 3D-aware: `is3D`, all four models loaded, steering, coasting/no-dim, crash/star, sky picture. `tools\run-smoke-tests.ps1` both suites PASS, 0 failures, no page errors. Screenshots reviewed.
- **Next.** Tune 3D fidelity and frame rate on the panel; source a closer VW up! model if desired; verify the no-WebGL fallback and rebuild the bundle after any `src/car3d` change.


## 2026-11-27 — Magic Car: speed-only pedal, red VW up!, richer night
- **Pedal no longer dims.** `game.keepLit` + `App.keepLitNow()` hold the play side lit while playing and suppress the hold-release rest transition. `Car.gasLevel` reads `App.holdCount`, so letting go coasts the car to a stop; the session keeps running.
- **Car art.** Red VW up! rear view in `drawCar`: rounded tall hatch and spoiler, large smoked tailgate glass with rear wiper, VW roundel on the glass (`drawVWBadge`), up! badge, tall corner tail lights with clear reverse segments, recessed plate, tyres, antenna.
- **Visual pass.** The reflector-post field and the farm-light scatter were removed. Added textured grass/asphalt (cached procedural noise), two volumetric headlight cones, ground fog and a colour grade, village/barn/windmill silhouettes, swaying verge grass and more detailed traffic; only a few warm lamps remain. All Canvas 2D, no assets or dependencies (D28).
- **Tests.** smoke-1 now asserts that coasting keeps `mode=playing`, `light>0.95`, `dark<0.05`, that speed falls, and that `model='vw-up'` / `color='red'`; both suites PASS, 0 failures, no page errors. Screenshots reviewed.
- Next: child verdict on the red car, the lit stopped scene and the quieter road. Decide whether to keep procedural Canvas or allow sprites/3D (D28). A parent session limit still counts coasting time (open question).


