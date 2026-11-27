# Current State

_Last reviewed: 2026-11-27_

## Now
- Complete, playable static web app (no build, dependencies or network): seven games - Magic Balloons, Magic Garden, Reach for the Stars, Magic Painting, **Picture Pairs**, **Three Goats**, **Magic Car**.
- **Magic Car.** A moonlit third-person drive in a red **VW up!** (rounded tall hatch with a big glass tailgate, roundel on the glass, up! badge, tall corner lights, a dog in the back window). The hold side is a **gas pedal that only sets speed**: letting go coasts the car to a stop while the play side stays lit and the session keeps playing (`keepLit`); it never shows the rest card. The play-side hand steers. There are no pickups and no failure: bumping a car, van, hay bale or roadside tree bursts into sparks/leaves/straw, lights one star and gives a short speed boost. The earned star **flies from the impact into the sky**; six complete one of **six rotating sky pictures**, which glows, draws a shooting star and fades. The world answers the child: the **dog bounces**, **verge animals wave and cheer**, and nearby traffic flashes its lights. An imprecise touch **honks and flashes**. The night is built like a game rather than a flat vector scene: textured grass/asphalt, **volumetric headlight beams**, layered fog, a colour grade, a distant village, a barn, a turning windmill, swaying verge grass and only a few warm lamps. Crashing is deliberately the reward (D25–D28).
- **Three Goats.** A gentle Bukkene Bruse scene. One contact sends the next goat to the bridge; the troll rises and asks "Hvem er det som tramper på min bru?". A second contact — the child's left-arm turn, with no timeout — lets the goat answer. The two smaller goats plead "Ikke spis meg! Ta den som kommer etter, han er mye større."; the biggest says "Det er meg, den største bukken Bruse." The troll replies "Så gå da" and waves it across. After all three, a soft dusk returns the herd and the cycle repeats.
- **Classic eventyr goats.** The three billy goats now have shaggy coats, curved horns, pointed ears, beards, thin legs and dark hooves, in increasing sizes and cream/grey/tan tones; the film accessories (bucket hat, sunglasses, red cap) are gone.
- **Eventyr troll.** Mossy green-grey skin, a huge bulbous nose, pointed ears, a mop of dark moss, small tusks, warts, big three-fingered paws, a gold earring and a wooden club on the bridge; sleepy and curious between visits, never threatening.
- Everything is original Canvas art; `sprites/` is reference-only and `sprites/README.md` says so.
- Surprise Mix is **removed**: the bottom tray switches scenes directly. Saved settings with game `mix` sanitise back to balloons.
- **Visual language: warm night-lamp storybook.** Deep plum shadows, a brass-and-amber lamp, film grain and soft glows. `js/theme.js` (`MG.Theme`) owns the palette, room, panels, cards, glow/vignette, grain and fonts.
- Child surface: velvet hold console with a brass lamp (glass face, filament, halo) — a gas pedal in Magic Car — a picture window for the game, dusk rather than a grey veil while the lamp is dark, and cards that fade in over ~0.55 s (`App.modeAt`).
- **Grown-up check.** The parent menu opens only from the corner lock, which asks a two-digit sum on a small keypad (`js/parentgate.js`); a wrong answer says "Not quite — try again". `Ctrl + Shift + P` still works. The bottom tray has **no settings button** — it only switches games and reserves its height through `App.zone.bottom`.
- **Renewing loops.** No scene can run out and nothing shows a score. The garden's 18 beds fill, drift to seed and regrow volunteers; six stars assemble a constellation that hands over to a new pattern; six photos fill an album page that lifts away; the moon salutes every dozen balloon pops; a full painting washes itself; the goat herd returns after all three cross; six car crashes complete a sky picture, which glows and fades while the next drive builds a different pattern.
- Picture Pairs cards live in horizontal lanes, so two pictures never sit under one finger and "hold two different pictures" cannot accidentally capture.
- Dashboard and calibration are dark glass with gold hairlines and serif headings; game icons are shared inline SVGs.
- Audio keeps its synthesised API with a procedural room reverb, plus `trip`, `bleat`, `troll`, `vroom` and `crash` voices; no audio files.
- App shell: `icon.svg` (vector lamp mark) and `manifest.webmanifest` (linked only over http(s)).
- **`GAME_GUIDE.md`** maps the game layer: contract, registration points, activation/pointer/waiting scene patterns, renewing loops, settings→game table, per-game internals, recipes, testing, pitfalls and a skeleton.
- Behaviour is otherwise unchanged: same settings, metrics, roles fixed at pointerdown, lamp/blackout, 1.2 s "Well done!" card.
- Settings and metrics live in `localStorage`; pictures in IndexedDB. Nothing is uploaded.
- `C:\Users\Josh\Downloads\MagicHand.zip` is the 2026-11-19 delivery (pre-overhaul); it no longer matches the project tree and must be rebuilt before handing it over.

