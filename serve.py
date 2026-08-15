#!/usr/bin/env python3
"""Dev server for the DCR prototype. Same as `python3 -m http.server` but sends
no-store cache headers: browsers were serving stale ES modules (audio.js edits
invisible after reload), which derails listen-tests and TTS iteration.
Not used in production; GitHub Pages handles caching there."""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8743
    HTTPServer(('', port), NoCacheHandler).serve_forever()
