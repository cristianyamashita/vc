# Story Studio — document format

Everything in this app is a JSON document: the characters, the objects, the
sets and the stories. The library that ships with the app is made of the same
files an import produces, so anything you can watch you can also export, edit
in a text editor and bring back.

There is no server. Your documents live in the browser, in the
`StoryStudioDB` IndexedDB database, and are included in the collection's
[backup tool](../../utils/backup.html).

Lia also has a built-in Blender model, selected by `"model": "lia-v1"` in her
character document. See the [Lia model notes](models/lia/README.md) for the editable
source, wardrobe, rig contract, tests and current limitations. Omitting `model`
uses the existing voxel builder.
Carmen uses `"model": "carmen-v1"`, with adult proportions, long wavy hair and
14 outfits. See the [Carmen model notes](models/carmen/README.md). The preview's
Blender source link resolves to the selected character's own file.

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

## The seven kinds

```
character   a person: body plan, height, build, colouring, wardrobe
outfit      clothes: how they are cut, how they fit, how they are painted
prop        an object: a chair, a house, a torch you can carry
set         a place: ground, sky, light, and props placed in it
action      a thing a body can do: walk, sit, skip a rope with two friends
story       a set, a cast, and a timeline of actions
bundle      several of the above in one file
```

**Actions and outfits are documents too**, so the vocabulary of the app is
not fixed: you can change how a wave looks, cut a garment nobody wrote, spray
it, and export either for someone else to use.

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
  "bust": 0.5,
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
| `bust` | 0 flat to 1 full. `woman` and `girl` only; ignored by the other plans |
| `regions` | per-region sculpt, `[x, y, z]` or one number, each 0.5 to 2.0 |
| `wardrobe` | the outfits this character owns, each with its own id |

`boy` and `girl` are separate plans rather than one "child": the anatomical
difference at that age is small — a shade narrower across the shoulders, a
shade wider at the hip — but a document should be able to say which it means.
`base: "child"` still works and reads as a boy; write `boy` or `girl` in new
documents.

Regions: `head` `hair` `eyes` `torso` `bust` `belly` `arms` `hands` `legs` `feet`.

The **limbs are cylinders** and the **bust is a pair of spheres**; the torso,
head, hands and feet stay square. That is the line the whole look sits on: an
arm is a tube in life and a box one reads as a plank the moment it swings,
while the head carries the face as flat panels and has to stay flat to hold
them. It costs about 450 quads a character, which is around two thirds more
than the all-box version and still nothing on a GPU.

`build` widens the trunk far more than the limbs, so 0 is slight and 1 is
heavy rather than simply bigger. Past the middle of the range it also pushes
the waist forward and drops it slightly, and below the middle it draws the
waist in under the ribs — width on its own reads as a broad person rather
than a heavy one. `height` drives everything else: a plan is written as
fractions of it, so 1.2 m and 1.9 m are the same anatomy at two sizes.

`bust` is a dial of its own rather than a corner of `build`, because a heavy
figure is not a busty one and an author who wants one should not have to
accept the other. Say nothing and a woman gets `0.45`, a girl `0.12`; on
`man` and `boy` the field is ignored. It hangs off the chest joint, so a
raised arm does not carry it, and the bikini or bra band is drawn forward far
enough to sit on top of it.

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

A wardrobe entry names an outfit — an `outfit` document, described in its own
section below — or writes a cut out longhand:

```json
{ "id": "work", "outfit": "military", "paint": "camo" }
{ "id": "odd",  "outfit": { "legs": "shorts", "top": "jacket", "sleeve": "long", "feet": "boot" } }
```

`color` overrides whatever colour the outfit's paint would have given, which
is how every character written before outfits had paints still says what
colour their shirt is. Name a `paint` instead and the garment arrives dressed
the way its own document says.

An **outfit name** that no document defines is an error naming the field and
listing the ones that exist. An unknown value inside a longhand cut still
falls back to a sensible default, so one typo dresses a leg oddly instead of
losing the character — but a misspelt outfit used to dress the character in
`casual` without a word, which is the one failure this error path exists to
prevent.

Every shipped character owns an entry for every outfit that suits their plan,
and the turntable preview shows the rest in a second row: it dresses the
character in one for as long as you look at it, without writing anything into
the document. Under that sits a row of the current outfit's paints. Both rows
exist because a garment nobody wrote into a wardrobe was otherwise invisible —
the library could grow an outfit and no character in it would ever be seen
wearing one.

## `outfit`

```json
{
  "kind": "outfit", "version": 1, "id": "military",
  "name": { "en": "Fatigues", "pt": "Roupa militar", "ja": "軍服" },
  "cut": { "legs": "trousers", "top": "fatigues", "sleeve": "long",
           "feet": "boot", "belt": true, "cap": true },
  "fit": { "swell": 0.004 },
  "plans": ["man", "woman", "boy", "girl"],
  "paints": [
    { "id": "olive", "name": "Olive drab", "color": "#5c6244" },
    { "id": "camo",  "name": "Camouflage", "color": "#5c6244",
      "spray": { "topChest|0|2,3": "#3f4632", "sleeveL|4|1,1": "#6d7350" } }
  ],
  "defaultPaint": "olive"
}
```

Clothes are documents like everything else: they live in `data/outfits/`, are
listed in `data/index.json`, and are loaded **before** characters, because a
character is validated against the outfits the library actually holds.

**`cut`** is the vocabulary the anatomy can draw. It is not a model — an
outfit does not carry a mesh — which is what lets one cut dress a man, a
woman and a child from the same four words:

| field | values |
|---|---|
| `legs` | `trousers` `shorts` `briefs` `bare` |
| `top` | `shirt` `tee` `jacket` `dress` `nightie` `bikini` `bra` `towel` `tube` `croptop` `fatigues` `bare` |
| `sleeve` | `long` `short` `upper` `none` |
| `feet` | `shoe` `sneaker` `boot` `dress` `flat` `bare` |
| flags | `belt` `tie` `cap` `skirt` `straps` |

**`fit.swell`** is how far the cloth stands off the body, in metres on a
1.76 m frame and scaled to whoever wears it. It grows every garment box on
every axis at once, from −20 mm to +60 mm: one dial, because what an author
wants is "looser everywhere", and a box grown by the same amount on each side
is exactly that. Negative takes a garment in, which is how one stops poking
through another.

