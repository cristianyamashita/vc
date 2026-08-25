#!/usr/bin/env python3
"""Generate page/os/js/catalog.js from page/index.html cards and translations."""

from __future__ import annotations

import json
import re
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "page" / "index.html"
OUT = ROOT / "page" / "os" / "js" / "catalog.js"

DEFAULT_INSTALLED = ("utils-calculator", "utils-notebook")
SKIP_HREFS = {"os/index.html", "os.html"}


def href_to_slug(href: str) -> str:
    href = href.split("?")[0].split("#")[0].lstrip("./")
    parts = [p for p in href.split("/") if p]
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


def parse_js_object_body(text: str) -> dict[str, str]:
    i = 0
    n = len(text)
    out: dict[str, str] = {}
    while i < n:
        while i < n and text[i] in " \t\n\r,":
            i += 1
        if i >= n or text[i] == "}":
            break
        m = re.match(r"([A-Za-z0-9_]+)\s*:", text[i:])
        if not m:
            i += 1
            continue
        key = m.group(1)
        i += m.end()
        while i < n and text[i] in " \t":
            i += 1
        if i >= n or text[i] not in "'\"":
            while i < n and text[i] not in ",\n":
                i += 1
            continue
        quote = text[i]
        i += 1
        val: list[str] = []
        while i < n:
            ch = text[i]
            if ch == "\\":
                nxt = text[i + 1] if i + 1 < n else ""
                if nxt == "n":
                    val.append("\n")
                elif nxt == "t":
                    val.append("\t")
                elif nxt in ("'", '"', "\\"):
                    val.append(nxt)
                else:
                    val.append(nxt)
                i += 2
                continue
            if ch == quote:
                i += 1
                break
            val.append(ch)
            i += 1
        out[key] = unescape("".join(val))
    return out


def extract_translations(html: str) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for lang in ("en", "ja", "pt"):
        marker = f"\n        {lang}: {{"
        start = html.find(marker)
        if start < 0:
            raise SystemExit(f"missing translations.{lang}")
        start += len(marker)
        depth = 1
        i = start
        while i < len(html) and depth:
            ch = html[i]
            if ch in "'\"":
                q = ch
                i += 1
                while i < len(html):
                    if html[i] == "\\":
                        i += 2
                        continue
                    if html[i] == q:
                        i += 1
                        break
                    i += 1
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    break
            i += 1
        result[lang] = parse_js_object_body(html[start:i])
    return result


def section_channel(section_id: str) -> str:
    if section_id == "drafts-beta":
        return "beta"
    if section_id == "drafts-alpha":
        return "alpha"
    return "stable"


def extract_cards(html: str) -> list[dict[str, str]]:
    section_marks = [(m.start(), m.group(1)) for m in re.finditer(r'<section id="([^"]+)"', html)]

    def channel_at(pos: int) -> str:
        current = ""
        for start, section_id in section_marks:
            if start <= pos:
                current = section_id
            else:
                break
        return section_channel(current)

    cards: list[dict[str, str]] = []
    seen: set[str] = set()
    for m in re.finditer(r"<article\s+class=\"card\"[^>]*>(.*?)</article>", html, re.S):
        body = m.group(1)
        href_m = re.search(r'<a class="link" href="([^"]+)"', body)
        name_m = re.search(
            r'<div class="name"(?:\s+data-i18n="([^"]+)")?[^>]*>(.*?)</div>', body, re.S
        )
        tag_m = re.search(
            r'<span class="tag"(?:\s+data-i18n="([^"]+)")?[^>]*>(.*?)</span>', body, re.S
        )
        desc_m = re.search(
            r'<div class="desc"(?:\s+data-i18n="([^"]+)")?[^>]*>(.*?)</div>', body, re.S
        )
        if not href_m or not name_m:
            continue
        href = href_m.group(1).split("?")[0].split("#")[0]
        if href in SKIP_HREFS or href in seen:
            continue
        seen.add(href)
        name_key = name_m.group(1) or ""
        tag_key = tag_m.group(1) if tag_m else ""
        desc_key = desc_m.group(1) if desc_m else ""
        cards.append(
            {
                "href": href,
                "channel": channel_at(m.start()),
                "nameKey": name_key,
                "nameEn": unescape(re.sub(r"\s+", " ", name_m.group(2)).strip()),
                "tagKey": tag_key,
                "tagEn": unescape(re.sub(r"\s+", " ", tag_m.group(2)).strip()) if tag_m else "App",
                "descKey": desc_key,
                "descEn": unescape(re.sub(r"\s+", " ", desc_m.group(2)).strip()) if desc_m else "",
            }
        )
    return cards


