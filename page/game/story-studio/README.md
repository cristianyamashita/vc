# Story Studio — document format

Everything in this app is a JSON document: the characters, the objects, the
sets and the stories. The library that ships with the app is made of the same
files an import produces, so anything you can watch you can also export, edit
in a text editor and bring back.

There is no server. Your documents live in the browser, in the
`StoryStudioDB` IndexedDB database, and are included in the collection's
[backup tool](../../utils/backup.html).

## The six kinds

```
character   a person: body plan, height, build, colouring, wardrobe
prop        an object: a chair, a house, a torch you can carry
set         a place: ground, sky, light, and props placed in it
action      a thing a body can do: walk, sit, skip a rope with two friends
story       a set, a cast, and a timeline of actions
bundle      several of the above in one file
```

**Actions are documents too**, so the vocabulary of the app is not fixed: you
can change how a wave looks, or invent an action nobody wrote, and export it
for someone else to use.

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
  "look": {
    "hair": "#3b2418", "skin": "#d6b28e", "eyeScale": 1.05, "beard": false,
    "hairStyle": "long", "hairLength": 0.62
  },
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
| `base` | `man`, `woman`, `boy` or `girl` — the body plan the anatomy is drawn from |
| `height` | metres, 0.2 to 3.0. Everything else scales from it |
| `build` | 0 slim to 1 heavy. Widens the trunk far more than the limbs |
| `regions` | per-region sculpt, `[x, y, z]` or one number, each 0.5 to 2.0 |
| `wardrobe` | the outfits this character owns, each with its own id |

`boy` and `girl` are separate plans rather than one "child": the anatomical
difference at that age is small — a shade narrower across the shoulders, a
shade wider at the hip — but a document should be able to say which it means.
`base: "child"` still works and reads as a boy; write `boy` or `girl` in new
documents.

Regions: `head` `hair` `eyes` `torso` `belly` `arms` `hands` `legs` `feet`.

### Hair

Hair does more than anything else to tell one character from another at this
level of detail, so it has its own two dials inside `look`:

| field | meaning |
|---|---|
| `hairStyle` | one of the styles below |
| `hairLength` | 0 to 1 — how far the loose hair falls. Ignored by styles that have none |

```
bald   buzz   short   crop   bob   long   wavy
ponytail   pigtails   bun   braid   afro
```

Say nothing and women get `long`, girls get `pigtails`, boys get `crop` and
men get `short`, each at a sensible length. So a woman or a girl written with
no `look` at all still comes out with long hair.

`hairLength` runs from roughly chin level at `0` to the waist at `1`. Long
hair deliberately does not count as ground contact: a plait reaching the waist
would otherwise lift a character clean off the floor when they lie down.

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

### Light

A prop can give off light, held or placed:

```json
"light": {
  "color": "#ff9038", "intensity": 6.5, "distance": 11,
  "at": [0, 0.55, 0], "flicker": 0.45, "flickerHz": 7.5
}
```

`at` is the emitter's position in the prop's own space, so a torch lights from
its flame and travels with the hand carrying it. `flicker` is driven from the
**film's own clock**, never from a random number — a fire that danced
differently on each replay would break the one promise the whole engine rests
on.

Six lights can burn at once. They are a fixed pool reassigned each frame to
whichever emitters are nearest the camera, because adding and removing lights
would make every material recompile the moment somebody picked up a torch.

Props that light: `campfire` `torch` `lantern` `flashlight` `floor-lamp`.

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

`sky` is `day`, `dawn`, `dusk`, `night` or `indoor`. `indoor` swaps the sky
for a warm, low-contrast fill and pulls the fog in close, so a room reads as a
room rather than as a lawn with furniture on it. Each placement needs its own
`id`:
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
| holding | `hold` `drop` |
| together | `oddsAndEvens` `shoulderCarry` `skipRope` |
| speech | `say` `think` |
| waiting | `wait` |
| camera | `cameraTo` `cut` `cameraFollow` |
| stage | `propShow` `propHide` `propMove` `setTime` |

That table is the shipped library, not a fixed list: `do` names any action
document, including ones you write.

Useful fields: `to` (destination) and optional `via` (waypoints) on moves,
`speed` in m/s, `on` (a placement id) for `sit` and `lie`, `face: "up"` or
`"down"` for `lie`, `reps` for exercises, `side: "left"` or `"right"` for
one-armed gestures, `text` for speech, and `at` / `look` / `for` for the
camera. `look` takes a point **or an actor id**, which is usually what you
want.