**`plans`** is who the outfit is *offered* to — the preview's second row and
the shipped wardrobes. Every cut still renders on every plan and any
character may name any outfit; this is a suggestion, not a rule. It is why
`swim` (trunks and a bare chest) goes to `man` and `boy` while `swimsuit`
goes to `woman` and `girl`.

**`paints`** are the schemes the garment ships in. Each has a main `color`
and, optionally, `spray`: a flat map of cell addresses to colours.

An address is `pid|face|gx,gy`. `pid` names one garment box — `topChest`,
`sleeveL`, `legThighR`, `cap` — `face` is 0..5, and the face is divided into
a 6 × 6 grid, so `gx` and `gy` run 0..5. Only boxes that are cloth carry a
pid, which is what confines paint to clothing: skin, hair and eyes have no
address, so they cannot be sprayed even by a hand-written document. Left and
right take their own pids (`sleeveL`, `sleeveR`) so a stripe down one sleeve
is not copied onto the other. An outfit may carry 6 000 sprayed cells, which
is roughly "every inch of the garment".

Spray shows at the **Detail** setting only: the simple tier collapses each
face to a single quad, and there is nowhere for a cell to land.

### The outfit editor

`Visual edit` on an outfit opens a turntable with a mannequin wearing the
draft. The left panel is the cut and `fit`, the right is the paints and the
spray can: an ink colour, a brush from **1 dot to 8**, and spray / erase /
pick-colour. Left-drag paints, right-drag turns the body, and paint only
lands on cloth facing the camera — never on the far side of an arm.

It writes an ordinary `outfit` document through the same validator an import
uses, so an outfit sprayed with the mouse and one typed by hand are the same
thing afterwards.

Some notes on the cuts themselves:

`nightie` is a slip that hangs from thin straps to mid-thigh, with bare arms,
legs and feet — its own top rather than a short dress, because the `dress`
cut stops at the hip and reads as a party frock in a bedroom scene. The hem
is measured between the waist and mid-thigh, so it falls the same way on a
woman and on a girl.

`underwear` is knickers and a bra: the same two garments a swimsuit is made
of, kept apart because a story means something different by each, and because
the bra has straps over the shoulder where a bikini top does not. Both cuts
take the garment colour lightened, so a colour that works on a tee does not
come out as midnight-blue nightwear.

`towel` is a bath towel, wrapped where the wearer's plan wraps it: at the
waist on `man` and `boy`, from above the bust on `woman` and `girl`. One cut
rather than two, because a story says "out of the shower" and should not have
to know which body it is dressing.

`tubeDress` is strapless and straight from above the bust to mid-thigh. It is
not `dress` in another colour: that cut flares at the hip, and the flare is
exactly what a tube dress does not have.

`shortsTop` is shorts and a crop top, both in the garment's own colour so
they read as one set — everywhere else `shorts` come out denim, which is what
`shortsTee` means by them.

`fatigues` is a uniform tunic with patch pockets and a collar, and it dresses
the trousers in its own cloth a shade darker rather than in the standard
charcoal: a uniform is one cloth, and camouflage that stopped at the waist
would not be camouflage.

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

* `{"type": "boxes", "boxes": [...]}` — built from parts written in the
  document. **This is the one you can author by pasting text**, with no file
  to host. A part takes `w h d x y z color`, and optionally `rx ry rz`
  (radians), `n` (face subdivision, 1–4), `shape`, `grain`, `flat`, `detail`.
* `{"type": "gltf", "file": "models/chair.glb"}` — a `.glb` shipped with the
  app.
* `{"type": "gltfBlob", "blobId": "…"}` — a `.glb` you uploaded, kept in your
  browser. Made for you by the **Upload a .glb model** button.

### Round things

A part is a box unless it says otherwise:

| `shape` | what it is | `axis` |
|---|---|---|
| `box` | the default | — |
| `sphere` | a ball; three unequal sizes give an ellipsoid | — |
| `cylinder` | a tube with solid ends | `x` `y` `z`, default `y` |
| `cone` | a cone, point at the **+axis** end | `x` `y` `z`, default `y` |

Nothing else about the part changes: `w` `h` `d` still give its size, `x y z`
its place, `rx ry rz` its rotation. Three unequal sizes give an ellipsoid, an
elliptical cylinder, or a cone on an oval base.

```json
"boxes": [
  { "shape": "sphere",   "n": 4, "w": 0.3,  "h": 0.3, "d": 0.3,  "y": 0.16, "color": "#e04b4b" },
  { "shape": "sphere",   "n": 4, "w": 0.31, "h": 0.1, "d": 0.31, "y": 0.16, "color": "#f5f2ea" },
  { "shape": "cylinder", "axis": "x", "n": 4, "w": 2.6, "h": 0.46, "d": 0.46, "y": 0.24 },
  { "shape": "cone",     "axis": "y", "n": 4, "w": 0.28, "h": 0.68, "d": 0.28, "y": 0.4 }
]
```

The second part there is a flattened sphere very slightly wider than the
first, so it shows only as a ring where it pokes through — that is how the
stripe around a ball is drawn, and the same trick makes the white band on a
traffic cone.

All of them are the same machinery: the builder already subdivides each face
into `n × n` quads, so a round part is that subdivided cube pushed outward.
`n` is therefore what makes it round — 4 gives 96 quads per part and no
visible facets at the size these things are seen. A round part keeps a coarse
subdivision even with **Detail** off, because that tier exists to shed
decoration, not to turn a ball back into a cube, and it never falls below 3
however small an `n` you write. Round parts also carry real normals, so they
shade smoothly instead of taking the baked per-face shading a box gets.

**Most things should stay boxes.** It is a voxel look; a table, a wall, a
crate and a book are boxes in life too, and the character's torso and head are
square on purpose — the head carries the face as flat panels, and a rounded
one would have nothing to sit them on. What is worth turning is what is a tube
or a lump in life: trunks, poles, posts, logs, mugs, drums, bar handles,
plates, stones, foliage, flames, fir trees, traffic cones, sand heaps.

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

A prop may carry **several anchors of the same sort** — a double bed has `lie`
and `lieB` — and an entry picks one by name:

```json
{ "actor": "leo",  "do": "lie", "on": "bed" },
{ "actor": "mira", "do": "lie", "on": "bed", "anchor": "lieB" }
```

