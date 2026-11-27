# Decisions

## D1 — Static `file://` app, no server or build
Reason: the simplest reliable install on a Windows touchscreen PC (copy a folder, double-click). Classic scripts avoid module/CORS restrictions. Verified that `localStorage` persists on `file://` in Edge, so settings survive.

## D2 — The hold side is a lamp with a round press-and-hold button
The interaction is continuous holding, so a toggle implied the wrong gesture (tap to flip). A big round button that sinks while held and emits light makes cause and effect obvious without words.

## D3 — "Off" means the play side fades to black
A card interrupts play and reads as a dialog. Fading to black matches the lamp and avoids "you stopped" framing. A faint bulb and a leak of warm light remain.

## D4 — Reward from any touch is on by default
One successful contact should always produce a reward. With large targets and any-touch, a palm anywhere pops the nearest balloon or blooms a flower.

## D5 — Never increase reach automatically
Reach (`starReach`) changes only from the dashboard or calibration.

## D6 — Metrics are interaction counters with an explicit disclaimer
Sessions, contacts, rewards, sustained contact and a rough movement estimate stay local and are labelled as interaction metrics, not medical measures.

## D7 — No binary assets
Graphics are Canvas 2D and sound is synthesised WebAudio; no image or audio files ship with the app. Parent-supplied photos are the exception: the delivery zip may include a sample under `pictures\`, but the app never draws it as a built-in asset — it is imported by the parent like any other photo.

## D8 — Contact role fixed at pointerdown
Roles (`pad` / `play` / `hold`) come from screen position at first contact and are not recomputed on move, so a hold hand drifting over the split cannot trigger a play reward.

## D9 — A popped balloon is replaced in view
Replacing below the screen made the reward vanish for a minute on Slow/Still. New balloons appear inside the play area, grow in over ~0.4 s, and recycled balloons return in view.

## D10 — Picture Pairs is a full-screen, two-handed scene
The parent asked for a scene using their own pictures that must be held on both halves at once. It therefore uses the whole screen and bypasses the lamp button (`game.fullScreen`, `App.holdRequiredNow`). Pictures are copied from a chosen folder, downscaled to 512 px and kept in IndexedDB; built-in doodles cover the empty case. The pair is matched by picture id and never repeated on screen, so "the same picture" is unambiguous.

## D11 — A picture is never shown in two pairs; a captured pair may keep its own
When the parent has no more pictures than the scene shows, there is no unused picture to swap in, and the earlier fallback could put a picture in two pairs at once — which makes a "matching" hold ambiguous and unfair for the child. So a reset takes only a picture no other pair shows, and if none is free the captured pair keeps its picture. Repetition is preferable to ambiguity.

## D12 — The end card lasts 1.2 s
The "Well done!" card used to hold for 3 s. The parent asked for 1.2 s so the next round starts sooner; the card still waits for hands to be lifted when the hold button is required, and no countdown or failure state is introduced.

## D13 — LAN or tunnel access is ad hoc, not the delivery
Serving the folder with `python -m http.server` plus a Cloudflare quick tunnel was added only to try the app on another machine. It is not an install path: the tunnel URL changes on restart, there is no authentication, and IndexedDB pictures belong to that origin, so the delivered copy stays the unzipped folder opened over `file://`.

## D14 — Visual direction: a warm, lamplit room at night
The parent asked for a premium, paid-for feel rather than "a webpage with games". Chosen direction: deep plum night, brass and amber lamplight, soft grain, serif titles. It keeps the same calm rules — no flashing, no sudden contrast jumps, fades and eases only — and makes the lamp metaphor literal: the room is dark until the child holds the button. Rejected alternatives were "elevated light craft" (still pastel, less of a departure) and "modern studio flat" (brighter, toy-like, less atmospheric). A light theme can be reconsidered only if the device screen makes the night palette hard to read (see `NEXT_STEPS.md`).

## D15 — One shared render language in `js/theme.js`
Visual code was spreading across `app.js`, five scenes, the dashboard and calibration. `MG.Theme` now owns the palette, grain, room/panel/card/inset surfaces, glow and vignette, and the serif/sans font stacks. Scenes keep their own hue-driven accents but take surfaces and depth from the theme, so a future restyle is one file plus per-scene tuning rather than a rewrite. Everything remains procedural: no fonts, images or audio are downloaded or bundled.

