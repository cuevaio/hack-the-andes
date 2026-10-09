"""Bounded ranking measurements and exact-byte Svix signing. Standard library only."""
import asyncio
import base64
from collections import Counter
import hashlib
import hmac
import json
import math
import statistics
import time
import urllib.error
import urllib.request
import uuid

ENDPOINTS = (
    "/api/v1/challenges/black-box/ranking",
    "/api/v1/challenges/broken-agent/ranking",
)


def signed_webhook(payload, secret, message_id=None, timestamp=None):
    if not secret.startswith("whsec_"):
        raise ValueError("Expected a whsec_ signing secret")
    key = base64.b64decode(secret[6:], validate=True)
    if not key:
        raise ValueError("Signing secret must not be empty")
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
    message_id = message_id or "msg_" + uuid.uuid4().hex
    if timestamp is None:
        timestamp = int(time.time())
    timestamp = str(timestamp)
    message = f"{message_id}.{timestamp}.".encode() + body
    signature = base64.b64encode(hmac.new(key, message, hashlib.sha256).digest()).decode()
    return body, {
        "Content-Type": "application/json",
        "svix-id": message_id,
        "svix-timestamp": timestamp,
        "svix-signature": "v1," + signature,
    }


def request_once(url, *, body=None, headers=None, timeout=10):
    started = time.perf_counter()
    status = None
    error = None
    content = b""
    try:
        request = urllib.request.Request(url, data=body, headers=headers or {})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            status = response.status
            content = response.read()
    except urllib.error.HTTPError as exception:
        status = exception.code
        content = exception.read()
    except (urllib.error.URLError, TimeoutError, OSError) as exception:
        error = f"{type(exception).__name__}: {exception}"
    return {
        "url": url,
        "status": status,
        "error": error,
        "latency_ms": (time.perf_counter() - started) * 1000,
        "body_size": len(content),
    }


def summarize(results):
    statuses = Counter(str(row["status"]) for row in results if row["status"] is not None)
    errors = Counter(row["error"] for row in results if row["error"] is not None)
    successes = sum(row["status"] is not None and 200 <= row["status"] < 300 for row in results)
    latencies = sorted(row["latency_ms"] for row in results)
    return {
        "requests": len(results),
        "successes_2xx": successes,
        "success_rate_percent": 100 * successes / len(results) if results else 0,
        "http_statuses": dict(statuses),
        "transport_errors": dict(errors),
        "mean_latency_ms": statistics.mean(latencies) if latencies else None,
        "p50_latency_ms": latencies[math.ceil(len(latencies) * 0.50) - 1] if latencies else None,
        "p95_latency_ms": latencies[math.ceil(len(latencies) * 0.95) - 1] if latencies else None,
        "max_latency_ms": max(latencies) if latencies else None,
    }


async def run_experiment(base_url="http://localhost:3000", *, total_requests=20, concurrency=4, interval=0):
    if not isinstance(total_requests, int) or not 1 <= total_requests <= 100:
        raise ValueError("total_requests must be an integer between 1 and 100")
    if not isinstance(concurrency, int) or not 1 <= concurrency <= 10:
        raise ValueError("concurrency must be an integer between 1 and 10")
    if not math.isfinite(interval) or interval < 0:
        raise ValueError("interval must be finite and nonnegative")
    queue = asyncio.Queue(maxsize=concurrency)
    results = []

    async def worker():
        while True:
            item = await queue.get()
            try:
                if item is None:
                    return
                request_id, url, queued_at = item
                dispatched_at = time.perf_counter()
                result = await asyncio.to_thread(request_once, url)
                result["request_id"] = request_id
                result["queue_ms"] = (dispatched_at - queued_at) * 1000
                results.append(result)
            finally:
                queue.task_done()

    started = time.perf_counter()
    async with asyncio.TaskGroup() as group:
        for _ in range(concurrency):
            group.create_task(worker())
        for request_id in range(total_requests):
            if request_id and interval:
                await asyncio.sleep(interval)
            endpoint = ENDPOINTS[request_id % len(ENDPOINTS)]
            await queue.put((request_id, base_url.rstrip("/") + endpoint, time.perf_counter()))
        for _ in range(concurrency):
            await queue.put(None)
        await queue.join()
    elapsed = time.perf_counter() - started
    summary = summarize(results)
    summary["duration_seconds"] = elapsed
    summary["requests_per_second"] = len(results) / elapsed
    summary["by_endpoint"] = {
        endpoint: summarize([row for row in results if row["url"].endswith(endpoint)])
        for endpoint in ENDPOINTS
    }
    return summary, sorted(results, key=lambda row: row["request_id"])
