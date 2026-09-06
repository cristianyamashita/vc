# Story Studio — document format

Everything in this app is a JSON document: the characters, the objects, the
sets and the stories. The library that ships with the app is made of the same
files an import produces, so anything you can watch you can also export, edit
in a text editor and bring back.

There is no server. Your documents live in the browser, in the
`StoryStudioDB` IndexedDB database, and are included in the collection's
[backup tool](../../utils/backup.html).

## The five kinds

```
character   a person: body plan, height, build, colouring, wardrobe
prop        an object: a chair, a house, a tree
set         a place: ground, sky, light, and props placed in it
story       a set, a cast, and a timeline of actions
bundle      several of the above in one file
```

Every document starts the same way:

```json
{ "kind": "story", "version": 1, "id": "pool-afternoon",
  "name": { "en": "…", "pt": "…", "ja": "…" } }
```

`id` is what other documents refer to. **Importing a document with the same
`id` as a shipped one replaces it everywhere** — import your own `ana` and
every official story that casts Ana now casts yours, with no story edited.

`name` may be a plain string instead of an object if you only have one
language.

## `character`

```json
{
  "kind": "character", "version": 1, "id": "ana",
  "name": { "en": "Ana", "pt": "Ana", "ja": "アナ" },
  "base": "woman",
  "height": 1.68,
  "build": 0.45,
  "look": { "hair": "#3b2418", "skin": "#d6b28e", "eyeScale": 1.05, "beard": false },
  "regions": { "belly": [1.10, 1.00, 1.15], "head": 1.02 },
  "wardrobe": [
    { "id": "casual", "outfit": "shortsTee", "color": "#c62828" },
    { "id": "work",   "outfit": { "legs": "trousers", "top": "blazer",
                                  "sleeve": "long", "feet": "dress" },
      "color": "#2b4c7e" }
  ],
  "defaultOutfit": "casual"
}
```

| field | meaning |
|---|---|
| `base` | `man`, `woman` or `child` — the body plan the anatomy is drawn from |
| `height` | metres, 0.2 to 3.0. Everything else scales from it |
| `build` | 0 slim to 1 heavy. Widens the trunk far more than the limbs |
| `regions` | per-region sculpt, `[x, y, z]` or one number, each 0.5 to 2.0 |
| `wardrobe` | the outfits this character owns, each with its own id |

Regions: `head` `hair` `eyes` `torso` `belly` `arms` `hands` `legs` `feet`.

An outfit is a preset name or a cut written out longhand:

* `legs`: `trousers` `shorts` `briefs` `bare`
* `top`: `shirt` `tee` `jacket` `dress` `bikini` `bare`
* `sleeve`: `long` `short` `upper` `none`
* `feet`: `shoe` `sneaker` `boot` `dress` `flat` `bare`
* flags: `belt` `tie` `cap` `skirt` `straps`

Presets: `casual` `shortsTee` `suit` `dress` `shirt` `swim` `swimsuit`
`overalls` `pyjamas`.

## `prop`

```json
{
  "kind": "prop", "version": 1, "id": "chair", "name": { "en": "Chair" },
  "source": { "type": "boxes", "boxes": [
    { "w": 0.46, "h": 0.06, "d": 0.46, "x": 0, "y": 0.47, "z": 0, "color": "#b07a45", "n": 2 }
  ]},
  "footprint": [0.5, 0.5],
  "anchors": { "seat": { "pos": [0.02, 0.50, 0], "yaw": 0 } }
}
```

Three ways to supply the shape:

* `{"type": "boxes", "boxes": [...]}` — built from boxes written in the
  document. **This is the one you can author by pasting text**, with no file
  to host. A box takes `w h d x y z color`, and optionally `rx ry rz`
  (radians), `n` (face subdivision, 1–4), `grain`, `flat`, `detail`.
* `{"type": "gltf", "file": "models/chair.glb"}` — a `.glb` shipped with the
  app.
* `{"type": "gltfBlob", "blobId": "…"}` — a `.glb` you uploaded, kept in your
  browser. Made for you by the **Upload a .glb model** button.

**Anchors are how an actor uses a prop.** `sit on chair1` finds that
placement's `seat` anchor and puts the actor's hips exactly there, facing the
anchor's `yaw`; `lie on lounger1` uses a `lie` anchor the same way. A prop
with no anchor can be looked at but not used.

`scale` and `yaw` on a prop correct the *model* — a chair exported ten times
life size, or facing the wrong way. Anchors are written in the corrected
space, so they are unaffected by them.

## `set`

