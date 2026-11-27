# Next Steps

Keep this list prioritized and actionable.

## Immediate (on the touchscreen PC)
- [ ] Rebuild `MagicHand.zip` from the current folder — the existing zip predates everything since 2026-11-19.
- [ ] Re-run `pc\Setup.cmd` once on each kiosk PC to install the splash launcher, then test an update, an offline start and a quick repeat start.
- [ ] Copy the folder (or the new zip) to the PC and double-click `Launch-Kiosk.cmd`.
- [ ] Play **Magic Piano** with the child: does the power hold make sense, do the keys sound, are chords and glissando comfortable with the left arm, and are the instrument/song chips readable? Releasing power must feel neutral, not like a failure.
- [ ] Confirm the piano screen stays lit with the power released and the keys fall quiet; try all six instruments and the four songs, including joining in during a song.
- [ ] Check the car-to-car glare now: approaching traffic should not blow out white.
- [ ] Try the grown-up check: tap the lock, answer the sum, cancel once. Is the question the right difficulty and speed for the parent?
- [ ] Play **Three Goats** with the child: is the troll welcoming, does the plea line land, is the left-arm answer natural, and are two contacts per goat comfortable?
- [ ] Play **Magic Car** with the child: does the gas pedal press clearly, is steering across the road comfortable with the left arm, and is deliberately bumping things fun rather than confusing?
- [ ] Release the gas pedal mid-drive: the car should coast to a stop while the road stays lit and the dog keeps moving. Does the child restart on their own, or does the stopped scene need a nudge?
- [ ] Look at the red **3D hatchback** on the panel: do the roundel, up! badge, tall lights and hatch shape read at the child's distance? Does the 3D scene start at all (WebGL), and does it hold a smooth frame rate with the guardrail, bloom and shadows?
- [ ] Judge the 3D night: guardrail, pines, warm lamps, mountains, moon/stars and headlight beams. Does it feel like a game, or still too empty/low-poly?
- [ ] Judge the faster cruise, the denser traffic, the crash combo and the six-crash sky picture; check the bursts are exciting but not startling.
- [ ] Watch the new car life with the child: do the back-window dog and the waving verge animals delight, or pull attention off steering? Is the honk discovered and understood when a touch lands on nothing?
- [ ] Judge the rotating sky pictures: does the child follow the star flying up from a bump, and notice that each completed picture is different?
- [ ] Look at the classic eventyr goats and the mossy troll on the panel: horns, beards, hooves, big nose, tusks and club should read at the child's distance.
- [ ] Judge the night look: lamp obvious, play window readable, dark calm rather than gloomy. Try Visual: Calm if busy.
- [ ] Check the bottom tray: comfortable to reach, icons readable, and the height it takes does not make the lamp feel small (~78 px at 1440×900).
- [ ] Play each scene long enough to see its loop end: garden reseeds, six stars → new constellation, six photos → new album page, three goats → herd returns, six crashes → a different sky picture.
- [ ] Dashboard → **Pictures** → Choose pictures folder: confirm the OS picker opens and thumbnails appear.
- [ ] Try **Picture Pairs** with the child: matching hold, and that the lane layout still feels playful.
- [ ] Run **Touch test** with real hands (palm, knuckle, two contacts) and recalibrate if needed.

## Upcoming
- [ ] If exact parity with the Orange Kids Piano APK is wanted, obtain written permission for its art/audio first; the current Magic Piano is intentionally original (D31).
- [ ] Decide whether to source a closer, higher-detail **VW up!** model (licensing) or keep the CC0 Kenney hatchback with its roundel/up! decals (D29).
- [ ] Build `js/car3d.bundle.js` before release (`npm run build:car3d`) and commit it; verify the 2D fallback on a browser with WebGL disabled.
- [ ] Add more pictures and check the whole picture is visible (fit, not cropped).
- [ ] If Magic Car feels too busy on the panel, lower traffic density (`spawnIn`) before removing the dog or verge friends.
- [ ] Confirm the 1.2 s "Well done!" card leaves enough time to notice the reward.
- [ ] If matching is hard, use Very large (one pair) and High reward sensitivity.
- [ ] Watch whether the child notices the constellation and album, or only the targets.
- [ ] Consider a light/dark option only if the night palette proves unsuitable.

## Unverified / blocked
- OS folder picker on the target PC (needs the machine).
- IndexedDB persistence across profile/launcher changes (use the same launcher).
- Target-hardware palm / multi-touch limits; low-end GPU cost of the 3D scene (bloom/shadows) and the 2D grain/glow pass.
- Maths check and the tray without Menu were verified on the S23+; Three Goats has not been played with the child on the panel.
- The ad hoc LAN server and Cloudflare tunnel were only smoke-checked with HTTP 200, never used in a real session.

## Reference
- Parent guide: `README.md` (§3 for the grown-up check and tray, §4 for the games).
- Game work: `GAME_GUIDE.md`.
- Reference images: `sprites/README.md` (not app assets).
- Developer smoke tests: `tools\run-smoke-tests.ps1`.
