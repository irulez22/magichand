# Session Handoff

## 2026-11-26 (latest) — Magic Car pedal, livelier drive, eventyr goats
- **Pedal.** `Car.holdStyle = 'pedal'`; `App.drawHoldZone` reads a scene's `holdStyle`, and `App.drawPedal` draws a mounted, ribbed pedal labelled "Gas"/"Go". Other scenes keep the parent's lamp/hand choice.
- **Perspective drive.** The car scene is now a third-person night road: sky, moon, stars, distant firs, fog, perspective tarmac, headlight beams, roadside lamps and a detailed rear-view car.
- **Crashes are the reward.** No pickups. Bumping a car, van, bale or tree bursts into themed debris, wobbles the car, adds a short boost and lights one star in the sky; six complete a constellation with a shooting star, then it fades and renews. A tap on an obstacle bumps it directly. Faster cruise and combo-scaled bursts; `crash` and `vroom` voices.
- **Goats and troll now follow the eventyr:** classic goats (horns, beards, hooves) and a mossy, big-nosed troll with tusks, an earring and a club. Film accessories removed.
- Verification: `node --check` clean; `tools\run-smoke-tests.ps1` both suites PASS, 0 failures, no page errors; car pedal, perspective road and troll screenshots reviewed.
- Superseded: the 2026-11-20 film-silhouette character pass (D21); see D22/D24/D25.

## 2026-11-20 - grown-up check, no tray menu, original goat art

**State:** complete and verified in headless Edge; not yet on the S23+ or the target panel. Delivery zip still stale.

What changed:
- **Bottom tray has no Menu button.** `js/tray.js` now renders game icons only; the settings entry is the corner lock.
- **`js/parentgate.js`:** tapping the corner lock opens a small keypad and a two-digit sum. Correct → `App.openParent()`; wrong → "Not quite — try again" and the input clears; Cancel/Escape returns. `Ctrl + Shift + P` stays as the keyboard shortcut. Styled in `styles.css` (`.gate-overlay` / `.gate-card`).
- **Goats dialogue:** the two smaller goats now say the authentic plea — "Ikke spis meg! Ta den som kommer etter, han er mye større." (and "Vent til den største kommer…" for the middle goat); the biggest says "Det er meg, den største bukken Bruse." The troll replies "Så gå da, lille/store venn." during the crossing. `drawBubble` wraps two-line answers.
- **New goat and troll art**, still procedural but informed by the reference stills: large white heads, grey foreheads, long dark ears, tall horns, pink muzzles, beards, blinking; a shaggy mossy troll with a big nose, floppy ears, a flower and a toothless smile. Herd spacing widened so the three read separately.
- **Picture Pairs lanes:** cards drift only horizontally inside per-pair lanes, so two pictures never sit under one finger. This fixed a real "two different pictures captured" flake and makes matching clearer.
- `sprites/README.md` marks the book cover/poster as reference-only and copyrighted, not app assets (D21).
- Smoke: maths gate (protected, wrong answer, correct answer), no tray settings button, Photo lanes; all green.

Verification: `node --check` clean; both suites PASS, 0 failures, no page errors, exit 0. Screenshots reviewed: goat question with the plea, idle herd, new art, tray without Menu, maths check.

Notes:
- The maths question is a soft barrier, not security. If the parent dislikes it, a different adult check can replace `parentgate.js` without touching the shell.
- The plea line is authentic but is the strongest line in the app; the troll never threatens. Watch the child's reaction.
- The character art is original, not the book's; adjust shapes/colours on the real panel if needed.


- **Film-style character pass:** trailer frames were pulled for reference (not bundled). The goats are now the film's shapes — huge fluffy body, small head, long ears, noodle legs, bucket hat / sunglasses / red cap — and the troll is a dark shaggy creature with a long nose, paws on the bridge and a wide toothy grin. New accessors: `GOATS[].look/coat/shade/ear`; `drawTrollArms` draws the paws on the planks. The smoke waits in the goat cycle were widened after a flaky answer.

## 2026-11-20 — Three Goats; Surprise Mix removed

**State:** complete and verified in headless Edge; not yet on the S23+ or the target panel.

What changed:
- New `js/games/goats.js` (`goats`, "Three Goats"): moonlit meadow, stream, plank bridge, three goats and a friendly troll. Contact one walks the next goat to the bridge; the troll asks the classic question; contact two lets the goat answer and the troll waves it on; the crossing finishes on its own. All three then cross, a soft dusk returns the herd and `cycle` increments. There is no timeout on the question.
- New sounds `trip`, `bleat`, `troll` in `js/audio.js`; goat icon in `js/icons.js`.
- **Surprise Mix removed:** `MixGame`/`ORDER` deleted from `js/games/registry.js` (now just `MG.createGame` + `MG.GameTitles`), `mix` removed from `CHOICES.game`, the dashboard card, icons and the tray fallback. Saved settings with `mix` sanitise to balloons.
- Smoke-2's mix test replaced by a Three Goats test (idle → question → answer → three crossings → renewal).
- Docs: README game table, GAME_GUIDE, PROJECT_INDEX, D19.

Verification: `node --check` clean; both suites PASS, 0 failures, no page errors, exit 0.

