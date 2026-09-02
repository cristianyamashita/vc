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

# First-run "Recommended" extras. Edit this list when reviewing the starter pack.
DEFAULT_INSTALLED = (
    "utils-bitwise_converter",
    "utils-copy_tool",
    "utils-dev_utils",
    "utils-password_generator",
    "utils-todo",
    "utils-whiteboard",
    "utils-prompt_concat",
    "game-tower-defense",
    "misc-vision_motion_lab",
    "game-tower-defense-3d",
    "game-vehicle-bash-arena",
    "game-cube-bash-arena",
    "game-service-tycoon",
    "utils-terminal",
    "utils-text_diff_studio",
    "utils-regex_playground",
    "utils-pdf_toolbox",
    "utils-css_visual_lab",
    "utils-ps2",
    "utils-vector_editor",
    "utils-color_picker",
    "utils-local_image_gallery",
    "utils-image_to_webp",
    "utils-images_to_pdf",
    "utils-morse_code",
    "utils-gallery",
    "utils-kanban",
    "utils-calculator",
    "utils-timer",
    "utils-notebook",
    "utils-markdown",
    "utils-obsidian",
    "utils-audio_player",
    "utils-fullscreen_message",
    "utils-wheel_picker",
    "utils-backup",
    "game-voxelcraft",
    "game-forex_sim",
    "game-river-raid",
    "game-tetris1",
    "game-vision_tetris",
    "game-vision_balloon_ball",
    "game-vision_hand_pong",
    "game-game1",
    "game-2048-shooter",
    "game-ten-second-stop",
    "game-cube",
    "game-checkers",
    "game-chess",
    "game-game5",
    "game-snake",
    "game-flip",
    "game-morris",
    "game-pac-man",
    "game-space-invaders",
    "game-crossword",
    "game-word-search",
    "game-tic-tac-toe",
    "game-missile-command",
    "misc-fluid_lab",
    "misc-webcam_music_controller",
    "misc-spin2",
    "misc-spin3",
    "misc-robot_face",
    "misc-nebula",
    "misc-nebula2",
    "misc-plasma_ball_lab",
    "misc-logic_circuit",
    "game-roulette",
)
SKIP_HREFS = {"os/index.html", "os.html"}
MULTI_INSTANCE = {
    "utils-wordpad",
    "utils-markdown",
    "utils-terminal",
    "utils-data_explorer",
    "notepad",
    "paint",
    "browser",
    "calculator",
    "stickies",
    "app-studio",
}


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
            "id": "app-studio",
            "href": "os/apps/app-studio/index.html",
            "icon": "../assets/icons/svg/os-app_studio.svg",
            "kind": "native",
            "uninstallable": False,
            "defaultInstalled": True,
            "multiInstance": True,
            "windowW": 1100,
            "windowH": 720,
            "channel": "stable",
            "tag": {"en": "System", "pt": "Sistema", "ja": "システム"},
            "name": {"en": "App Studio", "pt": "App Studio", "ja": "App Studio"},
            "desc": {
                "en": "Create multi-file desktop apps with a Visual Studio-style editor.",
                "pt": "Crie apps do desktop com vários arquivos, num editor no estilo Visual Studio.",
                "ja": "Visual Studio 風のエディタで複数ファイルのデスクトップアプリを作成します。",
            },
        },
        {
            "id": "sheets",
            "href": "os/app/sheets/index.html",
            "icon": "../assets/icons/svg/os-sheets.svg",
            "kind": "native",
            "uninstallable": False,
            "defaultInstalled": True,
            "channel": "stable",
            "tag": {"en": "System", "pt": "Sistema", "ja": "システム"},
            "name": {"en": "Sheets", "pt": "Planilhas", "ja": "表計算"},
            "desc": {
                "en": "Spreadsheet with multiple sheets, formulas, and Excel-style references.",
                "pt": "Planilha com várias abas, fórmulas e referências no estilo Excel.",
                "ja": "複数シート、数式、Excel 風の参照に対応した表計算アプリ。",
            },
        },
        {
            "id": "file-explorer",
            "href": None,
            "icon": "../assets/icons/svg/os-file_explorer.svg",
            "kind": "native",
            "uninstallable": False,
            "defaultInstalled": True,
            "multiInstance": True,
            "channel": "stable",
            "tag": {"en": "System", "pt": "Sistema", "ja": "システム"},
            "name": {"en": "File Explorer", "pt": "Explorador de Arquivos", "ja": "エクスプローラー"},
            "desc": {
                "en": "Browse folders and files stored in this desktop, with icons or details view.",
                "pt": "Navegue pastas e arquivos deste desktop, em ícones ou detalhes.",
                "ja": "このデスクトップに保存したフォルダーとファイルをアイコンまたは詳細表示で参照します。",
            },
        },
        {
            "id": "task-manager",
            "href": None,
            "icon": "../assets/icons/svg/os-task_manager.svg",
            "kind": "native",
            "uninstallable": False,
            "defaultInstalled": True,
            "channel": "stable",
            "tag": {"en": "System", "pt": "Sistema", "ja": "システム"},
            "name": {"en": "Task Manager", "pt": "Gerenciador de Tarefas", "ja": "タスク マネージャー"},
            "desc": {
                "en": "See open windows, end tasks, and check how much storage this desktop is using.",
                "pt": "Veja janelas abertas, encerre tarefas e confira o armazenamento deste desktop.",
                "ja": "開いているウィンドウの終了と、このデスクトップの使用容量を確認します。",
            },
        },
        {
            "id": "notepad",
            "href": "os/apps/notepad/index.html",
            "icon": "../assets/icons/svg/os-notepad.svg",
            "kind": "native",
            "suite": "accessories",
            "uninstallable": False,
            "defaultInstalled": True,
            "multiInstance": True,
            "windowW": 720,
            "windowH": 520,
            "channel": "stable",
            "tag": {"en": "Accessories", "pt": "Acessórios", "ja": "アクセサリ"},
            "name": {"en": "Notepad", "pt": "Bloco de Notas", "ja": "メモ帳"},
            "desc": {
                "en": "Simple text editor for notes and logs, with Open/Save on the desktop filesystem.",
                "pt": "Editor de texto simples para notas e logs, com Abrir/Salvar no sistema de arquivos do desktop.",
                "ja": "デスクトップのファイルシステムに保存できるシンプルなテキストエディタ。",
            },
        },
        {
            "id": "paint",
            "href": "os/apps/paint/index.html",
            "icon": "../assets/icons/svg/os-paint.svg",
            "kind": "native",
            "suite": "accessories",
            "uninstallable": False,
            "defaultInstalled": True,
            "multiInstance": True,
            "channel": "stable",
            "tag": {"en": "Accessories", "pt": "Acessórios", "ja": "アクセサリ"},
            "name": {"en": "Paint", "pt": "Paint", "ja": "ペイント"},
            "desc": {
                "en": "Bitmap drawing with pencil, shapes, fill, and undo — a Paint-style canvas.",
                "pt": "Desenho bitmap com lápis, formas, preenchimento e desfazer — no estilo Paint.",
                "ja": "鉛筆、図形、塗りつぶし、元に戻すを備えたペイント風キャンバス。",
            },
        },
        {
            "id": "calendar",
            "href": "os/apps/calendar/index.html",
            "icon": "../assets/icons/svg/os-calendar.svg",
            "kind": "native",
            "suite": "accessories",
            "uninstallable": False,
            "defaultInstalled": True,
            "channel": "stable",
            "tag": {"en": "Accessories", "pt": "Acessórios", "ja": "アクセサリ"},
            "name": {"en": "Calendar", "pt": "Calendário", "ja": "カレンダー"},
            "desc": {
                "en": "Month calendar with events and notes that also open from the taskbar clock.",
                "pt": "Calendário mensal com eventos e notas, também aberto pelo relógio da barra de tarefas.",
                "ja": "タスクバーの時計からも開ける、予定とメモ付きの月間カレンダー。",
            },
        },
        {
            "id": "browser",
            "href": "os/apps/browser/index.html",
            "icon": "../assets/icons/svg/os-browser.svg",
            "kind": "native",
            "suite": "accessories",
            "uninstallable": False,
            "defaultInstalled": True,
            "multiInstance": True,
            "windowW": 1100,
            "windowH": 720,
            "channel": "stable",
            "tag": {"en": "Accessories", "pt": "Acessórios", "ja": "アクセサリ"},
            "name": {"en": "Browser", "pt": "Navegador", "ja": "ブラウザ"},
            "desc": {
                "en": "Tabbed browser with live iframes, Compat view for sites that send X-Frame-Options, and a reader mode.",
                "pt": "Navegador com abas, iframe ao vivo, vista Compat para sites com X-Frame-Options e modo leitura.",
                "ja": "タブブラウザ。ライブ iframe、X-Frame-Options 向け Compat ビュー、リーダーモード。",
            },
        },
        {
            "id": "calculator",
            "href": "os/apps/calculator/index.html",
            "icon": "../assets/icons/svg/os-calculator.svg",
            "kind": "native",
            "suite": "accessories",
            "uninstallable": False,
            "defaultInstalled": True,
            "multiInstance": True,
            "windowW": 380,
            "windowH": 560,
            "channel": "stable",
            "tag": {"en": "Accessories", "pt": "Acessórios", "ja": "アクセサリ"},
            "name": {"en": "Calculator", "pt": "Calculadora", "ja": "電卓"},
            "desc": {
                "en": "Standard calculator with keyboard support.",
                "pt": "Calculadora padrão com suporte a teclado.",
                "ja": "キーボード操作に対応した標準電卓。",
            },
        },
        {
            "id": "stickies",
            "href": "os/apps/stickies/index.html",
            "icon": "../assets/icons/svg/os-stickies.svg",
            "kind": "native",
            "suite": "accessories",
            "uninstallable": False,
            "defaultInstalled": True,
            "multiInstance": True,
            "windowW": 720,
            "windowH": 520,
            "channel": "stable",
            "tag": {"en": "Accessories", "pt": "Acessórios", "ja": "アクセサリ"},
            "name": {"en": "Stickies", "pt": "Notas adesivas", "ja": "スティッキーズ"},
            "desc": {
                "en": "Colored sticky notes that also live as desktop widgets.",
                "pt": "Notas adesivas coloridas que também aparecem como widgets no desktop.",
                "ja": "デスクトップウィジェットにもなる色付きの付箋。",
            },
        },
        {
            "id": "snip",
            "href": None,
            "icon": "../assets/icons/svg/os-snip.svg",
            "kind": "native",
            "suite": "accessories",
            "uninstallable": False,
            "defaultInstalled": True,
            "windowW": 420,
            "windowH": 320,
            "channel": "stable",
            "tag": {"en": "Accessories", "pt": "Acessórios", "ja": "アクセサリ"},
            "name": {"en": "Snipping Tool", "pt": "Ferramenta de Recorte", "ja": "切り取りツール"},
            "desc": {
                "en": "Capture a rectangle of this desktop and save it or open it in Paint.",
                "pt": "Capture um retângulo deste desktop e salve ou abra no Paint.",
                "ja": "このデスクトップの範囲を切り取り、保存またはペイントで開きます。",
            },
        },
        {
            "id": "characters",
            "href": "os/apps/characters/index.html",
            "icon": "../assets/icons/svg/os-characters.svg",
            "kind": "native",
            "suite": "accessories",
            "uninstallable": False,
            "defaultInstalled": True,
            "windowW": 640,
            "windowH": 520,
            "channel": "stable",
            "tag": {"en": "Accessories", "pt": "Acessórios", "ja": "アクセサリ"},
            "name": {"en": "Character Map", "pt": "Mapa de Caracteres", "ja": "文字コード表"},
            "desc": {
                "en": "Browse symbols and copy characters to the clipboard.",
                "pt": "Percorra símbolos e copie caracteres para a área de transferência.",
                "ja": "記号を探してクリップボードにコピーします。",
            },
        },
        {
            "id": "preview",
            "href": "os/apps/preview/index.html",
            "icon": "../assets/icons/svg/os-preview.svg",
            "kind": "native",
            "suite": "accessories",
            "uninstallable": False,
            "defaultInstalled": True,
            "channel": "stable",
            "tag": {"en": "Accessories", "pt": "Acessórios", "ja": "アクセサリ"},
            "name": {"en": "Preview", "pt": "Visualização", "ja": "プレビュー"},
            "desc": {
                "en": "Quick look for images and PDFs stored on this desktop.",
                "pt": "Visualização rápida de imagens e PDFs deste desktop.",
                "ja": "このデスクトップの画像と PDF をすばやく表示します。",
            },
        },
        {
            "id": "about",
            "href": "os/apps/about/index.html",
            "icon": "../assets/icons/svg/os-about.svg",
            "kind": "native",
            "suite": "accessories",
            "uninstallable": False,
            "defaultInstalled": True,
            "windowW": 480,
            "windowH": 520,
            "channel": "stable",
            "tag": {"en": "Accessories", "pt": "Acessórios", "ja": "アクセサリ"},
            "name": {"en": "About This Desktop", "pt": "Sobre este desktop", "ja": "このデスクトップについて"},
            "desc": {
                "en": "System summary in the spirit of About This Mac and winver.",
                "pt": "Resumo do sistema no espírito de Sobre este Mac e winver.",
                "ja": "この Mac について / winver 風のシステム概要。",
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
        app = {
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
        if slug in MULTI_INSTANCE:
            app["multiInstance"] = True
        apps.append(app)

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

  const DEFAULT_INSTALLED = {json.dumps(list(DEFAULT_INSTALLED))};

  function installPackIds(pack) {{
    if (pack === "all") return stableSiteApps().map((app) => app.id);
    if (pack === "recommended") return DEFAULT_INSTALLED.slice();
    return [];
  }}

  return {{
    APPS,
    DEFAULT_INSTALLED,
    installPackIds,
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
    try:
        import subprocess
        import sys

        subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "build_offline_manifest.py")],
            check=False,
        )
    except Exception as exc:
        print(f"offline manifest skipped: {exc}")


if __name__ == "__main__":
    main()
