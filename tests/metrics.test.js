import test from "node:test";
import assert from "node:assert/strict";
import {
  describeMetric,
  recommend,
  resolveView,
  normalizeView,
  filterMetrics,
  loadView,
  saveView,
} from "../python/web/metrics.js";

const rl = [
  "Train/Episodes per epoch",
  "Train/Episodes total",
  "Train/Mean episode length",
  "Train/Mean reward",
  "Evaluation/Mean reward",
  "Network/Pi loss",
  "Network/V loss",
  "Train/Steps_per_second",
];

test("RL and supervised presets prioritize different recorded metrics and retain episodes", () => {
  const view = recommend(rl, "rl");
  assert.equal(view.primary, "Evaluation/Mean reward");
  assert.ok(view.pins.includes("Train/Episodes total"));
  assert.ok(view.pins.includes("Network/Pi loss"));
  assert.ok(view.pins.includes("Network/V loss"));
  assert.ok(!view.pins.includes("Train/Mean episode length"));
  const supervised = recommend(
    [...rl, "val_loss", "validation/accuracy", "train/loss"],
    "supervised",
  );
  assert.equal(supervised.primary, "val_loss");
  assert.ok(supervised.pins.includes("validation/accuracy"));
  assert.equal(recommend(rl, "performance").primary, "Train/Steps_per_second");
  assert.equal(resolveView({ scene: "rl" }, rl).direction, "none");
});

test("late evaluation records improve automatic suggestions but never override manual choices", () => {
  const initial = ["Train/Episodes total", "Train/Steps total"];
  const later = [...initial, "eval/mean_reward"];
  assert.equal(resolveView({}, initial).primary, "Train/Episodes total");
  assert.equal(resolveView({}, later).primary, "eval/mean_reward");
  const manual = {
    primary: "Train/Episodes total",
    pins: ["Train/Episodes total"],
    objectives: { "Train/Episodes total": "none", "eval/mean_reward": "max" },
  };
  assert.equal(resolveView(manual, later).primary, "Train/Episodes total");
  assert.deepEqual(resolveView(manual, later).pins, ["Train/Episodes total"]);
  assert.equal(resolveView(manual, later).direction, "none");
  assert.equal(
    resolveView({ ...manual, primary: "eval/mean_reward" }, later).direction,
    "max",
  );
});

test("missing selected metrics remain explicit and are never replaced by unrelated run data", () => {
  const result = resolveView(
    {
      primary: "eval/mean_reward",
      pins: ["eval/mean_reward", "Train/Episodes total"],
    },
    ["train/loss"],
  );
  assert.equal(result.primary, "eval/mean_reward");
  assert.deepEqual(result.pins, ["eval/mean_reward", "Train/Episodes total"]);
  assert.equal(recommend([], "rl").primary, "");
  assert.deepEqual(recommend(["train/loss"], "custom").pins, []);
});

test("search and grouping support common tag conventions without conflating counts and episode lengths", () => {
  for (const tag of [
    "Evaluation/Mean reward",
    "eval_mean_reward",
    "validation.loss",
    "val/accuracy",
    "test/f1",
  ])
    assert.equal(describeMetric(tag).group, "eval");
  assert.equal(describeMetric("optimizer/learning_rate").group, "optimization");
  assert.equal(describeMetric("Train/Steps_per_second").group, "system");
  assert.equal(describeMetric("Train/Episodes total").group, "progress");
  assert.equal(describeMetric("rollout/ep_len_mean").episodes, false);
  assert.equal(describeMetric("Train/Mean episode length").episodes, false);
  assert.deepEqual(filterMetrics(rl, "EVAL reward"), [
    "Evaluation/Mean reward",
  ]);
  assert.deepEqual(filterMetrics(rl, "episodes", "eval"), []);
});

test("view persistence isolates roots and runs and tolerates blocked or malformed storage", () => {
  const values = new Map();
  const storage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
  };
  assert.equal(
    saveView(storage, "root-a", "run", {
      scene: "rl",
      primary: "eval/mean_reward",
      pins: [],
    }),
    true,
  );
  assert.equal(loadView(storage, "root-a", "run").scene, "rl");
  assert.equal(loadView(storage, "root-b", "run").primary, null);
  assert.equal(loadView(storage, "root-a", "other").primary, null);
  assert.deepEqual(loadView(storage, "root-a", "run").pins, []);
  assert.equal(saveView(null, "root", "run", {}), false);
  assert.equal(
    loadView(
      {
        getItem() {
          throw Error("blocked");
        },
      },
      "root",
      "run",
    ).scene,
    "general",
  );
  assert.equal(
    loadView({ getItem: () => "{bad" }, "root", "run").primary,
    null,
  );
  const safe = normalizeView({
    scene: "unknown",
    smooth: "NaN",
    pins: ["x", "x", ...rl],
    objectives: { x: "maximize" },
  });
  assert.equal(safe.scene, "general");
  assert.equal(safe.pins.length, 6);
  assert.deepEqual(safe.objectives, {});
});