def main() -> None:
    html = INDEX.read_text(encoding="utf-8")
    translations = extract_translations(html)
    cards = extract_cards(html)
    apps = [
        {
            "id": "settings",
            "href": None,
            "icon": "../assets/icons/svg/os.svg",
            "kind": "native",
            "uninstallable": False,
            "defaultInstalled": True,
            "channel": "stable",
            "tag": {"en": "System", "pt": "Sistema", "ja": "システム"},
            "name": {"en": "Settings", "pt": "Configurações", "ja": "設定"},
            "desc": {
                "en": "Change theme, language, and user name, and install or uninstall apps.",
                "pt": "Muda tema, idioma e nome do usuário, e instala ou desinstala apps.",
                "ja": "テーマ、言語、ユーザー名を変更し、アプリをインストールまたは削除します。",
            },
        },
        {
            "id": "app-builder",
            "href": None,
            "icon": "../assets/icons/svg/os-app_builder.svg",
            "kind": "native",
            "uninstallable": False,
            "defaultInstalled": True,
            "channel": "stable",
            "tag": {"en": "System", "pt": "Sistema", "ja": "システム"},
            "name": {"en": "App Builder", "pt": "App Builder", "ja": "App Builder"},
            "desc": {
                "en": "Create desktop apps from a URL or a single HTML page.",
                "pt": "Crie apps do desktop a partir de uma URL ou de uma página HTML.",
                "ja": "URLまたは単一のHTMLページからデスクトップアプリを作成します。",
            },
        },
    ]
    for card in cards:
        slug = href_to_slug(card["href"])
        name = {
            "en": (translations["en"].get(card["nameKey"]) if card["nameKey"] else None) or card["nameEn"],
            "pt": (translations["pt"].get(card["nameKey"]) if card["nameKey"] else None) or card["nameEn"],
            "ja": (translations["ja"].get(card["nameKey"]) if card["nameKey"] else None) or card["nameEn"],
        }
        tag_fallback = card["tagEn"] or "App"
        tag_key = card["tagKey"]
        tag = {
            "en": (translations["en"].get(tag_key) if tag_key else None) or tag_fallback,
            "pt": (translations["pt"].get(tag_key) if tag_key else None) or tag_fallback,
            "ja": (translations["ja"].get(tag_key) if tag_key else None) or tag_fallback,
        }
        desc_fallback = card["descEn"] or ""
        desc_key = card["descKey"]
        desc = {
            "en": (translations["en"].get(desc_key) if desc_key else None) or desc_fallback,
            "pt": (translations["pt"].get(desc_key) if desc_key else None) or desc_fallback,
            "ja": (translations["ja"].get(desc_key) if desc_key else None) or desc_fallback,
        }
        apps.append(
            {
                "id": slug,
                "href": card["href"],
                "icon": f"../assets/icons/svg/{slug}.svg",
                "kind": "site",
                "uninstallable": True,
                "defaultInstalled": slug in DEFAULT_INSTALLED,
                "channel": card["channel"],
                "tag": tag,
                "name": name,
                "desc": desc,
            }
        )

    payload = json.dumps(apps, ensure_ascii=False, indent=2)
    native_count = sum(1 for app in apps if app["kind"] == "native")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        f"""/* Generated from page/index.html — run python3 scripts/build_os_catalog.py */
window.OSCatalog = (function () {{
  const APPS = {payload};
  let USER_APPS = [];

  function setUserApps(list) {{
    USER_APPS = Array.isArray(list) ? list.slice() : [];
  }}

  function userApps() {{
    return USER_APPS.slice();
  }}

  function byId(id) {{
    return APPS.find((app) => app.id === id) || USER_APPS.find((app) => app.id === id) || null;
  }}

  function siteApps() {{
    return APPS.filter((app) => app.kind === "site");
  }}

  function nativeApps() {{
    return APPS.filter((app) => app.kind === "native");
  }}

  function isPrerelease(app) {{
    return !!(app && (app.channel === "alpha" || app.channel === "beta"));
  }}

  function stableSiteApps() {{
    return siteApps().filter((app) => !isPrerelease(app));
  }}

  function prereleaseSiteApps() {{
    return siteApps().filter(isPrerelease);
  }}

  function localizedText(value, lang) {{
    if (value == null) return "";
    if (typeof value === "string") return value;
    return value[lang] || value.en || "";
  }}

  function displayName(app, lang) {{
    if (!app) return "";
    return localizedText(app.name, lang) || app.id;
  }}

  function displayTag(app, lang) {{
    if (!app) return "";
    return localizedText(app.tag, lang);
  }}

  function displayDesc(app, lang) {{
    if (!app) return "";
    return localizedText(app.desc, lang);
  }}

  function tagGroupKey(app) {{
    if (!app || !app.tag) return "App";
    if (typeof app.tag === "string") return app.tag;
    return app.tag.en || "App";
  }}

  function resolveHref(app) {{
    if (!app) return null;
    const href = app.href || (app.kind === "user" ? app.url : null);
    if (!href) return null;
    if (/^https?:\\/\\//i.test(href)) return href;
    return "../" + href;
  }}

  return {{
    APPS,
    DEFAULT_INSTALLED: {json.dumps(list(DEFAULT_INSTALLED))},
    byId,
    siteApps,
    nativeApps,
    userApps,
    setUserApps,
    isPrerelease,
    stableSiteApps,
    prereleaseSiteApps,
    displayName,
    displayTag,
    displayDesc,
    tagGroupKey,
    resolveHref,
  }};
}})();
""",
        encoding="utf-8",
    )
    print(f"Wrote {OUT} with {len(apps)} apps ({len(apps) - native_count} site + {native_count} native)")


if __name__ == "__main__":
    main()