## Verified
- 2026-11-27 — Magic Car visual pass: rebuilt the car as a red VW up! with a large glass tailgate and VW roundel, removed the reflector-post field and most lamps, added textured ground/asphalt, headlight cones, village/barn/windmill silhouettes, swaying grass and obstacle detail. `node --check` clean; `tools\run-smoke-tests.ps1` both suites PASS, 0 failures, no page errors; driving/crash/sky screenshots reviewed.
- 2026-11-27 — Magic Car speed-only pedal and red VW up!: releasing the pedal now coasts to a stop without dimming or resting; car redrawn as a VW up! rear view; the night was enriched. `node --check` clean; `tools\run-smoke-tests.ps1` both suites PASS, 0 failures, no page errors; new checks cover mode/light/dark staying on, the car stopping, and the model/colour. Screenshots reviewed.
- 2026-11-26 — Magic Car engagement pass: crash star flight, six rotating sky pictures, waving verge friends, the rear-window dog and the honk/flash. `node --check` clean; `tools\run-smoke-tests.ps1` both suites PASS, 0 failures, no page errors, with new car checks (flying star, friends/dog reaction, rotating pictures, honk). Car driving, crash and sky screenshots reviewed. The runner now mutes its headless Edge.
- 2026-11-26 — Magic Car rebuilt as a perspective night drive: gas pedal, no pickups, crashing as the reward, six-crash constellation; Three Goats' goats and troll redrawn for the eventyr. `tools\run-smoke-tests.ps1`: both suites PASS, 0 failures, no page errors; car steering/crash/constellation and the pedometer checks included. Screenshots reviewed.
- 2026-11-20 — `node --check` on every JS and smoke script: clean.
- 2026-11-20 — `tools\run-smoke-tests.ps1`: both suites PASS, 0 failures, no page errors, exit 0, after the film-style art pass. Checks cover the maths gate, the tray without settings, Picture Pairs lanes, the goat scene cycle and renewal.
- 2026-11-20 — screenshots reviewed: the question with the plea line, the idle herd with the three accessories, the troll on the bridge, the tray without Menu, the maths check.
- 2026-11-20 — phone (SM-S916B) reloaded over `adb reverse` after the art pass: build markers correct, no page errors, tray and gate present; the new herd and troll visible in the lit scene.
- 2026-11-20 — Picture Pairs lane change: holding two different pictures no longer captures; a matching hold still does.
- 2026-11-20 — manifest CORS on `file://` found by the gate and fixed by linking it only for http(s).
- Earlier evidence (2026-11-19): picture import through the real IndexedDB path, zip rebuild, LAN/tunnel 200 checks — details in `SESSION_HANDOFF.md`.

## Risks
- **The goats and troll now follow the eventyr, not the film.** Shaggy goats with horns, beards and hooves; a mossy, big-nosed troll with tusks, a club and an earring. Check at panel distance that they read as the storybook characters rather than sheep or a bear.
- **Magic Car deliberately rewards crashing.** Watch that ramming everything stays playful and does not become the only thing the child does; the constellation is a picture, not a score.
- **The maths check may annoy the parent** more than the old hold did; it is a soft barrier, not security, and `Ctrl + Shift + P` is an instant way in.
- **Three Goats is unjudged by the child.** The question waits indefinitely by design; check that waiting feels comfortable, and whether two contacts per goat fits the child's energy.
- **Magic Car is unjudged by the child.** The pedal is a new object on the hold side; check that the press is understood, that a bump reads as gentle, and that the road is wide enough for the left arm's reach. The engagement pass raised traffic density and added characters: watch whether the dog and verge friends delight or distract, whether the honk is understood, and whether the rotating sky pictures get noticed at panel distance. Releasing the pedal now keeps playing, so a parent session limit still counts coasting time; confirm that matches the parent's expectation.
- **Magic Car's visual style is deliberately 2D Canvas.** The pass adds texture, beams and silhouettes, but a true 3D or photo-real look needs binary sprites or a WebGL library and a bundler; the current no-asset/no-dependency rules forbid that. Decide with the parent before changing the policy (D28).
- The scene tray costs vertical space (~78 px at 1440×900); on a small phone landscape that is a larger share.
- Not yet seen on the target touchscreen: night look, tray, cycles and goats.
- Cycle pacing is unjudged by a child (garden ~1.4 s, constellation ~1.8 s, goat dusk ~2.4 s).
- Real palm/knuckle contacts and genuine two-hand touches on the panel are still unverified.
- Runtime cost of grain/glows on a low-end GPU is unmeasured; the S23+ held 60 fps.
- The delivery zip is stale — rebuild before installing or sending it.
- The OS folder picker has not been tested on the target PC.
- Pictures depend on IndexedDB; a blocked profile falls back to doodles.
