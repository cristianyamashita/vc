"""Insert <link rel="icon"> tags pointing at generated .ico files."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from page_icons import ICONS, slug_from_relpath  # noqa: E402

PAGE_ROOT = ROOT / "page"
ICON_LINK_RE = re.compile(
    r"[ \t]*<link\b[^>]*rel\s*=\s*[\"'](?:shortcut\s+)?icon[\"'][^>]*>\s*",
    re.IGNORECASE,
)
HEAD_RE = re.compile(r"<head[^>]*>", re.IGNORECASE)
SKIP_DIRS = {"assets", "models"}


def iter_pages():
    yield PAGE_ROOT / "index.html"
    for folder in ("utils", "game", "misc", "mobile", "os"):
        base = PAGE_ROOT / folder
        if not base.exists():
            continue
        for path in sorted(base.rglob("*.html")):
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            yield path


def relative_icon_href(page: Path, slug: str) -> str:
    icon = PAGE_ROOT / "assets" / "icons" / "ico" / f"{slug}.ico"
    rel = Path(os_rel(page.parent, icon))
    return rel.as_posix()


def os_rel(start: Path, target: Path) -> str:
    start_parts = start.resolve().parts
    target_parts = target.resolve().parts
    i = 0
    while i < min(len(start_parts), len(target_parts)) and start_parts[i] == target_parts[i]:
        i += 1
    ups = [".."] * (len(start_parts) - i)
    down = list(target_parts[i:])
    return "/".join(ups + down) if (ups or down) else "."


def inject(page: Path) -> bool:
    rel = page.relative_to(PAGE_ROOT).as_posix()
    slug = slug_from_relpath(rel)
    if slug not in ICONS:
        print(f"skip (no icon): {rel} -> {slug}")
        return False
    href = relative_icon_href(page, slug)
    tag = f'<link rel="icon" href="{href}" type="image/x-icon">'
    text = page.read_text(encoding="utf-8")
    text = ICON_LINK_RE.sub("", text)
    match = HEAD_RE.search(text)
    if not match:
        print(f"skip (no head): {rel}")
        return False
    insert_at = match.end()
    # Keep minified files minified; pretty-print otherwise.
    pretty = "\n" in text[: min(len(text), 400)]
    snippet = f"\n    {tag}\n" if pretty else tag
    page.write_text(text[:insert_at] + snippet + text[insert_at:], encoding="utf-8")
    return True


def main() -> None:
    count = 0
    for page in iter_pages():
        if inject(page):
            count += 1
    print(f"Injected favicons into {count} pages")


if __name__ == "__main__":
    main()
