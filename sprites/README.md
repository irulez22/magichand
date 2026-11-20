# Reference images (not app assets)

`images.jpg` (book cover) and the `MV5B…jpg` poster are **reference only**. They
are copyrighted artwork and are not loaded by the app, not packaged in the
delivery, and must not be redistributed with the project.

The goats and the troll in `js/games/goats.js` are original procedural Canvas
drawings *inspired by* the story and these stills: big white heads, grey
foreheads, long floppy ears, tall horns and pink muzzles for the goats; a
shaggy, mossy, round troll with a big nose and a flower behind one ear. No pixel
from these files is copied into the app.

If licensed, isolated character images ever arrive:

1. Put them in this folder with clear names and a licence note.
2. Add an image loader to the game (and update `DECISIONS.md` D7, which currently
   forbids binary assets).
3. Keep a procedural fallback for `file://` and for missing files.

Do not crop these covers into sprites: they contain title text, logos and other
characters, and the resolution is too low for the animations the scene needs.
