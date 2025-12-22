#!/usr/bin/env python3
import functools
import http.server
import os
import socketserver
import sys
import urllib.parse
import urllib.request
import shutil


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == "/proxy":
            self.handle_proxy(parsed)
            return
        super().do_GET()

    def handle_proxy(self, parsed):
        query = urllib.parse.parse_qs(parsed.query)
        target = query.get("url", [""])[0].strip()
        if not target:
            self.send_error(400, "Missing url parameter")
            return

        target = self.normalize_drive_url(target)
        try:
            target_parsed = urllib.parse.urlsplit(target)
        except ValueError:
            self.send_error(400, "Invalid url")
            return

        if target_parsed.scheme not in ("http", "https"):
            self.send_error(400, "Only http/https are supported")
            return

        try:
            req = urllib.request.Request(
                target,
                headers={
                    "User-Agent": "Mozilla/5.0",
                },
            )
            with urllib.request.urlopen(req, timeout=20) as resp:
                self.send_response(resp.status)
                content_type = resp.headers.get("Content-Type", "application/octet-stream")
                self.send_header("Content-Type", content_type)
                content_length = resp.headers.get("Content-Length")
                if content_length:
                    self.send_header("Content-Length", content_length)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                shutil.copyfileobj(resp, self.wfile)
        except Exception as exc:
            self.send_error(502, f"Proxy fetch failed: {exc}")

    def normalize_drive_url(self, url):
        try:
            parsed = urllib.parse.urlsplit(url)
        except ValueError:
            return url

        host = (parsed.hostname or "").lower()
        if not (host.endswith("drive.google.com") or host.endswith("docs.google.com")):
            return url

        file_id = ""
        if "/file/d/" in parsed.path:
            parts = parsed.path.split("/")
            if "d" in parts:
                index = parts.index("d")
                if index + 1 < len(parts):
                    file_id = parts[index + 1]

        if not file_id:
            query = urllib.parse.parse_qs(parsed.query)
            file_id = query.get("id", [""])[0]

        if not file_id:
            return url

        return f"https://drive.google.com/uc?export=download&id={file_id}"


def run():
    port = int(os.environ.get("PORT", "8080"))
    handler = functools.partial(ProxyHandler, directory=os.getcwd())
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", port), handler) as httpd:
        print(f"Serving on http://localhost:{port}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down.")


if __name__ == "__main__":
    run()
