# Current State

_Last reviewed: 2026-11-20_

## Now
- Complete, playable static web app (no build, dependencies or network): seven games - Magic Balloons, Magic Garden, Reach for the Stars, Magic Painting, **Picture Pairs**, **Three Goats**, **Magic Car**.
- **Magic Car.** A moonlit drive. The hold side is a brass-hinged **gas pedal**; holding it accelerates, and moving the play-side hand steers between three lanes. Fireflies light a six-lantern garland above the road; a full garland glows, holds, fades and the drive renews. Other cars, vans and roadside trees are dodged; a bump only wobbles the car, slows it briefly and tumbles the obstacle away. Speed streaks, exhaust, a quiet vroom and a firefly swarm when the garland completes keep the drive lively without flashing.
- **Three Goats.** A gentle Bukkene Bruse scene. One contact sends the next goat to the bridge; the troll rises and asks "Hvem er det som tramper på min bru?". A second contact — the child's left-arm turn, with no timeout — lets the goat answer. The two smaller goats plead "Ikke spis meg! Ta den som kommer etter, han er mye større."; the biggest says "Det er meg, den største bukken Bruse." The troll replies "Så gå da" and waves it across. After all three, a soft dusk returns the herd and the cycle repeats.
- **Classic eventyr goats.** The three billy goats now have shaggy coats, curved horns, pointed ears, beards, thin legs and dark hooves, in increasing sizes and cream/grey/tan tones; the film accessories (bucket hat, sunglasses, red cap) are gone. The troll keeps his dark shaggy bridge-troll shape. Everything is original Canvas art; `sprites/` is reference-only and `sprites/README.md` says so.
- Surprise Mix is **removed**: the bottom tray switches scenes directly. Saved settings with game `mix` sanitise back to balloons.
- **Visual language: warm night-lamp storybook.** Deep plum shadows, a brass-and-amber lamp, film grain and soft glows. `js/theme.js` (`MG.Theme`) owns the palette, room, panels, cards, glow/vignette, grain and fonts.
- Child surface: velvet hold console with a brass lamp (glass face, filament, halo) — a gas pedal in Magic Car — a picture window for the game, dusk rather than a grey veil while the lamp is dark, and cards that fade in over ~0.55 s (`App.modeAt`).
- **Grown-up check.** The parent menu opens only from the corner lock, which asks a two-digit sum on a small keypad (`js/parentgate.js`); a wrong answer says "Not quite — try again". `Ctrl + Shift + P` still works. The bottom tray has **no settings button** — it only switches games and reserves its height through `App.zone.bottom`.
- **Renewing loops.** No scene can run out and nothing shows a score. The garden's 18 beds fill, drift to seed and regrow volunteers; six stars assemble a constellation that hands over to a new pattern; six photos fill an album page that lifts away; the moon salutes every dozen balloon pops; a full painting washes itself; the goat herd returns after all three cross; six fireflies light the car's garland, which glows and fades.
- Picture Pairs cards live in horizontal lanes, so two pictures never sit under one finger and "hold two different pictures" cannot accidentally capture.
- Dashboard and calibration are dark glass with gold hairlines and serif headings; game icons are shared inline SVGs.
- Audio keeps its synthesised API with a procedural room reverb, plus `trip`, `bleat`, `troll` and `vroom` voices; no audio files.
- App shell: `icon.svg` (vector lamp mark) and `manifest.webmanifest` (linked only over http(s)).
- **`GAME_GUIDE.md`** maps the game layer: contract, registration points, activation/pointer/waiting scene patterns, renewing loops, settings→game table, per-game internals, recipes, testing, pitfalls and a skeleton.
- Behaviour is otherwise unchanged: same settings, metrics, roles fixed at pointerdown, lamp/blackout, 1.2 s "Well done!" card.
- Settings and metrics live in `localStorage`; pictures in IndexedDB. Nothing is uploaded.
- `C:\Users\Josh\Downloads\MagicHand.zip` is the 2026-11-19 delivery (pre-overhaul); it no longer matches the project tree and must be rebuilt before handing it over.

## Verified
- 2026-11-26 — new **Magic Car** scene: moonlit road, hold-button accelerator, play-side steering, fireflies and a six-lantern garland cycle. `tools\run-smoke-tests.ps1`: both suites PASS, 0 failures, no page errors; car checks cover steering, the gentle bump and garland renewal. Screenshot reviewed.
- 2026-11-20 — `node --check` on every JS and smoke script: clean.
- 2026-11-20 — `tools\run-smoke-tests.ps1`: both suites PASS, 0 failures, no page errors, exit 0, after the film-style art pass. Checks cover the maths gate, the tray without settings, Picture Pairs lanes, the goat scene cycle and renewal.
- 2026-11-20 — screenshots reviewed: the question with the plea line, the idle herd with the three accessories, the troll on the bridge, the tray without Menu, the maths check.
- 2026-11-20 — phone (SM-S916B) reloaded over `adb reverse` after the art pass: build markers correct, no page errors, tray and gate present; the new herd and troll visible in the lit scene.
- 2026-11-20 — Picture Pairs lane change: holding two different pictures no longer captures; a matching hold still does.
- 2026-11-20 — manifest CORS on `file://` found by the gate and fixed by linking it only for http(s).
- Earlier evidence (2026-11-19): picture import through the real IndexedDB path, zip rebuild, LAN/tunnel 200 checks — details in `SESSION_HANDOFF.md`.

## Risks
- **The goats now follow the eventyr, not the film.** Shaggy coats, curved horns, pointed ears, beards and hooves, in cream/grey/tan and three increasing sizes; the bucket hat, sunglasses and red cap are gone. Check at panel distance that they read as goats rather than sheep.
- **The troll still has a toothy grin** from the film pass. It is friendly and passive, but watch the child's reaction; the mouth can be softened without touching the rest.
- **The maths check may annoy the parent** more than the old hold did; it is a soft barrier, not security, and `Ctrl + Shift + P` is an instant way in.
- **Three Goats is unjudged by the child.** The question waits indefinitely by design; check that waiting feels comfortable, and whether two contacts per goat fits the child's energy.
- **Magic Car is unjudged by the child.** The pedal is a new object on the hold side; check that the press is understood, that a bump reads as gentle, and that the road is wide enough for the left arm's reach.
- The scene tray costs vertical space (~78 px at 1440×900); on a small phone landscape that is a larger share.
- Not yet seen on the target touchscreen: night look, tray, cycles and goats.
- Cycle pacing is unjudged by a child (garden ~1.4 s, constellation ~1.8 s, goat dusk ~2.4 s).
- Real palm/knuckle contacts and genuine two-hand touches on the panel are still unverified.
- Runtime cost of grain/glows on a low-end GPU is unmeasured; the S23+ held 60 fps.
- The delivery zip is stale — rebuild before installing or sending it.
- The OS folder picker has not been tested on the target PC.
- Pictures depend on IndexedDB; a blocked profile falls back to doodles.
