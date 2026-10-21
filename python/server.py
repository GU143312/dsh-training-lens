"""Read-only, loopback dashboard for existing TensorBoard scalar event files."""
from __future__ import annotations

import argparse
from collections import OrderedDict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import math
import os
import socket
import sys
from pathlib import Path
import threading
import time
from urllib.parse import parse_qs, urlsplit


ALIASES = {
    "train_reward": ("Train/Mean reward", "MCTS/Mean reward", "rollout/ep_rew_mean"),
    "eval_reward": ("Evaluation/Mean reward", "eval/mean_reward"),
    "success": ("eval/success_rate", "Evaluation/Success rate"),
    "train_length": ("Train/Mean episode length", "MCTS/Mean episode length", "rollout/ep_len_mean"),
    "eval_length": ("Evaluation/Mean episode length", "eval/mean_ep_length"),
    "episodes": ("Train/Episodes total",),
    "samples": ("Train/Samples total",),
    "steps": ("Train/Steps total", "MCTS/Steps"),
    "throughput": ("Train/Steps_per_second", "MCTS/Throughput", "time/fps"),
    "pi_loss": ("Network/Pi loss", "train/policy_gradient_loss"),
    "v_loss": ("Network/V loss", "train/value_loss"),
    "eval_count": ("Evaluation/Episodes per epoch",),
}
CONFIG_KEYS = ("training_epochs", "num_rollout_workers", "logging_aggregation_epochs",
               "num_expansions", "train_batch_size", "learning_rate")
ASSETS = Path(__file__).with_name("web")
VERSION = "0.1.0"


class LocalHTTPServer(ThreadingHTTPServer):
    # Windows SO_REUSEADDR can bind an already-owned port; require exclusive use.
    allow_reuse_address = os.name != "nt"

    def server_bind(self):
        if os.name == "nt":
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def finite(value):
    return float(value) if math.isfinite(float(value)) else None