```json
{
  "kind": "set", "version": 1, "id": "backyard", "name": { "en": "Backyard" },
  "ground": { "size": [46, 46], "color": "#6d8f4a" },
  "sky": "day",
  "light": { "sun": [-0.4, 0.9, 0.35], "intensity": 1.0 },
  "props": [
    { "id": "house", "prop": "house-small", "at": [-9, 0, 0], "yaw": 0 },
    { "id": "fence.north", "prop": "fence", "at": [-9, 0, -10], "yaw": 90,
      "repeat": { "count": 10, "step": [1.9, 0, 0] } }
  ]
}
```

`sky` is `day`, `dawn`, `dusk` or `night`. Each placement needs its own `id`:
that is what a story removes, repaints, or sits somebody on. A `repeat`
placement makes `fence.north.0` … `fence.north.9`, and removing
`fence.north` removes all of them at once.

## `story`

```json
{
  "kind": "story", "version": 1, "id": "pool-afternoon",
  "name": { "en": "An afternoon by the pool" },
  "set": "backyard",
  "camera": { "at": [7.5, 3.1, 7.0], "look": [-0.5, 1.1, 3.0], "fov": 44 },
  "setEdits": [
    { "op": "add", "prop": "chair", "id": "poolchair", "at": [1.2, 0, 3.4], "yaw": 180 },
    { "op": "remove", "id": "fence.east" },
    { "op": "tint", "id": "house", "color": "#c8b8a0" }
  ],
  "cast": [
    { "id": "ana", "character": "ana", "outfit": "swim", "at": [-4.5, 0, 5.5], "yaw": 0 }
  ],
  "timeline": [
    { "actor": "ana", "do": "walkTo", "to": [1.2, 0, 3.4], "cue": "arrived" },
    { "actor": "ana", "do": "sit", "on": "poolchair" },
    { "t": 0.4, "actor": "leo", "do": "say", "text": { "en": "Hello." } },
    { "after": "arrived", "do": "cameraTo", "at": [5.2, 2.2, 5.6], "look": "ana", "for": 2.6 }
  ]
}
```

### When things happen

Each timeline entry starts in one of three ways, and this is the part worth
reading twice:

1. **`t`** — an absolute time in seconds.
2. **`after`** — when the entry carrying that `cue` finishes.
3. **neither** — when the previous entry *for the same actor* finishes.

The third is the default because it is what you almost always mean: each
actor's entries read as their own sequential line, and `t` / `cue` / `after`
are for syncing between actors. `for` overrides an action's natural length.

`t` is the only spelling of a start time. `at` always means a position.

Positions are `[x, y, z]`, or `[x, z]` when the y is 0. `yaw` is in degrees.

### Actions

| group | actions |
|---|---|
| moving | `walkTo` `runTo` `crawlTo` `swimTo` `turnTo` |
| posture | `stand` `idle` `sit` `kneel` `crouch` `lie` |
| gesture | `wave` `point` `raiseArm` `nod` `shakeHead` `jump` |
| exercise | `jumpingJacks` `squats` `pushups` `situps` |
| speech | `say` `think` |
| waiting | `wait` |
| camera | `cameraTo` `cut` `cameraFollow` |
| stage | `propShow` `propHide` `propMove` `setTime` |

Useful fields: `to` (destination) and optional `via` (waypoints) on moves,
`speed` in m/s, `on` (a placement id) for `sit` and `lie`, `face: "up"` or
`"down"` for `lie`, `reps` for exercises, `side: "left"` or `"right"` for
one-armed gestures, `text` for speech, and `at` / `look` / `for` for the
camera. `look` takes a point **or an actor id**, which is usually what you
want.

**Postures stick.** Once an actor sits it stays sitting until told otherwise.
Gestures and exercises play and hand the body back to whatever posture was
underneath, so an actor can wave while seated.

**`walkTo` goes in a straight line.** It does not route around anything. Use
`via` to steer it:

```json
{ "actor": "ana", "do": "walkTo", "to": [3, 0, 2], "via": [[-2, 0, 4.6]] }
```

## `bundle`

```json
{ "kind": "bundle", "version": 1, "documents": [ … ] }
```

A story that uses characters or objects of your own has to travel with them.
**Export with everything it uses** writes the bundle for you; importing one
brings in every document at once.

## Sharing your own work

Export writes a file; import takes a pasted document, a dropped `.json`, or an
uploaded `.glb`. Imported documents are validated field by field, and the
errors name the field — `cast[1].outfit: unknown outfit "swin"` — because the
loop is paste, run, read the error, fix.

## Adding to the shipped library

Drop the file in `data/characters/`, `data/props/`, `data/sets/` or
`data/stories/` and add its filename to `data/index.json`.
