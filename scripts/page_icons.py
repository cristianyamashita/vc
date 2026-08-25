"""Geometric icon catalog for VC pages.

Coordinates live in a 32x32 viewBox. The teal rounded square is drawn
automatically; catalog entries are the white/dark glyphs only.
"""

from __future__ import annotations

import math
from typing import Any

TEAL = "#008f7d"
WHITE = "#ffffff"
DARK = "#006056"
SIZE = 32
BG_RADIUS = 7

Shape = dict[str, Any]


def r(x, y, w, h, fill=WHITE, rad=0, stroke=None, sw=0) -> Shape:
    return {"t": "rect", "x": x, "y": y, "w": w, "h": h, "fill": fill, "rad": rad, "stroke": stroke, "sw": sw}


def c(cx, cy, rad, fill=WHITE, stroke=None, sw=0) -> Shape:
    return {"t": "circle", "cx": cx, "cy": cy, "r": rad, "fill": fill, "stroke": stroke, "sw": sw}


def e(cx, cy, rx, ry, fill=WHITE, stroke=None, sw=0) -> Shape:
    return {"t": "ellipse", "cx": cx, "cy": cy, "rx": rx, "ry": ry, "fill": fill, "stroke": stroke, "sw": sw}


def l(x1, y1, x2, y2, stroke=WHITE, sw=2) -> Shape:
    return {"t": "line", "x1": x1, "y1": y1, "x2": x2, "y2": y2, "stroke": stroke, "sw": sw}


def p(pts, fill=WHITE, stroke=None, sw=0) -> Shape:
    return {"t": "poly", "pts": list(pts), "fill": fill, "stroke": stroke, "sw": sw}


def pl(pts, stroke=WHITE, sw=2) -> Shape:
    return {"t": "polyline", "pts": list(pts), "stroke": stroke, "sw": sw}


def _hex(cx, cy, rad, rot=0.0):
    return [
        (round(cx + rad * math.cos(rot + i * math.pi / 3), 2), round(cy + rad * math.sin(rot + i * math.pi / 3), 2))
        for i in range(6)
    ]


def _star(cx, cy, ro, ri, n=5, rot=-math.pi / 2):
    pts = []
    for i in range(n * 2):
        ang = rot + i * math.pi / n
        rr = ro if i % 2 == 0 else ri
        pts.append((round(cx + rr * math.cos(ang), 2), round(cy + rr * math.sin(ang), 2)))
    return pts


def _ring(cx, cy, outer, inner, sw=2):
    return c(cx, cy, outer, fill=None, stroke=WHITE, sw=sw)


def slug_from_relpath(rel: str) -> str:
    rel = rel.replace("\\", "/").lstrip("./")
    if rel.startswith("page/"):
        rel = rel[5:]
    parts = [part for part in rel.split("/") if part]
    if not parts:
        return "index"
    stem = parts[-1]
    if stem.endswith(".html"):
        stem = stem[:-5]
    if len(parts) == 1:
        return "index" if stem in ("index", "") else stem
    if stem == "index" and len(parts) >= 2:
        return "-".join(parts[:-1])
    return f"{parts[0]}-{stem}"


# --- catalog -----------------------------------------------------------------