def summarize(points, limit=1600):
    """Keep statistics exact; decimate display only, preserving extrema and gaps."""
    # A resumed writer may repeat steps. Use the newest event at each step.
    by_step = {}
    for wall, step, value in sorted(points):
        by_step[int(step)] = [int(step), finite(value), finite(wall)]
    rows = sorted(by_step.values())
    valid = [p for p in rows if p[1] is not None]
    shown = rows
    if len(rows) > limit:
        # Up to four representatives per bucket: endpoints, min and max;
        # retain a non-finite marker instead of connecting across missing data.
        shown = []
        bucket_size = math.ceil(len(rows) / (limit // 5))
        for start in range(0, len(rows), bucket_size):
            chunk = rows[start:start + bucket_size]
            indices = {0, len(chunk) - 1}
            good = [i for i, p in enumerate(chunk) if p[1] is not None]
            if good:
                indices.update((min(good, key=lambda i: chunk[i][1]),
                                max(good, key=lambda i: chunk[i][1])))
            bad = next((i for i, p in enumerate(chunk) if p[1] is None), None)
            if bad is not None:
                indices.add(bad)
            shown.extend(chunk[i] for i in sorted(indices))
    latest = rows[-1] if rows else None
    return {"points": shown, "count": len(rows), "invalid": len(rows) - len(valid),
            "latest": latest, "best": max(valid, key=lambda p: p[1]) if valid else None,
            "minimum": min(valid, key=lambda p: p[1]) if valid else None,
            "previous_finite": valid[-2] if len(valid) > 1 and latest[1] is not None else None,
            "latest_wall": max((p[2] for p in rows if p[2] is not None), default=None),
            "downsampled": len(shown) < len(rows)}


def read_config(directory):
    """Expose only numeric display metadata, never arbitrary local config fields."""
    path = directory / "config.yaml"
    if not path.is_file() or path.is_symlink() or path.stat().st_size > 256_000:
        return {}, None
    try:
        import yaml
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return {}, "config_not_mapping"
        result = {k: data[k] for k in CONFIG_KEYS if isinstance(data.get(k), (int, float))
                  and not isinstance(data[k], bool) and math.isfinite(data[k])}
        return result, None
    except (ImportError, OSError, ValueError):
        return {}, "config_unavailable"
    except yaml.YAMLError:
        return {}, "config_invalid"


class EventStore:
    def __init__(self, logdir, stale_seconds=120, cache_seconds=5):
        self.root = Path(logdir).resolve(strict=True)
        if not self.root.is_dir():
            raise ValueError("--logdir 必须是目录")
        self.stale_seconds = stale_seconds
        self.cache_seconds = cache_seconds
        self.lock = threading.Lock()
        self.readers = OrderedDict()
        self.cached = {}

    def discover(self):
        runs = []
        for directory, dirs, files in os.walk(self.root, followlinks=False):
            dirs[:] = [d for d in dirs if not d.startswith((".", "checkpoint"))
                       and d not in {"__pycache__", "node_modules", "ray"}
                       and not Path(directory, d).is_symlink()]
            events = [Path(directory, f) for f in files if f.startswith("events.out.tfevents.")
                      and not Path(directory, f).is_symlink()]
            if events:
                try:
                    runs.append({"id": Path(directory).relative_to(self.root).as_posix(),
                                 "modified": max(p.stat().st_mtime for p in events)})
                except OSError:
                    continue  # A writer may rotate/remove files during discovery.
        return sorted(runs, key=lambda r: (-r["modified"], r["id"]))

    def snapshot(self, run_id=None):
        with self.lock:
            runs = self.discover()
            if not runs:
                return {"runs": [], "selected": None, "series": {}, "warnings": [],
                        "root": str(self.root), "generated_at": time.time()}
            run_id = run_id if run_id is not None else runs[0]["id"]
            # Run IDs are a discovered allowlist, never user-supplied filesystem paths.
            if run_id not in {r["id"] for r in runs}:
                raise KeyError("未找到该运行，请重新选择")
            directory = (self.root / run_id).resolve(strict=True)
            if not directory.is_relative_to(self.root):
                raise KeyError("运行目录超出日志范围")
            now = time.time()
            cache = self.cached.get(run_id)
            if cache and now - cache[0] < self.cache_seconds:
                payload = dict(cache[1])
            else:
                payload = self._read(run_id, directory)
                self.cached[run_id] = (now, payload)
            payload = dict(payload, runs=runs, selected=run_id, root=str(self.root), generated_at=now)
            latest_wall = payload.get("latest_wall")
            age = max(0, now - latest_wall) if latest_wall is not None else None
            payload["age_seconds"] = age
            payload["freshness"] = "empty" if age is None else ("recent" if age <= self.stale_seconds else "stale")
            payload["stale_seconds"] = self.stale_seconds
            return payload

    def _read(self, run_id, directory):
        from tensorboard.backend.event_processing.event_accumulator import EventAccumulator
        from tensorboard.util import tensor_util
        warnings = []
        if run_id not in self.readers:
            self.readers[run_id] = EventAccumulator(str(directory), size_guidance={"scalars": 0, "tensors": 0})
            while len(self.readers) > 4:
                old, _ = self.readers.popitem(last=False)
                self.cached.pop(old, None)
        self.readers.move_to_end(run_id)
        reader = self.readers[run_id]
        reader.Reload()
        tags = reader.Tags()
        series = {}
        for tag in tags.get("scalars", []):
            series[tag] = summarize((e.wall_time, e.step, e.value) for e in reader.Scalars(tag))
        # TF2 stores scalar summaries as tensors. Ignore images/text/histograms.
        try:
            tensor_tags = reader.PluginTagToContent("scalars")
        except KeyError:
            tensor_tags = {}
        for tag in tags.get("tensors", []):
            if tag not in tensor_tags or tag in series:
                continue
            points = []
            for event in reader.Tensors(tag):
                try:
                    value = tensor_util.make_ndarray(event.tensor_proto)
                    if value.size == 1:
                        points.append((event.wall_time, event.step, float(value.reshape(-1)[0])))
                except (TypeError, ValueError):
                    continue
            series[tag] = summarize(points)
        config, warning = read_config(directory)
        if warning:
            warnings.append(warning)
        metrics = {key: next((tag for tag in options if tag in series and series[tag]["count"]), None)
                   for key, options in ALIASES.items()}
        epoch_axis = ("Train/Steps total" in series and "Train/Seconds total" in series) or "MCTS/Steps" in series
        latest_step = max((s["latest"][0] for s in series.values() if s["latest"]), default=None)
        latest_wall = max((s["latest_wall"] for s in series.values() if s["latest_wall"] is not None), default=None)
        target = config.get("training_epochs") if epoch_axis else None
        if target is not None and (target <= 0 or target != int(target)):
            target = None
        return {"series": series, "metrics": metrics, "config": config, "warnings": warnings,
                "axis": "训练轮次" if epoch_axis else "日志 step", "latest_step": latest_step,
                "target": target, "latest_wall": latest_wall}


def make_handler(store):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            if self.headers.get("Host", "").split(":")[0].lower() not in {"127.0.0.1", "localhost"}:
                self.respond(403, b"Local host only", "text/plain")
                return
            route = urlsplit(self.path)
            if route.path == "/api/health":
                health = {"service": "training-lens", "version": VERSION,
                          "instance": os.environ.get("TRAINING_LENS_INSTANCE", "standalone")}
                self.respond(200, json.dumps(health).encode(), "application/json")
                return
            if route.path == "/api/snapshot":
                query = parse_qs(route.query)
                try:
                    data = store.snapshot(query.get("run", [None])[0])
                    self.respond(200, json.dumps(data, ensure_ascii=False, allow_nan=False).encode(), "application/json")
                except KeyError:
                    self.respond(404, b'{"error":"Run not found"}', "application/json")
                except Exception as exc:
                    # Never render arbitrary file contents or an exception traceback.
                    print(f"Monitor read failed: {type(exc).__name__}", flush=True)
                    self.respond(503, json.dumps({"error": "暂时无法读取事件日志；页面会自动重试。"}, ensure_ascii=False).encode(), "application/json")
                return
            paths = {"/": ("index.html", "text/html"), "/app.js": ("app.js", "text/javascript"),
                     "/style.css": ("style.css", "text/css")}
            if route.path not in paths:
                self.respond(404, b"Not found", "text/plain")
                return
            filename, mime = paths[route.path]
            self.respond(200, (ASSETS / filename).read_bytes(), mime)

        def respond(self, status, body, mime):
            self.send_response(status)
            self.send_header("Content-Type", mime + "; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'")
            self.end_headers()
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass
    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--logdir", required=True, type=Path, help="已有 TensorBoard 日志目录（可含多个运行）")
    parser.add_argument("--port", type=int, default=0, help="0 chooses an available loopback port")
    parser.add_argument("--parent-stdin", action="store_true", help="Stop when the owning plugin closes stdin")
    parser.add_argument("--stale-seconds", type=int, default=120, help="仅标识日志新鲜度，不代表训练进程存活")
    args = parser.parse_args()
    if not 0 <= args.port <= 65535 or args.stale_seconds < 1:
        parser.error("port must be 0–65535; stale-seconds must be positive")
    try:
        # Load native numerical dependencies on the main thread before accepting
        # requests or starting the stdin watcher (important for Windows loaders).
        from tensorboard.backend.event_processing import event_accumulator  # noqa: F401
        from tensorboard.util import tensor_util  # noqa: F401
        store = EventStore(args.logdir, args.stale_seconds)
    except ImportError:
        parser.error("TensorBoard is missing. Use your training Python, or install this package's requirements.txt with that interpreter.")
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    server = LocalHTTPServer(("127.0.0.1", args.port), make_handler(store))
    ready = {"service": "training-lens", "url": f"http://127.0.0.1:{server.server_port}",
             "instance": os.environ.get("TRAINING_LENS_INSTANCE", "standalone")}
    print(json.dumps(ready), flush=True)
    if args.parent_stdin:
        def parent_watch():
            sys.stdin.buffer.read()
            server.shutdown()
        threading.Thread(target=parent_watch, daemon=True).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
