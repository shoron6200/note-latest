"""Static server for an Expo web export: route fallback to index.html, plus the
cross-origin isolation headers expo-sqlite's WebAssembly build needs."""
import http.server
import mimetypes
import os
import sys

ROOT = sys.argv[1]
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
mimetypes.add_type("application/wasm", ".wasm")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header("Cross-Origin-Embedder-Policy", "credentialless")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        path = self.path.split("?", 1)[0]
        if not os.path.exists(self.translate_path(path)):
            self.path = "/index.html"
        return super().send_head()

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
