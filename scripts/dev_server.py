#!/usr/bin/env python3
"""Static server for local development.

Identical to `python3 -m http.server` except that it tells the browser never
to cache. Without that, editing a stylesheet or a data file and reloading
shows the previous version, which is a slow way to chase bugs that were
already fixed.
"""

import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "404" in (fmt % args):
            super().log_message(fmt, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    HTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()
