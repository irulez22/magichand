# Magic Hand Play

A calm, colourful touchscreen play activity for a child aged 3–4 who has limited movement and control of the left arm and hand. The right side of the screen is a big round **hold button**: while it is held, the play side wakes up. Letting go fades the play side gently to black and nothing is lost — there are no failure messages, timers or scores.

The whole activity is staged as a warm, lamplit room at night: deep plum shadows, brass and amber light, and games that glow softly in the dark. The look exists to keep the screen calm and easy to read, not to add excitement.

**This is a play activity, not a treatment.** It is not medical advice and does not measure strength, recovery or progress. The settings exist so a parent or occupational therapist can decide what is appropriate.

---

## 1. Run it on Windows

No installation, no account, no internet connection needed after copying the folder.

1. Copy the whole `MagicHand` folder to the touchscreen PC (for example `C:\MagicHand`).
2. Double-click **`Launch-Kiosk.cmd`** for full-screen play.
   - It starts Microsoft Edge in kiosk mode with a dedicated profile, so extensions and toolbars stay out of the way.
   - Press **Alt + F4** to leave kiosk mode.
3. Or double-click **`Launch-Browser.cmd`** / **`index.html`** to run in a normal window (handy while testing with a mouse).

Tested with Microsoft Edge 140+ and Chrome on Windows 11. Any current Chromium-based browser will do.

> The kiosk profile lives in `%LOCALAPPDATA%\MagicHand\kiosk-profile`. Settings and recorded metrics are stored per browser profile, so use the same launcher each time to keep them.

---

## 2. First run (about two minutes)

On first launch a short calibration opens automatically:

1. **Test the hold button** — rest a hand anywhere on the big round button. It lights up.
2. **Test the play side** — touch the other side. A ring follows the contact.
3. **Both at once** — hold the button and touch the play side at the same time. This proves the screen reports two contacts.
4. **Comfortable reach** — the child touches 3–4 natural spots; the play area is fitted around them (minimum 46 % × 52 % of the screen).
5. **Targets and feel** — pick target size, touch mode and sound.
6. **Save.**

Every step can be skipped and changed later. Nothing is forced, and the child is never asked to hold a position for long.

If the touchscreen does not report palms or two fingers, calibration says so, and the dashboard suggests the workarounds (very large targets, "reward from any touch", or playing without the hold button). Software cannot override the touch panel's own limits.

---

## 3. Opening the parent dashboard

Tap the small lock in the top-right corner and solve a short maths question. The question is quick for an adult and not something a small child can stumble through. **Ctrl + Shift + P** is the keyboard shortcut.

The bar at the bottom of the play screen switches games instantly and has no settings button, so the child can change scenes but cannot reach the parent settings.

Tabs: **Play**, **Accessibility**, **Calibration**, **Touch test**, **Progress**, **Help**.

Close it with **Back to play**, **Start playing**, or **Esc**.

---

## 4. The games

| Game | What happens |
| --- | --- |
| **Magic Balloons** | Huge floating balloons. Any contact pops one into confetti and stars, with a cheerful pop. |
| **Magic Garden** | Every successful touch blooms a flower. Butterflies, a bunny, a bird and a snail appear as the garden fills. |
| **Picture Pairs** | Your own pictures drift across both halves. Hold the same picture on both sides at once to catch it. |
| **Reach for the Stars** | Glowing stars appear only inside the reach you set. Touch one to collect it. No time limit. |
| **Magic Painting** | A contact makes a large colourful splash; moving leaves a colour trail; holding still in "Still" animation mode grows animated mandalas. |
| **Three Goats** | A gentle Bukkene Bruse scene. The next goat trip-traps to the bridge; the troll asks "Hvem er det som tramper på min bru?"; a touch lets the goat answer, and the troll waves it on. All three goats cross, the herd returns, and the night begins again. |
| **Magic Car** | Hold the **gas pedal** on the right; steer with the other hand along a moonlit road in a little red **VW up!**. Bump cars, vans, hay bales and roadside trees for sparks, a speed boost and a new star in the sky. Six stars complete a sky picture. |

The bar at the bottom switches games instantly: tap an icon and the scene changes without leaving the play screen. It has no settings button.

### Magic Car: the gas pedal and the crash constellation

The hold side shows a brass-hinged **gas pedal** for this scene, and the car is a red **VW up!** seen from behind. Release the pedal and the car coasts to a stop while the play side stays lit — the pedal only sets speed, it does not switch the room off. Hold again and it pulls away. Moving the play-side hand from one side of the play area to the other steers across the road. With **Require the hold button** off (mouse fallback), the car drives by itself and the mouse steers.

Bumping is the fun, not a failure. Hitting another car, a van, a hay bale or a roadside tree bursts it into sparks, leaves or straw, makes the car wobble and gives a short speed boost. A touch directly on one of them bumps it too. Each bump lights one star in the night sky; six complete a constellation, a shooting star crosses, then it fades and the drive begins again. There is no damage, no score and nothing to lose.

