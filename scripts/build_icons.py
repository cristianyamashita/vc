"""Render page icon catalog to SVG, PNG, and ICO files."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from page_icons import BG_RADIUS, ICONS, SIZE, TEAL  # noqa: E402

OUT = ROOT / "page" / "assets" / "icons"
PNG_SIZE = 64
ICO_SIZES = [(16, 16), (32, 32), (48, 48)]
MASTER = 128


def hex_to_rgba(value, alpha=255):
    if value is None or value == "none":
        return None
    value = value.lstrip("#")
    r = int(value[0:2], 16)
    g = int(value[2:4], 16)
    b = int(value[4:6], 16)
    return (r, g, b, alpha)


def _s(n, scale):
    return n * scale


def _xy(x, y, w, h, scale):
    x0 = _s(x, scale)
    y0 = _s(y, scale)
    return [x0, y0, x0 + _s(w, scale), y0 + _s(h, scale)]


def _pts(pts, scale):
    return [(_s(x, scale), _s(y, scale)) for x, y in pts]


def draw_shapes(draw: ImageDraw.ImageDraw, shapes, scale: float) -> None:
    for shape in shapes:
        kind = shape["t"]
        fill = hex_to_rgba(shape.get("fill"))
        stroke = hex_to_rgba(shape.get("stroke"))
        sw = max(1, round(_s(shape.get("sw") or 0, scale))) if (shape.get("sw") or 0) else 0
        if kind == "rect":
            xy = _xy(shape["x"], shape["y"], shape["w"], shape["h"], scale)
            rad = _s(shape.get("rad") or 0, scale)
            kwargs = {}
            if fill:
                kwargs["fill"] = fill
            if stroke and sw:
                kwargs["outline"] = stroke
                kwargs["width"] = sw
            if rad > 0:
                draw.rounded_rectangle(xy, radius=rad, **kwargs)
            else:
                draw.rectangle(xy, **kwargs)
        elif kind == "circle":
            cx, cy, rad = _s(shape["cx"], scale), _s(shape["cy"], scale), _s(shape["r"], scale)
            xy = [cx - rad, cy - rad, cx + rad, cy + rad]
            kwargs = {}
            if fill:
                kwargs["fill"] = fill
            if stroke and sw:
                kwargs["outline"] = stroke
                kwargs["width"] = sw
            draw.ellipse(xy, **kwargs)
        elif kind == "ellipse":
            cx, cy = _s(shape["cx"], scale), _s(shape["cy"], scale)
            rx, ry = _s(shape["rx"], scale), _s(shape["ry"], scale)
            xy = [cx - rx, cy - ry, cx + rx, cy + ry]
            kwargs = {}
            if fill:
                kwargs["fill"] = fill
            if stroke and sw:
                kwargs["outline"] = stroke
                kwargs["width"] = sw
            draw.ellipse(xy, **kwargs)
        elif kind == "line":
            p1 = (_s(shape["x1"], scale), _s(shape["y1"], scale))
            p2 = (_s(shape["x2"], scale), _s(shape["y2"], scale))
            draw.line([p1, p2], fill=stroke or fill, width=max(sw, 1))
        elif kind == "poly":
            pts = _pts(shape["pts"], scale)
            kwargs = {}
            if fill:
                kwargs["fill"] = fill
            if stroke and sw:
                kwargs["outline"] = stroke
                kwargs["width"] = sw
            draw.polygon(pts, **kwargs)
        elif kind == "polyline":
            pts = _pts(shape["pts"], scale)
            draw.line(pts, fill=stroke or fill, width=max(sw, 1), joint="curve")


def render_png(shapes, px: int) -> Image.Image:
    scale = px / SIZE
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, px - 1, px - 1], radius=_s(BG_RADIUS, scale), fill=hex_to_rgba(TEAL))
    draw_shapes(draw, shapes, scale)
    return img


def svg_attr(name, value):
    if value is None:
        return ""
    return f' {name}="{value}"'


def svg_paint(fill, stroke, sw):
    parts = []
    if fill is None or fill == "none":
        parts.append('fill="none"')
    else:
        parts.append(f'fill="{fill}"')
    if stroke:
        parts.append(f'stroke="{stroke}"')
        parts.append(f'stroke-width="{sw}"')
        parts.append('stroke-linecap="round"')
        parts.append('stroke-linejoin="round"')
    else:
        parts.append('stroke="none"')
    return " ".join(parts)


def shape_to_svg(shape) -> str:
    kind = shape["t"]
    fill = shape.get("fill")
    stroke = shape.get("stroke")
    sw = shape.get("sw") or 0
    paint = svg_paint(fill, stroke, sw)
    if kind == "rect":
        rad = shape.get("rad") or 0
        rx = f' rx="{rad}" ry="{rad}"' if rad else ""
        return f'<rect x="{shape["x"]}" y="{shape["y"]}" width="{shape["w"]}" height="{shape["h"]}"{rx} {paint}/>'
    if kind == "circle":
        return f'<circle cx="{shape["cx"]}" cy="{shape["cy"]}" r="{shape["r"]}" {paint}/>'
    if kind == "ellipse":
        return f'<ellipse cx="{shape["cx"]}" cy="{shape["cy"]}" rx="{shape["rx"]}" ry="{shape["ry"]}" {paint}/>'
    if kind == "line":
        return (
            f'<line x1="{shape["x1"]}" y1="{shape["y1"]}" x2="{shape["x2"]}" y2="{shape["y2"]}" {paint}/>'
        )
    pts = " ".join(f"{x},{y}" for x, y in shape["pts"])
    if kind == "poly":
        return f'<polygon points="{pts}" {paint}/>'
    if kind == "polyline":
        return f'<polyline points="{pts}" {paint}/>'
    raise ValueError(f"Unknown shape {kind}")


def render_svg(shapes) -> str:
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">',
        f'<rect width="{SIZE}" height="{SIZE}" rx="{BG_RADIUS}" fill="{TEAL}"/>',
    ]
    parts.extend(shape_to_svg(shape) for shape in shapes)
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def write_icon(slug: str, shapes) -> None:
    svg_dir = OUT / "svg"
    png_dir = OUT / "png"
    ico_dir = OUT / "ico"
    for folder in (svg_dir, png_dir, ico_dir):
        folder.mkdir(parents=True, exist_ok=True)

    (svg_dir / f"{slug}.svg").write_text(render_svg(shapes), encoding="utf-8")

    master = render_png(shapes, MASTER)
    png = master.resize((PNG_SIZE, PNG_SIZE), Image.Resampling.LANCZOS)
    png.save(png_dir / f"{slug}.png", format="PNG")

    master.save(ico_dir / f"{slug}.ico", format="ICO", sizes=ICO_SIZES)


def expected_slugs() -> set[str]:
    from page_icons import slug_from_relpath

    slugs = {"index"}
    page_root = ROOT / "page"
    for folder in ("utils", "game", "misc", "mobile", "os"):
        base = page_root / folder
        if not base.exists():
            continue
        for path in base.rglob("*.html"):
            rel = path.relative_to(page_root).as_posix()
            slugs.add(slug_from_relpath(rel))
    return slugs


def main() -> None:
    missing = expected_slugs() - set(ICONS)
    extra = set(ICONS) - expected_slugs()
    if missing:
        print("Missing catalog entries:", ", ".join(sorted(missing)))
    if extra:
        print("Extra catalog entries:", ", ".join(sorted(extra)))
    for slug, shapes in ICONS.items():
        write_icon(slug, shapes)
    print(f"Wrote {len(ICONS)} icons to {OUT}")


if __name__ == "__main__":
    main()
