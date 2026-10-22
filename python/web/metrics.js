// Name-based suggestions only. Never synthesize an unrecorded metric or objective.
export const GROUPS = [
  "eval",
  "train",
  "progress",
  "optimization",
  "system",
  "other",
];
export const SCENES = ["general", "rl", "supervised", "performance", "custom"];
export const MAX_PINS = 6;
const words = (tag) =>
  String(tag)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim();
export function describeMetric(tag) {
  const name = words(tag);
  const has = (pattern) => pattern.test(name);
  const evaluation = has(/\b(eval|evaluation|val|valid|validation|test)\b/);
  const reward = has(/\b(reward|rewards|return|returns|rew)\b/);
  const loss = has(/\b(loss|error|mse|mae|rmse|perplexity)\b/);
  const accuracy = has(/\b(accuracy|acc|f1|auc|precision|recall)\b/);
  const success = has(/\b(success|win)\b/);
  const episodes =
    has(
      /\b(episodes|episode count|num episodes|episodes total|total episodes)\b/,
    ) && !has(/\b(length|len|reward|return|seconds|mean|avg)\b/);
  const throughput = has(
    /\b(fps|throughput)\b|\b(steps|samples|tokens|iterations) (per second|per sec|s)\b/,
  );
  const progress =
    !throughput &&
    (episodes ||
      has(
        /\b(timesteps|epoch|epochs|global step|total steps|steps total|total samples|samples total|seconds total|total seconds)\b/,
      ));
  const system =
    throughput ||
    has(/\b(gpu|cpu|memory|latency|duration|time|seconds|utilization)\b/);
  const optimization =
    loss ||
    has(
      /\b(network|optimizer|learning rate|lr|gradient|grad|entropy|kl|clip)\b/,
    );
  const group = evaluation
    ? "eval"
    : progress
      ? "progress"
      : optimization
        ? "optimization"
        : system
          ? "system"
          : has(/\b(train|training|rollout|mcts)\b/)
            ? "train"
            : "other";
  return {
    group,
    evaluation,
    reward,
    loss,
    accuracy,
    success,
    episodes,
    throughput,
    progress,
  };
}
export function sortedMetrics(tags) {
  return [...tags].sort(
    (a, b) =>
      GROUPS.indexOf(describeMetric(a).group) -
        GROUPS.indexOf(describeMetric(b).group) || a.localeCompare(b),
  );
}
export function recommend(tags, scene = "general") {
  const all = sortedMetrics(tags);
  const choose = (predicate) =>
    all.find((tag) => predicate(describeMetric(tag), words(tag)));
  const evalReward = choose((m) => m.evaluation && m.reward);
  const evalLoss = choose((m) => m.evaluation && m.loss);
  const evalScore = choose((m) => m.evaluation && (m.accuracy || m.success));
  const trainReward = choose((m) => !m.evaluation && m.reward);
  const trainLoss = choose((m) => !m.evaluation && m.loss);
  const valueLoss = choose(
    (m, n) => !m.evaluation && m.loss && /\b(value|critic|v)\b/.test(n),
  );
  const episodes =
    choose((m, n) => !m.evaluation && m.episodes && /\btotal\b/.test(n)) ??
    choose((m) => !m.evaluation && m.episodes);
  const throughput = choose((m) => m.throughput);
  const evalOther = choose((m) => m.evaluation && !m.progress);
  const orders = {
    general: [
      evalReward,
      evalLoss,
      evalScore,
      evalOther,
      trainReward,
      trainLoss,
      episodes,
      throughput,
    ],
    rl: [
      evalReward,
      evalScore,
      trainReward,
      episodes,
      trainLoss,
      valueLoss,
      throughput,
      evalOther,
    ],
    supervised: [
      evalLoss,
      evalScore,
      trainLoss,
      choose((m, n) => /\b(learning rate|lr)\b/.test(n)),
      throughput,
    ],
    performance: [
      throughput,
      episodes,
      choose((m, n) => /\b(latency|duration)\b/.test(n)),
      choose((m, n) => /\b(memory|utilization)\b/.test(n)),
      trainLoss,
    ],
    custom: [],
  };
  const pins = [
    ...new Set((orders[scene] ?? orders.general).filter(Boolean)),
  ].slice(0, MAX_PINS);
  const primary = pins[0] ?? all[0] ?? "";
  return {
    primary,
    secondary: pins[1] ?? all.find((tag) => tag !== primary) ?? primary,
    pins,
  };
}
export function normalizeView(raw) {
  const obj = raw && typeof raw === "object" ? raw : {};
  const tag = (s) => typeof s === "string" && s.length > 0 && s.length < 4096;
  return {
    scene: SCENES.includes(obj.scene) ? obj.scene : "general",
    primary: tag(obj.primary) ? obj.primary : null,
    secondary: tag(obj.secondary) ? obj.secondary : null,
    pins: Array.isArray(obj.pins)
      ? [...new Set(obj.pins.filter(tag))].slice(0, MAX_PINS)
      : null,
    objectives: Object.fromEntries(
      Object.entries(
        obj.objectives && typeof obj.objectives === "object"
          ? obj.objectives
          : {},
      )
        .filter(
          ([key, value]) => tag(key) && ["none", "min", "max"].includes(value),
        )
        .slice(-64),
    ),
    smooth: ["0", "0.6", "0.9"].includes(obj.smooth) ? obj.smooth : "0",
  };
}
export function resolveView(view, tags) {
  const saved = normalizeView(view),
    defaults = recommend(tags, saved.scene);
  const primary = saved.primary ?? defaults.primary;
  return {
    ...saved,
    primary,
    secondary: saved.secondary ?? defaults.secondary,
    pins: saved.pins ?? defaults.pins,
    direction: ["none", "min", "max"].includes(saved.objectives[primary])
      ? saved.objectives[primary]
      : "none",
  };
}
export function filterMetrics(tags, query, group = "all") {
  const terms = words(query).split(/\s+/).filter(Boolean);
  return sortedMetrics(tags).filter(
    (tag) =>
      (group === "all" || describeMetric(tag).group === group) &&
      terms.every((term) => words(tag).includes(term)),
  );
}
export function viewKey(root, run) {
  return `training-lens:view:v1:${JSON.stringify([root, run])}`;
}
export function loadView(storage, root, run) {
  try {
    return normalizeView(JSON.parse(storage.getItem(viewKey(root, run))));
  } catch {
    return normalizeView(null);
  }
}
export function saveView(storage, root, run, view) {
  try {
    storage.setItem(viewKey(root, run), JSON.stringify(normalizeView(view)));
    return true;
  } catch {
    return false;
  }
}
