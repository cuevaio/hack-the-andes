import ast
import asyncio
import base64
import importlib.util
import json
from pathlib import Path
import subprocess
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("ranking_checks", ROOT / "ranking-checks.py")
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)


class ChecksTest(unittest.TestCase):
    def test_http_statuses_concurrency_and_pacing(self):
        starts = []
        active = 0
        peak = 0
        lock = threading.Lock()

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                nonlocal active, peak
                with lock:
                    starts.append(time.perf_counter())
                    active += 1
                    peak = max(peak, active)
                time.sleep(0.04)
                status = 200 if "black-box" in self.path else 503
                self.send_response(status)
                self.end_headers()
                self.wfile.write(b"{}")
                with lock:
                    active -= 1

            def log_message(self, *args):
                pass

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}"
            summary, rows = asyncio.run(checks.run_experiment(url, total_requests=8, concurrency=2))
            self.assertEqual(summary["http_statuses"], {"200": 4, "503": 4})
            self.assertEqual(summary["success_rate_percent"], 50)
            self.assertEqual(summary["requests"], 8)
            self.assertEqual(summary["transport_errors"], {})
            self.assertLessEqual(peak, 2)
            self.assertGreater(peak, 1)
            self.assertTrue(all(row["latency_ms"] > 0 for row in rows))
            self.assertTrue(all(row["queue_ms"] >= 0 for row in rows))
            starts.clear()
            asyncio.run(checks.run_experiment(url, total_requests=4, concurrency=2, interval=0.12))
            self.assertEqual(len(starts), 4)
            self.assertGreater(starts[-1] - starts[0], 0.30)
            self.assertGreaterEqual(min(b - a for a, b in zip(starts, starts[1:])), 0.08)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_transport_failure_keeps_latency_and_error(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), BaseHTTPRequestHandler)
        port = server.server_port
        server.server_close()
        result = checks.request_once(f"http://127.0.0.1:{port}", timeout=0.2)
        self.assertIsNone(result["status"])
        self.assertTrue(result["error"])
        self.assertGreater(result["latency_ms"], 0)
        summary = checks.summarize([result])
        self.assertEqual(summary["successes_2xx"], 0)
        self.assertEqual(sum(summary["transport_errors"].values()), 1)

    def test_python_signature_passes_installed_clerk_verifier(self):
        secret = "whsec_" + base64.b64encode(b"local-test-key-only").decode()
        body, headers = checks.signed_webhook({"type": "session.ended", "data": {"name": "Perú"}}, secret)
        fixture = {"secret": secret, "body": body.decode(), "headers": headers}
        script = '''import { verifyWebhook } from "@clerk/backend/webhooks";
const fixture = await Bun.stdin.json();
const makeRequest = (body, headers) => new Request("http://localhost/api/webhooks/clerk", {method: "POST", body, headers});
const event = await verifyWebhook(makeRequest(fixture.body, fixture.headers), {signingSecret: fixture.secret});
if (event.type !== "session.ended") throw new Error("Incorrect event");
for (const request of [
  makeRequest(fixture.body + " ", fixture.headers),
  makeRequest(fixture.body, {...fixture.headers, "svix-timestamp": "1"}),
  makeRequest(fixture.body, {"X-Svix-Signature": fixture.headers["svix-signature"]}),
]) {
  let rejected = false;
  try { await verifyWebhook(request, {signingSecret: fixture.secret}); }
  catch { rejected = true; }
  if (!rejected) throw new Error("Invalid request accepted");
}
'''
        result = subprocess.run(["bun", "-e", script], input=json.dumps(fixture), text=True, capture_output=True, cwd=ROOT.parents[1])
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_notebook_defaults_run_without_network(self):
        notebook = json.loads((ROOT / "floodingtheandesv2-reviewed.ipynb").read_text())
        scope = {}
        async def run():
            for cell in notebook["cells"]:
                if cell["cell_type"] == "code":
                    compiled = compile("".join(cell["source"]), "reviewed-notebook", "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
                    result = eval(compiled, scope)
                    if result is not None:
                        await result
        asyncio.run(run())
        self.assertFalse(scope["RUN_RANKING_TESTS"])
        self.assertFalse(scope["RUN_WEBHOOK_CHECKS"])


if __name__ == "__main__":
    unittest.main()
