# Local MediaPipe assets

Vision Photo Lab loads its library, WebAssembly runtime and three landmark models
from this directory. There is no CDN fallback and no third-party runtime request.
Keep this entire directory when copying or hosting the site, including on GitHub
Pages. Serve the copy through HTTP (for example, `python3 scripts/dev_server.py`);
ES modules and WebAssembly do not support opening the HTML directly via `file://`.

The runtime is `@mediapipe/tasks-vision` 0.10.14, with both SIMD and non-SIMD
WebAssembly builds. The browser chooses one build; both are retained for browser
compatibility. Models are the original float16 version 1 files for full body
pose, face and hand landmarks. Their paths and bytes are preserved.

The eight runtime/model files total 40,250,563 bytes (40.25 MB). A browser loads
one WebAssembly build, so a complete first analysis transfers approximately
30.7 MB before HTTP compression. Photos and results remain in browser memory.

`sources.json` records original download URLs, package archive members, exact
sizes and SHA-256 hashes. The MediaPipe project's Apache 2.0 license is included
in `LICENSE`. Bundled runtime notices are preserved. These assets are included
in the desktop's full offline pack rather than the base pack.
