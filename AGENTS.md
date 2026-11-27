# Project Instructions

## Before working
- Follow the shared startup contract in G:\Codex\Tools\ProjectStartup.md (rendered by the selector); read AGENTS/index/state/next steps and keep handoff/decisions conditional. Consult architecture only when relevant; do not load every document.

## While working
- Before editing, define the observable outcome, behavior to preserve, focused check and stop condition internally.
- Use the fast verification command in PROJECT_INDEX.md while editing; run its full gate for shared behavior changes at completion. Document missing commands only after verifying them.
- After two substantially identical failures, change hypothesis or method; report a blocker instead of looping.
- Follow existing project conventions.
- Verify changes with appropriate tests.
- Do not claim a test passed unless it was run successfully.

## Before finishing
- Update CURRENT_STATE.md when meaningful progress occurs.
- Record significant decisions in DECISIONS.md.
- Keep NEXT_STEPS.md actionable and concise.
- Keep long manual/release checklists in VERIFICATION_BACKLOG.md, linked from NEXT_STEPS.md and read only when relevant.
- Prepare SESSION_HANDOFF.md when useful for continuing later.
- Preserve existing information that remains valid.
- Keep CURRENT_STATE.md under about 12 KB and NEXT_STEPS.md under about 6 KB. Keep SESSION_HANDOFF.md to the current and previous session; move older dated sections to `memory/archive/YYYY-MM.md` with `G:\Codex\Tools\Rotate-ProjectMemory.ps1`.
- Never claim work is saved unless the file was actually written.
- Follow G:\Codex\Tools\MemoryCheckpoint.md for revision-checked atomic memory edits, backup, rotation and validation. Do not directly overwrite live memory; reread and merge on conflict.

<!-- caveman-blocks:start -->
BLOCKS. Scripts in this repo are reusable blocks in .blocks/. Rules:
1. Check the block index below first. If a block fits, run it. If one almost fits, add a param to it.
2. A script you would run twice, or over ~10 lines, becomes a block, not a heredoc or a /tmp file.
3. Inputs are params. No hardcoded paths, ids, ports or dates.
4. Print one small JSON object: the answer, not the data. Filter, count and truncate in code.
5. Exit 0 on success, non-zero with {"error": ...} on failure.
6. Safe to re-run: idempotent, no prompts, cleans up after itself.
7. Header first: name, summary, params, effects, example. caveman-blocks lint checks it.
8. Compose: call existing blocks with caveman-blocks run instead of copying their code.
<!-- caveman-blocks:end -->

## Project specifics: Magic Hand Play

A dependency-free, browser-based play activity for a 3–4 year old with limited left-arm movement. It is entertainment plus a parent/therapist-configurable activity, **not a medical device or a measure of recovery**. Keep that framing in every user-facing word.

### Child-facing rules
- No failure state, no score, no countdown, no timer on screen. Releasing the hold button is neutral, never wrong.
- One contact must always be able to produce a visible and audible reward when `anyTouch` is on. Do not add precision requirements.
- No flashing, no sudden loud sounds, no rapid motion. Prefer fades and eases over pops.
- Text on the child surface stays minimal; every word must also be understandable to a parent.
- Rewards are always optional to the child: touching nothing must never punish.

### Interaction rules
- Pointer Events only (`pointerdown/move/up/cancel`). Never use `click` for gameplay. `touch-action: none` on `#scene`.
- Track every contact in `MG.createTouchSource`'s `Map` by `pointerId`. A contact's role (`pad` / `play` / `hold`) is fixed at pointerdown from its screen position, never from pointer type or assumed hand.
- A hold-side contact must never become a play-side activation, even if it drifts across the split.
- The play side is a lamp: holding the round button lights it (`App.light`), releasing fades it to black (`App.dark`). Keep both transitions smooth, never abrupt. Magic Car is the deliberate exception: its pedal is speed only (`keepLit`), so releasing coasts the car to a stop and leaves the scene lit.
- Never increase target distance automatically. `starReach` changes only from the dashboard or calibration.

### Engineering rules
- **Runtime:** no network calls, no identifiers. Everything runs from `file://`; all state is `localStorage`. There is one ahead-of-time build: the 3D Magic Car (`src/car3d` + CC0 GLBs) is bundled into the committed `js/car3d.bundle.js`. Build-only dev dependencies live in `package.json`; the kiosk never needs to build.
- The app shell and six scenes are procedural Canvas 2D; sound is synthesised WebAudio. **Magic Car is the deliberate 3D exception** (Three.js + CC0 Kenney GLBs; D29). Do not add other binary assets or runtime asset fetches without a decision.
- After changing `src/car3d/` or `assets/models/`, run `npm run build:car3d` and commit the regenerated bundle.
- Keep the play/button split in `js/zones.js` and the session state machine in `js/app.js`; games own only their scene.
- Panel layout must survive any window size; `App.resize()` is the single source of geometry.
- Do not weaken accessibility defaults to make a visual nicer.

### Verification
- Fast: `node --check` every `js/**/*.js` file after edits.
- Full gate: `powershell -ExecutionPolicy Bypass -File tools\run-smoke-tests.ps1` (needs Edge and Node 22+; starts its own headless Edge on port 9223 with a fresh profile, runs `tools/smoke-1.mjs` and `tools/smoke-2.mjs`, prints PASS/FAIL and screenshots in `%TEMP%\magichand-smoke`).
- Hardware behaviour (palm, two contacts, simultaneous hold + play) can only be confirmed on the target touchscreen; it is listed in README section 6 and NEXT_STEPS.md.