## D16 — The web app manifest is linked only over http(s)
`manifest.webmanifest` and `icon.svg` give an installable-app feel and a proper icon. Edge refuses the manifest fetch on `file://` (CORS), which the smoke gate correctly flagged as a page error, so the link is added at runtime only when the protocol is http(s). `file://` remains the supported delivery path; the manifest is a bonus when the folder is served.

## D17 — Every scene renews instead of ending; progress is never a number
The parent asked for an endless loop with no hard wall. Garden had 18 one-way beds, Stars an eight-slot row and Picture Pairs an eight-heart row, so each ran out of meaningful feedback. Chosen model: a visible cycle that completes and begins again — the garden drifts to seed and regrows a few volunteers, six stars assemble a constellation that holds and then hands over to a new pattern, six photos fill an album page that lifts away, the moon salutes every dozen balloon pops, and a full painting washes itself. The remaining numeric feedback was replaced with a ring, a constellation and an album, so the "no score" rule still holds and the parent dashboard remains the only place rewards are counted. Rejected: a climbing score (needs a rule change and adds competition to a calming activity) and pure ambient accumulation (no moment of completion). A new game should follow the same rule; `GAME_GUIDE.md` has the checklist.

## D18 — Instant parent menu and a bottom scene tray
The parent asked for the menu to open instantly instead of a 2.4 s hold, and for a control panel at the bottom to switch scenes. The corner pad opens on a quick tap and the tray had a one-click Menu button; the hold timer and its progress ring are gone. The tray is fixed DOM chrome (icons from `js/icons.js`, game list from `MG.GameTitles`) that switches via `Settings.set('game', id)` and reserves its own height with `Zones.compute(..., bottom)`, so no scene is covered. The tray is reachable by the child, but changing scenes is harmless. The direct-tap menu part is superseded by D20.

## D19 — Three Goats keeps the classic exchange, gently; Surprise Mix removed
The parent asked for a Bukkene Bruse scene with the troll's question and the child answering with the left arm, and for Surprise Mix to go now that the tray switches scenes directly.

- **Scene.** Activation game. Contact one sends the next goat to the bridge; the troll rises and asks "Hvem er det som tramper på min bru?". Contact two — the child's left-arm turn, with no timeout — lets the goat answer with the classic "Ikke spis meg! Ta den som kommer etter, han er mye større." (or, for the third goat, "Det er meg, den største bukken Bruse."), and the troll replies "Så gå da" and lets it cross. After all three goats a soft dusk resets the herd (`cycle`).
- **The troll is curious, not threatening.** Round, mossy, toothless, asleep between visits, with a lantern on the bridge. It never blocks, grabs or punishes; the only conflict is the story's question and the goat's plea.
- **Language.** The Norwegian lines are verbatim because they are the story's signature; the dashboard card explains the scene in English for the parent. No language setting was added: a bilingual option would double the text on the child surface.
- **Surprise Mix is removed.** The tray makes switching direct, and rotation was a scene the child could not choose. Saved `game: 'mix'` sanitises to balloons.
- Rejected: the goat being stopped forever or eaten (failure/scary), a dialogue timer (breaks the child's pace and the no-countdown rule), and English-only dialogue (loses the family's classic).

## D20 — A maths question guards the settings; the tray has no menu button
The parent asked to remove Menu from the bottom tray and put a grown-up check on the settings entry. A tap on the corner lock now opens a small keypad asking a two-digit sum; a correct answer opens the dashboard, a wrong one says "Not quite — try again". `Ctrl + Shift + P` remains a keyboard shortcut. This replaces the direct tap from D18 and restores the child-proofing the 2.4 s hold provided, without making the parent wait. The tray keeps only game icons, so the child can change scenes but cannot reach settings. The check is deliberately simple arithmetic, not a password: a soft barrier for a 3–4 year old, not security.

## D21 — Character art follows the film's silhouette, not its frames
The parent pointed out that the first goat/troll drawings did not resemble the film. Reference frames were pulled from the trailer with yt-dlp/ffmpeg for study only; they are not bundled or drawn into the app. The goats were rebuilt to the film's proportions — a huge fluffy cream/tan body, a small head with big eyes, long floppy ears, noodle legs, and their accessories (yellow bucket hat, sunglasses, red cap) — and the troll became a large dark-brown shaggy creature with a heavy brow, long nose, big ears, paws resting on the bridge and a wide toothy grin. Everything remains original Canvas art, so D7 (no binary assets) still holds. Rejected for now: cropping trailer frames (busy backgrounds, low resolution, fuzzy edges) and shipping stills (would change the asset policy and the self-contained delivery). If exact likeness becomes essential, the next step is isolated transparent PNGs supplied by the parent plus an image-sprite layer with the procedural art as fallback.

