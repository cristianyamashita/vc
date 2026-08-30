# Codex Project Instructions

These instructions apply to the entire repository.

## Page Architecture

- Always create each page as a single self-contained HTML file containing its HTML, CSS, and JavaScript.
- Keep page-specific behavior inside that page file unless there is already a shared local asset that the page must use.
- Exception: `page/os/` is a multi-file desktop shell (`index.html` plus local CSS/JS). Do not fold it into a single HTML file.
- Exception: dedicated game folders under `page/game/<slug>/` (`index.html` plus local CSS/JS). Do not fold these into a single HTML file.
- When adding or registering cards in `page/index.html`, include a visible `#NNN` sequence number for each card based on the order the card was first added to the index. If multiple cards share the same commit date and time, continue numbering them sequentially in the page order for that addition.

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
