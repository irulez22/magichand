# 3D models — Kenney Car Kit (CC0)

These GLB models are from **Kenney's Car Kit**, released under
**Creative Commons Zero (CC0 1.0)**. They are embedded into
`js/car3d.bundle.js` by the build, so the app still runs from `file://`.

- Source: https://kenney.nl/assets/car-kit
- Mirror used for the download: https://github.com/Arslan12216775/kenney_car-kit
- License: `License.txt` in this folder.
- Files: `hatchback-sports.glb` (player, recoloured to red at runtime),
  `van.glb`, `sedan.glb`, `suv.glb` (traffic).
- `colormap.png` is the shared palette texture (also embedded in the GLBs);
  it is kept here for reference.

No model is modified on disk; the player's green paint is hue-shifted to red
in `src/car3d/main.js` when the texture is loaded.
