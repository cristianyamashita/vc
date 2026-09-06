# Story Studio — document format

Everything in this app is a JSON document: the characters, the objects, the
sets and the stories. The library that ships with the app is made of the same
files an import produces, so anything you can watch you can also export, edit
in a text editor and bring back.

There is no server. Your documents live in the browser, in the
`StoryStudioDB` IndexedDB database, and are included in the collection's
[backup tool](../../utils/backup.html).

## Conventions

Everything below assumes these. They are the things that are easy to get
wrong and impossible to guess.

| | |
|---|---|
| **Axes** | A character faces **+X**. Up is **+Y**. Their left and right are **±Z**. |
| **Units** | Distances are metres. `yaw` and a prop's `rx`/`ry`/`rz` are **degrees**; a joint channel's value is **radians**. Time is seconds. |
| **Positions** | `[x, y, z]`, or `[x, z]` when y is 0 — the two-number form is the common case and saves writing a zero. |
| **Colours** | `"#rrggbb"` strings. |
| **Ids** | `[a-zA-Z0-9][a-zA-Z0-9_.-]*`, up to 64 characters. Ids are how documents refer to each other, and an imported document with an existing id **replaces** it everywhere. |
| **Names** | `{ "en": …, "pt": …, "ja": … }`, or a plain string when you only have one language. Missing languages fall back to whichever is present. |
| **Unknown fields** | are dropped, silently. If something has no effect, check the spelling against the tables here. |

Anything out of range is clamped and reported; anything malformed is refused
with the field path that caused it. Nothing is ever executed — an action is
data, not code, so importing a document from a stranger cannot run anything.

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

`build` widens the trunk far more than the limbs, so 0 is slight and 1 is
heavy rather than simply bigger. `height` drives everything else: a plan is
written as fractions of it, so 1.2 m and 1.9 m are the same anatomy at two
sizes.

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

| field | values |
|---|---|
| `legs` | `trousers` `shorts` `briefs` `bare` |
| `top` | `shirt` `tee` `jacket` `dress` `bikini` `bare` |
| `sleeve` | `long` `short` `upper` `none` |
| `feet` | `shoe` `sneaker` `boot` `dress` `flat` `bare` |
| flags | `belt` `tie` `cap` `skirt` `straps` |

Presets, usable by name in place of the object: `casual` `shortsTee` `suit`
`dress` `shirt` `swim` `swimsuit` `overalls` `pyjamas`.

An unknown value in any one field falls back to a sensible default rather
than failing the document, so one typo dresses a leg oddly instead of losing
the character.

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

### What an entry can do

`do` names an **action document** — any of them, including ones you write. The
catalogue below lists every shipped action with the fields each one reads.

The fields an entry may carry:

| field | on | meaning |
|---|---|---|
| `actor` | actor actions | who does it |
| `t` `after` `cue` `for` | any | when it starts and how long it lasts |
| `to` `via` `speed` | moves | where to, by what route, how fast |
| `on` | `sit` `lie` `cycle` `row` `benchPress` | a placement id with the right anchor |
| `face` | `lie` | `"up"` or `"down"` |
| `reps` | repetitive actions | how many |
| `side` | one-armed gestures | `"left"` or `"right"` |
| `text` | `say` `think` | the line, per language |
| `prop` `hand` | `hold` | what to pick up, and in which hand |
| `yaw` `facing` | actor actions | which way to end up pointing |
| `at` `look` `fov` | camera | where from, what at, how wide |
| `id` | `propShow` `propHide` `propMove` | which placement |
| `sky` | `setTime` | the new time of day |
| `cast` | group actions | which actor plays each role |

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
| `pose` | the base pose, from the table below |
| `duration` / `period` / `reps` | how long it runs; `reps` makes the length a count of periods |
| `gesture` | only claims the joints it names, so it plays over any posture |
| `mirrorable` | `side: "left"` plays it mirrored, so a wave is written once |
| `breathe` | how much idle breathing to lay under it |
| `posture` | which posture a `move` leaves the actor in |
| `anchor` / `seatLift` | which prop anchor a posture uses, and whether it sets or adds the height |

Postures **stick**; overlays play and hand the body back.

### The joints

```
hips ── chest ── neck ── head
 │        ├───── lArm ── lFore ── lHand
 │        └───── rArm ── rFore ── rHand
 ├── lThigh ── lShin ── lFoot
 └── rThigh ── rShin ── rFoot
```