The stage actions address a placement by `id`: `propShow`, `propHide` and
`propMove` all need one, `propMove` also takes `at` and `yaw`, and `setTime`
takes a `sky`.

### Which way an actor faces

**Every actor action takes a direction**, because "sit down facing the
window" and "say this to her" are the normal case, not something that should
need a separate `turnTo` in front of each line. Two spellings:

| field | meaning |
|---|---|
| `yaw` | absolute degrees |
| `facing` | a point `[x, y, z]`, **or an actor id** |

```json
{ "actor": "ana", "do": "sit", "on": "chair1", "facing": "leo" },
{ "actor": "leo", "do": "say", "text": { "en": "…" }, "facing": "ana" },
{ "actor": "elza", "do": "sit", "on": "sofa", "facing": [-0.7, 0, -3.0] }
```

Without one, an actor keeps the direction it already had — except that a
move points it the way it is travelling, and `sit`/`lie` on a prop take the
direction of that prop's anchor. Giving a direction overrides both: a chair
decides where the hips go, you decide where the eyes go.

On a move the turn happens **on arrival**, not across the whole walk, so
nobody strides sideways across the room to end up facing the right way.

`facing: "<actor>"` aims at where that actor stands *at that point in the
script*, reading the timeline in the order it is written. For a target who is
still walking, aim at a fixed point instead, or place the line after theirs.

**Postures stick.** Once an actor sits it stays sitting until told otherwise.
Gestures and exercises play and hand the body back to whatever posture was
underneath, so an actor can wave while seated.

**`walkTo` goes in a straight line.** It does not route around anything. Use
`via` to steer it:

```json
{ "actor": "ana", "do": "walkTo", "to": [3, 0, 2], "via": [[-2, 0, 4.6]] }
```

## `action`

An action is a base pose plus some channels pushing joints around. That is
all any of the shipped ones are, which is why they are data rather than code
— and why importing a story from someone else cannot run anything.

```json
{
  "kind": "action", "version": 1, "id": "wave",
  "name": { "en": "Wave", "pt": "Acenar", "ja": "手を振る" },
  "category": "solo",
  "type": "overlay",
  "pose": "stand",
  "gesture": true,
  "mirrorable": true,
  "duration": 2.2,
  "breathe": 0.6,
  "joints": [
    { "joint": "rArm",  "axis": "x", "amp": 2.15, "wave": "const" },
    { "joint": "rFore", "axis": "x", "offset": 0.35, "amp": 0.45,
      "wave": "sin", "hz": 1.19 }
  ]
}
```

### The channel

```
value = offset + amp * wave(freq * u + phase)
```

`u` is the action's own clock, in **turns**, not radians — `freq: 2` is
plainly two cycles. Which clock depends on the action: `period` counts one
turn per repetition, `rate` counts one per stride (and reads `speed`), and
otherwise one turn spans the whole action. A channel with `hz` instead of
`freq` counts seconds directly, which is how breathing keeps its own pace
while the legs speed up.

| wave | shape |
|---|---|
| `const` | 1 — a plain constant offset |
| `sin` `cos` | the obvious ones |
| `absSin` `absCos` | rectified to positive |
| `posSin` `posCos` | the negative half flattened to zero — a knee folds one way |
| `rise` | out and back once per turn; the shape of a repetition |
| `ramp` | eased 0 to 1, then held |
| `lin` | straight 0 to 1, then held |
| `saw` | 0 to 1 and snap back |

`from` and `to` make a channel piecewise: it applies only across that slice of
the action, with its own clock stretched to fill it. A jump is one document
holding a crouch, an arc and a landing that way.

A `root` channel drives the body as a whole instead of a joint — `field` is
`lift`, `shift` or `tiltZ`.

### The sign trap

A joint's `z` axis swings it toward the character's face. For a limb that
**hangs down** from its joint — a thigh, an upper arm — that means positive is
forward, which is what you expect.

The torso is the exception, and it catches everyone once. `chest` and `neck`
point **up** from their joint, so positive `z` leans them **backward**.
Leaning forward is negative:

```json
{ "joint": "chest", "axis": "z", "amp": -0.26, "wave": "rise" }
```

It is invisible on a standing figure and obvious the moment anyone crawls or
runs, so it is worth checking whenever a pose looks subtly wrong rather than
plainly broken.

### The rest of an action