**A `lie` anchor's `yaw` points at the FEET.** A lying pose lays the body out
along the actor's own axis with the head behind them, so an anchor facing the
headboard puts the sleeper in upside down. Point it at the foot of the bed.

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

A placement takes `at` `yaw` `scale` `tint` `locked` `repeat`, and can also
**lean**:

| field | what it does |
|---|---|
| `yaw` | turns it about its upright. This is the one furniture needs |
| `pitch` | tips it end over end. Positive leans the top back, toward −X |
| `roll` | leans it sideways. Positive leans the top toward +Z |

The same three senses, on the same axes, as a held prop's `grip`. `at[1]` is
height, so a picture goes on a wall and a lamp on a shelf by raising it.

```json
{ "id": "ladder", "prop": "ladder", "at": [2, 0, -4], "yaw": 90, "pitch": -18 }
```

That is a ladder leaning against something. `setEdits`' `add` takes them too.

`scale` is one number, or three to stretch: `"scale": [1, 2.2, 1]` makes a
wall twice as tall without making it twice as thick. `tint` repaints the whole
placement in one colour — it is a blunt instrument by design, since a
per-part override would have to name parts the prop is free to change.

`locked: true` is read only by the visual editor, which then refuses to move,
turn or delete that placement. It lives in the document rather than in the
editor's memory because "I have finished with the walls" is worth keeping, and
a note that vanishes on reload is not worth making.

**Anchors follow the full rotation**, so a leaning prop's `grip` point is
still where it looks. The *facing* an anchor hands back is computed from
`yaw` alone, though, which is the honest limit: pitch and roll are for
scenery — a leaning ladder, a fallen sign, a plank on a slope — not for a
seat somebody has to sit in squarely.

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
| `anchor` | the same | which anchor of that placement, when it has more than one |
| `face` | `lie` | `"up"` or `"down"` |
| `reps` | repetitive actions | how many |
| `side` | one-armed gestures | `"left"` or `"right"` |
| `text` | `say` `think` | the line, per language |
| `prop` `hand` | `hold` | what to pick up, and in which hand |
| `yaw` `facing` | actor actions | which way to end up pointing |
| `at` `look` `fov` `glide` | camera | where from, what at, how wide, and whether to pass through |
| `id` | `propShow` `propHide` `propMove` | which placement |
| `at` `yaw` `for` `arc` | `propMove` | where to, facing which way, over how long, bowing how high |
| `sky` | `setTime` | the new time of day |
| `cast` | group actions | which actor plays each role |

### Moving an object

`propMove` with no `for` puts a placement somewhere else at that instant — a
chair repositioned between two shots. Give it a `for` and it *travels* there
over that many seconds, and `arc` bows the path upward by that many metres at
its midpoint:

```json
{ "t": 1.5, "do": "propMove", "id": "ball",
  "at": [2.65, 1.8, 0], "for": 1.8, "arc": 1.15 }
```

That is a thrown ball: it leaves one hand, rises 1.15 m above the straight
line — clear of a 2.4 m net — and arrives 1.8 s later. Each move starts from
wherever the last one left the prop, so a rally is a chain of them and the
ball is never teleported back to where the set first put it.

**Timing a hit is arithmetic, not taste.** The ball has to be in the hand at
the instant that hand is at full stretch, and every action says when that is:
one `spike` repetition lasts 1.6 s and its jump peaks at **0.90 s**; one
`throw` lasts 1.2 s and the arm is fully forward at **0.60 s**. So a striker
whose hand meets the ball at `t` starts their `spike` at `t − 0.9`, and the
flight that ends at `t` is the previous player's `propMove` finishing exactly
then. `volley-match` and `pool-ball` are both written that way, and they are
the two to read for it.

### Moving the camera

`cameraTo` eases in and out, which is right for changing setup between two
shots and wrong for a walk — it comes to a stop at every corner. Mark a run of
moves `glide` and they become one continuous travel:

```json
{ "do": "cameraTo", "at": [-7.4, 1.85, 4.6], "look": [-4.6, 1, 0.5], "for": 3.2 },
{ "do": "cameraTo", "at": [-2.4, 1.70, 0.2], "look": [1.5, 1.1, 0], "for": 3.0, "glide": true },
{ "do": "cameraTo", "at": [0.4, 1.72, 0.0], "look": [4.0, 1.1, 0], "for": 2.6, "glide": true },
{ "do": "cameraTo", "at": [4.6, 1.66, -1.3], "look": [7.85, 1.5, 0.2], "for": 3.4 }
```

**Both ends of a leg have to be marked**, so `glide` describes a run rather
than a single point: the first and last moves still ease, and everything
between them holds a steady pace. `office-walkthrough` is the worked example —
it walks out of an open-plan room, through a doorway, once round a meeting
table and onto the presenter at the board.

`cut` changes framing instantly instead of travelling. `cameraFollow` keeps
the camera aimed at an actor while its position keyframes carry on.

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
closes around, in the prop's own space, plus the angle it sits at in the hand;
everything else follows from it.

```json
"anchors": { "grip": { "pos": [0, 0.22, 0], "pitch": 0, "yaw": 0, "roll": 0 } }
```

All three angles are degrees and all three default to `0`, which means "held
the way it was modelled, with the prop's own up pointing along the hand's".

| angle | what it does | a use for it |
|---|---|---|
| `pitch` | tips the thing forward or back, away from the body or toward it | a torch angled ahead, a book tilted up to read |
| `yaw` | twists it about its own upright | turning a phone or a sign to face the camera |
| `roll` | tilts it out sideways, across the body | a bar carried level, a mug hanging at the hip |

They are the same three senses the joints use — `pitch` is the rig's forward
swing, `roll` its sideways one — so a prop tilts the way a limb of the same
description would.

Then in a story:

```json
{ "actor": "leo", "do": "hold", "prop": "torch", "hand": "left" },
{ "actor": "leo", "do": "drop" }
```

A cast entry can start with something already in hand: `"holds": "torch"`.
What an actor carries is sticky, like a posture — they keep it until they put
it down. A group action that puts a prop in a role's hand gives back whatever
was there when it ends.

**A story can override the angle for one hold.** The anchor says how the thing
is *usually* carried; `grip` on the entry says how this character is carrying
it now, and the two are added together:

```json
{ "id": "vic", "character": "vic", "at": [7.2, 0, 3.8],
  "holds": "flashlight", "hand": "right", "grip": [40, 0, 0] },
```