All sixteen are writable. A channel names one and an axis: `z` is the
forward/back swing, `x` the sideways swing, `y` the twist.

### The base poses

| pose | what it is | already touching |
|---|---|---|
| `stand` | upright | feet |
| `sit` | thighs forward, shins down | feet (hips go on a seat) |
| `kneel` | shins flat behind, sitting on the heels | shins |
| `crouch` | deep squat, feet flat | feet |
| `lieUp` | supine | back |
| `lieDown` | prone | front |
| `crawl` | hands and knees, torso horizontal | hands, knees |
| `plank` | face down on straight arms | hands, toes |
| `situpDown` | supine with the knees up | back, feet |
| `swim` | prone and floating — the one pose that does **not** touch the floor |

Their heights against the floor are measured, not chosen: a calibration pass
runs forward kinematics over the man, woman, boy and girl plans and sets each
pose so the worst of the four just touches. Change a pose's joints and that
needs redoing, or it will sink or float.

A running clamp catches the rest — a cross-fade between two grounded poses is
not itself grounded, and an imported pose was never calibrated at all — but it
only ever lifts, so a jump still leaves the ground. Hair is excluded from it:
a plait to the waist would otherwise levitate its owner the moment they lay
down.

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

A `props` entry either goes in a hand (`hand`, plus `role` for a group) or
stands in the action's own space — the formation for a group action, the
actor's own footprint for a solo one, measured from their **body** rather
than the ground under it, so a bar authored at chest height stays at chest
height when its owner lies down on a bench.

`spin` turns a prop about its long axis and `spinPhase` offsets that turn: the
skipping rope reaches the floor exactly when the jumper is at the top of their
hop because of that offset. A `motion` list drives `x`, `y`, `z` or `spin`
with the same channels the joints use, which is how a barbell rises with the
press that lifts it:

```json
{ "id": "bar", "prop": "barbell", "at": [0.06, 1.42, 0],
  "motion": [{ "field": "y", "amp": 0.52, "wave": "rise" }] }
```

Props are not a group-only feature — a bench press is one person and a bar,
and there is no sense in calling that a group.

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

## Writing one, start to finish

### A character

1. Pick a `base`: `man` `woman` `boy` `girl`.
2. Give it a `height` in metres and a `build` from 0 to 1.
3. Set `look.hair` and `look.skin`, and a `hairStyle` if the default for that
   plan is not what you want.
4. List a `wardrobe` — each entry is an id, a cut (preset name or object) and
   a colour — and name one of them as `defaultOutfit`.

### An object

1. Decide the source. `boxes` needs no files and is what you can write
   directly; `gltf` points at a `.glb` in `models/`.
2. Build it around the origin with **y = 0 on the floor**, in metres.
3. Give it a `footprint` — roughly its size in X and Z — so a set can lay
   things out without overlap.
4. Add the anchors that say what it is *for*: `seat` where the hips go and
   which way that faces, `lie` for a surface to lie on, `grip` where a fist
   closes around it, `stand` for a machine to stand on. **A prop with no
   anchor can be looked at but not used.**

### A set

1. Choose `ground` size and colour and a `sky`. Use `indoor` for anything with
   walls, or the room will look like a lawn with furniture on it.
2. Place props, each with its own `id` — that id is how a story removes it,
   repaints it, or sits somebody on it.
3. Use `repeat` for a run of the same thing: a fence, a row of lamps.
4. For an interior, give **each wall its own placement**, and keep tall
   furniture off the wall a story will shoot through.

### An action

1. Choose a `type` and a base `pose`.
2. Decide its clock: `period` + `reps` for something repetitive, `rate` for
   something that follows walking speed, or `duration` for a one-shot.
3. Add `joints` channels. Start with `wave: "const"` values to get the shape
   right, then make the ones that should move into `sin` or `rise`.
4. Add `root` channels for anything that moves the body as a whole.
5. Preview it in the library — an action's Preview performs it on the empty
   stage, casting a body per role.

### A story

1. Name a `set` and any `setEdits` — remove the wall you are filming through,
   add the props this story needs.
2. Write the `cast`: an actor id, which `character`, which `outfit`, and where
   they start.
3. Write the `timeline` in narrative order. Give each actor their own line and
   let entries follow one another; use `t`, `cue` and `after` only to
   synchronise between actors.
4. Give the camera somewhere to be. Check it is not inside a wall or behind
   the furniture.

## What goes wrong

The mistakes that are easy to make and hard to see:

