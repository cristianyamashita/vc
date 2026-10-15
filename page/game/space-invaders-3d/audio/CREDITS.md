# Space Invaders 3D sound effects — sources and license

Every clip in this folder comes from the **Sci-Fi Sounds (1.0)** pack by
[Kenney](https://www.kenney.nl), released under
[Creative Commons Zero (CC0)](http://creativecommons.org/publicdomain/zero/1.0/).
Attribution is not required; it is given here because the work deserves it.

The source `.ogg` files were folded to mono and encoded as MP3 at 160 kbps
(ambience at 128 kbps) with ffmpeg. Leading silence was trimmed; the UI click
is a 0.3 s cut of `computerNoise_000` and the ambience loop has short fades.

| File in this folder | Kenney source | Used for |
| --- | --- | --- |
| `shoot_1.mp3`, `shoot_2.mp3` | `laserSmall_000`, `laserSmall_002` | player laser |
| `alien_shoot_1.mp3`, `alien_shoot_2.mp3` | `laserRetro_001`, `laserRetro_003` | invader bombs |
| `explosion_1.mp3` … `explosion_3.mp3` | `explosionCrunch_000/002/004` | invader explosions |
| `big_explosion_1.mp3`, `big_explosion_2.mp3` | `lowFrequency_explosion_000/001` | UFO and player ship explosions |
| `shield_hit_1.mp3`, `shield_hit_2.mp3` | `impactMetal_001`, `impactMetal_003` | bunker blocks being chipped |
| `player_hit.mp3` | `laserLarge_001` | bomb hitting the player |
| `ufo_hum.mp3` | `forceField_000` | UFO fly-by |
| `wave_clear.mp3` | `forceField_003` | wave cleared / extra life |
| `ui_click.mp3` | `computerNoise_000` | menu clicks |
| `ambience.mp3` | `spaceEngineLow_001` | background engine hum (looped) |
