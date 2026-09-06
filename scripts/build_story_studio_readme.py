#!/usr/bin/env python3
"""Regenerate the catalogue section of page/game/story-studio/README.md.

The README is meant to be handed to someone — or something — that has never
seen the app, so it has to say exactly what already exists: which props have a
seat to sit on, which placements a story can remove, what every character is
called. Writing that by hand guarantees it goes stale, so it is generated from
the documents themselves and pasted between two markers.

    python3 scripts/build_story_studio_readme.py
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "page" / "game" / "story-studio"
DATA = APP / "data"
README = APP / "README.md"

START = "<!-- catalogue:start -->"
END = "<!-- catalogue:end -->"

FOLDER = {
    "character": "characters",
    "prop": "props",
    "set": "sets",
    "action": "actions",
    "story": "stories",
}


def load(kind: str) -> list[dict]:
    index = json.loads((DATA / "index.json").read_text())
    out = []
    for name in index[FOLDER[kind]]:
        out.append(json.loads((DATA / FOLDER[kind] / name).read_text()))
    return sorted(out, key=lambda d: d["id"])


def en(doc: dict, field: str = "name") -> str:
    value = doc.get(field)
    if isinstance(value, str):
        return value
    return (value or {}).get("en", doc.get("id", ""))


def placements(doc: dict) -> list[str]:
    """Placement ids a story can remove, tint or sit somebody on.

    A `repeat` placement becomes `<id>.0` … `<id>.N-1`, and removing the bare
    id takes all of them, so both spellings are worth showing.
    """
    out = []
    for pl in doc.get("props", []):
        count = (pl.get("repeat") or {}).get("count", 1)
        out.append(f"`{pl['id']}`" + (f" (×{count})" if count > 1 else ""))
    return out


def characters() -> list[str]:
    rows = ["| id | plan | height | build | hair | outfits |", "|---|---|---|---|---|---|"]
    for d in load("character"):
        look = d.get("look", {})
        hair = look.get("hairStyle", "—")
        length = look.get("hairLength")
        if length is not None:
            hair += f" {length}"
        wardrobe = " ".join(f"`{w['id']}`" for w in d.get("wardrobe", []))
        rows.append(
            f"| `{d['id']}` | {d.get('base', 'man')} | {d.get('height', '—')} m | "
            f"{d.get('build', 0.5)} | {hair} | {wardrobe} |"
        )
    return rows


def props() -> list[str]:
    rows = ["| id | source | anchors | light | footprint |", "|---|---|---|---|---|"]
    for d in load("prop"):
        anchors = " ".join(f"`{k}`" for k in sorted(d.get("anchors", {}))) or "—"
        light = "yes" if d.get("light") else "—"
        fp = d.get("footprint", [0, 0])
        rows.append(
            f"| `{d['id']}` | {d['source']['type']} | {anchors} | {light} | "
            f"{fp[0]}×{fp[1]} |"
        )
    return rows


def sets() -> list[str]:
    out = []
    for d in load("set"):
        size = d.get("ground", {}).get("size", [0, 0])
        out.append(f"**`{d['id']}`** — {en(d)}, sky `{d.get('sky', 'day')}`, "
                   f"ground {size[0]}×{size[1]} m")
        out.append("")
        out.append("> " + ", ".join(placements(d)))
        out.append("")
    return out


def actions() -> list[str]:
    rows = ["| id | category | type | length | reads |", "|---|---|---|---|---|"]
    for d in load("action"):
        if d.get("reps"):
            length = f"`reps` × {d.get('period')}s"
        elif d.get("type") == "move":
            length = f"distance ÷ {d.get('speed', 1.25)} m/s"
        elif d.get("type") == "speech":
            length = "length of the line"
        elif d.get("duration") is not None:
            length = f"{d['duration']}s"
        else:
            length = "—"
        reads = []
        if d.get("type") == "move":
            reads += ["`to`", "`via`", "`speed`"]
        if d.get("anchor"):
            reads.append(f"`on` (needs a `{d['anchor']}` anchor)")
        if d.get("mirrorable"):
            reads.append("`side`")
        if d.get("reps"):
            reads.append("`reps`")
        if d.get("type") == "speech":
            reads.append("`text`")
        if d.get("type") == "hold":
            reads += (["`prop`", "`hand`"] if d.get("grabs") is not False else [])
        if d.get("poseByFace"):
            reads.append("`face`")
        if d.get("category") == "group":
            reads.append("`cast` " + "+".join(f"`{r['id']}`" for r in d.get("roles", [])))
        if d.get("type") == "camera":
            reads += ["`at`", "`look`", "`fov`"]
        if d.get("type") == "cameraFollow":
            reads += ["`target`", "`for`"]
        if d.get("type") == "turn":
            reads += ["`to`", "`yaw`", "`facing`"]
        if d.get("type") == "stage":
            reads.append("`id`" if d["id"] != "setTime" else "`sky`")
        rows.append(
            f"| `{d['id']}` | {d.get('category', 'solo')} | {d.get('type')} | {length} | "
            f"{' '.join(reads) or '—'} |"
        )
    return rows


def stories() -> list[str]:
    rows = ["| id | set | cast | entries |", "|---|---|---|---|"]
    for d in load("story"):
        cast = " ".join(f"`{c['id']}`" for c in d.get("cast", []))
        rows.append(f"| `{d['id']}` | `{d['set']}` | {cast or '—'} | {len(d.get('timeline', []))} |")
    return rows


def main() -> None:
    block = [
        START,
        "",
        "_Generated by `scripts/build_story_studio_readme.py`. Run it after"
        " adding documents to `data/`._",
        "",
        "### Characters",
        "",
        *characters(),
        "",
        "### Objects",
        "",
        "A prop's anchors are what actions can use it for: `seat` for `sit`,"
        " `lie` for `lie` and `benchPress`, `stand` for a machine you stand on,"
        " `grip` for anything that can be carried.",
        "",
        *props(),
        "",
        "### Sets",
        "",
        "Each list is the placement ids a story can `remove`, `tint` or sit an"
        " actor on. A `×N` placement expands to `id.0` … `id.N-1`, and removing"
        " the bare id removes all of them.",
        "",
        *sets(),
        "### Actions",
        "",
        *actions(),
        "",
        "### Stories",
        "",
        *stories(),
        "",
        END,
    ]

    text = README.read_text()
    if START in text and END in text:
        head = text.split(START)[0]
        tail = text.split(END)[1]
        README.write_text(head + "\n".join(block) + tail)
    else:
        README.write_text(text.rstrip() + "\n\n" + "\n".join(block) + "\n")
    print(f"Wrote catalogue into {README}")


if __name__ == "__main__":
    main()
