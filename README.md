# vc
Collection of different scripts and applications.

Space Invaders 3D (card #122, `page/game/space-invaders-3d/`) is a Three.js remake
of the arcade classic with voxel invaders, destructible shields, a bonus UFO,
particle/debris/shockwave explosions with bloom, and recorded CC0 sound effects
(Kenney Sci-Fi Sounds, see its `audio/CREDITS.md`). Best scores are kept per
difficulty in `vc.space-invaders-3d.v1`.

Eleven new self-contained 3D pages are registered as collection cards #111–#121:
Pinball, Bowling, Bridge Builder, Warehouse Robot, Submarine Explorer, Billiards,
Model Inspector, Terrain Generator, Mechanism Lab, Molecule Builder and Folding
Lab. Each has EN/PT/JA, light/dark themes, an in-page help dialog, a 44px toolbar
and a scene that fills the desktop shell's 960×640 window. Settings live in a
closed-by-default drawer; the main interactions work on the scene itself:

| Page | Direct interaction |
| --- | --- |
| Pinball | Hold/release to launch; mouse halves or A/D control the flippers |
| Bowling | Mouse aim and drag/release power; A/D position, Q/E spin |
| Bridge Builder | Drag between joints; select/Delete members; Space tests |
| Warehouse Robot | Camera-relative WASD; click-to-move routes; Space magnet |
| Submarine Explorer | WASD and Q/E; click destinations/specimens; following camera |
| Billiards | Mouse aim, pull/release cue; keyboard charge and spin |
| Model Inspector | File drop, part selection, drag separation, Shift-drag section |
| Terrain Generator | Brush directly on terrain; 1/2/3 tools; stroke undo |
| Mechanism Lab | Drag gears, crank, slider or pendulum with physical torque |
| Molecule Builder | Pull atoms, Shift-drag bonds, double-click to add atoms |
| Folding Lab | Drag paper to fold; draw creases on the sheet; edit undo |

Right-drag orbits and the mouse wheel zooms. The camera tool also enables
one-finger/left-drag orbiting. F frames the scene, P pauses and Escape cancels.
Construction edits support Ctrl/Cmd+Z. All gesture help is translated in-page.

Serve the repository over HTTP. Three.js 0.164.1 and cannon-es 0.20.0 are pinned
CDN imports; the pages show a loading failure message if rendering cannot start.
Rigid-body games use 120 Hz steps. The other pages use explicit educational
models: axial bridge springs, conservative heightfield erosion, torsional gear
constraints, normalized molecular mechanics and rigid-panel paper hinges. Their
help dialogs describe model assumptions. These are interactive simulations,
not calibrated structural, chemical or fluid analysis tools. Folding supports
non-crossing creases and does not model paper self-collision.

`vc.3d.<page-slug>.v1` localStorage keys hold preferences, records and saved
designs. Model Inspector can additionally keep source model buffers/textures in
`VC3DModelsDB` (version 1, `models`, key path `id`). Both storage types participate
in Backup & Restore. Inspector project JSON stores display settings; original
model files are retained separately in IndexedDB when **Keep model locally** is
selected. Terrain exports OBJ and the existing `plannerTerrain` version 1 format.

For browser, layout, localization, persistence and physics regression checks,
start `python3 -m http.server 8781 --bind 127.0.0.1`, then run
`NODE_PATH=<directory containing playwright> node scripts/tests/three_d_collection.mjs`.
Point `VC_3D_URL` at the page directory (for example `http://localhost:8000`);
`VC_3D_SCREENSHOTS` optionally captures each page. Also run
`scripts/tests/three_d_interactions.mjs` with the same Node/Playwright setup to
check native mouse gestures, keyboard controls, undo, model file drops, camera
movement and mobile layout while the settings drawer stays closed. Both suites
use isolated headless Chrome contexts.

[Open the Collection](https://cristianyamashita.github.io/vc/page/index.html)

The Environment Planner lives in `page/utils/environment_planner.html`: a
single-file 3D editor with Plan, Terrain and Furniture tabs. Serve the repository
over HTTP to load its JSON presets and CDN modules. Measurements are stored in
metres; the interface can display metres or centimetres.

Object cards show thumbnails rendered from their actual procedural geometry by
one shared offscreen renderer. The Architecture catalog contains eight door and
window models, straight, L-shaped (90°), U-shaped (180°) and spiral stairs, and a ramp. Select a room or independent wall
before clicking a door/window preset to insert a real opening in that wall.

The sidebar's storey selector and ≡ dialog manage basements, upper floors and
attics. Each storey has an absolute floor elevation, ceiling height and slab
thickness. Changing its elevation moves its elements; Stack storeys places the
upper slab directly above the lower storey's ceiling. Rooms, walls and furniture
keep a `floorId`; linked stairs/ramps update their rise and open passages through
intervening slabs. Slab openings remain editable, and a basement's foundation can
be excavated into the terrain. The + toolbar menu adds independent walls, stairs
and ramps. The visible Samples button opens a gallery of all existing house and
plan presets, with complete houses first; narrow layouts place it above the
sidebar controls. Choosing a preset uses the existing replacement confirmation,
and loading from this gallery opens a framed 3D view. The Plans catalog also
includes 12 complete house samples: one, two
and three above-ground storeys, each with four combinations of basement and
attic, split evenly between flat and hillside sites. Samples include furnished
rooms, linked stair flights, an entrance staircase or ramp, an editable gable
roof and an authored terrain grid with prepared foundations. Hillside basements
have a downhill courtyard and a sliding exterior door. Sample roofs become
translucent in Cutaway, and all storeys are shown when a sample loads.

Presets live in `page/assets/environment-planner/`, indexed by `manifest.json`.
Its procedural objects and six environments reuse the non-character JSON catalog
from Cristian's story-studio project. No character assets or external model or
texture files are included. Objects retain story-studio's `prop` version 1 format;
environments use `set` version 1. Part rotations are radians, while placement
angles are degrees (YXZ: roll about X, yaw about Y, pitch about Z).

JSON exchange supports these formats:

- `environmentPlannerProject`, version 1, `units: "m"`: self-contained rooms,
  walls, storeys, terrain height grid and placed objects with inline prop documents.
  This format preserves editable plan and terrain data.
- `plannerTerrain`, version 1, `units: "m"`: width/depth, seed, profile, relief,
  grid resolution and `(resolution + 1)²` heights, ordered by Z row then X column.
- `plannerPlan`, version 1, `units: "m"`: storeys, rooms, walls and object placements
  referencing catalog prop IDs. Exported plans include their prop definitions in
  `documents`, so a custom plan can be reused on another terrain without missing
  furniture. Applying a plan prepares its foundations on the current terrain,
  preserving relative storey elevations and excavating any basement below them.
  Complete samples additionally carry an optional `terrain` field; applying one
  restores its authored site together with the building instead of adapting it
  to the current terrain. The confirmation dialog distinguishes these operations.
  Project JSON preserves the building and site together; exporting a reusable
  plan keeps it independent of the terrain.
- story-studio `prop`, `set` or `bundle`, version 1: procedural objects only.
  A bundle includes the referenced props and the set. Character documents are
  ignored on import and never exported.

The story-studio export packages all required geometry in a bundle. Terrain is
baked into solid grid columns (up to 48×48); negative elevations are shifted
up together with the plan to clear story-studio's flat ground. Native project
JSON retains the original smooth heightfield. Material IDs are preserved, with
flat-colour previews in this editor.

The optional `floors` array is backwards compatible with existing version 1
projects: an older project becomes one storey without moving its geometry.
Rooms keep `floorThickness`, rectangular `floorHoles` and modeled `openings`;
independent walls also keep `openings`. Parametric object definitions use
`plannerConnector` for stair/ramp dimensions, railings and their destination
storey. Native JSON keeps this metadata, while story-studio exports the resulting
geometry as ordinary props, including slab openings and all door/window models.
Stair connectors keep a backwards-compatible `layout` (`straight`, `l`, `u`,
`spiral`); omitted layouts mean straight stairs. L/U stairs add a landing, turn
direction and, for U stairs, a gap between flights. Spiral stairs use diameter
and turns. Flight length excludes the landing. The inspector displays the
footprint and riser height in m/cm. A shared layout defines procedural geometry,
slab openings and walking heights, including multiple turns of a spiral.
Regenerating geometry preserves part colours. Complete house samples use L/U
stairs between storeys and spiral stairs for their attics. Native JSON preserves
these parameters; Story exports contain the full geometry without editor metadata.

Created projects and reusable furniture/terrain live in `EnvironmentPlannerDB`
version 1, stores `projects` and `assets`, both keyed by `id`. Preferences use
`environmentPlanner.prefs.v1` in localStorage. Both are included by the collection's
Backup utility. Use File → Export project JSON for a portable editable copy, or
File → Export environment for story-studio for its library importer.

In Walk, click a visible floor to walk there, a door to open or close it, or a
stair/ramp to traverse it to the other storey. An adaptive navigation grid searches
around furniture, walls and slab openings, connected by parametric stair paths.
All storeys are rendered in Walk even when the drawing view isolates one floor.
Clicking stairs chooses ascent from below and descent from above; arrival changes
the active storey. A free starting position avoids spawning inside furniture.

A ring marks the destination. Doors on a planned route open as the walker approaches.
Matching doorways on shared room walls open together. Door states use the existing
opening angle field and are saved in project JSON and IndexedDB, with undo support.
Standalone door objects regenerate their geometry while preserving part colours.
Story exports bake the resulting geometry and omit internal picking metadata.

Dragging changes the view, and another click replaces the destination. WASD/arrows,
leaving Walk, editing the project or losing window focus cancel automatic travel.
Navigation grids, routes and destination markers add no browser-storage keys.
