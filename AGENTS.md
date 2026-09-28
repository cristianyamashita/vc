# Codex Project Instructions

These instructions apply to the entire repository.

## Page Architecture

- Always create each page as a single self-contained HTML file containing its HTML, CSS, and JavaScript.
- Keep page-specific behavior inside that page file unless there is already a shared local asset that the page must use.
- Exception: `page/os/` is a multi-file desktop shell (`index.html` plus local CSS/JS). Do not fold it into a single HTML file.
- Exception: dedicated game folders under `page/game/<slug>/` (`index.html` plus local CSS/JS). Do not fold these into a single HTML file.
- When adding or registering cards in `page/index.html`, include a visible `#NNN` sequence number for each card based on the order the card was first added to the index. If multiple cards share the same commit date and time, continue numbering them sequentially in the page order for that addition.
- The numbers in `cardSequenceByHref` are contiguous from `#001`, so the last number equals the number of cards on the page. When cards are removed or merged, delete their entries and renumber the remaining cards, keeping their relative order. A new card gets the next number after the current last one.

## Libraries

- Libraries are allowed.
- Prefer loading libraries from a CDN whenever possible.
- Copy libraries into the repository only as a last resort, such as when CDN loading is blocked or offline behavior is explicitly required.

## Persistence And Backup

- This project has no backend.
- Persist data only in browser storage, using `localStorage` or IndexedDB.
- When a page stores persistent user data, update `page/utils/backup.html` so that the data is included in backup and restore flows.

## Internationalization

- Pages must support three languages: English (`EN`), Portuguese (`PT`), and Japanese (`JA`).
- New user-facing text should be covered by the page's language switcher or translation system.

## Theme Support

- Whenever applicable, pages should include both light and dark modes.
- Theme choice should be easy to find and should persist locally when the page has other persistent preferences.

## Page Icons

Every page needs a unique geometric icon. Cards on `page/index.html` pick it up automatically from the page href; the page itself must still include a favicon.

- Palette: predominate `#008f7d` with white (`#ffffff`). `#006056` may be used for depth. No page name or other lettering on the icon.
- Shape: a drawing or geometric mark that represents the page. Each icon must be visually distinct from the others, including close variants of the same tool.
- Source of truth: add an entry to `scripts/page_icons.py` using slug `{folder}-{filename}` (for example `utils-timer`, `game-snake`). Use `index` for the collection index and `{folder}-{parent}` when the file is `index.html` inside a subfolder (`game/service-tycoon/index.html` → `game-service-tycoon`).
- Generate files with `python3 scripts/build_icons.py` (needs Pillow; see `scripts/requirements-icons.txt`). This writes `page/assets/icons/svg/{slug}.svg`, `png/{slug}.png`, and `ico/{slug}.ico`.
- Put a favicon in the page `<head>`:
  `<link rel="icon" href="../assets/icons/ico/{slug}.ico" type="image/x-icon">`
  Adjust the relative path for the file depth (`assets/...` from `page/index.html`, `../../assets/...` from nested pages). `python3 scripts/inject_favicons.py` can insert or replace these tags.

## Compact Layout

Pages also open inside the desktop shell (`page/os/`), where a window is 960×640 by default. Every page must fit that window without scrolling the page body, and still work when opened on its own.

- One top bar, at most 44px tall: an 18px page icon (`../assets/icons/svg/{slug}.svg`) and a 15-16px title, then tabs or the main actions, then on the right a Help button (`?`), the language select (`#lang-switcher`) and the theme button (`#theme-switcher`). The desktop hides those two ids automatically.
- No hero sections, eyebrows, subtitles or large headings. Headings inside the page stay at 13-16px.
- Usage instructions, "how it works" lists, tips and reference tables go into a Help dialog (`<dialog>`) opened by the `?` button and the `?` key, translated in EN/PT/JA. Keep only short labels and placeholders in the page.
- When there are many buttons, keep the frequent ones in the top bar or a thin toolbar and move the rest into a menu (dropdown) or the dialog.
- Spacing: padding at most 12-14px, gaps 8-12px, controls about 30-32px tall.
- Structure: `html, body { height: 100% }` with an app grid `grid-template-rows: auto 1fr`; scroll inside panels, not on the body. Avoid `min-height` above ~560px. Multi-column layouts should hold down to ~900px wide and stack only below ~720px.
- Do not use `<header>` for dialog headers: the desktop hides `<header>` elements that contain no visible controls.
- Reference pages: `utils/time_tools.html` (top bar with tabs, help dialog, tokens), `utils/kanban.html` (single top bar), `utils/collage.html` (grouped toolbar).

## Merged Pages

Related tools are grouped into one page with tabs. The tab id is the URL hash (`page.html#tab`) and the last tab is remembered in localStorage.

- Merged into the code of one page (for example `utils/time_tools.html`, `utils/calculators.html`, `utils/dev_utils.html`): the old file becomes a redirect stub. Keep the old localStorage keys and IndexedDB names so saved data keeps working.
- Tab hubs (for example `utils/photo_editor.html`, `misc/vision_labs.html`): the hub loads each original page in an iframe with `?hub=1`. The original file keeps its content and a `hub-guard` script that redirects to the hub when it is opened on its own.
- Both the hubs and the stubs are generated by `python3 scripts/build_hubs.py`. Edit its config, not the generated files.
- Old app ids are mapped to the new page in `APP_ALIASES` in `scripts/build_os_catalog.py`, so desktop shortcuts, installed apps and recent files keep working.