The road is a moonlit country lane rather than a wall of streetlights: a few warm lamps, a distant village, a barn, a turning windmill, textured fields and the car's two headlight beams picking out the tarmac.

The road is alive: a dog rides in the back window (ears flapping with speed, bouncing with each bump), and small animals wave from the verge and cheer when something bursts. The star you earn flies from the impact up into the sky, so the cause and the reward are easy to follow. Each completed constellation is a different picture, so the sixth bump keeps its surprise. A touch that does not land on anything honks the horn and flashes the headlights — never a miss.

The pedal is the same control as the lamp in the other scenes; only its appearance changes here.

There is no crash. Touching another car or a roadside tree makes the car wobble, slows it briefly and tumbles the obstacle off the road. Fireflies light the six lanterns above the road; when the garland is full it glows, holds, then fades and the drive begins again. Nothing is counted or scored.

Picture Pairs uses whatever photos or drawings you put in its folder (see section 8). Until you choose pictures, it uses friendly built-in doodles.

### Picture Pairs: choosing pictures

1. Open the parent dashboard → **Pictures**.
2. Press **Choose pictures folder** and pick a folder of JPG/PNG photos or drawings.
3. Pictures are copied into this browser (downscaled to 512 px, stored in IndexedDB). Nothing is uploaded.
4. **Clear pictures** removes them and returns to the built-in doodles.

In the game each picture appears twice — once on the left half, once on the right half — and drifts slowly. A picture is never shown in two pairs at once, so the copy to match is never ambiguous. The child catches it by holding one copy with each hand at the same time, for about 0.3–0.55 s depending on reward sensitivity. Holding two different pictures does nothing. The lamp/switch is not used in this scene, so both halves are active at once.

### How touches become rewards

- **New touch** (default): each fresh contact gives one reward. Sweeping the hand further than a short threshold (≈9 % of the play area at High sensitivity) gives another, so a swipe works too.
- **Continuous**: while the hand stays on the play side, a reward arrives every 0.34–0.78 s depending on reward sensitivity.
- **Dwell**: hold still for the configured time (0.25–3 s). A ring around the contact shows the wait.

"Reward from any touch" (on by default) makes the nearest target respond even if the contact is not exactly on it. Together with large targets this means one contact always produces a visible and audible reward.

### The hold button, pause and the lamp

- While a contact is inside the hold area, the play side is lit and that contact can never count as a play-side touch, even if the hand drifts across the middle.
- Letting go keeps the game running for the **pause delay** (default 1.2 s), then fades the play side gently to black, as if the lamp went out. Holding again brings it straight back. There is no failure message.
- The hold requirement can be turned off entirely in **Accessibility → Require the hold button**.
- The hold button can be drawn as a **big round button** (default) or a **hand rest**, and the whole layout can be **swapped** left/right. In **Magic Car** it is drawn as a **gas pedal** instead; it is the same control, but there it only sets speed — letting go coasts the car and leaves the scene lit.

---

## 5. Settings worth knowing

**Accessibility tab**

