# Game Guide

How a game is wired into Magic Hand Play, where to change each one, and what to
touch when adding another. Read this before editing `js/games/`; it is the
change map for game work. Visual primitives are documented in the comments of
`js/theme.js`; interaction rules live in `DECISIONS.md` and `AGENTS.md`.

## TL;DR — adding a game

1. Create `js/games/<id>.js` from the skeleton at the end of this file.
2. Load it in `index.html` **before** `js/games/registry.js`.
3. The file registers itself with `MG.Games.<id> = MyGame`. No registry edit is
   required for the id to work (`MG.createGame` falls back to balloons if an id
   is unknown).
4. Add the id to `CHOICES.game` in `js/settings.js`; without it, saved settings
   are sanitised back to `balloons`.
5. Add a card to `GAMES` in `js/ui.js`, an icon to `js/icons.js`, and the
   title to `MG.GameTitles` in `js/games/registry.js`; the bottom scene tray
   builds itself from that object.
6. Add assertions to the smoke suites (see Testing), then run the gate.

Also update `README.md` (game table / section 4) and `CURRENT_STATE.md`.

## The contract

`js/games/base.js` defines `MG.BaseGame`. A game is a constructor + prototype:

| Member | Called by | Expectations |
| --- | --- | --- |
| `constructor(app)` | `MG.createGame` → `App.newGame` | Set **all** own fields first, then `MG.BaseGame.call(this, app)`, then `this.id` / `this.title`. |
| `layout()` | `setZone()` — runs inside the base constructor, again on resize and when the play rect moves | Recompute geometry from `this.play` / `this.inset`; must be idempotent. |
| `setZone(rect)` | `App.resize`, `App.newGame` | Base implementation; do not override. |
| `enter()` / `exit()` | `App.newGame` / leaving the game | Start/stop anything expensive. Painting clears its canvas in `enter`. |
| `update(dt)` | `App.update` | Call `MG.BaseGame.prototype.update.call(this, dt)` first so `this.t` advances; then animate. |
| `draw(ctx)` | `App.render`, already clipped to the stage | Draw in CSS pixels using `this.play` / `this.inset` coordinates. No DOM. |
| `activate(x, y, info)` | `App.activate` for touch / sweep / dwell / continuous | Return `true` only when a reward actually happened. |
| `onResize(W, H, dpr)` | `App.resize` | Only needed for offscreen canvases (painting). |
| `fullScreen` (flag) | `App.stageRect`, `App.zoneOf`, `App.holdRequiredNow`, `App.render` | Set **before** `BaseGame.call`; bypasses the lamp and uses the whole window. |

Inherited getters (use these instead of reading settings by hand):

- `this.settings` — the live settings object.
- `this.calm` — `visual === 'calm'`.
- `this.motion` — `stationary` 0, `slow` 0.34, `normal` 1. Multiply idle movement
  by it; reward animation should stay legible at 0.
- `this.sizeFactor` — `xlarge` 1.42, `large` 1, `medium` 0.72.
- `this.rewardFactor` — `low` 0.8, `medium` 1, `high` 1.4.
- `this.scale` — `min(play.w, play.h)`.
- `this.playsPointerAt(x, y, radius)` — first play-side contact within radius.

## Two ways a scene responds

**A. Activation games** (balloons, garden, stars): implement `activate()`. The
app owns gating — it blocks while the lamp is dark and the hold button is
required, counts one activation, and draws the shared ring. `x, y` are CSS
pixels; `info.reason` is `'touch' | 'sweep' | 'dwell' | 'continuous'`.

