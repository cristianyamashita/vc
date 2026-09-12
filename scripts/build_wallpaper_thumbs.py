#!/usr/bin/env python3
"""Build small WebP previews for Desktop wallpaper tiles.

Full PNG files stay on disk for the active wallpaper. The Settings picker
loads these thumbs instead of the 2 MB originals.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "page" / "assets" / "images"
OUT = IMG / "wallpaper-thumbs"
THUMB_W = 480
THUMB_H = 270
QUALITY = 72

# Keep in sync with IMAGE_WALLPAPERS in page/os/js/desktop.js
SOURCES: list[tuple[str, str]] = [
    ("hero-playground-dark.png", "playground-dark"),
    ("hero-playground-light.png", "playground-light"),
]
SOURCES.extend((f"wp{i}.png", f"wp{i}") for i in range(1, 26))
SOURCES.extend((f"w9-{i}.png", f"w9-{i}") for i in range(1, 7))


def cover_resize(im: Image.Image, width: int, height: int) -> Image.Image:
    src_w, src_h = im.size
    scale = max(width / src_w, height / src_h)
    new_w = max(width, round(src_w * scale))
    new_h = max(height, round(src_h * scale))
    resized = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
    left = max(0, (new_w - width) // 2)
    top = max(0, (new_h - height) // 2)
    return resized.crop((left, top, left + width, top + height))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    written = 0
    for filename, slug in SOURCES:
        src = IMG / filename
        if not src.is_file():
            raise SystemExit(f"missing wallpaper source: {src}")
        dest = OUT / f"{slug}.webp"
        with Image.open(src) as im:
            rgb = im.convert("RGB")
            thumb = cover_resize(rgb, THUMB_W, THUMB_H)
            thumb.save(dest, "WEBP", quality=QUALITY, method=6)
        written += 1
        print(f"{dest.relative_to(ROOT)}  {dest.stat().st_size} bytes")
    print(f"Wrote {written} thumbs to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
