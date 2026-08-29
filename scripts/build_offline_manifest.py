#!/usr/bin/env python3
"""Generate page/os/js/offline-manifest.js from files under page/."""

from __future__ import annotations

import hashlib
import json
import re
from html import unescape
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "page"
OUT = PAGE / "os" / "js" / "offline-manifest.js"

SKIP_DIRS = {"drafts", "__pycache__"}
SKIP_NAMES = {".ds_store", "license.txt", "thumbs.db"}
TEXT_SUFFIXES = {".html", ".js", ".css", ".webmanifest", ".json", ".svg"}
ATTR_RE = re.compile(
    r"""(?is)(?:src|href|poster|data-src|data-href)\s*=\s*["']([^"']+)["']"""
)
SRCSET_RE = re.compile(r"""(?is)srcset\s*=\s*["']([^"']+)["']""")
CSS_URL_RE = re.compile(r"""url\(\s*['"]?([^'")]+)['"]?\s*\)""")
IMPORT_RE = re.compile(r"""(?:import(?:\s*\(|\s+)|from\s+|@import\s+)['"]([^'"]+)['"]""")
ABS_RE = re.compile(r"""https?://[^\s"'<>)\\]+""")
GITHUB_PREFIXES = (
    "https://cristianyamashita.github.io/vc/page/",
    "http://cristianyamashita.github.io/vc/page/",
)
SKIP_HOSTS = {
    "github.com",
    "www.github.com",
    "w3.org",
    "www.w3.org",
    "schema.org",
    "www.schema.org",
    "www.youtube.com",
    "youtube.com",
    "www.youtube-nocookie.com",
    "www.googletagmanager.com",
    "www.google.com",
    "www.google-analytics.com",
    "example.com",
    "fontawesome.com",
    "www.fontawesome.com",
    "duckduckgo.com",
    "icons.duckduckgo.com",
    "www.chessclub.com",
    "chessclub.com",
    "worldtimeapi.org",
    "api.open-meteo.com",
    "open-meteo.com",
    "cors-anywhere.herokuapp.com",
    "api.allorigins.win",
    "r.jina.ai",
}
BARE_HOST_OK = {"cdn.tailwindcss.com"}
CDN_FILE_RE = re.compile(
    r"\.(?:js|mjs|cjs|css|json|wasm|map|woff2?|ttf|otf|eot|png|jpe?g|gif|webp|svg|task|onnx|wasm)(?:$|\?)",
    re.I,
)


def posix(path: Path) -> str:
    return path.as_posix()


def skip_dir(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)


def clean_ref(raw: str) -> str:
    ref = unescape(raw).strip()
    ref = ref.split("\\")[0].strip()
    ref = ref.rstrip("\\.,);]")
    return unquote(ref)


def is_ignored_ref(ref: str) -> bool:
    if not ref:
        return True
    lower = ref.lower()
    return lower.startswith(
        ("#", "data:", "javascript:", "mailto:", "blob:", "about:", "chrome:", "file:")
    )


def local_from_abs(url: str) -> str | None:
    for prefix in GITHUB_PREFIXES:
        if url.startswith(prefix):
            rest = url[len(prefix) :].split("?")[0].split("#")[0]
            return rest or None
    return None