ICONS: dict[str, list[Shape]] = {
    # Index
    "index": [
        r(6, 6, 8, 8, rad=2),
        r(18, 6, 8, 8, rad=2),
        r(6, 18, 8, 8, rad=2),
        r(18, 18, 8, 8, rad=2),
    ],
    # Desktop OS shell
    "os": [
        r(6, 7, 20, 14, rad=2),
        r(8, 9, 9, 7, rad=1, fill=DARK),
        r(6, 21, 20, 4),
        r(8, 22, 3, 2, fill=DARK, rad=0.5),
        r(12, 22.5, 2, 1, fill=DARK),
        r(15, 22.5, 2, 1, fill=DARK),
    ],
    # Desktop OS App Builder (native, no HTML page)
    "os-app_builder": [
        r(5, 6, 14, 12, rad=2),
        r(7, 8, 10, 7, rad=1, fill=DARK),
        r(5, 18, 14, 3),
        r(21, 8, 6, 6, rad=1),
        r(18, 16, 6, 6, rad=1, fill=DARK),
        r(24, 16, 6, 6, rad=1),
    ],
    # Mobile
    "mobile-ar_object_scanner": [
        r(7, 9, 18, 14, rad=2, fill=None, stroke=WHITE, sw=2),
        r(10, 7, 4, 3, rad=1),
        r(18, 7, 4, 3, rad=1),
        p([(14, 13), (20, 20), (12, 20)], fill=WHITE),
        r(12, 17, 6, 4, fill=DARK),
    ],
    # Utils
    "utils-flashcards_srs": [
        r(8, 8, 14, 16, rad=2, fill=DARK),
        r(10, 6, 14, 16, rad=2),
        l(13, 11, 21, 11, sw=1.5),
        l(13, 14, 20, 14, sw=1.5, stroke=DARK),
        l(13, 17, 18, 17, sw=1.5, stroke=DARK),
    ],
    "utils-data_explorer": [
        r(6, 8, 13, 16, rad=1, fill=None, stroke=WHITE, sw=1.5),
        l(6, 12, 19, 12, sw=1.2),
        l(10.5, 8, 10.5, 24, sw=1.2),
        l(15, 8, 15, 24, sw=1.2),
        c(22, 21, 5, fill=None, stroke=WHITE, sw=2),
        l(25.5, 24.5, 28, 28, sw=2),
    ],
    "utils-text_diff_studio": [
        r(6, 7, 8, 3, rad=1),
        r(6, 12, 8, 3, rad=1),
        r(6, 17, 6, 3, rad=1),
        r(6, 22, 8, 3, rad=1),
        r(18, 7, 8, 3, rad=1),
        r(18, 12, 5, 3, rad=1, fill=DARK),
        r(18, 17, 8, 3, rad=1),
        r(18, 22, 8, 3, rad=1),
    ],
    "utils-regex_playground": [
        p([(10, 8), (11.5, 12), (16, 12), (12.5, 15), (14, 20), (10, 17), (6, 20), (7.5, 15), (4, 12), (8.5, 12)]),
        pl([(20, 7), (18, 11), (20, 16), (18, 21), (20, 25)], sw=2),
        pl([(24, 7), (26, 11), (24, 16), (26, 21), (24, 25)], sw=2),
    ],
    "utils-pdf_toolbox": [
        r(8, 6, 14, 18, rad=1),
        p([(18, 6), (22, 10), (18, 10)]),
        r(10, 12, 8, 1.5, fill=DARK),
        r(10, 16, 8, 1.5, fill=DARK),
        r(10, 20, 5, 1.5, fill=DARK),
        r(11, 22, 14, 4, rad=1, fill=DARK),
    ],
    "utils-css_visual_lab": [
        r(7, 8, 12, 12, rad=2, fill=DARK),
        r(11, 11, 12, 12, rad=2, fill=WHITE),
        r(15, 14, 10, 10, rad=2, fill=DARK),
    ],
    "utils-pomodoro_garden": [
        c(16, 18, 8),
        c(13, 15, 2, fill=DARK),
        c(19, 15, 2, fill=DARK),
        p([(16, 5), (18, 11), (14, 11)]),
        l(16, 10, 16, 12, sw=2),
    ],
    "utils-whiteboard": [
        r(6, 8, 20, 14, rad=1, fill=None, stroke=WHITE, sw=2),
        r(14, 22, 4, 3),
        pl([(9, 18), (13, 12), (17, 16), (22, 10)], sw=2),
    ],
    "utils-whiteboard_google": [
        r(6, 8, 20, 16, rad=1, fill=None, stroke=WHITE, sw=2),
        r(9, 11, 5, 5, rad=1),
        c(16, 13.5, 2.6),
        p([(20, 11), (24, 11), (22, 16)]),
    ],
    "utils-whiteboard_gpt": [
        r(6, 8, 20, 16, rad=1, fill=None, stroke=WHITE, sw=2),
        r(10, 11, 12, 9, rad=0, fill=None, stroke=WHITE, sw=1.5),
        l(10, 11, 8, 9, sw=1.5),
        l(22, 11, 24, 9, sw=1.5),
        l(10, 20, 8, 22, sw=1.5),
        l(22, 20, 24, 22, sw=1.5),
    ],
    "utils-ps1": [
        r(8, 14, 16, 10, rad=1, fill=DARK),
        r(8, 8, 16, 10, rad=1),
        l(11, 12, 21, 12, sw=1.5, stroke=DARK),
    ],
    "utils-ps2": [
        r(7, 16, 16, 9, rad=1, fill=DARK),
        r(9, 11, 16, 9, rad=1, fill=WHITE),
        r(11, 6, 14, 9, rad=1),
        p([(21, 6), (25, 6), (25, 10)]),
    ],
    "utils-vector_editor": [
        p([(8, 22), (12, 8), (16, 22)]),
        c(12, 8, 1.8),
        pl([(16, 20), (20, 12), (26, 16)], sw=2),
        c(20, 12, 1.6),
        c(26, 16, 1.6),
    ],
    "utils-form_builder": [
        r(7, 6, 18, 20, rad=2, fill=None, stroke=WHITE, sw=2),
        r(10, 10, 12, 3, rad=1),
        r(10, 16, 12, 3, rad=1),
        r(10, 21, 7, 2.5, rad=1, fill=DARK),
    ],
    "utils-sprint": [
        r(6, 8, 5, 16, rad=1, fill=DARK),
        r(13, 8, 5, 11, rad=1),
        r(20, 8, 5, 14, rad=1),
        p([(24, 24), (28, 24), (26, 28)]),
    ],
    "utils-dev_utils": [
        p(_hex(16, 15, 7, rot=math.pi / 6)),
        c(16, 15, 3, fill=TEAL),
        r(15, 5, 2, 6, rad=1),
        r(15, 21, 2, 6, rad=1),
        r(8, 18, 6, 2, rad=1),
        r(18, 12, 6, 2, rad=1),
    ],
    "utils-handwritten_digit_ocr": [
        e(16, 11, 6, 5, fill=None, stroke=WHITE, sw=2.4),
        e(16, 21, 6, 5, fill=None, stroke=WHITE, sw=2.4),
        r(10, 14, 12, 4, fill=TEAL),
    ],
    "utils-color_picker": [
        c(14, 13, 8, fill=None, stroke=WHITE, sw=2.2),
        c(14, 13, 4),
        p([(19, 18), (27, 26), (23, 28), (17, 20)]),
        r(20, 21, 4, 2, fill=DARK),
    ],
    "utils-local_image_gallery": [
        r(6, 6, 9, 9, rad=1),
        r(17, 6, 9, 9, rad=1),
        r(6, 17, 9, 9, rad=1),
        r(17, 17, 9, 9, rad=1),
        c(10.5, 9.5, 1.4, fill=DARK),
        c(21.5, 20.5, 1.4, fill=DARK),
    ],
    "utils-image_to_webp": [
        r(7, 8, 18, 14, rad=1),
        p([(21, 8), (25, 12), (21, 12)]),
        p([(9, 19), (14, 13), (18, 17), (21, 14), (23, 19)]),
    ],
    "utils-images_to_pdf": [
        r(6, 8, 7, 6, rad=1),
        r(10, 12, 7, 6, rad=1, fill=DARK),
        r(14, 16, 7, 6, rad=1),
        r(20, 7, 7, 18, rad=1, fill=None, stroke=WHITE, sw=1.8),
        l(22, 12, 25, 12, sw=1.4),
        l(22, 16, 25, 16, sw=1.4),
    ],
    "utils-age_calculator": [
        c(16, 16, 10, fill=None, stroke=WHITE, sw=2),
        c(16, 16, 6, fill=None, stroke=WHITE, sw=2),
        c(16, 16, 2),
    ],
    "utils-morse_code": [
        c(8, 16, 3),
        r(14, 13.5, 8, 5, rad=1.5),
        c(26, 16, 3),
    ],
    "utils-checklist": [
        r(7, 7, 18, 18, rad=2, fill=None, stroke=WHITE, sw=2),
        pl([(11, 16), (15, 21), (22, 12)], sw=2.4),
    ],
    "utils-gallery": [
        r(6, 10, 20, 14, rad=1),
        c(12, 15, 2, fill=DARK),
        p([(8, 22), (14, 16), (18, 20), (22, 15), (26, 22)]),
    ],
    "utils-char_art_creator": [
        r(7, 7, 5, 5),
        r(13, 7, 5, 3),
        r(20, 7, 5, 5),
        r(7, 14, 3, 5),
        r(12, 13, 8, 6),
        r(22, 14, 4, 4),
        r(7, 21, 5, 4),
        r(14, 21, 4, 4),
        r(20, 20, 6, 5),
    ],
    "utils-fake_data_generator": [
        r(8, 7, 16, 18, rad=2),
        c(16, 13, 3, fill=DARK),
        r(11, 18, 10, 2, rad=1, fill=DARK),
        r(13, 21, 6, 2, rad=1, fill=DARK),
    ],
    "utils-kanban": [
        r(6, 7, 6, 5, rad=1),
        r(6, 14, 6, 8, rad=1),
        r(13, 7, 6, 8, rad=1),
        r(13, 17, 6, 5, rad=1),
        r(20, 7, 6, 4, rad=1),
        r(20, 13, 6, 9, rad=1, fill=DARK),
    ],
    "utils-step_sequencer": [
        r(7, 7, 4, 4, rad=1),
        r(13, 7, 4, 4, rad=1, fill=DARK),
        r(19, 7, 4, 4, rad=1),
        r(7, 13, 4, 4, rad=1, fill=DARK),
        r(13, 13, 4, 4, rad=1),
        r(19, 13, 4, 4, rad=1, fill=DARK),
        r(7, 19, 4, 4, rad=1),
        r(13, 19, 4, 4, rad=1, fill=DARK),
        r(19, 19, 4, 4, rad=1),
        r(25, 7, 2, 16, rad=1),
    ],
    "utils-calculator": [
        r(8, 6, 16, 20, rad=2, fill=None, stroke=WHITE, sw=2),
        r(11, 9, 10, 4, rad=1),
        r(11, 15, 3, 3, rad=0.6),
        r(15.5, 15, 3, 3, rad=0.6),
        r(20, 15, 3, 3, rad=0.6, fill=DARK),
        r(11, 20, 3, 3, rad=0.6),
        r(15.5, 20, 3, 3, rad=0.6),
        r(20, 20, 3, 3, rad=0.6),
    ],
    "utils-timer": [
        c(16, 17, 9, fill=None, stroke=WHITE, sw=2.2),
        r(14, 6, 4, 3, rad=1),
        l(16, 17, 16, 11, sw=2),
        l(16, 17, 21, 19, sw=2),
        c(16, 17, 1.4),
    ],
    "utils-todo": [
        r(7, 8, 4, 4, rad=1, fill=None, stroke=WHITE, sw=1.6),
        pl([(8, 10), (9.5, 12), (12, 8)], sw=1.6),
        r(15, 9, 10, 2, rad=1),
        r(7, 15, 4, 4, rad=1, fill=None, stroke=WHITE, sw=1.6),
        r(15, 16, 10, 2, rad=1),
        r(7, 22, 4, 4, rad=1, fill=None, stroke=WHITE, sw=1.6),
        r(15, 23, 8, 2, rad=1),
    ],
    "utils-credit_planner": [
        e(16, 22, 8, 3),
        e(16, 17, 8, 3, fill=DARK),
        e(16, 12, 8, 3),
        e(16, 12, 5, 1.6, fill=TEAL),
    ],
    "utils-notebook": [
        r(9, 6, 16, 20, rad=1),
        c(9, 10, 1.6, fill=DARK),
        c(9, 16, 1.6, fill=DARK),
        c(9, 22, 1.6, fill=DARK),
        l(13, 11, 21, 11, sw=1.4, stroke=DARK),
        l(13, 15, 21, 15, sw=1.4, stroke=DARK),
        l(13, 19, 18, 19, sw=1.4, stroke=DARK),
    ],
    "utils-markdown": [
        r(8, 6, 16, 20, rad=1),
        r(11, 10, 10, 3, fill=DARK),
        r(11, 16, 10, 1.6, fill=DARK),
        r(11, 20, 7, 1.6, fill=DARK),
    ],
    "utils-obsidian": [
        p(_hex(16, 16, 10, rot=math.pi / 6)),
        p(_hex(16, 16, 5, rot=math.pi / 6), fill=DARK),
    ],
    "utils-test_builder": [
        r(10, 6, 14, 20, rad=1),
        r(8, 8, 14, 18, rad=1, fill=DARK),
        r(10, 6, 14, 20, rad=1, fill=None, stroke=WHITE, sw=1.8),
        pl([(14, 16), (17, 20), (22, 12)], sw=2),
    ],
    "utils-audio_player": [
        p([(8, 12), (14, 12), (20, 7), (20, 25), (14, 20), (8, 20)]),
        c(24, 16, 3, fill=None, stroke=WHITE, sw=1.8),
        c(24, 16, 6, fill=None, stroke=WHITE, sw=1.6),
    ],
    "utils-copy_tool": [
        r(8, 10, 12, 14, rad=1, fill=DARK),
        r(12, 6, 12, 14, rad=1),
    ],
    "utils-fullscreen_message": [
        r(6, 8, 20, 14, rad=1, fill=None, stroke=WHITE, sw=2),
        r(9, 13, 14, 4, rad=1),
        r(12, 22, 8, 2, rad=1),
    ],
    "utils-password_generator": [
        r(8, 14, 10, 7, rad=2),
        c(13, 14, 5, fill=None, stroke=WHITE, sw=2),
        r(18, 16, 8, 3, rad=1),
        r(24, 14, 2, 2),
        r(24, 19, 2, 2),
    ],
    "utils-forex_times": [
        c(11, 14, 7, fill=None, stroke=WHITE, sw=2),
        l(11, 14, 11, 10, sw=1.6),
        l(11, 14, 15, 15, sw=1.6),
        r(20, 8, 3, 8),
        r(20, 16, 3, 6, fill=DARK),
        r(25, 11, 3, 6),
        r(25, 17, 3, 7, fill=DARK),
    ],
    "utils-world_clocks": [
        c(16, 16, 10, fill=None, stroke=WHITE, sw=2),
        e(16, 16, 5, 10, fill=None, stroke=WHITE, sw=1.6),
        l(6, 16, 26, 16, sw=1.6),
        l(16, 6, 16, 26, sw=1.6),
    ],
    "utils-bitwise_converter": [
        r(5, 12, 4, 8, rad=1),
        r(10, 12, 4, 8, rad=1, fill=DARK),
        r(15, 12, 4, 8, rad=1),
        r(20, 12, 4, 8, rad=1, fill=DARK),
        r(25, 12, 3, 8, rad=1),
    ],
    "utils-prompt_concat": [
        r(5, 10, 9, 12, rad=1),
        r(18, 10, 9, 12, rad=1),
        r(14, 14, 4, 4, rad=1, fill=DARK),
        l(16, 12, 16, 20, sw=2),
        l(12, 16, 20, 16, sw=2),
    ],
    "utils-wheel_picker": [
        c(16, 17, 10, fill=None, stroke=WHITE, sw=2.2),
        c(16, 17, 3),
        p([(16, 5), (18, 11), (14, 11)]),
        l(16, 17, 23, 12, sw=2),
    ],
    "utils-time_diff": [
        c(10, 16, 6, fill=None, stroke=WHITE, sw=2),
        l(10, 16, 10, 12, sw=1.6),
        c(22, 16, 6, fill=None, stroke=WHITE, sw=2),
        l(22, 16, 25, 14, sw=1.6),
        p([(15, 16), (18, 14), (18, 18)]),
    ],
    "utils-band_calc": [
        r(6, 13, 20, 6, rad=3),
        r(11, 13, 2, 6, fill=DARK),
        r(15, 13, 2, 6, fill=TEAL),
        r(19, 13, 2, 6, fill=DARK),
        r(23, 13, 1.5, 6),
        r(4, 14, 3, 4, rad=1),
        r(25, 14, 3, 4, rad=1),
    ],
    "utils-paste_canvas": [
        r(8, 7, 12, 4, rad=1),
        r(7, 9, 14, 16, rad=1, fill=DARK),
        r(14, 13, 12, 12, rad=1),
    ],
    "utils-backup": [
        r(12, 14, 8, 10, rad=1),
        pl([(22, 12), (26, 10), (24, 16)], sw=2),
        pl([(10, 20), (6, 22), (8, 16)], sw=2),
        c(16, 16, 11, fill=None, stroke=WHITE, sw=1.8),
    ],
    "utils-pixel1": [
        r(7, 7, 9, 9),
        r(16, 7, 9, 9, fill=DARK),
        r(7, 16, 9, 9, fill=DARK),
        r(16, 16, 9, 9),
    ],
    "utils-pixel2": [
        r(7, 7, 3, 3),
        r(11, 7, 3, 3, fill=DARK),
        r(15, 7, 3, 3),
        r(19, 7, 3, 3),
        r(7, 11, 3, 3),
        r(11, 11, 3, 3),
        r(15, 11, 3, 3, fill=DARK),
        r(19, 11, 3, 3),
        r(7, 15, 3, 3, fill=DARK),
        r(11, 15, 3, 3),
        r(15, 15, 3, 3),
        r(19, 15, 3, 3, fill=DARK),
        r(7, 19, 3, 3),
        r(11, 19, 3, 3),
        r(15, 19, 3, 3, fill=DARK),
        r(19, 19, 3, 3),
        p([(23, 20), (27, 26), (21, 26)]),
    ],
    "utils-video_trimmer": [
        r(6, 10, 4, 12, rad=1),
        r(11, 10, 4, 12, rad=1, fill=DARK),
        r(16, 10, 4, 12, rad=1),
        r(21, 10, 4, 12, rad=1),
        p([(20, 6), (28, 16), (20, 16)]),
    ],
    "utils-code_flow": [
        r(10, 5, 12, 6, rad=1),
        p([(16, 13), (23, 18), (16, 23), (9, 18)]),
        r(10, 24, 12, 5, rad=1),
        l(16, 11, 16, 13, sw=1.6),
        l(16, 23, 16, 24, sw=1.6),
    ],
    "utils-collage": [
        r(6, 8, 12, 10, rad=1, fill=DARK),
        r(12, 12, 12, 10, rad=1),
        r(8, 16, 10, 8, rad=1, fill=WHITE),
    ],
    "utils-wordpad": [
        r(8, 6, 16, 20, rad=1),
        l(11, 11, 21, 11, sw=1.5, stroke=DARK),
        l(11, 15, 21, 15, sw=1.5, stroke=DARK),
        l(11, 19, 18, 19, sw=1.5, stroke=DARK),
    ],
    "utils-prompt_context": [
        r(6, 8, 10, 8, rad=1),
        r(16, 16, 10, 8, rad=1),
        l(16, 12, 16, 16, sw=2),
        l(11, 16, 16, 16, sw=2),
    ],
    "utils-mindmap": [
        c(16, 16, 4),
        c(7, 8, 3),
        c(26, 10, 3),
        c(10, 25, 3),
        l(13, 14, 9, 10, sw=2),
        l(19, 14, 24, 11, sw=2),
        l(14, 19, 11, 23, sw=2),
    ],
    "utils-slides": [
        r(8, 14, 14, 10, rad=1, fill=DARK),
        r(10, 10, 14, 10, rad=1),
        r(12, 6, 14, 10, rad=1),
    ],
    # Games
    "game-forex_sim": [
        r(7, 8, 3, 10),
        r(7, 18, 3, 6, fill=DARK),
        r(13, 6, 3, 8),
        r(13, 14, 3, 10, fill=DARK),
        r(19, 10, 3, 6),
        r(19, 16, 3, 8, fill=DARK),
        r(25, 7, 3, 9),
        r(25, 16, 3, 7, fill=DARK),
    ],
    "game-factory_flow": [
        r(5, 18, 22, 4, rad=1),
        c(16, 12, 6, fill=None, stroke=WHITE, sw=2),
        r(15, 5, 2, 5),
        r(15, 16, 2, 3),
        r(9, 11, 5, 2),
        r(18, 11, 5, 2),
        r(20, 20, 6, 5, rad=1, fill=DARK),
    ],
    "game-marble_track_builder": [
        pl([(6, 10), (12, 8), (16, 14), (22, 12), (26, 18)], sw=3),
        c(10, 10, 2.4),
        r(22, 20, 6, 4, rad=1),
    ],
    "game-cargo_dispatcher": [
        r(5, 14, 8, 5, rad=1),
        r(13, 14, 8, 5, rad=1, fill=DARK),
        r(21, 14, 6, 5, rad=1),
        l(5, 20, 27, 20, sw=2),
        l(16, 20, 16, 26, sw=2),
        l(16, 26, 22, 26, sw=2),
        c(9, 19, 1.4, fill=DARK),
        c(17, 19, 1.4),
    ],
    "game-service-tycoon": [
        r(8, 12, 16, 14),
        p([(8, 12), (16, 6), (24, 12)]),
        r(14, 18, 4, 8, fill=DARK),
        r(10, 15, 3, 3, fill=DARK),
        r(19, 15, 3, 3, fill=DARK),
        c(7, 26, 2),
        r(6, 24, 2, 4),
    ],
    "game-river-raid": [
        pl([(10, 6), (8, 12), (12, 18), (9, 24), (13, 28)], sw=3),
        pl([(22, 6), (24, 12), (20, 18), (23, 24), (19, 28)], sw=3),
        p([(16, 8), (20, 16), (16, 14), (12, 16)]),
    ],
    "game-tetris1": [
        r(10, 8, 6, 6),
        r(10, 14, 6, 6),
        r(10, 20, 6, 6),
        r(16, 20, 6, 6),
    ],
    "game-vision_tetris": [
        r(6, 8, 5, 5),
        r(6, 13, 5, 5),
        r(6, 18, 5, 5),
        r(11, 18, 5, 5),
        e(22, 14, 6, 4, fill=None, stroke=WHITE, sw=1.8),
        c(22, 14, 2),
    ],
    "game-vision_balloon_ball": [
        c(16, 13, 7),
        c(14, 11, 1.6, fill=DARK),
        p([(10, 22), (16, 18), (22, 22), (16, 26)]),
    ],
    "game-vision_hand_pong": [
        r(6, 10, 3, 12, rad=1),
        r(23, 10, 3, 12, rad=1),
        c(16, 16, 3),
        r(6, 6, 3, 3, rad=1, fill=DARK),
        r(23, 23, 3, 3, rad=1, fill=DARK),
    ],
    "game-tower-defense": [
        r(6, 22, 20, 4, rad=1),
        r(10, 12, 6, 10),
        r(9, 9, 8, 4, rad=1),
        r(12, 6, 2, 4),
        pl([(16, 20), (26, 16), (26, 22)], sw=2),
    ],
    "game-tower-defense-3d": [
        p([(10, 22), (16, 18), (22, 22), (16, 26)]),
        p([(12, 16), (16, 8), (20, 16), (16, 18)]),
        r(15, 5, 2, 4),
        p([(8, 24), (24, 24), (22, 28), (10, 28)], fill=DARK),
    ],
    "game-game1": [
        p([(16, 6), (20, 16), (16, 14), (12, 16)]),
        r(15, 14, 2, 10, rad=1),
        r(12, 23, 8, 3, rad=1),
    ],
    "game-cube-bash-arena": [
        r(9, 9, 14, 14, rad=1),
        l(9, 9, 16, 5, sw=1.6),
        l(23, 9, 16, 5, sw=1.6),
        l(23, 9, 27, 14, sw=1.6),
        l(23, 23, 27, 18, sw=1.6),
        p([(20, 8), (26, 6), (24, 12)]),
    ],
    "game-vehicle-bash-arena": [
        r(6, 16, 20, 7, rad=2),
        r(10, 11, 10, 6, rad=1),
        c(11, 23, 3),
        c(21, 23, 3),
        r(18, 8, 3, 5, rad=1),
    ],
    "game-helicopter-command": [
        e(16, 16, 10, 4),
        r(15, 10, 2, 8, rad=1),
        e(16, 10, 8, 2),
        r(16, 16, 10, 2, rad=1),
        r(24, 15, 3, 6, rad=1),
    ],
    "game-2048-shooter": [
        r(7, 7, 8, 8, rad=1),
        r(17, 7, 8, 8, rad=1),
        r(7, 17, 8, 8, rad=1, fill=DARK),
        r(17, 17, 8, 8, rad=1),
        p([(12, 20), (16, 14), (20, 20)]),
    ],
    "game-endless-coaster": [
        pl([(5, 20), (10, 10), (16, 16), (16, 8), (22, 14), (27, 10)], sw=2.6),
        c(16, 12, 5, fill=None, stroke=WHITE, sw=2),
        r(6, 22, 4, 3, rad=1),
    ],
    "game-rail-siege": [
        pl([(5, 22), (10, 12), (16, 18), (16, 8), (24, 14)], sw=2.4),
        c(16, 13, 4, fill=None, stroke=WHITE, sw=2),
        p([(22, 8), (28, 10), (24, 14)]),
        r(6, 23, 5, 3, rad=1),
    ],
    "game-ten-second-stop": [
        c(16, 17, 9, fill=None, stroke=WHITE, sw=2.2),
        r(14, 6, 4, 3, rad=1),
        p([(16, 8), (17.5, 17), (14.5, 17)]),
        r(15, 7, 2, 2, fill=DARK),
    ],
    "game-cube": [
        r(7, 7, 18, 18, rad=1, fill=None, stroke=WHITE, sw=2),
        l(13, 7, 13, 25, sw=1.5),
        l(19, 7, 19, 25, sw=1.5),
        l(7, 13, 25, 13, sw=1.5),
        l(7, 19, 25, 19, sw=1.5),
        r(13, 13, 6, 6),
    ],
    "game-checkers": [
        r(7, 7, 9, 9),
        r(16, 7, 9, 9, fill=DARK),
        r(7, 16, 9, 9, fill=DARK),
        r(16, 16, 9, 9),
        c(11.5, 11.5, 2.4, fill=TEAL),
        c(20.5, 20.5, 2.4, fill=WHITE),
    ],
    "game-chess": [
        r(8, 22, 16, 4, rad=1),
        r(12, 14, 8, 8, rad=1),
        r(14, 8, 4, 8, rad=1),
        r(11, 8, 10, 3, rad=1),
        r(15, 5, 2, 4, rad=1),
    ],
    "game-domino": [
        r(7, 10, 18, 12, rad=2),
        l(16, 10, 16, 22, sw=1.6, stroke=DARK),
        c(12, 16, 1.8, fill=DARK),
        c(20, 13, 1.6, fill=DARK),
        c(20, 19, 1.6, fill=DARK),
    ],
    "game-game5": [
        p([(16, 7), (22, 25), (16, 21), (10, 25)]),
        p([(24, 8), (28, 14), (22, 13)]),
        c(8, 20, 3),
    ],
    "game-snake": [
        r(7, 8, 5, 5, rad=1),
        r(12, 8, 5, 5, rad=1),
        r(17, 8, 5, 5, rad=1),
        r(17, 13, 5, 5, rad=1),
        r(17, 18, 5, 5, rad=1),
        r(12, 18, 5, 5, rad=1),
        r(7, 18, 5, 5, rad=1, fill=DARK),
        c(24, 20, 2.4),
    ],
    "game-game2": [
        c(16, 16, 4),
        c(16, 16, 10, fill=None, stroke=WHITE, sw=1.8),
        c(16, 6, 2.2),
        c(25, 20, 2.2),
        c(7, 20, 2.2),
    ],
    "game-game3": [
        p([(8, 10), (24, 8), (26, 16), (18, 14), (20, 24), (10, 20)]),
        c(12, 16, 2, fill=DARK),
    ],
    "game-game6": [
        p([(6, 24), (8, 12), (16, 8), (24, 12), (26, 24)]),
        r(6, 24, 20, 3, fill=TEAL),
        p([(16, 14), (19, 22), (16, 20), (13, 22)]),
    ],
    "game-custom_image_puzzle": [
        r(7, 7, 8, 8),
        r(17, 7, 8, 8),
        r(7, 17, 8, 8),
        r(17, 17, 8, 8, fill=None, stroke=WHITE, sw=1.6),
    ],
    "game-math_quiz": [
        r(7, 14, 8, 3, rad=1),
        r(9.5, 11.5, 3, 8, rad=1),
        r(18, 12, 8, 3, rad=1),
        r(18, 18, 8, 3, rad=1),
    ],
    "game-flip": [
        r(8, 8, 12, 16, rad=1, fill=DARK),
        r(12, 8, 12, 16, rad=1),
        p([(24, 14), (28, 16), (24, 18)]),
    ],
    "game-morris": [
        r(8, 8, 16, 16, fill=None, stroke=WHITE, sw=2),
        r(12, 12, 8, 8, fill=None, stroke=WHITE, sw=1.6),
        l(16, 8, 16, 12, sw=1.6),
        l(16, 20, 16, 24, sw=1.6),
        l(8, 16, 12, 16, sw=1.6),
        c(8, 8, 1.8),
        c(24, 16, 1.8),
        c(16, 24, 1.8),
    ],
    "game-pac-man": [
        c(16, 16, 10),
        p([(16, 16), (26, 10), (26, 22)], fill=TEAL),
        c(14, 11, 1.6, fill=DARK),
    ],
    "game-space-invaders": [
        r(10, 8, 3, 3),
        r(19, 8, 3, 3),
        r(8, 11, 16, 8, rad=1),
        r(10, 19, 3, 4),
        r(19, 19, 3, 4),
        r(7, 14, 3, 3),
        r(22, 14, 3, 3),
        c(13, 14, 1.2, fill=DARK),
        c(19, 14, 1.2, fill=DARK),
    ],
    "game-type-invaders": [
        r(8, 6, 3, 3),
        r(16, 6, 3, 3),
        r(6, 9, 15, 7, rad=1),
        r(8, 16, 3, 3),
        r(16, 16, 3, 3),
        r(7, 22, 3, 4, rad=0.5),
        r(11, 22, 5, 4, rad=0.5),
        r(17, 22, 3, 4, rad=0.5),
        r(21, 22, 4, 4, rad=0.5, fill=DARK),
    ],
    "game-type-invaders-jp": [
        r(8, 6, 3, 3),
        r(16, 6, 3, 3),
        r(6, 9, 15, 7, rad=1),
        r(8, 16, 3, 3),
        r(16, 16, 3, 3),
        r(7, 21, 5, 5, rad=0.5),
        r(14, 21, 5, 5, rad=0.5, fill=DARK),
        r(21, 21, 5, 5, rad=0.5),
    ],
    "game-crossword": [
        r(7, 7, 18, 18, fill=None, stroke=WHITE, sw=2),
        l(13, 7, 13, 25, sw=1.5),
        l(19, 7, 19, 25, sw=1.5),
        l(7, 13, 25, 13, sw=1.5),
        l(7, 19, 25, 19, sw=1.5),
        r(13, 13, 6, 6),
    ],
    "game-word-search": [
        r(7, 7, 18, 18, fill=None, stroke=WHITE, sw=1.8),
        l(13, 7, 13, 25, sw=1.2),
        l(19, 7, 19, 25, sw=1.2),
        l(7, 13, 25, 13, sw=1.2),
        l(7, 19, 25, 19, sw=1.2),
        l(8, 24, 24, 8, sw=2.4),
    ],
    "game-tic-tac-toe": [
        l(13, 7, 13, 25, sw=2),
        l(19, 7, 19, 25, sw=2),
        l(7, 13, 25, 13, sw=2),
        l(7, 19, 25, 19, sw=2),
        l(8, 8, 12, 12, sw=2),
        l(12, 8, 8, 12, sw=2),
        c(22, 22, 2.4, fill=None, stroke=WHITE, sw=1.8),
    ],
    "game-missile-command": [
        r(6, 24, 5, 3, rad=1),
        r(14, 23, 5, 4, rad=1),
        r(22, 24, 5, 3, rad=1),
        pl([(8, 8), (16, 20)], sw=2),
        pl([(24, 7), (18, 18)], sw=2),
        c(8, 8, 1.6),
        c(24, 7, 1.6),
    ],
    "game-rummy": [
        r(7, 10, 10, 14, rad=1, fill=DARK),
        r(11, 8, 10, 14, rad=1),
        r(15, 10, 10, 14, rad=1, fill=WHITE),
        r(17, 13, 6, 2, fill=DARK),
    ],
    "game-traffic-lights": [
        r(12, 5, 8, 22, rad=3),
        c(16, 10, 2.4, fill=DARK),
        c(16, 16, 2.4),
        c(16, 22, 2.4, fill=DARK),
    ],
    "game-roulette": [
        c(16, 16, 10, fill=None, stroke=WHITE, sw=2.2),
        c(16, 16, 3),
        l(16, 6, 16, 13, sw=2),
        l(16, 19, 16, 26, sw=1.6),
        l(6, 16, 13, 16, sw=1.6),
        l(19, 16, 26, 16, sw=1.6),
        c(23, 10, 2),
    ],
    "game-slot-machine": [
        r(6, 8, 20, 16, rad=2, fill=None, stroke=WHITE, sw=2),
        r(9, 11, 5, 10, rad=1),
        r(14, 11, 5, 10, rad=1, fill=DARK),
        r(19, 11, 5, 10, rad=1),
        r(13, 25, 6, 3, rad=1),
    ],
    "game-ufo-tank-shooter-3d": [
        r(8, 18, 16, 6, rad=2),
        r(12, 14, 8, 5, rad=1),
        c(11, 24, 2.4),
        c(21, 24, 2.4),
        e(16, 8, 8, 3),
        e(16, 7, 4, 2, fill=DARK),
        r(15, 10, 2, 4),
    ],
    "game-traffic-pickup": [
        r(7, 8, 18, 10, rad=1, fill=None, stroke=WHITE, sw=1.8),
        r(9, 18, 8, 6, rad=1),
        r(11, 15, 4, 4, rad=1),
        c(11, 24, 1.8),
        c(15, 24, 1.8),
        r(20, 20, 6, 4, rad=1, fill=DARK),
    ],
    "game-pachinko1": [
        c(10, 10, 1.6),
        c(16, 10, 1.6),
        c(22, 10, 1.6),
        c(13, 15, 1.6),
        c(19, 15, 1.6),
        c(10, 20, 1.6),
        c(16, 20, 1.6),
        c(22, 20, 1.6),
        c(16, 6, 2.2),
        r(8, 24, 4, 3, rad=1),
        r(14, 24, 4, 3, rad=1, fill=DARK),
        r(20, 24, 4, 3, rad=1),
    ],
    "game-pachinko2": [
        c(16, 8, 2),
        c(12, 13, 1.6),
        c(20, 13, 1.6),
        c(10, 18, 1.6),
        c(16, 18, 1.6),
        c(22, 18, 1.6),
        p([(8, 24), (16, 20), (24, 24), (22, 28), (10, 28)]),
        r(14, 24, 4, 3, fill=DARK),
    ],
    "game-claw-machine": [
        r(10, 6, 12, 3, rad=1),
        r(15, 8, 2, 6),
        p([(12, 14), (16, 18), (20, 14), (18, 14), (16, 16), (14, 14)]),
        c(16, 22, 3),
        r(8, 24, 16, 3, rad=1, fill=DARK),
    ],
    "game-game4": [
        r(13, 10, 6, 10),
        r(12, 8, 8, 3, rad=1),
        r(15, 5, 2, 4),
        c(16, 16, 10, fill=None, stroke=WHITE, sw=1.6),
        c(16, 16, 14, fill=None, stroke=WHITE, sw=1.2),
    ],
    "game-race": [
        e(16, 22, 12, 4, fill=None, stroke=WHITE, sw=2),
        p([(12, 8), (20, 8), (22, 16), (10, 16)]),
        r(13, 11, 6, 3, rad=1, fill=DARK),
    ],
    "game-game7": [
        r(7, 7, 4, 18),
        r(7, 7, 18, 4),
        r(21, 7, 4, 10),
        r(13, 13, 12, 4),
        r(13, 21, 4, 4),
        r(21, 21, 4, 4),
        c(17, 25, 2),
    ],
    # Misc
    "misc-interactive_planetarium": [
        c(16, 16, 4),
        e(16, 16, 12, 6, fill=None, stroke=WHITE, sw=1.8),
        c(26, 16, 2.4),
        c(8, 12, 1.6),
    ],
    "misc-fluid_lab": [
        pl(
            [
                (16, 16),
                (20, 14),
                (22, 16),
                (20, 19),
                (16, 20),
                (12, 18),
                (11, 14),
                (14, 11),
                (19, 11),
                (23, 14),
                (23, 20),
                (18, 24),
                (12, 23),
            ],
            sw=2.2,
        ),
        c(16, 16, 2),
    ],
    "misc-webcam_music_controller": [
        p([(10, 18), (14, 14), (18, 18), (16, 24), (12, 24)]),
        r(13, 12, 6, 5, rad=2),
        pl([(22, 10), (22, 12), (24, 14), (22, 16), (24, 18), (22, 20), (22, 22)], sw=2),
        pl([(25, 8), (26, 12), (28, 14), (26, 18), (28, 20), (26, 24)], sw=1.6),
    ],
    "misc-spin1": [
        p(_hex(16, 16, 11, rot=0)),
        c(16, 16, 9, fill=TEAL),
        c(20, 14, 3),
    ],
    "misc-spin2": [
        p(_hex(16, 16, 11, rot=math.pi / 6)),
        c(16, 16, 8.5, fill=TEAL),
        c(12, 13, 2.4),
        c(20, 13, 2.4),
        c(16, 20, 2.4),
    ],
    "misc-spin3": [
        p(_hex(16, 16, 11, rot=0.3)),
        c(16, 16, 8.5, fill=TEAL),
        c(19, 12, 2.6),
        pl([(19, 12), (16, 16), (12, 22), (10, 26)], sw=1.8),
    ],
    "misc-robot_face": [
        r(7, 8, 18, 16, rad=3),
        r(11, 13, 4, 4, rad=1, fill=DARK),
        r(17, 13, 4, 4, rad=1, fill=DARK),
        r(13, 19, 6, 2, rad=1, fill=DARK),
        r(14, 6, 4, 3, rad=1),
    ],
    "misc-nebula": [
        p(_star(10, 12, 4, 1.8)),
        p(_star(22, 11, 3.5, 1.6)),
        p(_star(16, 22, 4.2, 1.8)),
        l(12, 13, 20, 12, sw=1.5),
        l(12, 14, 16, 20, sw=1.5),
        l(20, 13, 17, 20, sw=1.5),
    ],
    "misc-nebula2": [
        p(_star(10, 10, 3.4, 1.5)),
        p(_star(23, 12, 3, 1.3)),
        p(_star(12, 22, 3.2, 1.4)),
        p(_star(22, 22, 2.6, 1.2)),
        c(16, 16, 5, fill=None, stroke=WHITE, sw=2),
        c(16, 16, 2, fill=DARK),
    ],
    "misc-vision_motion_lab": [
        r(6, 10, 14, 12, rad=2, fill=None, stroke=WHITE, sw=2),
        r(10, 8, 6, 3, rad=1),
        c(13, 16, 3),
        p([(22, 12), (28, 16), (22, 20)]),
        p([(22, 16), (28, 12), (28, 20)], fill=DARK),
    ],
    "misc-eye_gaze_control": [
        e(16, 16, 12, 7),
        c(16, 16, 5, fill=DARK),
        c(16, 16, 2),
    ],
    "misc-plasma_ball_lab": [
        c(16, 16, 10, fill=None, stroke=WHITE, sw=2),
        c(16, 16, 3),
        pl([(16, 13), (14, 8), (18, 10), (16, 6)], sw=1.6),
        pl([(19, 16), (24, 14), (22, 18), (26, 18)], sw=1.6),
        pl([(14, 19), (10, 24), (14, 23), (12, 27)], sw=1.6),
    ],
    "misc-logic_circuit": [
        r(6, 10, 8, 12, rad=1),
        e(14, 16, 8, 8),
        r(6, 10, 8, 12, fill=WHITE),
        l(4, 13, 6, 13, sw=2),
        l(4, 19, 6, 19, sw=2),
        l(22, 16, 27, 16, sw=2),
    ],
    "misc-electronics_lab_3d": [
        r(8, 10, 16, 12, rad=1),
        r(6, 12, 3, 2, rad=0.5),
        r(6, 16, 3, 2, rad=0.5),
        r(6, 20, 3, 2, rad=0.5),
        r(23, 12, 3, 2, rad=0.5),
        r(23, 16, 3, 2, rad=0.5),
        r(23, 20, 3, 2, rad=0.5),
        r(12, 13, 8, 6, rad=1, fill=DARK),
    ],
    "misc-laser1": [
        p([(8, 8), (16, 16), (8, 24)]),
        l(16, 16, 27, 16, sw=2.4),
        c(27, 16, 1.8),
    ],
    "misc-code_runner": [
        r(6, 8, 20, 16, rad=2, fill=None, stroke=WHITE, sw=2),
        p([(12, 12), (20, 16), (12, 20)]),
    ],
    "misc-code_runer_sandbox": [
        r(6, 8, 20, 16, rad=2),
        r(8, 10, 16, 12, rad=1, fill=TEAL),
        p([(12, 12), (20, 16), (12, 20)]),
    ],
}

# Index href points at utils/code_runner.html, but the file lives under misc/.
ICONS["utils-code_runner"] = ICONS["misc-code_runner"]


def all_slugs() -> list[str]:
    return sorted(ICONS)
