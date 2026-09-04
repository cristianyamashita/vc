# VoxelCraft sound effects — sources and licenses

Every clip in this folder is CC0 or public domain, so it can be shipped with
the game without attribution obligations. The credits below are given anyway,
because the people who recorded these deserve them.

## How the files were prepared

Each clip is silence-trimmed, capped to a length that suits its role in the
game, peak-normalised to about -6 dBFS and encoded as mono MP3 at 160 kbps.

Three details matter if these are ever rebuilt:

- **No fade-in.** An impact peaks in its first millisecond, so any ramp at the
  start flattens the attack — an 8 ms fade-in cost the footsteps up to 18 dB of
  their transient. Only a clip cut mid-waveform gets a short one, to avoid a
  click.
- **-6 dBFS, not -3.** Lossy encoding overshoots on transients; the extra
  headroom keeps that overshoot from reaching full scale. `MASTER_GAIN` in
  `js/sfx.js` makes the level back up.
- **160 kbps, not 96.** At the lower rate the encoder smears sharp transients —
  a gunshot, breaking glass — into a swishy mess.

Long recordings are cut around their loudest moment rather than from the top,
since an eleven-second flock of chickens opens on ambience. The field
recordings also get a light denoise and a limit on how far they may be boosted,
so their room tone does not come up with the animal.

Relative loudness between events is set in `js/sfx.js`, not baked into the
files, so the mix can be retuned without re-exporting anything.

## Kenney — kenney.nl (CC0)

| Pack | Used for |
| --- | --- |
| Impact Sounds | footsteps (grass, sand, stone, wood, carpet), mining swings, breaking glass and soft blocks, placing, landings, ladder rungs, punches, arrow hits |
| Interface Sounds | UI click, panel open/close, drop, error, confirmation, sleep chime |
| RPG Audio | doors opening and closing, furnace, crafting latch, cloth rustle for jumps and releasing the lasso |

## OpenGameArt.org (all CC0)

| Pack | Author | Used for |
| --- | --- | --- |
| [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) | bart | revolver — Ruger Single Six, two takes |
| [80 CC0 creature SFX](https://opengameart.org/content/80-cc0-creature-sfx) | rubberduck | lion and tiger roars |
| [80 CC0 RPG SFX](https://opengameart.org/content/80-cc0-rpg-sfx) | rubberduck | breaking stone and wood, placing stone and wood, coins, pickups, chest, torch, furnace sizzle, teleport |
| [40 CC0 water / splash / slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) | rubberduck | entering water, swimming strokes |
| [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) | artisticdude | melee swings, bow release, lasso throw |
| [RPG Sound Pack](https://opengameart.org/content/rpg-sound-pack) | artisticdude | crafting |
| [grunts of male death and pain](https://opengameart.org/content/grunts-male-death-and-pain) | thebardofblasphemy | player hurt and death, villager and guard cries |
| [7 Eating Crunches](https://opengameart.org/content/7-eating-crunches) | starninjas | eating |

## Internet Archive

| Recording | License | Used for |
| --- | --- | --- |
| [Cows mooing in a stockyard, St Joseph, Missouri](https://archive.org/details/aporee_38610_44123) — Felix Blume, via radio aporee | Public Domain Mark 1.0 | cow, and pitched down for the bull — three isolated moos cut out of the five-minute recording |

## Wikimedia Commons

| File | License | Used for |
| --- | --- | --- |
| Sheep bleating.ogg | Public domain | sheep |
| Chickens demanding food.ogg | Public domain | chicken |
| Hens leaving coop.ogg | Public domain | chicken |
| Wiehern.ogg | Public domain | zebra |

## A trap worth remembering

Wikimedia Commons hosts pronunciation recordings alongside animal recordings,
and their titles look identical. `Cow in Vezo.ogg` is a person saying the word
for *cow* in the Vezo language — not a cow. It shipped as the cow, the bull and
the cow's hurt cry before anyone caught it; in Portuguese it sounded like
someone saying "aonde". OpenGameArt's "Sci-Fi Aliens and Cows Pack" is the same
trap from the other direction: its moos are described as "mouth-made", a human
imitating a cow.

Read the description and the categories of any animal recording before using
it. A file in `Category:Audio files of Bos taurus` is a cow; a file in
`Category:Vezo people` is a vocabulary lesson.