**B. Pointer scenes** (painting, photos): read `this.app.playPointers()` every
`update()`. These keep per-contact scratch state on the contact record (painting
uses `rec._paint`; `App.onUp` clears it on release). They return `false` from
`activate` (or don't implement it). Photos matches holds this way and ignores
the lamp entirely as a full-screen scene.

Choose A unless the interaction is genuinely about movement or two hands.

### Timing you get from the app

`update(dt)` is already scaled by context, so animations slow down with the
lamp instead of jumping:

- ready `×0.25`, playing `× (0.4 + 0.6 · App.light)`, resting `×0.05`,
  ended `×0.4`, parent overlay stops updates.

Do not use wall-clock time for scene animation; use the accumulated `this.t`.

## Renewing loops (no hard walls, no score)

Every scene has a visible cycle that completes and starts again, so play never
runs out. The rule is: **progress is shown as a picture, never as a number** —
no score, no countdown, no failure. Parent-facing counts stay in the dashboard
metrics.

| Scene | Cycle | State that resets |
| --- | --- | --- |
| Balloons | the moon gives a salute every 12 pops | `sinceSalute`, `salute` |
| Garden | all 18 beds fill → the garden drifts to seed → a few volunteers regrow | `renewIn`, `seeding`, `cycle`, `slots[].used` |
| Stars | six stars assemble a constellation → it holds, fades → a new pattern begins | `skyIndex`, `skyProgress`, `skyFade`, `skyResetAt`, `cycle` |
| Painting | the canvas fills, then washes itself slowly | `stamps`, `fadeBoost` |
| Picture Pairs | six captured pictures fill an album page → the page lifts away → a new page | `album`, `turning`, `pages` |
| Magic Car | six crashes build a sky picture → it glows, fades → the next drive builds a different pattern | `starsLit`, `skyGlow`, `cycle`, `SKY_PATTERNS` |

If you add a cycle to a new game:

1. Give it an explicit state flag and a `cycle` counter (for tests, not display).
2. Finish with a soft cue (glow, chime), hold it briefly, then fade — never a cut.
3. Reset only your own state in the cycle end; never reset `App` session state.
4. Leave the stage alive afterwards (garden volunteers, an empty album page that
   fills again), so the scene never looks broken between cycles.
5. Keep it non-numeric. If the parent asked for a score, that is a rule change —
   update `DECISIONS.md`, `AGENTS.md` and the README wording first.

## Settings → where they apply

| Setting | Enforced by | What a game must do |
| --- | --- | --- |
| `targetSize` | game `layout()` | Use `sizeFactor` or its own size map. |
| `reward` | game `activate()` | Use `rewardFactor` in hit radius / hold time. |
| `anyTouch` | game `activate()` | If the contact misses every target, still reward (nearest target). |
| `animation` | game `update()` + `motion` | Scale idle movement, keep rewards readable at Still. |
| `visual` | `calm` + `FX.calm` | Fewer particles, softer light. |
| `activation` | `App.updatePointerModes` / `App.onMove` | Nothing, except painting is deliberately excluded from sweep/continuous. |
| `holdRequired` | `App.activate` / `holdRequiredNow` | Nothing unless `fullScreen`. |
| `sound` | `MG.Audio` | Nothing; audio is muted centrally. |
| `starReach` | stars `layout()` | Only stars. Reach is never increased automatically. |

**Single-contact guarantee:** every non-full-screen game must give a visible and
audible reward from one contact (with `anyTouch`, the default). Full-screen
two-handed scenes are the documented exception; if you add another, say so in the
dashboard card, README and `DECISIONS.md`.

## Per-game map

| id | File | Pattern | Key state | Draw pieces | Audio | Watch out |
| --- | --- | --- | --- | --- | --- | --- |
| `balloons` | `balloons.js` | activation | `list`, `pops`, `hue` | night sky, `starsBg`, moon, hills, `balloon()` | `pop`, `chime` | Respawn must stay inside the play rect (`spawn(fromX, fromY)`). |
| `garden` | `garden.js` | activation | `slots`, `flowers`, `butterflies`, `animals`, `motes`, `renewIn`, `seeding`, `cycle` | sky, moon, hills, `drawFlower`, animals, fireflies, `drawSign` | `bloom`, `chime`, `sparkle` | When every slot is used the garden drifts to seed, frees itself and re-seeds a few volunteers; `cycle` counts turn-overs. A full garden still rewards the nearest bloom. |
| `stars` | `stars.js` | activation | `stars`, `q`, `flyers`, `shoot`, `skyIndex`, `skyProgress`, `skyFade`, `skyResetAt`, `cycle` | sky, constellation, moon, `drawStar`, `drawConstellation` | `star`, `chime` | `layout()` derives `cx/cy/rx/ry` from `starReach` and `zone.swapped`; the constellation band is kept clear of targets; finishing a pattern schedules `skyResetAt`, then a new pattern begins. |
| `painting` | `painting.js` | pointer scene | offscreen `cv`, `brush`, `stamps`, `idle`, `fadeBoost` | dark canvas, luminous `drawImage`, mandala in Still | `paint`, `bloom`, `chime` | Offscreen canvas is window-sized, not play-sized; strokes use `lighter`; excluded from sweep/continuous. At 240 stamps the canvas gently washes and starts again. |
| `photos` | `photos.js` | pointer scene, `fullScreen` | `pairs`, `pictures`, `captured`, `holdTime`, `album`, `turning`, `pages` | gallery wall, `drawCard`, `drawPicture`, album strip | `chime`, `sparkle`, `bloom` | Each picture appears once (`pickPicture`); capture needs both halves held for `holdTime`; the album holds 6 and then lifts to a new page; no lamp. |
| `goats` | `goats.js` | activation + waits | `phase`, `goatIndex`, `done`, `cross`, `trollUp`, `line`, `cycle` | meadow, stream, bridge, classic eventyr goats (horns, beards, hooves), mossy troll with a club, dialogue bubble | `trip`, `bleat`, `troll`, `chime` | The troll waits for a contact during `challenge` — no timeout, that contact is the child's "left arm" turn. Every contact returns true (sparkle/bleat outside the two waiting phases). `cycle` resets the herd at dusk. |
| `car` | `src/car3d/main.js` → `js/car3d.bundle.js` (**3D**; `js/games/car.js` is the no-WebGL fallback) | pointer scene + activate, offscreen WebGL blit | `carU`, `throttle`, `speed`, `boost`, `obstacles`, `starsLit`, `skyGlow`, `cycle`, `starFly`, `friends`, `dogJoy`, `honk`, `keepLit`, `is3D` | 3D night road, red hatchback with VW roundel/up! decals and a back-window dog, van/sedan/suv traffic, guardrail, pines, warm lamps, mountains, moon/stars, bloom, headlights, sky pictures | `chime`, `sparkle`, `toot`, `vroom`, `crash` | The hold side is a gas pedal (`holdStyle='pedal'`); it only sets speed, so `keepLit=true` stops the play side dimming and the session resting when it is released — the car coasts to a stop. The first play pointer steers. Crashing is the reward: a bump bursts, boosts, flies a star to the sky, bounces the dog and makes the verge friends cheer; six complete a sky picture (`SKY_PATTERNS` rotates each cycle). A touch away from traffic honks and flashes. No pickups and no failure. The WebGL renderer is offscreen and blitted in `draw()`; `layout()` resizes renderer + composer. Rebuild the bundle after any source/model change. |

**Magic Car 3D.** This is the one scene outside the procedural-Canvas rule (D29). Source lives in `src/car3d/main.js`; build with `npm run build:car3d` into `js/car3d.bundle.js` (Three.js + GLTFLoader + post-processing + the CC0 GLBs embedded as data URLs). The bundle runs as a classic script and sets `MG.Games.car` only when WebGL exists; `js/games/car.js` stays the fallback. The game renders to an offscreen `WebGLRenderer`, then `draw(ctx)` blits it into `this.inset`; `layout()` resizes the renderer and `EffectComposer`. Models come from `assets/models/` (Kenney Car Kit, CC0). `prepareModel` scales/orients them and recolours the player's green atlas to red. The player group is not yawed: the GLB's **front faces −Z**, so headlights are at local −Z, taillights and the dog at +Z. Do not hand-edit the bundle.

`registry.js` holds `MG.createGame` and `MG.GameTitles`; `App.newGame` falls
back to `MG.Games.balloons` if a constructor throws.

## Recipes

**Recolour a scene.** Use `MG.Theme.C` and `Theme.rgba` / `Theme.mix`. Keep
hue-driven accents local (`U.hsl`) for targets, so different targets stay
distinguishable. Do not hard-code near-black; use the palette.

**Change what counts as a hit.** Edit that game's `activate()`: find the nearest
target, compute the reach from its radius and `rewardFactor`, and honour
`anyTouch`. Never require precision inside the target.

**Change pacing or counts.** `layout()` for counts and sizes; constants at the
top of the file for timings; `this.motion` for idle drift. Avoid new timers.

**Add a setting.** `js/settings.js` → `DEFAULTS` + `CHOICES` + `sanitize` clamp;
`js/ui.js` → a `field(...)` with `seg`/`toggle`/`slider`; read it in the game via
`this.settings`. Add a smoke assertion if it changes behaviour. Settings are
persisted by path (`Settings.set('dwellTime', ...)`), so keep names flat.

**Add a sound.** Add a voice to `SOUNDS` in `js/audio.js` (oscillator/noise only,
with a gain below ~0.2), then call `MG.Audio.play(name, index)`. Existing names:
`pop chime bloom star paint nom bubble spray toot vroom crash sparkle switchOn switchOff start end tap trip bleat troll`.

**Add particles.** Prefer `FX.confetti`, `FX.sparkle`, `FX.petals`, `FX.trail`,
`FX.ring` — they are capped (420 particles / 26 rings) and respect `FX.calm`.
A local burst is fine if it is capped and short.

**Make a scene full-screen.** Set `this.fullScreen = true` before
`MG.BaseGame.call`, then in `layout()` use `this.app.W/H` rather than
`this.inset`. The lamp disappears, `holdRequiredNow()` returns false, and
`App.activate` no longer gates on light. Update the dashboard copy and tests.

**Dress the hold side for one scene.** Set `this.holdStyle = 'pedal'` in a game constructor (Magic Car does; `pedal` is the only extra look) before `MG.BaseGame.call`. `App.drawHoldZone` then draws that object and labels it "Gas"/"Go". Add `this.keepLit = true` when the object is a speed control rather than a lamp: `App.keepLitNow()` then stops releasing it from dimming the play side or entering rest (Magic Car coasts to a stop while staying lit). Every other scene keeps the parent's lamp/hand choice and the normal light/rest rules.

**Use a waiting turn (dialogue).** `goats.js` shows the pattern: a phase that
does nothing until `activate` is called (`challenge`), which is where the
second contact — the child's left-arm turn — moves the scene on. Never add a
timeout to such a phase; waiting is the point.

## Testing

Fast: `node --check` on every `js/**/*.js` file (see `PROJECT_INDEX.md`).

Add the game to the generic loop in `tools/smoke-1.mjs`:

```js
for (const id of ['garden', 'stars', 'painting', 'mygame']) {
  // switches game, holds the lamp, sends contacts, expects growth via
  // g.flowers / g.total / g.stamps, or extend the probe object for new state.
}
```

For a game with its own state, add a block like the Picture Pairs one: assert
the scene renders, a contact produces a reward (`MG.Metrics.live.activations`),
and any rule that must not regress. If the game has a renewing cycle, complete
it directly through its own methods and assert the cycle counter advanced and
the state reset — `smoke-1.mjs` does this for balloons, garden, stars and the
photo album. Then run the full gate:

```
powershell -ExecutionPolicy Bypass -File tools\run-smoke-tests.ps1
```

It exits 0 only when both suites pass and writes screenshots to
`%TEMP%\magichand-smoke` — open the game's screenshot before calling it done.

The gate cannot prove: palm/knuckle contacts, real simultaneous touches on the
target panel, how the motion feels, or whether the reward is understandable to
the child. Those are listed in `NEXT_STEPS.md` / README §6.

## Pitfalls

- Initialise fields **before** `BaseGame.call`; `layout()` runs inside it.
- `layout()` runs again on every resize — never reset progress, scores or state
  there; only geometry and counts.
- Draw your own background inside `this.play` / `this.inset`, or the room shows
  through.
- The canvas is already clipped to the stage and uses CSS pixels; do not
  re-apply `dpr` scaling, and do not draw outside the stage expecting it to be
  visible.
- A contact's role is fixed at pointerdown; never infer the hand or reclassify on
  move.
- Do not call `App.startSession`, `App.enterRest` or other session functions from
  a game; return a boolean from `activate` instead.
- Keep one `activate` = one reward (`MG.Metrics.addActivation` is driven by the
  return value).
- Painting-sized offscreen canvases must be reallocated in `onResize` and
  cleared there when dimensions change.
- The scene tray reserves `App.zone.bottom` pixels; never use the full window
  height for layout. Full-screen games get that space removed from
  `App.stageRect()`, and must not call `stageRect()` during construction — when
  `App.game` is still the previous scene, it falls back to the play rect.
  `Photos.layout` uses `app.W` / `app.H - zone.bottom` for that reason.
- The parent dashboard is behind a short maths check (`js/parentgate.js`),
  opened by tapping the corner pad; the bottom tray has no settings button and
  only switches games. Do not bypass the check or reintroduce a hold timer
  without asking the parent.
- No images, audio files, fonts, network calls or DOM nodes: Canvas 2D, WebAudio,
  CSS only. Parent photos are the only exception and go through `js/pictures.js`.
- Do not add timers or countdowns; the app already stops scenes gently and ends
  sessions on the parent's schedule.

## Skeleton

```js
/* Game - <Name>. */
window.MG = window.MG || {};
(function (MG) {
  'use strict';
  var U = MG.U;
  var FX = MG.FX;

  function MyGame(app) {
    this.things = [];          // own fields first: layout() runs below
    MG.BaseGame.call(this, app);
    this.id = 'mygame';
    this.title = 'My Game';
  }

  MyGame.prototype = Object.create(MG.BaseGame.prototype);
  MyGame.prototype.constructor = MyGame;

  MyGame.prototype.layout = function () {
    var p = this.inset;
    this.r = Math.max(24, Math.min(p.w, p.h) * 0.12 * this.sizeFactor);
    if (!this.things.length) this.spawn();
  };

  MyGame.prototype.spawn = function () {
    var p = this.inset;
    this.things.push({
      x: U.rand(p.x + this.r, p.x + p.w - this.r),
      y: U.rand(p.y + this.r, p.y + p.h - this.r),
      grow: 0
    });
  };

  MyGame.prototype.update = function (dt) {
    MG.BaseGame.prototype.update.call(this, dt);
    for (var i = 0; i < this.things.length; i++) {
      var t = this.things[i];
      if (t.grow < 1) t.grow = Math.min(1, t.grow + dt * 2);
    }
  };

  MyGame.prototype.activate = function (x, y) {
    var best = null;
    var bd = Infinity;
    for (var i = 0; i < this.things.length; i++) {
      var d = U.dist(x, y, this.things[i].x, this.things[i].y);
      if (d < bd) { bd = d; best = this.things[i]; }
    }
    if (!best) return false;

    var hit = bd <= this.r * (1 + this.rewardFactor * 0.2);
    if (!hit && this.settings.anyTouch) hit = true;
    if (!hit) { FX.sparkle(x, y, 3, 48); return false; }

    FX.sparkle(best.x, best.y, this.calm ? 6 : 12, 48);
    MG.Audio.play('chime', 2);
    return true;
  };

  MyGame.prototype.draw = function (ctx) {
    var p = this.inset;
    ctx.fillStyle = MG.Theme.C.night1;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    for (var i = 0; i < this.things.length; i++) {
      var t = this.things[i];
      var r = this.r * Math.max(0.05, U.easeOutBack(t.grow));
      MG.Theme.glow(ctx, t.x, t.y, r * 2, '#ffd39b', 0.28);
      ctx.fillStyle = '#f2c884';
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, U.TAU);
      ctx.fill();
    }
  };

  MG.Games = MG.Games || {};
  MG.Games.mygame = MyGame;
})(window.MG);
```

## Files to touch in one place

| File | Why |
| --- | --- |
| `js/games/<id>.js` | The scene itself; self-registers in `MG.Games`. |
| `index.html` | Script tag, before `registry.js`. |
| `js/settings.js` | `CHOICES.game` (and `DEFAULTS.game` if it should be the default). |
| `js/ui.js` | `GAMES` card (name + short description). |
| `js/games/registry.js` | `MG.GameTitles` (the bottom tray builds from it). |
| `js/icons.js` | One icon per game, shared by the dashboard and the tray. |
| `tools/smoke-1.mjs` / `smoke-2.mjs` | Behaviour assertions. |
| `README.md` | Parent-facing game table and description. |
| `PROJECT_INDEX.md`, `CURRENT_STATE.md` | Project map and current facts. |
| `DECISIONS.md` | Only when a rule or interaction changes. |