```json
{ "actor": "vic", "do": "hold", "prop": "torch", "hand": "right",
  "grip": [0, 0, -20] }
```

A group action's own props take it too, next to `role` and `hand`, for the
same reason: the rope handles want one angle, a carried plank another. Written
as `[pitch, yaw, roll]` — all three, always, because `[10, 20]` would be a
guess about which two you meant.

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
   closes around it — with the `pitch`/`yaw`/`roll` it hangs at — and `stand`
   for a machine to stand on. **A prop with no anchor can be looked at but not
   used.**

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

## Errors and warnings

Two kinds of problem, deliberately kept apart.

An **error** means the film cannot be built: no character with that id, a
circular `after`, an action that does not exist. Compiling stops and the
problems are listed, each with its field path.

A **warning** means the compiler worked around something. The film plays, and
the note appears above it. The one that exists today is `on` naming a
placement without the anchor the action needs — telling somebody to sit on the
concrete floor. They perform the posture where they already stand, which is
visibly wrong in exactly the one place that is wrong.

The line between them is worth stating, because it is easy to put in the wrong
place: **losing a twenty-second film over one entry of twenty teaches nothing
and costs everything.** A missing prop already draws a magenta box rather than
a black screen; this is the same judgement applied to the timeline.

## What goes wrong

The mistakes that are easy to make and hard to see:

