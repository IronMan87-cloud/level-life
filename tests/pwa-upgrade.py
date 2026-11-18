"""Exercise the service-worker update lifecycle in Chromium on a private local origin."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class FixtureHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.server.old and self.path.split("?", 1)[0] in ("/", "/index.html", "/sw.js"):
            worker = self.path.startswith("/sw.js")
            name = "sw.js" if worker else "index.html"
            source = (ROOT / name).read_text()
            source = source.replace("level-shell-v40", "level-shell-fixture") if worker else source.replace(
                "<h1>Сегодня</h1>", "<h1>Предыдущая версия</h1>"
            )
            body = source.encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript" if worker else "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()


with ThreadingHTTPServer(("127.0.0.1", 0), partial(FixtureHandler, directory=ROOT)) as server:
    server.old = True
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    url = f"http://127.0.0.1:{server.server_port}/"
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=os.getenv("LEVEL_CHROMIUM", "/usr/bin/chromium"), args=["--no-sandbox"]
        )
        context = browser.new_context()
        context.route("https://cdn.jsdelivr.net/**", lambda route: route.abort())
        page = context.new_page()
        page.goto(url)
        page.wait_for_function("navigator.serviceWorker.controller")
        page.evaluate("""async () => {
          await caches.open('unrelated-test-cache');
          db.upgradeFixture = 'retained';
          save();
        }""")
        server.old = False
        page.evaluate("(async () => { const registration = await navigator.serviceWorker.ready; await registration.update() })()")
        page.wait_for_function("(async () => !!(await navigator.serviceWorker.getRegistration()).waiting)()")
        expect(page.locator("#page-home h1")).to_have_text("Предыдущая версия")
        page.close()
        updated = context.new_page()
        updated.goto(url)
        expect(updated.locator("#page-home h1")).to_have_text("Сегодня")
        assert updated.evaluate("db.upgradeFixture") == "retained"
        keys = updated.evaluate("caches.keys()")
        assert "level-shell-fixture" not in keys and "level-shell-v40" in keys
        assert "unrelated-test-cache" in keys
        assert updated.evaluate("performance.getEntriesByType('navigation')[0].type") == "navigate"
        browser.close()
    server.shutdown()
print("PWA replacement, cache isolation and data retention passed")
