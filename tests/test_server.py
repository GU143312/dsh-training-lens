"""No training process is used; optional tests write temporary TensorBoard events."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from python.server import EventStore, LocalHTTPServer, make_handler, read_config, summarize


HAS_TB = importlib.util.find_spec("tensorboard") is not None
HAS_YAML = importlib.util.find_spec("yaml") is not None


class SummaryTests(unittest.TestCase):
    def test_nonfinite_is_gap_and_latest_does_not_fall_back(self):
        result = summarize([(100, 1, 3), (101, 2, float("inf")), (102, 3, float("nan"))])
        self.assertEqual(result["invalid"], 2)
        self.assertIsNone(result["latest"][1])
        self.assertEqual(result["best"][1], 3)
        json.dumps(result, allow_nan=False)

    def test_resumed_duplicate_steps_use_newest_event(self):
        result = summarize([(103, 2, 7), (101, 1, 2), (102, 2, 99)])
        self.assertEqual(result["points"], [[1, 2.0, 101.0], [2, 7.0, 103.0]])
        self.assertEqual(result["best"][1], 7)

    def test_display_downsampling_preserves_spike_gap_and_exact_stats(self):
        rows = [(i, i, 1) for i in range(10000)]
        rows[373] = (373, 373, 999)
        rows[374] = (374, 374, float("nan"))
        result = summarize(rows)
        self.assertLessEqual(len(result["points"]), 1600)
        self.assertIn([373, 999.0, 373.0], result["points"])
        self.assertIn([374, None, 374.0], result["points"])
        self.assertEqual(result["best"][1], 999)
        self.assertEqual(result["previous_finite"][0], 9998)
        self.assertEqual(result["count"], 10000)

    def test_empty_series(self):
        result = summarize([])
        self.assertIsNone(result["best"])
        self.assertIsNone(result["latest_wall"])


class DiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def test_empty_root_and_missing_root(self):
        result = EventStore(self.root).snapshot()
        self.assertEqual(result["runs"], [])
        with self.assertRaises(FileNotFoundError):
            EventStore(self.root / "missing")

    def test_discovery_skips_checkpoint_copies_and_rejects_path_traversal(self):
        for folder in ("run A", "run A/checkpoint_001"):
            directory = self.root / folder
            directory.mkdir(parents=True, exist_ok=True)
            (directory / "events.out.tfevents.fake").touch()
        store = EventStore(self.root)
        self.assertEqual([r["id"] for r in store.discover()], ["run A"])
        with self.assertRaises(KeyError):
            store.snapshot("../private")
        with self.assertRaises(KeyError):
            store.snapshot(str(self.root))

    @unittest.skipUnless(HAS_YAML, "optional PyYAML dependency")
    def test_config_is_allowlisted_and_safe(self):
        path = self.root / "config.yaml"
        path.write_text("training_epochs: 500\nsecret: do-not-expose\nlearning_rate: .nan\n", encoding="utf8")
        self.assertEqual(read_config(self.root), ({"training_epochs": 500}, None))
        path.write_text("!!python/object/apply:os.system ['echo forbidden']", encoding="utf8")
        self.assertIsNotNone(read_config(self.root)[1])

    def test_http_only_exposes_allowlisted_routes(self):
        server = LocalHTTPServer(("127.0.0.1", 0), make_handler(EventStore(self.root)))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{server.server_port}"
            with urlopen(base + "/api/snapshot") as response:
                self.assertEqual(json.load(response)["runs"], [])
                self.assertEqual(response.headers["Cache-Control"], "no-store")
            with urlopen(base + "/") as response:
                self.assertIn("Training Lens", response.read().decode())
                self.assertIn("default-src 'self'", response.headers["Content-Security-Policy"])
            with self.assertRaises(HTTPError) as error:
                urlopen(base + "/../config.yaml")
            self.assertEqual(error.exception.code, 404)
            with self.assertRaises(HTTPError) as error:
                urlopen(Request(base + "/api/snapshot", headers={"Host": "external.example"}))
            self.assertEqual(error.exception.code, 403)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


@unittest.skipUnless(HAS_TB, "optional TensorBoard integration dependency")
class EventIntegrationTests(unittest.TestCase):
    def setUp(self):
        from tensorboard.summary.writer.event_file_writer import EventFileWriter
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.writer = EventFileWriter(str(self.root / "run 中文"))
        self.addCleanup(self.tmp.cleanup)
        self.addCleanup(self.writer.close)

    def write(self, tag, step, value, wall=None):
        from tensorboard.compat.proto.event_pb2 import Event
        from tensorboard.compat.proto.summary_pb2 import Summary
        self.writer.add_event(Event(wall_time=wall or time.time(), step=step,
                                    summary=Summary(value=[Summary.Value(tag=tag, simple_value=value)])))
        self.writer.flush()

    def test_live_append_freshness_mapping_and_read_only(self):
        self.write("Train/Steps total", 60, 1000, wall=time.time() - 1000)
        self.write("Train/Seconds total", 60, 100, wall=time.time() - 1000)
        self.write("Evaluation/Mean reward", 20, -5, wall=time.time() - 1000)
        store = EventStore(self.root, cache_seconds=0)
        initial = store.snapshot()
        self.assertEqual(initial["latest_step"], 60)
        self.assertEqual(initial["axis"], "训练轮次")
        self.assertEqual(initial["freshness"], "stale")
        self.assertEqual(initial["series"][initial["metrics"]["eval_reward"]]["latest"][0], 20)
        self.write("Evaluation/Mean reward", 40, -2)
        self.write("Network/V loss", 60, float("inf"))
        event_file = next((self.root / "run 中文").glob("events.out.tfevents.*"))
        before = hashlib.sha256(event_file.read_bytes()).digest()
        updated = store.snapshot()
        self.assertEqual(updated["freshness"], "recent")
        self.assertEqual(updated["series"]["Evaluation/Mean reward"]["best"][1], -2)
        self.assertIsNone(updated["series"]["Network/V loss"]["latest"][1])
        self.assertEqual(before, hashlib.sha256(event_file.read_bytes()).digest())
        json.dumps(updated, allow_nan=False)

    def test_tensor_scalar_summary(self):
        from tensorboard.compat.proto.event_pb2 import Event
        from tensorboard.compat.proto.summary_pb2 import Summary, SummaryMetadata
        from tensorboard.util import tensor_util
        metadata = SummaryMetadata(plugin_data=SummaryMetadata.PluginData(plugin_name="scalars"))
        scalar = Summary.Value(tag="eval/success_rate", metadata=metadata,
                               tensor=tensor_util.make_tensor_proto(.75))
        self.writer.add_event(Event(wall_time=time.time(), step=100, summary=Summary(value=[scalar])))
        self.writer.flush()
        result = EventStore(self.root).snapshot()
        self.assertEqual(result["metrics"]["success"], "eval/success_rate")
        self.assertEqual(result["series"]["eval/success_rate"]["latest"][1], .75)
        self.assertEqual(result["axis"], "日志 step")
        self.assertIsNone(result["target"])


if __name__ == "__main__":
    unittest.main()
