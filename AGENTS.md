# Codex Project Instructions

These instructions apply to the entire repository.

## Page Architecture

- Always create each page as a single self-contained HTML file containing its HTML, CSS, and JavaScript.
- Keep page-specific behavior inside that page file unless there is already a shared local asset that the page must use.

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