| | |
|---|---|
| **`walkTo` walks through walls** | It goes in a straight line and does no pathfinding. Steer it with `via`. |
| **The camera is inside a building** | Camera positions are not checked against anything. A wall filling the frame with a flat colour is usually this. |
| **Furniture in front of the subject** | Nothing culls it. Raise the camera or move the shot to the other side. |
| **A tall prop on the removed wall** | Filming an interior through a missing wall puts anything standing against that wall between you and everyone. |
| **`+z` on the chest leans backward** | See [the sign trap](#the-sign-trap). |
| **A prop's `yaw` turns the opposite way to an actor's** | A prop at yaw θ points its local +X at `(cos θ, −sin θ)`; an actor at yaw θ faces `(cos θ, sin θ)`. A chair meant to seat someone facing +Z is at **−90**, not +90. The two agree at 0° and 180°, which is why it is easy to miss. |
| **A sleeper is head-to-toe** | A `lie` anchor's yaw points at the feet, not the head. |
| **A prop's furniture disagrees with its footprint** | Decide which way the user of a desk sits, then lay the top out around that. A monitor facing +X on a top that is wide along X is a desk turned ninety degrees from its own screen. |
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

### Laying out a set with the mouse

A set card also has **Visual edit**. It opens the same document on a stage you
can orbit, with every object in the library down the left side as a picture,
and it saves a normal `set` through the normal validator — a set laid out with
the mouse and one typed by hand are the same thing afterwards, which is the
property that stops this becoming a second format.

| | |
|---|---|
| add | drag an object in from the palette, or click it to drop it where you are looking |
| select | click it on the stage, or its name in **In the set** |
| move | drag the gizmo arrows — including the green one, straight up and down |
| turn | drag any of the three rings. **G** and **R** switch modes, as in Blender |
| **Snap** | rounds to 0.25 m and 15° while it is on |
| **Duplicate** | copies the selected object a little to one side, under a free id |
| **Delete** | removes it. **X**, Delete or Backspace do the same |
| **Time of day** | the set's `sky` |
| properties | the box on the right: name, position, rotation, size, colour, repeat — every number the placement has, typed exactly rather than dragged |
| **Lock** | freezes a placement. Locked, it still selects and copies, but will not move, turn or delete, and its fields go read-only |

Size has a **linked** tick: on, one number scales the whole thing; off, the
three axes stretch independently. **Colour** tints the placement and
**Original** takes the tint away again.

**A `repeat` block stays one object.** The eight panels of a fence are one
entry that draws eight, so the editor selects and moves the row as a whole and
writes the same `repeat` back. Editing the expansion instead would flatten
that row into eight entries the first time you nudged it, and the document
would come back longer and dumber than it went in.

Saving writes to **your** library under the set's own id, so editing a shipped
set gives you a copy of it that every story using that id then plays in,
without any story being edited. **Cancel** asks before dropping changes.

### Editing a story with the mouse

A story card has **Visual edit** too. A set is a floor plan and a story is a
schedule, so this is a different instrument: a timeline along the bottom, one
lane per actor plus lanes for the camera and the stage, and a stage above it
showing the film at whatever instant the playhead is on.

**The stage is the player.** Not a lookalike — the actual playback, compiling
through the actual compiler — so what you watch while you edit is what will
play. The compiler hands back the schedule it resolved, and the timeline draws
its blocks straight from that. That matters more than it sounds: `t`, `after`
and "follows this actor's previous line" only become numbers inside the
compiler, and working them out a second time in the editor is exactly how an
editor and its format drift apart.

| | |
|---|---|
| the set | the dropdown in the toolbar. `remove` and `tint` edits are dropped, since they name placements the new set never had; objects the story added are kept |
| cast and objects | drag from the left, or click to drop at the origin. A character joins the `cast`, an object becomes a `setEdits` `add` |
| select | click somebody on the stage, a name on the left, or a block on the timeline |
| the playhead | click the ruler or any empty lane |
| retime | drag a block. Drag its right edge for `for` |
| **Add action** | a new entry for the selected actor, at the playhead |
| **Opening shot** | the first row on the left is the story's own `camera` — where the film opens, before any `cameraTo` runs. Position, aim and `fov`, and selecting it takes the playhead to 0 so you can see it |
| **Free look** | orbit away from the shot. **Camera from this view** then writes where you are looking into whichever camera is selected — the opening shot, or a camera block on the timeline |

The properties box on the right is built from what the action *is*: a `move`
asks for `to` and `speed`, a `speech` for the line, a `hold` for the prop and
the hand. Add an action document to the library and its form appears with it.

**Dragging a block pins it.** An entry with no `t` follows whatever came
before it for that actor, and there is no honest way to drag something whose
time is somebody else's business — so the drag writes a `t` and drops any
`after`.

**`on` only offers things that are one.** A `sit` lists the placements whose
prop has a `seat` anchor, a `lie` those with a `lie` one, and so on from the
action's own `anchor` field — the concrete floor is not on the list, because
choosing it is how a story gets written that cannot be played. A value already
in the document stays in the list even so, since hiding it would silently
rewrite the story the moment you touched another field.

Not in it yet: making a story from nothing, casting the roles of a group
action, and `via` waypoints. Those are still the JSON panel's, which remains
the interface that can do everything.

**Duplicate** sits next to Edit on every card. It saves a copy under a free id
— `camp-night` becomes `camp-night-copy`, then `-copy-2` — marks the name as a
copy in all three languages, and opens it in the editor, which is the only
reason anyone duplicates anything. The copy is a document of its own, not an
override: keeping the id would shadow the original everywhere instead of
sitting beside it. What is inside is left alone, so a copied story still uses
the same characters and set, and copying `ana` does not recast the stories
that name her.

**Edit** appears on every card in the library and again beside the title while
a film is playing or an object is turning on the stand. The one during
playback is the one that matters: you watch, you see the thing that is wrong,
and the JSON is one click away. Opening it pauses the film; **Apply and play**
saves the document to your own library and starts it again from the top.

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

| id | plan | height | build | bust | hair | outfits |
|---|---|---|---|---|---|---|
| `ana` | woman | 1.68 m | 0.45 | default | long 0.62 | `casual` `dress` `swim` `work` `shirt` `overalls` `pyjamas` `nightie` `underwear` `towel` `tubeDress` `shortsTop` `military` |
| `bel` | girl | 1.14 m | 0.52 | default | bob 0.3 | `casual` `dress` `swim` `shortsTee` `suit` `shirt` `overalls` `pyjamas` `nightie` `towel` `tubeDress` `shortsTop` `military` |
| `beto` | man | 1.66 m | 0.82 | — | bun 0.35 | `casual` `overalls` `shirt` `shortsTee` `suit` `swim` `pyjamas` `towel` `military` |
| `bia` | woman | 1.64 m | 0.86 | 0.72 | bun 0.35 | `casual` `nightie` `underwear` `dress` `shortsTee` `suit` `shirt` `swimsuit` `overalls` `pyjamas` `towel` `tubeDress` `shortsTop` `military` |
| `carmen` | woman | 1.67 m | 0.52 | 0.92 | wavy 0.6 | `casual` `nightie` `underwear` `swim` `shortsTee` `suit` `dress` `shirt` `overalls` `pyjamas` `towel` `tubeDress` `shortsTop` `military` |
| `dado` | boy | 1.38 m | 0.58 | — | buzz | `casual` `swim` `pyjamas` `shortsTee` `suit` `shirt` `overalls` `towel` `military` |
| `duda` | girl | 1.26 m | 0.36 | 0.06 | pigtails 0.5 | `casual` `nightie` `swim` `shortsTee` `suit` `dress` `shirt` `overalls` `pyjamas` `towel` `tubeDress` `shortsTop` `military` |
| `elza` | woman | 1.63 m | 0.6 | default | bun 0.3 | `casual` `dress` `pyjamas` `shortsTee` `suit` `shirt` `swimsuit` `overalls` `nightie` `underwear` `towel` `tubeDress` `shortsTop` `military` |
| `kai` | man | 1.78 m | 0.46 | — | ponytail 0.45 | `casual` `shirt` `swim` `suit` `overalls` `pyjamas` `towel` `military` |
| `lena` | woman | 1.71 m | 0.14 | 0.18 | long 0.82 | `casual` `nightie` `underwear` `work` `shortsTee` `dress` `shirt` `swimsuit` `overalls` `pyjamas` `towel` `tubeDress` `shortsTop` `military` |
| `leo` | man | 1.81 m | 0.55 | — | short | `casual` `work` `swim` `shirt` `pyjamas` `shortsTee` `overalls` `towel` `military` |
| `lia` | girl | 1.27 m | 0.46 | default | braid 0.6 | `casual` `dress` `swim` `suit` `shirt` `overalls` `pyjamas` `nightie` `towel` `tubeDress` `shortsTop` `military` |
| `mira` | woman | 1.59 m | 0.7 | default | bob 0.3 | `casual` `dress` `swim` `pyjamas` `shortsTee` `suit` `shirt` `overalls` `nightie` `underwear` `towel` `tubeDress` `shortsTop` `military` |
| `nina` | woman | 1.7 m | 0.5 | default | braid 0.75 | `casual` `work` `swim` `dress` `shirt` `overalls` `pyjamas` `nightie` `underwear` `towel` `tubeDress` `shortsTop` `military` |
| `noa` | girl | 1.06 m | 0.5 | default | pigtails 0.5 | `casual` `dress` `swim` `suit` `shirt` `overalls` `pyjamas` `nightie` `towel` `tubeDress` `shortsTop` `military` |
| `pip` | girl | 1.31 m | 0.44 | default | long 0.7 | `casual` `dress` `swim` `shortsTee` `suit` `shirt` `overalls` `pyjamas` `nightie` `towel` `tubeDress` `shortsTop` `military` |
| `ravi` | boy | 1.18 m | 0.46 | — | crop | `casual` `swim` `pyjamas` `suit` `shirt` `overalls` `towel` `military` |
| `rui` | man | 1.86 m | 0.62 | — | crop | `work` `casual` `shirt` `shortsTee` `suit` `swim` `pyjamas` `towel` `military` |
| `sol` | woman | 1.74 m | 0.38 | default | afro | `casual` `work` `overalls` `swim` `shortsTee` `dress` `shirt` `pyjamas` `nightie` `underwear` `towel` `tubeDress` `shortsTop` `military` |
| `tom` | boy | 1.22 m | 0.42 | — | crop | `casual` `swim` `pyjamas` `suit` `shirt` `overalls` `towel` `military` |
| `vic` | man | 1.72 m | 0.28 | — | buzz | `casual` `shirt` `pyjamas` `shortsTee` `suit` `swim` `overalls` `towel` `military` |
| `zeca` | boy | 1.34 m | 0.5 | — | short | `casual` `swim` `pyjamas` `shortsTee` `suit` `shirt` `overalls` `towel` `military` |

### Outfits

A paint is the garment's main colour plus its sprayed cells; the number in brackets is how many cells it carries. `offered to` is which body plans the app suggests the outfit for — any character may name any of them.

| id | cut | offered to | fit | paints |
|---|---|---|---|---|
| `casual` | trousers · tee · short sleeve · sneaker · `belt` | man woman boy girl | — | `plain` |
| `dress` | bare · dress · upper sleeve · flat · `skirt` | woman girl | — | `plain` |
| `military` | trousers · fatigues · long sleeve · boot · `belt` `cap` | man woman boy girl | — | `olive` `camo` (1040) `desert` |
| `nightie` | bare · nightie · none sleeve · bare | woman girl | — | `plain` |
| `overalls` | trousers · tee · short sleeve · boot · `straps` | man woman boy girl | — | `plain` |
| `pyjamas` | trousers · tee · long sleeve · bare | man woman boy girl | — | `plain` |
| `shirt` | trousers · shirt · upper sleeve · shoe · `belt` | man woman boy girl | — | `plain` |
| `shortsTee` | shorts · tee · short sleeve · sneaker | man woman boy girl | — | `plain` |
| `shortsTop` | shorts · croptop · none sleeve · sneaker | woman girl | — | `plain` |
| `suit` | trousers · jacket · long sleeve · dress · `belt` `tie` | man woman boy girl | — | `plain` |
| `swim` | briefs · bare · none sleeve · bare | man boy | — | `plain` |
| `swimsuit` | briefs · bikini · none sleeve · bare | woman girl | — | `plain` |
| `towel` | bare · towel · none sleeve · bare | man woman boy girl | — | `plain` `stripes` (96) |
| `tubeDress` | bare · tube · none sleeve · flat | woman girl | — | `plain` |
| `underwear` | briefs · bra · none sleeve · bare | woman | — | `plain` |

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
| `bicycle` | boxes | `seat` | — | 1.8×0.5 |
| `blackboard` | boxes | — | — | 0.14×3.2 |
| `book` | boxes | `grip` | — | 0.18×0.22 |
| `bookshelf` | boxes | — | — | 0.35×1.35 |
| `bricks` | boxes | — | — | 0.55×1.1 |
| `bush` | boxes | — | — | 1.1×1.1 |
| `campfire` | boxes | — | yes | 1.3×1.3 |
| `car` | boxes | `seat` `seatB` | — | 4.35×1.85 |
| `cement-sack` | boxes | `seat` | — | 0.65×0.42 |
| `chair` | boxes | `seat` | — | 0.5×0.5 |
| `coffee-table` | boxes | — | — | 1.15×0.75 |
| `concrete-door` | boxes | — | — | 0.24×4.2 |
| `concrete-floor` | boxes | — | — | 9.0×8.0 |
| `concrete-wall` | boxes | — | — | 0.24×4.2 |
| `concrete-window` | boxes | — | — | 0.24×4.2 |
| `cone` | boxes | — | — | 0.45×0.45 |
| `cooler` | boxes | `seat` | — | 0.85×0.55 |
| `court-line` | boxes | — | — | 9.0×0.12 |
| `crate` | gltf | `seat` | — | 0.8×0.8 |
| `crt-tv` | boxes | — | — | 0.6×0.6 |
| `desk` | boxes | `stand` | — | 0.85×1.7 |
| `dirt-patch` | boxes | — | — | 3.2×2.2 |
| `double-bed` | boxes | `lie` `lieB` `seat` | — | 2.2×1.7 |
| `dumbbell` | boxes | `grip` | — | 0.3×0.2 |
| `exercise-bike` | boxes | `seat` | — | 1.1×0.5 |
| `fence` | boxes | — | — | 0.15×1.9 |
| `fern` | boxes | — | — | 1.1×1.1 |
| `filing-cabinet` | boxes | — | — | 0.55×0.95 |
| `flashlight` | boxes | `grip` | yes | 0.1×0.1 |
| `floor-lamp` | boxes | — | yes | 0.4×0.4 |
| `game-console` | boxes | — | — | 0.3×0.36 |
| `gamepad` | boxes | `grip` | — | 0.14×0.34 |
| `glass-bottle` | boxes | `grip` | — | 0.09×0.09 |
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
| `magazine` | boxes | `grip` | — | 0.22×0.29 |
| `magazine-open` | boxes | `grip` | — | 0.46×0.3 |
| `magazines` | boxes | — | — | 0.34×0.38 |
| `meeting-table` | boxes | — | — | 4.7×1.7 |
| `mixer` | boxes | — | — | 0.9×0.9 |
| `money-stack` | boxes | `grip` | — | 0.18×0.09 |
| `motorcycle` | boxes | `seat` | — | 2.1×0.75 |
| `mug` | boxes | `grip` | — | 0.12×0.1 |
| `nightstand` | boxes | — | — | 0.46×0.46 |
| `office-chair` | boxes | `seat` | — | 0.55×0.55 |
| `office-floor` | boxes | — | — | 17.0×13.0 |
| `old-books` | boxes | — | — | 0.3×0.25 |
| `old-mattress` | boxes | `lie` `seat` | — | 1.95×0.95 |
| `pallet` | boxes | `seat` | — | 1.15×1.05 |
| `pallet-rack` | boxes | — | — | 1.2×2.6 |
| `picture` | boxes | — | — | 0.06×0.85 |
| `pine` | boxes | — | — | 2.5×2.5 |
| `planks` | boxes | — | — | 3.1×0.95 |
| `planter` | boxes | — | — | 0.72×0.72 |
| `pool` | boxes | `swim` | — | 6.6×4.4 |
| `radio` | boxes | `grip` | — | 0.2×0.46 |
| `road` | boxes | — | — | 8.0×7.0 |
| `rock` | boxes | — | — | 1.5×1.3 |
| `room-door` | boxes | — | — | 0.2×4.0 |
| `room-doorway` | boxes | — | — | 0.2×4.0 |
| `room-floor` | boxes | — | — | 8.0×7.0 |
| `room-wall` | boxes | — | — | 0.2×4.0 |
| `room-window` | boxes | — | — | 0.2×4.0 |
| `rope-arc` | boxes | `grip` | — | 0.1×2.7 |
| `rope-handle` | boxes | `grip` | — | 0.06×0.06 |
| `rowing-machine` | boxes | `seat` | — | 2.2×0.55 |
| `rubble` | boxes | — | — | 0.8×0.7 |
| `rug` | boxes | — | — | 3.0×2.2 |
| `sack-pallet` | boxes | `seat` | — | 1.2×1.1 |
| `sand-pile` | boxes | — | — | 2.2×2.0 |
| `scaffold` | boxes | `seat` | — | 1.9×1.4 |
| `school-desk` | boxes | `seat` | — | 1.0×0.65 |
| `slab` | boxes | — | — | 6.1×5.1 |
| `sleeping-bag` | boxes | `lie` | — | 2.0×0.7 |
| `sleeping-bag-red` | boxes | `lie` | — | 2.0×0.7 |
| `sofa` | boxes | `lie` `seat` | — | 1.0×2.2 |
| `steel-drum` | boxes | `seat` | — | 0.6×0.6 |
| `stool` | boxes | `seat` | — | 0.4×0.4 |
| `stump` | boxes | `seat` | — | 0.9×0.9 |
| `table` | boxes | — | — | 1.4×0.95 |
| `teacher-desk` | boxes | `stand` | — | 0.8×1.55 |
| `tent` | boxes | `lie` `seat` | — | 2.6×2.2 |
| `torch` | boxes | `grip` | yes | 0.15×0.15 |
| `treadmill` | boxes | `stand` | — | 1.8×0.7 |
| `tree` | boxes | — | — | 1.9×1.9 |
| `tv` | boxes | — | — | 0.45×1.45 |
| `volley-net` | boxes | — | — | 0.5×9.6 |
| `volleyball` | boxes | `grip` | — | 0.24×0.24 |
| `wall` | boxes | — | — | 0.3×2.0 |
| `wall-frame` | boxes | — | — | 0.2×3.6 |
| `water-cooler` | boxes | — | — | 0.4×0.4 |
| `weight-bench` | boxes | `lie` `seat` | — | 1.4×0.85 |
| `weight-rack` | boxes | — | — | 1.0×0.45 |
| `whiteboard` | boxes | — | — | 0.12×2.6 |

### Sets

Each list is the placement ids a story can `remove`, `tint` or sit an actor on. A `×N` placement expands to `id.0` … `id.N-1`, and removing the bare id removes all of them.

**`abandoned`** — Abandoned building, sky `indoor`, ground 36×36 m

> `floor`, `wall.north.a`, `wall.north.b`, `wall.west.a`, `wall.west.b`, `wall.east.a`, `wall.east.b`, `wall.south.a`, `wall.south.b`, `pallet.a`, `pallet.b`, `pallet.c`, `pallet.stack`, `sack.a`, `sack.b`, `sack.c`, `sack.d`, `books.a`, `books.b`, `books.c`, `rubble.a`, `rubble.b`, `rubble.c`, `drum`

**`backyard`** — Backyard, sky `day`, ground 46×46 m

> `house`, `pool`, `lounger.a`, `lounger.b`, `table`, `chair.a`, `chair.b`, `bench`, `tree.a`, `tree.b`, `bush.a`, `bush.b`, `planter`, `ball`, `fence.north` (×10), `fence.east` (×10)

**`bedroom`** — Bedroom, sky `indoor`, ground 24×24 m

> `floor`, `wall.north.0`, `wall.south.0`, `wall.north.1`, `wall.south.1`, `wall.west`, `wall.east`, `bed`, `night.a`, `night.b`, `lamp.a`, `wardrobe`, `chair`, `rug`, `plant`, `picture`

**`camp`** — Campsite, sky `dusk`, ground 64×64 m

> `ground`, `tent.a`, `tent.b`, `fire`, `log.a`, `log.b`, `stump`, `cooler`, `backpack`, `lantern`, `planks`, `pine.ring` (×7), `pine.side` (×6), `tree.back`, `rock`, `fern`

**`classroom`** — Classroom, sky `indoor`, ground 30×30 m

> `floor`, `wall.north.0`, `wall.south.0`, `wall.north.1`, `wall.south.1`, `wall.north.2`, `wall.south.2`, `wall.west.0`, `wall.west.1`, `wall.west.2`, `wall.east.0`, `wall.east.1`, `wall.east.2`, `board`, `teacher.desk`, `globe`, `shelf`, `cabinet`, `desk.00`, `desk.01`, `desk.02`, `desk.10`, `desk.11`, `desk.12`, `desk.20`, `desk.21`, `desk.22`

**`construction`** — House under construction, sky `day`, ground 60×60 m

> `slab`, `frame.north`, `frame.south`, `frame.west`, `scaffold.a`, `scaffold.b`, `bricks.a`, `bricks.b`, `sand`, `mixer`, `planks`, `ladder`, `cones` (×5), `barrier.a`, `barrier.b`, `crate`, `tree`, `bush`, `fence` (×9)

**`forest`** — Forest clearing, sky `day`, ground 70×70 m

> `clearing`, `tree.0`, `tree.1`, `tree.2`, `tree.3`, `tree.4`, `tree.5`, `tree.6`, `tree.7`, `tree.8`, `tree.9`, `tree.10`, `tree.11`, `tree.12`, `tree.13`, `fern.0`, `fern.1`, `fern.2`, `fern.3`, `fern.4`, `fern.5`, `rock.a`, `rock.b`, `rock.c`, `log`, `stump`, `bush.a`, `bush.b`

**`gym`** — Gym, sky `indoor`, ground 30×30 m

> `floor`, `wall.north.a`, `wall.north.b`, `wall.west`, `wall.east`, `wall.south.a`, `wall.south.b`, `treadmill`, `bike`, `rower`, `bench`, `rack`, `plates`, `mat`, `drum`, `plant`, `bookshelf`

**`living-room`** — Living room, sky `indoor`, ground 26×26 m

> `floor`, `wall.north`, `wall.east`, `wall.west`, `wall.south`, `rug`, `sofa`, `tv`, `table`, `armchair.a`, `armchair.b`, `shelf`, `lamp`, `plant`, `picture`, `stool`

**`office`** — Office, sky `indoor`, ground 40×40 m

> `floor`, `wall.north.0`, `wall.north.1`, `wall.north.2`, `wall.north.3`, `wall.south.0`, `wall.south.1`, `wall.south.2`, `wall.south.3`, `wall.west.0`, `wall.west.1`, `wall.west.2`, `wall.east.0`, `wall.east.1`, `wall.east.2`, `divider.a`, `divider.door`, `divider.b`, `desk.a0`, `chair.a0`, `desk.a1`, `chair.a1`, `desk.a2`, `chair.a2`, `desk.a3`, `chair.a3`, `desk.b0`, `chair.b0`, `desk.b1`, `chair.b1`, `desk.b2`, `chair.b2`, `desk.b3`, `chair.b3`, `cabinet.a`, `cabinet.b`, `cooler`, `plant.a`, `table`, `seat.n0`, `seat.s0`, `seat.n1`, `seat.s1`, `seat.n2`, `seat.s2`, `seat.n3`, `seat.s3`, `seat.head`, `seat.foot`, `board`, `plant.b`, `plant.c`, `shelf`, `lamp`

**`street`** — Street, sky `dusk`, ground 60×60 m

> `road` (×6), `house.a`, `house.b`, `house.c`, `lamp` (×4), `wall` (×8), `tree.a`, `tree.b`, `bench`, `bush`

**`studio`** — Empty studio, sky `day`, ground 30×30 m

> `mark`

**`volley-court`** — Volleyball court, sky `day`, ground 60×60 m

> `net`, `line.west`, `line.east`, `line.n`, `line.s`, `bench.a`, `bench.b`, `cooler`, `tree.a`, `tree.b`, `tree.c`, `bush.a`, `bush.b`, `fence.n.0`, `fence.s.0`, `fence.n.1`, `fence.s.1`, `fence.n.2`, `fence.s.2`, `fence.n.3`, `fence.s.3`, `fence.n.4`, `fence.s.4`, `fence.n.5`, `fence.s.5`, `fence.n.6`, `fence.s.6`, `fence.n.7`, `fence.s.7`, `fence.n.8`, `fence.s.8`, `fence.n.9`, `fence.s.9`, `fence.n.10`, `fence.s.10`, `fence.n.11`, `fence.s.11`

**`warehouse`** — Cement warehouse, sky `night`, ground 40×40 m

> `floor`, `wall.north.0`, `wall.south.0`, `wall.north.1`, `wall.south.1`, `wall.west.0`, `wall.east.0`, `wall.west.1`, `wall.east.1`, `wall.west.2`, `wall.east.2`, `wall.west.3`, `wall.east.3`, `rack.00`, `rack.01`, `rack.02`, `rack.03`, `rack.04`, `rack.10`, `rack.11`, `rack.12`, `rack.13`, `rack.14`, `load.00`, `load.01`, `load.02`, `load.03`, `load.10`, `load.11`, `load.12`, `load.13`, `spill.a`, `spill.b`, `spill.c`, `drum.a`, `drum.b`, `rubble`, `planks`, `crate`

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
| `ready` | solo | posture | 0.6s | — |
| `row` | solo | posture | `reps` × 2.0s | `on` (needs a `seat` anchor) `reps` |
| `runTo` | solo | move | distance ÷ 3.4 m/s | `to` `via` `speed` |
| `say` | solo | speech | length of the line | `text` |
| `setTime` | solo | stage | 0s | `sky` |
| `shakeHead` | solo | overlay | 1.6s | — |
| `shoulderCarry` | group | overlay | 4.0s | `cast` `carrier`+`rider` |
| `sit` | solo | posture | 0.6s | `on` (needs a `seat` anchor) |
| `situps` | solo | overlay | `reps` × 1.8s | `reps` |
| `skipRope` | group | overlay | `reps` × 1.0s | `reps` `cast` `turnerA`+`turnerB`+`jumper` |
| `spike` | solo | overlay | `reps` × 1.6s | `reps` |
| `squats` | solo | overlay | `reps` × 1.6s | `reps` |
| `stand` | solo | posture | 0.4s | — |
| `swimTo` | solo | move | distance ÷ 0.9 m/s | `to` `via` `speed` |
| `think` | solo | speech | length of the line | `text` |
| `throw` | solo | overlay | `reps` × 1.2s | `reps` |
| `tread` | solo | posture | `reps` × 1.4s | `reps` |
| `turnTo` | solo | turn | 0.6s | `to` `yaw` `facing` |
| `wait` | solo | wait | 1s | — |
| `walkTo` | solo | move | distance ÷ 1.25 m/s | `to` `via` `speed` |
| `wave` | solo | overlay | 2.2s | `side` |

### Stories

| id | set | cast | entries |
|---|---|---|---|
| `abandoned-night` | `abandoned` | `vic` `sol` `dado` | 14 |
| `bedroom-sleeping` | `bedroom` | `vic` | 5 |
| `bedroom-talk` | `bedroom` | `leo` `mira` | 13 |
| `camp-asleep` | `camp` | `tom` `zeca` `noa` `bel` | 9 |
| `camp-night` | `camp` | `kai` `nina` `dado` | 14 |
| `classroom-lesson` | `classroom` | `tom` `noa` `dado` `pip` `zeca` `lia` `ravi` `bel` `elza` | 24 |
| `forest-walk` | `forest` | `ana` `tom` `noa` | 14 |
| `gym-session` | `gym` | `sol` `kai` `nina` `rui` `beto` | 15 |
| `lia-blender` | `studio` | `kit` | 43 |
| `living-room-evening` | `living-room` | `elza` `pip` `beto` | 16 |
| `living-room-game` | `living-room` | `tom` `dado` | 13 |
| `office-interview` | `office` | `ana` `mira` `nina` `rui` | 19 |
| `office-walkthrough` | `office` | `vic` `mira` `dado` `pip` `ana` `leo` `elza` `kai` `nina` `sol` | 29 |
| `playground` | `backyard` | `ana` `leo` `tom` `noa` `pip` | 18 |
| `pool-afternoon` | `backyard` | `ana` `leo` `tom` | 17 |
| `pool-ball` | `backyard` | `tom` `noa` `zeca` `bel` | 32 |
| `rig-check` | `studio` | `kit` | 43 |
| `roll-call` | `studio` | `beto` `kai` `leo` `rui` `vic` `ana` `bia` `carmen` `elza` `lena` `mira` `nina` `sol` `dado` `ravi` `tom` `zeca` `bel` `duda` `lia` `noa` `pip` | 47 |
| `site-morning` | `construction` | `rui` `sol` `beto` | 13 |
| `street-evening` | `street` | `vic` `mira` `noa` | 13 |
| `volley-match` | `volley-court` | `tom` `noa` `zeca` `bel` `ravi` `lia` | 30 |
| `warehouse-search` | `warehouse` | `vic` `sol` `beto` | 19 |

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