- Target size: Very large / Large / Medium (balloons reach ~40 % of the play area's short side at "Very large").
- Play area: width, height, distance from the edge, vertical position, plus a live preview.
- Swap sides: put the play area on the other half (the button moves too).
- Touch activation: New touch / Continuous / Dwell, and dwell time.
- Reward sensitivity: Low / Medium / High — changes hit radius and how quickly continuous rewards arrive.
- Reward from any touch: on/off.
- Star reach: 1 (closest to the button) to 5 (furthest across) — **only the parent moves this**. The game never increases reach automatically.
- Animation speed: Still / Slow / Normal (background motion; reward animations stay short).
- Visual stimulation: Calm / Standard (Calm = softer colours, fewer particles, fewer butterflies).
- Sound: Off / Quiet / Normal, plus a test button.
- On-screen words: show/hide the small "Hold" label.

**Play tab** — game selection and session length (2 / 5 / 10 min / Unlimited). No countdown is shown; at the end the game slows down and shows "Well done!", then returns to the ready screen about a second after hands are lifted.

**Progress tab** — local interaction metrics: sessions, active play time, rewards, contacts, longest sustained contact, rough hand-travel distance and a heat map of contact positions.

> These are interaction counts only. They are **not** measures of strength, motor recovery or therapeutic progress, and they are not medical advice. Nothing is uploaded and no names, ages or photos are recorded.

**Touch test tab** — a live panel showing every contact the browser receives, with type and reported size. Use it to check whether this specific screen reports a palm, a knuckle, and two contacts at once. Record the result there; the app remembers the maximum number of simultaneous contacts it has seen.

---

## 6. Testing on the real touchscreen

1. Open **Touch test**. Put one finger on the panel → one dot.
2. Put the whole hand flat → a dot should appear. If it does not, the panel rejects palm-sized contacts.
3. Try a knuckle and the side of the hand.
4. Hold the button with one hand and touch the play side with the other → **two dots at the same time**.
5. Open a game, hold the button, then touch the play side once. You should get a reward from that single contact.
6. Release the button → the play side fades to black (light off), and holding again brings the game back.
7. Tap the top-right lock, solve the maths question → the dashboard should open. **Cancel** must return to play.

Known hardware limits (not fixable in software):

- Windows touch drivers may reject palm contacts, report them as a mouse, or cap simultaneous touches.
- Edge/Chrome receive only what Windows reports; `pointerType` and contact width are often approximate.
- Very old PCAP panels may not report a second contact while the first is held.

Workarounds: very large targets, "Reward from any touch", dwell activation, or playing without the hold button.

---

## 7. Mouse fallback

A mouse is a single pointer, so it cannot hold the button and play at the same time. For desk testing, turn **Require the hold button** off in Accessibility — then any click on the play side counts. Everything else works identically, so this is a quick way to try every game.

---

## 8. On a phone or tablet (preview)

The app works in a mobile browser, but a phone is a preview: the layout is made for a large landscape touchscreen. Rotate the phone to landscape.

**Android cannot open a downloaded HTML file directly.** Tapping `index.html` opens a `content://media/...` URI, which Chrome refuses to render (blank page). Use a small local server instead — it also makes settings persist, because `localStorage` works over `http://`.

1. Extract `MagicHand.zip` so you have `Download/MagicHand/index.html`.
2. In Termux (once): `termux-setup-storage`, then allow access.
3. Then:
   ```sh
   cd ~/storage/downloads/MagicHand
   busybox httpd -f -p 8080
   ```
4. Open `http://localhost:8080` in Chrome. Add to the home screen if you like.
5. Stop the server with Ctrl+C in Termux.

If the folder is elsewhere, `cd` to it instead. `python -m http.server 8080` works the same if Python is installed.

On a phone, either turn **Require the hold button** off (one finger can play) or use two fingers for hold + play.

---

## 9. Practical notes

- **No scrolling or zooming during play:** `touch-action: none`, no `click` handlers for gameplay, context menus and text selection are suppressed. Browsers may still allow edge-swipe gestures in windowed mode; kiosk mode removes them.
- **Lost contacts:** pointer cancellation, window blur and tab changes clear all tracked contacts, so the lamp cannot get stuck on.
- **Screen sleep:** the app asks for a screen wake lock while a session runs (where the browser supports it).
- **Fullscreen:** the dashboard's Fullscreen button uses the browser API; the kiosk launcher is more reliable.
- **Reset:** "Reset all settings" in Accessibility restores defaults. "Delete recorded metrics" in Progress clears only the metrics.
- **Data location:** browser local storage for this page (per profile). Clearing browser data removes settings and metrics.

---

## 10. Project layout
```
index.html            page shell + script order
styles.css            dashboard styling (night-lamp design system)
icon.svg              app icon, drawn as vector (no binary assets)
manifest.webmanifest  installable-app metadata (only linked over http(s))
js/util.js            helpers, colour, storage
js/theme.js           shared visual language: palette, grain, panels, cards
js/icons.js           shared game / action icons (inline SVG)
js/audio.js           synthesised WebAudio sounds (no audio files)
js/settings.js        settings model + local interaction metrics
js/zones.js           play / hold layout maths
js/input.js           Pointer Events multi-touch source (Map of pointers)
js/fx.js              capped particle / ring effects
js/games/base.js      shared game base
js/games/balloons.js  Magic Balloons
js/games/garden.js    Magic Garden
js/games/stars.js     Reach for the Stars
js/games/painting.js  Magic Painting
js/pictures.js        local picture folder (IndexedDB)
js/games/photos.js     Picture Pairs
js/games/goats.js      Three Goats
js/games/car.js        Magic Car
js/games/registry.js   game factory + titles (the bottom tray uses them)
js/ui.js              parent / therapist dashboard
js/calibration.js     guided calibration
js/tray.js            bottom scene switcher (no settings entry)
js/app.js             shell: lamp, sessions, pointer routing, rendering

GAME_GUIDE.md         developer map for adding or changing games
```

No build step, no dependencies, no network calls. All graphics are drawn with Canvas 2D and all sound is synthesised at runtime.

---

## 11. Quick troubleshooting

- **No sound:** click/touch once anywhere (browsers require a gesture), then check the Sound setting and the Windows volume mixer per-app level.
- **Dashboard will not open:** tap the lock again, or use Ctrl + Shift + P.
- **Layout looks odd after changing monitors:** the layout recalculates on resize; re-run calibration or press F5.
- **Game dims immediately:** the button contact is not being reported. Check Touch test; if the panel does not report the hold, turn off the hold requirement.
- **A contact sticks:** lift all hands, click elsewhere, or press F5. Contacts are also cleared when the window loses focus.
- **Settings do not persist:** the launcher must use the same browser profile (use `Launch-Kiosk.cmd`).

---

## 12. Touchscreen PC auto-update

The `pc/` folder sets the PC up as a self-updating kiosk: it clones the public repo over HTTPS into `C:\MagicHand`, installs a desktop shortcut and a launcher that pulls the latest commit before starting. If the PC is offline it launches the local copy; if the new commit is missing files it rolls back; it never updates while the kiosk is open.

See `pc/README.md` for the one-time setup and the update flow.
