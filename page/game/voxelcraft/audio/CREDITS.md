# VoxelCraft sound effects — sources and licenses

Every clip in this folder is CC0 or public domain, so it can be shipped with
the game without attribution obligations. The credits below are given anyway,
because the people who recorded these deserve them.

## How the files were prepared

Each clip is silence-trimmed, capped to a length that suits its role in the
game, peak-normalised to about -6 dBFS and encoded as mono MP3 at 160 kbps.

The order of the build matters more than any single setting: each clip is cut,
folded to mono and shaped **first**, and only then measured and normalised.
Every level bug in this pipeline came from measuring one signal and shipping
another — a window that excluded the source's real peak, a stereo file whose
mono fold moved the peak 6 dB, a probe `volumedetect` could not read.

Details worth keeping if these are ever rebuilt:

- **No fade-in.** An impact peaks in its first millisecond, so any ramp at the
  start flattens the attack — an 8 ms fade-in cost the footsteps up to 18 dB of
  their transient. Only a clip cut mid-waveform gets a short one, to avoid a
  click.
- **-6 dBFS, not -3.** Lossy encoding overshoots on transients; the extra
  headroom keeps that overshoot from reaching full scale. `MASTER_GAIN` in
  `js/sfx.js` makes the level back up.
- **160 kbps, not 96.** At the lower rate the encoder smears sharp transients —
  a gunshot, breaking glass — into a swishy mess.
- **Float all the way through.** The mono fold *sums* the channels instead of
  averaging them, because the revolver's shot sits on the right channel 12 dB
  above the left and an average throws that away. A sum can reach 1.8, so a
  16-bit intermediate clips it flat — which is what 114 of the 133 clips were
  quietly doing before.
- **The revolver is limited, not compressed.** Its crack is about two
  milliseconds long, so a compressor with a 4 ms attack never catches it and
  the clip stays as quiet as it started. A fast limiter lifts the body and tail
  against the crack; the strength is dialled per take so the two shots land at
  the same loudness instead of 6 dB apart.
- **Peak parity is not loudness parity.** Normalised to the same peak, the
  revolver measured as loud as a footstep and sounded 20 dB quieter, because
  nearly all its energy is in that one transient. Sounds like that need their
  level set by loudness — the loudest 100 ms — not by their peak.

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