## D22 — The goats follow the eventyr, not the film
The parent asked for the three billy goats of the eventyr rather than the film's characters. The goats were redrawn with the classic storybook features — shaggy coats, curved horns, pointed ears, beards, thin legs and dark hooves — in three increasing sizes and cream/grey/tan tones. The bucket hat, sunglasses and red cap are gone. D21's film silhouette is superseded for the goats; the troll is redrawn separately (D24). All art remains procedural Canvas, so D7 still holds. Rejected: importing Kittelsen or film stills as sprites, which would change the asset policy.

## D23 — A scene may dress the hold side
The hold side remains the same physical control (hold = lit play side), but a scene may supply its own object for it: `game.holdStyle = 'pedal'` makes Magic Car draw a gas pedal and label it "Gas"/"Go". Parents who chose the lamp or hand keep that object in every other scene. The pedal changes neither the interaction nor the session rules, and every activation/sweep/dwell path still works while it is held.

## D24 — The troll is an eventyr troll, not the film's creature
Following the parent's note, the troll was rebuilt with storybook features: mossy green-grey skin, a huge bulbous nose, pointed ears, a mop of dark moss, small tusks, warts, big three-fingered paws, a gold earring, a tiny mushroom and a wooden club lying on the bridge. He stays curious and sleepy, never threatening. D21's film creature is superseded for the troll as well as the goats; all art remains procedural Canvas.

## D25 — In Magic Car, crashing is the reward
The scene exists to encourage left-arm reaching, so contact with an obstacle is the reward, not a failure: the obstacle bursts into themed debris, the car wobbles and gets a short speed boost, a combo raises the burst, and one star lights in the sky. Six crashes finish a constellation, which glows, draws a shooting star and fades. There is no damage, no score and nothing to lose. The floating pickups were removed because `anyTouch` vacuumed them up and they pulled attention away from steering. This is a deliberate inversion of the usual dodge-the-traffic loop, documented in the README and dashboard card.

## D26 — Magic Car needs a living world, not only a reward
The parent found the first drive too flat to stay engaging. The crash reward is unchanged (D25), but the world now answers it: the earned star flies from the impact into its place in the sky, the rear-window dog bounces, the verge animals hop and wave, and nearby traffic flashes its lights. Six crashes complete one of six rotating sky pictures, so the payoff differs every cycle; a touch that misses traffic honks and flashes instead of doing nothing. All of it is decorative Canvas and synthesised audio, adds no score, timer or failure state, and keeps the same controls. The test runner also mutes its headless Edge so a smoke run is silent. Rejected: turning the road into a dodge challenge, adding pickups or a score — each would undo D25's intent; if the scene feels too busy, reduce traffic density instead of removing the characters.

## D27 — Magic Car's pedal sets speed, not light
The parent asked that releasing the gas pedal only stop the car, not dim the play side. Magic Car therefore sets `keepLit = true`: while playing, `App.keepLitNow()` holds `App.light` at 1 and suppresses the hold-release rest transition, and `Car.gasLevel` reads `App.holdCount` directly so the car coasts to a stop. The pedal still shows its pressed state; every other scene keeps the lamp rule. This amends D23, which had said the pedal changed no session rules. Rejected: dimming the window and showing the rest card, which interrupted the drive whenever the child paused. Also in this pass the car became a red VW up! rear view and the night got a Milky Way band, farm lights and reflector posts. Open question: a parent session limit still counts coasting time because the session keeps running.

## D28 — Magic Car's graphics stay procedural, but richer
The parent found the scene's low-poly/Flash look too flat. The scene was rebuilt toward a game look inside the project's no-asset constraint: textured grass and asphalt from cached procedural noise, volumetric headlight cones, layered fog and a colour grade, a red VW up! with a large glass tailgate and roundel, barn/windmill/village silhouettes, swaying verge grass and fewer, larger props (the reflector posts and the field of farm lights were removed). It is still Canvas 2D and synthesised audio; no build step, dependency, binary asset or network call was added. A genuinely 3D or photo-textured look would need a policy change — pre-rendered PNG/WebP sprites or a WebGL library plus a bundler — and is not adopted without the parent's decision. Rejected for now: a 3D engine, because it would break file:// offline use and the no-dependency rule.