| field | meaning |
|---|---|
| `type` | `posture` `overlay` `move` `turn` `speech` `wait` `hold` `camera` `stage` |
| `pose` | the base pose: `stand` `sit` `kneel` `crouch` `lieUp` `lieDown` `crawl` `plank` `situpDown` `swim` |
| `duration` / `period` / `reps` | how long it runs; `reps` makes the length a count of periods |
| `gesture` | only claims the joints it names, so it plays over any posture |
| `mirrorable` | `side: "left"` plays it mirrored, so a wave is written once |
| `breathe` | how much idle breathing to lay under it |
| `posture` | which posture a `move` leaves the actor in |
| `anchor` / `seatLift` | which prop anchor a posture uses, and whether it sets or adds the height |

Postures **stick**; overlays play and hand the body back.

## Group actions

`category: "group"` is an action several people do together. It declares
roles, where each stands relative to the group, and a part for each one.

```json
{
  "kind": "action", "version": 1, "id": "skipRope", "category": "group",
  "type": "overlay", "reps": true, "period": 1.0, "defaultReps": 8,
  "roles": [
    { "id": "turnerA", "at": [0, 0, -1.35], "yaw": 90 },
    { "id": "turnerB", "at": [0, 0,  1.35], "yaw": -90 },
    { "id": "jumper",  "at": [0, 0, 0],     "yaw": 0 }
  ],
  "parts": {
    "turnerA": { "pose": "stand", "joints": [ … ] },
    "jumper":  { "pose": "stand", "joints": [ … ], "root": [ … ] }
  },
  "props": [
    { "id": "handleA", "prop": "rope-handle", "role": "turnerA", "hand": "right" },
    { "id": "rope", "prop": "rope-arc", "at": [0, 1.02, 0], "spin": -1, "spinPhase": 0.25 }
  ]
}
```

A story casts the roles instead of naming one actor, and places the whole
formation:

```json
{ "do": "skipRope", "at": [-2.6, 0, -0.95], "yaw": 0, "reps": 7,
  "cast": { "turnerA": "tom", "turnerB": "noa", "jumper": "pip" } }
```

`at` and `yaw` position the **formation**, not any one person — that is what
keeps three people turning the same rope rather than three people each doing
their own idea of it. A role with `optional: true` may be left uncast.

A group `props` entry either goes in a role's hand (`role` + `hand`) or stands
in the group's own space, where `spin` turns it about its long axis and
`spinPhase` offsets that turn. The skipping rope reaches the floor exactly
when the jumper is at the top of their hop because of that offset.

Group actions happen **in one place**. A carry that walks would need one rig
parented to another, which this does not do yet.

## Holding things

A prop with a `grip` anchor can be carried. The anchor is the point the fist
closes around, in the prop's own space; everything else follows from it.

```json
"anchors": { "grip": { "pos": [0, 0.22, 0], "yaw": 0 } }
```

Then in a story:

```json
{ "actor": "leo", "do": "hold", "prop": "torch", "hand": "left" },
{ "actor": "leo", "do": "drop" }
```

A cast entry can start with something already in hand: `"holds": "torch"`.
What an actor carries is sticky, like a posture — they keep it until they put
it down. A group action that puts a prop in a role's hand gives back whatever
was there when it ends.

Holdable props that ship: `torch` `flashlight` `hairdryer` `mug` `book`
`rope-handle` `ball`.

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

## What ships with the app

| sets | |
|---|---|
| `backyard` | a house, a pool, garden furniture |
| `street` | a road between houses, at dusk |
| `forest` | pines around an open clearing |
| `camp` | tents, a fire and logs to sit on |
| `construction` | a slab, wall frames, scaffolding and materials |
| `living-room` | a four-walled interior; remove `wall.south` to film it |
| `abandoned` | bare concrete, open window and door holes, pallets and sacks |
| `studio` | an empty stage, for testing |

Fourteen characters, sixty-six objects and thirty-six actions come with
them. `rig-check` walks one character through every pose in turn, and
`playground` uses the group actions and the held props together — the two
quickest ways to see what the vocabulary actually looks like.

Every action has a **Preview** in the library that performs it on the empty
stage, casting a body per role, so an action you write can be watched before
it goes anywhere near a story.

**Filming an interior.** A room with four walls has no camera angle, so the
living room gives each wall its own placement id and a story removes the one
it shoots through:

```json
"setEdits": [{ "op": "remove", "id": "wall.south" }],
"camera": { "at": [6.4, 2.2, 0.8], "look": [-0.8, 1.0, 0.6], "fov": 44 }
```

Keep tall furniture off that wall as well, or its back fills the shot.

## Adding to the shipped library

Drop the file in `data/characters/`, `data/props/`, `data/sets/` or
`data/stories/` and add its filename to `data/index.json`.