| | |
|---|---|
| **`walkTo` walks through walls** | It goes in a straight line and does no pathfinding. Steer it with `via`. |
| **The camera is inside a building** | Camera positions are not checked against anything. A wall filling the frame with a flat colour is usually this. |
| **Furniture in front of the subject** | Nothing culls it. Raise the camera or move the shot to the other side. |
| **A tall prop on the removed wall** | Filming an interior through a missing wall puts anything standing against that wall between you and everyone. |
| **`+z` on the chest leans backward** | See [the sign trap](#the-sign-trap). |
| **Group actions do not move** | The formation is placed once. A carry that walks is not supported. |
| **A posture sticks** | An actor who sits stays sitting until something else says otherwise. That is deliberate; `stand` is how you undo it. |
| **`facing` an actor reads script order** | It aims at where that actor is after the entries written above it, not at the clock. For a moving target, aim at a point. |
| **Only six lights** | The nearest six to the camera are lit; the rest go dark. |
| **An unknown field does nothing** | It is dropped without complaint. |

## Limits

Anything outside these is clamped, and the error names the field.

| | |
|---|---|
| height | 0.2 – 3.0 m |
| build, hairLength, region scale | 0 – 1, 0 – 1, 0.5 – 2.0 |
| coordinates | ±5000 m |
| camera fov | 15 – 110° |
| one action | up to 600 s |
| one story | up to 3600 s, 2000 timeline entries, 40 cast |
| one set | 4000 placements, `repeat` up to 200 |
| a boxes prop | 4000 boxes |
| a bundle | 200 documents |
| an import | 4 MB of JSON, 12 MB per `.glb` |

## Sharing your own work

Export writes a file; import takes a pasted document, a dropped `.json`, or an
uploaded `.glb`. Imported documents are validated field by field, and the
errors name the field — `cast[1].outfit: unknown outfit "swin"` — because the
loop is paste, run, read the error, fix.

## Two stories worth reading first

`rig-check` walks one character through every pose in turn. `playground` uses
the group actions and the held props together. Between them they exercise most
of the vocabulary, and both are in `data/stories/`.

Every action also has a **Preview** in the library that performs it on the
empty stage, casting a body per role, so an action you write can be watched
before it goes anywhere near a story.

**Filming an interior.** A room with four walls has no camera angle, so an
interior set gives each wall its own placement id and a story removes the one
it shoots through:

```json
"setEdits": [{ "op": "remove", "id": "wall.south" }],
"camera": { "at": [6.4, 2.2, 0.8], "look": [-0.8, 1.0, 0.6], "fov": 44 }
```

Keep tall furniture off that wall as well, or its back fills the shot.

## Catalogue

Everything the app already knows about. This is what a new document can refer
to by id.

<!-- catalogue:start -->

_Generated by `scripts/build_story_studio_readme.py`. Run it after adding documents to `data/`._

### Characters

| id | plan | height | build | hair | outfits |
|---|---|---|---|---|---|
| `ana` | woman | 1.68 m | 0.45 | long 0.62 | `casual` `dress` `swim` `work` |
| `beto` | man | 1.66 m | 0.82 | bun 0.35 | `casual` `overalls` `shirt` |
| `dado` | boy | 1.38 m | 0.58 | buzz | `casual` `swim` `pyjamas` |
| `elza` | woman | 1.63 m | 0.6 | bun 0.3 | `casual` `dress` `pyjamas` |
| `kai` | man | 1.78 m | 0.46 | ponytail 0.45 | `casual` `shirt` `swim` |
| `leo` | man | 1.81 m | 0.55 | short | `casual` `work` `swim` `shirt` |
| `mira` | woman | 1.59 m | 0.7 | bob 0.3 | `casual` `dress` `swim` |
| `nina` | woman | 1.7 m | 0.5 | braid 0.75 | `casual` `work` `swim` |
| `noa` | girl | 1.06 m | 0.5 | pigtails 0.5 | `casual` `dress` `swim` |
| `pip` | girl | 1.31 m | 0.44 | long 0.7 | `casual` `dress` `swim` |
| `rui` | man | 1.86 m | 0.62 | crop | `work` `casual` `shirt` |
| `sol` | woman | 1.74 m | 0.38 | afro | `casual` `work` `overalls` `swim` |
| `tom` | boy | 1.22 m | 0.42 | crop | `casual` `swim` `pyjamas` |
| `vic` | man | 1.72 m | 0.28 | buzz | `casual` `shirt` `pyjamas` |

### Objects

A prop's anchors are what actions can use it for: `seat` for `sit`, `lie` for `lie` and `benchPress`, `stand` for a machine you stand on, `grip` for anything that can be carried.

| id | source | anchors | light | footprint |
|---|---|---|---|---|
| `armchair` | boxes | `seat` | — | 0.95×0.95 |
| `backpack` | boxes | — | — | 0.4×0.5 |
| `ball` | boxes | — | — | 0.32×0.32 |
| `barbell` | boxes | `grip` | — | 0.5×1.8 |
| `barrier` | boxes | — | — | 0.2×2.5 |
| `bench` | boxes | `seat` | — | 0.55×1.6 |
| `book` | boxes | `grip` | — | 0.18×0.22 |
| `bookshelf` | boxes | — | — | 0.35×1.35 |
| `bricks` | boxes | — | — | 0.55×1.1 |
| `bush` | boxes | — | — | 1.1×1.1 |
| `campfire` | boxes | — | yes | 1.3×1.3 |
| `cement-sack` | boxes | `seat` | — | 0.65×0.42 |
| `chair` | boxes | `seat` | — | 0.5×0.5 |
| `coffee-table` | boxes | — | — | 1.15×0.75 |
| `concrete-door` | boxes | — | — | 0.24×4.2 |
| `concrete-floor` | boxes | — | — | 9.0×8.0 |
| `concrete-wall` | boxes | — | — | 0.24×4.2 |
| `concrete-window` | boxes | — | — | 0.24×4.2 |
| `cone` | boxes | — | — | 0.45×0.45 |
| `cooler` | boxes | `seat` | — | 0.85×0.55 |
| `crate` | gltf | `seat` | — | 0.8×0.8 |
| `dirt-patch` | boxes | — | — | 3.2×2.2 |
| `dumbbell` | boxes | `grip` | — | 0.3×0.2 |
| `exercise-bike` | boxes | `seat` | — | 1.1×0.5 |
| `fence` | boxes | — | — | 0.15×1.9 |
| `fern` | boxes | — | — | 1.1×1.1 |
| `flashlight` | boxes | `grip` | yes | 0.1×0.1 |
| `floor-lamp` | boxes | — | yes | 0.4×0.4 |
| `gym-floor` | boxes | — | — | 11.0×9.0 |
| `gym-mirror` | boxes | — | — | 0.2×4.0 |
| `hairdryer` | boxes | `grip` | — | 0.3×0.15 |
| `house-small` | boxes | — | — | 6.0×4.8 |
| `houseplant` | boxes | — | — | 0.65×0.65 |
| `ladder` | boxes | — | — | 0.6×0.6 |
| `lamp` | boxes | — | — | 0.4×0.4 |
| `lantern` | boxes | — | yes | 0.25×0.25 |
| `log` | boxes | `seat` | — | 2.7×0.6 |
| `lounger` | boxes | `lie` `seat` | — | 1.9×0.7 |
| `mixer` | boxes | — | — | 0.9×0.9 |
| `mug` | boxes | `grip` | — | 0.12×0.1 |
| `old-books` | boxes | — | — | 0.3×0.25 |
| `pallet` | boxes | `seat` | — | 1.15×1.05 |
| `picture` | boxes | — | — | 0.06×0.85 |
| `pine` | boxes | — | — | 2.5×2.5 |
| `planks` | boxes | — | — | 3.1×0.95 |
| `planter` | boxes | — | — | 0.72×0.72 |
| `pool` | boxes | `swim` | — | 6.6×4.4 |
| `road` | boxes | — | — | 8.0×7.0 |
| `rock` | boxes | — | — | 1.5×1.3 |
| `room-door` | boxes | — | — | 0.2×4.0 |
| `room-floor` | boxes | — | — | 8.0×7.0 |
| `room-wall` | boxes | — | — | 0.2×4.0 |
| `room-window` | boxes | — | — | 0.2×4.0 |
| `rope-arc` | boxes | `grip` | — | 0.1×2.7 |
| `rope-handle` | boxes | `grip` | — | 0.06×0.06 |
| `rowing-machine` | boxes | `seat` | — | 2.2×0.55 |
| `rubble` | boxes | — | — | 0.8×0.7 |
| `rug` | boxes | — | — | 3.0×2.2 |
| `sand-pile` | boxes | — | — | 2.2×2.0 |
| `scaffold` | boxes | `seat` | — | 1.9×1.4 |
| `slab` | boxes | — | — | 6.1×5.1 |
| `sofa` | boxes | `lie` `seat` | — | 1.0×2.2 |
| `steel-drum` | boxes | `seat` | — | 0.6×0.6 |
| `stool` | boxes | `seat` | — | 0.4×0.4 |
| `stump` | boxes | `seat` | — | 0.9×0.9 |
| `table` | boxes | — | — | 1.4×0.95 |
| `tent` | boxes | `lie` `seat` | — | 2.6×2.2 |
| `torch` | boxes | `grip` | yes | 0.15×0.15 |
| `treadmill` | boxes | `stand` | — | 1.8×0.7 |
| `tree` | boxes | — | — | 1.9×1.9 |
| `tv` | boxes | — | — | 0.45×1.45 |
| `wall` | boxes | — | — | 0.3×2.0 |
| `wall-frame` | boxes | — | — | 0.2×3.6 |
| `weight-bench` | boxes | `lie` `seat` | — | 1.4×0.85 |
| `weight-rack` | boxes | — | — | 1.0×0.45 |

### Sets

Each list is the placement ids a story can `remove`, `tint` or sit an actor on. A `×N` placement expands to `id.0` … `id.N-1`, and removing the bare id removes all of them.

**`abandoned`** — Abandoned building, sky `indoor`, ground 36×36 m

> `floor`, `wall.north.a`, `wall.north.b`, `wall.west.a`, `wall.west.b`, `wall.east.a`, `wall.east.b`, `wall.south.a`, `wall.south.b`, `pallet.a`, `pallet.b`, `pallet.c`, `pallet.stack`, `sack.a`, `sack.b`, `sack.c`, `sack.d`, `books.a`, `books.b`, `books.c`, `rubble.a`, `rubble.b`, `rubble.c`, `drum`

**`backyard`** — Backyard, sky `day`, ground 46×46 m

> `house`, `pool`, `lounger.a`, `lounger.b`, `table`, `chair.a`, `chair.b`, `bench`, `tree.a`, `tree.b`, `bush.a`, `bush.b`, `planter`, `ball`, `fence.north` (×10), `fence.east` (×10)

**`camp`** — Campsite, sky `dusk`, ground 64×64 m

> `ground`, `tent.a`, `tent.b`, `fire`, `log.a`, `log.b`, `stump`, `cooler`, `backpack`, `lantern`, `planks`, `pine.ring` (×7), `pine.side` (×6), `tree.back`, `rock`, `fern`

**`construction`** — House under construction, sky `day`, ground 60×60 m

> `slab`, `frame.north`, `frame.south`, `frame.west`, `scaffold.a`, `scaffold.b`, `bricks.a`, `bricks.b`, `sand`, `mixer`, `planks`, `ladder`, `cones` (×5), `barrier.a`, `barrier.b`, `crate`, `tree`, `bush`, `fence` (×9)

**`forest`** — Forest clearing, sky `day`, ground 70×70 m

> `clearing`, `tree.0`, `tree.1`, `tree.2`, `tree.3`, `tree.4`, `tree.5`, `tree.6`, `tree.7`, `tree.8`, `tree.9`, `tree.10`, `tree.11`, `tree.12`, `tree.13`, `fern.0`, `fern.1`, `fern.2`, `fern.3`, `fern.4`, `fern.5`, `rock.a`, `rock.b`, `rock.c`, `log`, `stump`, `bush.a`, `bush.b`

**`gym`** — Gym, sky `indoor`, ground 30×30 m

> `floor`, `wall.north.a`, `wall.north.b`, `wall.west`, `wall.east`, `wall.south.a`, `wall.south.b`, `treadmill`, `bike`, `rower`, `bench`, `rack`, `plates`, `mat`, `drum`, `plant`, `bookshelf`

**`living-room`** — Living room, sky `indoor`, ground 26×26 m

> `floor`, `wall.north`, `wall.east`, `wall.west`, `wall.south`, `rug`, `sofa`, `tv`, `table`, `armchair.a`, `armchair.b`, `shelf`, `lamp`, `plant`, `picture`, `stool`

**`street`** — Street, sky `dusk`, ground 60×60 m

> `road` (×6), `house.a`, `house.b`, `house.c`, `lamp` (×4), `wall` (×8), `tree.a`, `tree.b`, `bench`, `bush`

**`studio`** — Empty studio, sky `day`, ground 30×30 m

> `mark`

### Actions

| id | category | type | length | reads |
|---|---|---|---|---|
| `benchPress` | solo | posture | `reps` × 2.4s | `on` (needs a `lie` anchor) `reps` |
| `cameraFollow` | solo | cameraFollow | 0s | `target` `for` |
| `cameraTo` | solo | camera | 2s | `at` `look` `fov` |
| `crawlTo` | solo | move | distance ÷ 0.7 m/s | `to` `via` `speed` |
| `crouch` | solo | posture | 0.5s | — |
| `cut` | solo | camera | 0s | `at` `look` `fov` |
| `cycle` | solo | posture | `reps` × 0.9s | `on` (needs a `seat` anchor) `reps` |
| `drop` | solo | hold | 0.5s | — |
| `hold` | solo | hold | 0.5s | `prop` `hand` |
| `idle` | solo | posture | 0.4s | — |
| `jog` | solo | overlay | `reps` × 0.62s | `reps` |
| `jump` | solo | overlay | 0.9s | — |
| `jumpingJacks` | solo | overlay | `reps` × 0.9s | `reps` |
| `kneel` | solo | posture | 0.6s | — |
| `lie` | solo | posture | 0.9s | `on` (needs a `lie` anchor) `face` |
| `nod` | solo | overlay | 1.6s | — |
| `oddsAndEvens` | group | overlay | `reps` × 1.1s | `reps` `cast` `a`+`b` |
| `overheadPress` | solo | overlay | `reps` × 2.2s | `reps` |
| `point` | solo | overlay | 1.6s | `side` |
| `propHide` | solo | stage | 0s | `id` |
| `propMove` | solo | stage | 0s | `id` |
| `propShow` | solo | stage | 0s | `id` |
| `pushups` | solo | overlay | `reps` × 1.5s | `reps` |
| `raiseArm` | solo | overlay | 1.4s | `side` |
| `row` | solo | posture | `reps` × 2.0s | `on` (needs a `seat` anchor) `reps` |
| `runTo` | solo | move | distance ÷ 3.4 m/s | `to` `via` `speed` |
| `say` | solo | speech | length of the line | `text` |
| `setTime` | solo | stage | 0s | `sky` |
| `shakeHead` | solo | overlay | 1.6s | — |
| `shoulderCarry` | group | overlay | 4.0s | `cast` `carrier`+`rider` |
| `sit` | solo | posture | 0.6s | `on` (needs a `seat` anchor) |
| `situps` | solo | overlay | `reps` × 1.8s | `reps` |
| `skipRope` | group | overlay | `reps` × 1.0s | `reps` `cast` `turnerA`+`turnerB`+`jumper` |
| `squats` | solo | overlay | `reps` × 1.6s | `reps` |
| `stand` | solo | posture | 0.4s | — |
| `swimTo` | solo | move | distance ÷ 0.9 m/s | `to` `via` `speed` |
| `think` | solo | speech | length of the line | `text` |
| `turnTo` | solo | turn | 0.6s | `to` `yaw` `facing` |
| `wait` | solo | wait | 1s | — |
| `walkTo` | solo | move | distance ÷ 1.25 m/s | `to` `via` `speed` |
| `wave` | solo | overlay | 2.2s | `side` |

### Stories

| id | set | cast | entries |
|---|---|---|---|
| `abandoned-night` | `abandoned` | `vic` `sol` `dado` | 14 |
| `camp-night` | `camp` | `kai` `nina` `dado` | 14 |
| `forest-walk` | `forest` | `ana` `tom` `noa` | 14 |
| `gym-session` | `gym` | `sol` `kai` `nina` `rui` `beto` | 15 |
| `living-room-evening` | `living-room` | `elza` `pip` `beto` | 16 |
| `playground` | `backyard` | `ana` `leo` `tom` `noa` `pip` | 18 |
| `pool-afternoon` | `backyard` | `ana` `leo` `tom` | 17 |
| `rig-check` | `studio` | `kit` | 43 |
| `site-morning` | `construction` | `rui` `sol` `beto` | 13 |
| `street-evening` | `street` | `vic` `mira` `noa` | 13 |

<!-- catalogue:end -->

## Adding to the shipped library

Drop the file in `data/characters/`, `data/props/`, `data/sets/`,
`data/actions/` or `data/stories/`, add its filename to `data/index.json`,
then run:

```bash
python3 scripts/build_story_studio_readme.py
```

which refreshes the catalogue above from the documents themselves.

Nothing needs building otherwise — the app is plain ES modules served as
static files.