def host_of(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower()
    except ValueError:
        return ""


def classify(rel: str) -> str:
    path = rel.replace("\\", "/").lstrip("./")
    lower = path.lower()
    if path.startswith(("http://", "https://")):
        return "cdn"
    if lower.endswith(".onnx") or path.startswith("models/"):
        return "models"
    if path.startswith("assets/images/"):
        return "images"
    if lower.endswith(".html") and path not in {"os/index.html", "os/offline.html", "index.html"}:
        return "pages"
    return "core"


def is_cacheable_cdn(url: str) -> bool:
    if any(token in url for token in ("${", "{", "`", " ")):
        return False
    if not url.startswith("https://"):
        return False
    host = host_of(url)
    if not host or host in SKIP_HOSTS or host.endswith(".w3.org"):
        return False
    parsed = urlparse(url)
    path = parsed.path or ""
    if path in ("", "/") and host not in BARE_HOST_OK:
        return False
    if url.endswith(("=", "&", "?")):
        return False
    if path.endswith("/") and not CDN_FILE_RE.search(url):
        # Directory-style imports (ffmpeg/three examples) often 404 as GET.
        return False
    return True


def add_url(buckets: dict[str, set[str]], rel: str) -> None:
    if not rel:
        return
    if rel.startswith(("http://", "https://")):
        local = local_from_abs(rel)
        if local:
            add_url(buckets, local)
            return
        cleaned = rel.split("#")[0]
        if is_cacheable_cdn(cleaned):
            buckets["cdn"].add(cleaned)
        return
    path = rel.replace("\\", "/").lstrip("./").split("?")[0].split("#")[0]
    if not path or path.endswith("/"):
        return
    name = path.rsplit("/", 1)[-1].lower()
    if name in SKIP_NAMES or name.startswith("."):
        return
    buckets[classify(path)].add(path)


def resolve_ref(source: Path, raw: str) -> str | None:
    ref = clean_ref(raw)
    if is_ignored_ref(ref):
        return None
    if ref.startswith(("http://", "https://")):
        return ref.split("#")[0]
    rel_target = ref.split("?")[0].split("#")[0]
    if not rel_target:
        return None
    try:
        target = (source.parent / rel_target).resolve()
        rel = target.relative_to(PAGE.resolve())
    except (OSError, ValueError):
        return None
    return posix(rel)


def extract_from_text(source: Path, text: str, buckets: dict[str, set[str]]) -> None:
    found: list[str] = []
    found.extend(ATTR_RE.findall(text))
    for srcset in SRCSET_RE.findall(text):
        for part in srcset.split(","):
            token = part.strip().split()[0] if part.strip() else ""
            if token:
                found.append(token)
    found.extend(CSS_URL_RE.findall(text))
    found.extend(IMPORT_RE.findall(text))
    found.extend(ABS_RE.findall(text))
    for raw in found:
        resolved = resolve_ref(source, raw)
        if resolved:
            add_url(buckets, resolved)


def seed_globs(buckets: dict[str, set[str]]) -> None:
    def add_file(path: Path) -> None:
        if not path.is_file() or skip_dir(path):
            return
        if path.name.lower() in SKIP_NAMES or path.name.startswith("."):
            return
        try:
            rel = posix(path.relative_to(PAGE))
        except ValueError:
            return
        add_url(buckets, rel)

    for pattern in (
        "os/**/*.js",
        "os/**/*.css",
        "os/**/*.html",
        "assets/icons/**/*.*",
        "assets/fontawesome/**/*.*",
        "assets/images/**/*.*",
        "models/**/*.*",
        "**/*.html",
    ):
        for path in PAGE.glob(pattern):
            add_file(path)

    for extra in (
        PAGE / "index.html",
        PAGE / "sw.js",
        PAGE / "manifest.webmanifest",
        PAGE / "os" / "offline.html",
        PAGE / "os" / "js" / "offline-manifest.js",
        PAGE / "os" / "js" / "offline.js",
        PAGE / "assets" / "timezones.json",
    ):
        add_file(extra)


def scan_text_files(buckets: dict[str, set[str]]) -> None:
    for path in PAGE.rglob("*"):
        if not path.is_file() or skip_dir(path):
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if path.resolve() == OUT.resolve():
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        extract_from_text(path, text, buckets)


def sorted_list(values: set[str]) -> list[str]:
    return sorted(values, key=lambda item: item.lower())


def main() -> None:
    buckets = {
        "core": set(),
        "pages": set(),
        "cdn": set(),
        "images": set(),
        "models": set(),
    }
    seed_globs(buckets)
    scan_text_files(buckets)
    buckets["core"].discard("os/js/offline-manifest.js")
    buckets["core"].add("os/js/offline-manifest.js")
    buckets["core"].add("os/js/offline.js")
    buckets["core"].add("sw.js")
    buckets["core"].add("manifest.webmanifest")
    buckets["core"].add("os/offline.html")
    buckets["core"].add("os/index.html")
    buckets["core"].add("index.html")

    payload = {
        "core": sorted_list(buckets["core"]),
        "pages": sorted_list(buckets["pages"]),
        "cdn": sorted_list(buckets["cdn"]),
        "images": sorted_list(buckets["images"]),
        "models": sorted_list(buckets["models"]),
    }
    blob = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    version = hashlib.sha256(blob.encode("utf-8")).hexdigest()[:12]
    payload["version"] = version
    OUT.parent.mkdir(parents=True, exist_ok=True)
    body = json.dumps(payload, ensure_ascii=True, indent=2)
    OUT.write_text(
        f"""/* Generated by scripts/build_offline_manifest.py — do not edit */
(function (root) {{
  root.OSOfflineManifest = {body};
}})(typeof self !== "undefined" ? self : window);
""",
        encoding="utf-8",
    )
    counts = {key: len(payload[key]) for key in ("core", "pages", "cdn", "images", "models")}
    print(
        f"Wrote {OUT} version {version} "
        f"(core={counts['core']} pages={counts['pages']} cdn={counts['cdn']} "
        f"images={counts['images']} models={counts['models']})"
    )


if __name__ == "__main__":
    main()
