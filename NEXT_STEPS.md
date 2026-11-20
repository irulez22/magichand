# Next Steps

Keep this list prioritized and actionable.

## Immediate (on the touchscreen PC)
- [ ] Rebuild `MagicHand.zip` from the current folder — the existing zip predates everything since 2026-11-19.
- [ ] Copy the folder (or the new zip) to the PC and double-click `Launch-Kiosk.cmd`.
- [ ] Try the grown-up check: tap the lock, answer the sum, cancel once. Is the question the right difficulty and speed for the parent?
- [ ] Play **Three Goats** with the child: is the troll welcoming, does the plea line land, is the left-arm answer natural, and are two contacts per goat comfortable?
- [ ] Look at the new goat and troll art on the panel; adjust the shapes or colours if they read poorly at the child's distance.
- [ ] Judge the night look: lamp obvious, play window readable, dark calm rather than gloomy. Try Visual: Calm if busy.
- [ ] Check the bottom tray: comfortable to reach, icons readable, and the height it takes does not make the lamp feel small (~78 px at 1440×900).
- [ ] Play each scene long enough to see its loop end: garden reseeds, six stars → new constellation, six photos → new album page, three goats → herd returns.
- [ ] Dashboard → **Pictures** → Choose pictures folder: confirm the OS picker opens and thumbnails appear.
- [ ] Try **Picture Pairs** with the child: matching hold, and that the lane layout still feels playful.
- [ ] Run **Touch test** with real hands (palm, knuckle, two contacts) and recalibrate if needed.

## Upcoming
- [ ] Add more pictures and check the whole picture is visible (fit, not cropped).
- [ ] Confirm the 1.2 s "Well done!" card leaves enough time to notice the reward.
- [ ] If matching is hard, use Very large (one pair) and High reward sensitivity.
- [ ] Watch whether the child notices the constellation and album, or only the targets.
- [ ] Consider a light/dark option only if the night palette proves unsuitable.

## Unverified / blocked
- OS folder picker on the target PC (needs the machine).
- IndexedDB persistence across profile/launcher changes (use the same launcher).
- Target-hardware palm / multi-touch limits, and low-end GPU cost of the grain/glow pass.
- Maths check and the tray without Menu were verified on the S23+; Three Goats has not been played with the child on the panel.
- The ad hoc LAN server and Cloudflare tunnel were only smoke-checked with HTTP 200, never used in a real session.

## Reference
- Parent guide: `README.md` (§3 for the grown-up check and tray, §4 for the games).
- Game work: `GAME_GUIDE.md`.
- Reference images: `sprites/README.md` (not app assets).
- Developer smoke tests: `tools\run-smoke-tests.ps1`.
