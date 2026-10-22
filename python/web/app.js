"use strict";
document.documentElement.classList.toggle(
  "embedded",
  new URLSearchParams(location.search).get("embedded") === "1",
);
const $ = (id) => document.getElementById(id);
let snapshot = null,
  selected = null,
  paused = false,
  controller = null,
  requestId = 0;
let lang = navigator.language.startsWith("zh") ? "zh" : "en";
const copy = {
  brand: ["训练视窗", "Training dashboard"],
  headline: ["看见每一次训练的变化。", "See how your training is changing."],
  subtitle: [
    "从 TensorBoard 标量日志，读懂进展与趋势。",
    "A clearer view of your TensorBoard scalar logs.",
  ],
  local: ["本机 · 只读", "Local · Read only"],
  run: ["当前运行", "Run"],
  refresh: ["刷新", "Refresh"],
  interval: ["每 5 秒", "Every 5s"],
  empty: ["等待标量记录", "Waiting for scalar events"],
  emptyHelp: [
    "训练器写入事件文件后，页面会自动更新。",
    "This page updates automatically when your trainer writes event files.",
  ],
  primary: ["主要指标", "Primary metric"],
  direction: ["改善方向", "Objective"],
  neutral: ["不预设", "Unspecified"],
  maximize: ["越高越好", "Higher is better"],
  minimize: ["越低越好", "Lower is better"],
  progress: ["已记录进度", "Logged progress"],
  latest: ["主要指标 · 最新值", "Primary metric · Latest"],
  change: ["较前一有效记录", "Change from previous valid point"],
  raw: ["卡片始终显示原始记录", "Cards always show raw values"],
  trend: ["主要指标如何变化", "Follow the main trend"],
  smoothing: ["曲线平滑", "Smoothing"],
  off: ["关闭 · 原始值", "Off · Raw values"],
  interpret: [
    "请按指标定义判断变化方向。单条曲线不能单独证明训练收敛、模型泛化或任务成功。",
    "Interpret changes using the metric's definition. One curve cannot establish convergence, generalization or task success.",
  ],
  secondary: ["辅助指标", "Secondary metric"],
  independent: [
    "辅助图使用自己的纵轴；不同指标的数值不可直接比较。",
    "Each chart has its own vertical scale. Values of different metrics are not directly comparable.",
  ],
  snapshot: ["日志快照", "Log snapshot"],
  health: [
    "状态仅反映日志新鲜度，不代表训练进程健康。",
    "Status reflects log freshness, not the health of your training process.",
  ],
  diagnostics: ["诊断与全部标量", "Diagnostics & all scalars"],
  tag: ["原始指标", "Scalar tag"],
  value: ["最新值", "Latest value"],
  atStep: ["对应 step", "At step"],
  validCount: ["有效 / 总记录", "Valid / Total"],
  footer: [
    "Training Lens · 日志留在本机",
    "Training Lens · Your logs stay local",
  ],
  paused: [
    "刷新已暂停 · 训练不受影响",
    "Refresh paused · Training is unaffected",
  ],
  pause: ["暂停刷新", "Pause refresh"],
  resume: ["继续刷新", "Resume refresh"],
  recent: ["近期有日志写入", "Recent log activity"],
  stale: ["暂无近期日志", "No recent log activity"],
  loading: ["正在读取日志", "Reading logs"],
  failed: ["读取失败 · 数据未更新", "Read failed · Data is unchanged"],
  failure: [
    "暂时无法读取日志；保留上次画面并自动重试。",
    "Cannot read logs right now. Keeping the last view and retrying automatically.",
  ],
  missing: [
    "该运行已移走，下次刷新将重新选择。",
    "This run was moved. The next refresh will select another run.",
  ],
  unknown: [
    "目标未记录，不估算完成比例",
    "No recorded target; completion is unknown",
  ],
  reached: ["日志已达到目标", "Logs have reached the target"],
  range: ["历史范围", "Observed range"],
  best: ["所选方向下的最佳值", "Best for the chosen objective"],
  waiting: ["等待更多有效记录", "Waiting for more valid points"],
  noObjective: ["未预设改善方向", "No improvement direction assumed"],
  better: ["按所选方向有所改善", "Improved for the chosen objective"],
  worse: ["按所选方向有所回落", "Declined for the chosen objective"],
  unchanged: ["与前一有效记录相同", "Unchanged from the previous valid point"],
  invalid: [
    "非有限值已留空；请结合指标定义检查。",
    "Non-finite values are gaps; inspect them in the context of the metric.",
  ],
  decimated: [
    "长曲线保留区间端点和极值；统计来自完整序列。",
    "Long curves retain interval endpoints and extrema; statistics use the full sequence.",
  ],
  noPoints: ["暂无有效标量", "No valid scalar points"],
  epoch: ["训练轮次", "Epoch"],
  step: ["日志 step", "Logged step"],
  source: ["日志目录", "Log directory"],
  readAt: ["页面读取于", "Read at"],
  metrics: ["标量指标数", "Scalar tags"],
  points: ["主要指标记录数", "Primary metric points"],
  gaps: ["非有限记录数", "Non-finite points"],
  freshness: ["最近标量", "Latest scalar"],
  config_not_mapping: [
    "config.yaml 不是配置字典；目标轮次暂不可用。",
    "config.yaml is not a mapping; the target epoch is unavailable.",
  ],
  config_unavailable: [
    "无法读取配置；仍可查看标量，目标轮次暂不可用。",
    "Configuration could not be read. Scalars remain available; the target epoch is unknown.",
  ],
  config_invalid: [
    "config.yaml 尚不完整或格式无效；目标轮次暂不可用。",
    "config.yaml is incomplete or invalid; the target epoch is unavailable.",
  ],
};
const t = (key) => copy[key]?.[lang === "zh" ? 0 : 1] ?? key;
const fmt = (n, digits = 2) => {
  if (!Number.isFinite(n)) return "—";
  const magnitude = Math.abs(n);
  if (magnitude && (magnitude < 10 ** -digits || magnitude >= 1e8))
    return n.toExponential(2);
  return n.toLocaleString(lang === "zh" ? "zh-CN" : "en", {
    maximumFractionDigits: digits,
  });
};
const text = (id, value) => {
  $(id).textContent = value;
};
const axis = () => (snapshot?.axis === "训练轮次" ? t("epoch") : t("step"));
const at = (p) => (p ? `${axis()} ${fmt(p[0], 0)}` : "—");
function age(seconds) {
  if (seconds == null) return "—";
  const [n, unit] =
    seconds < 60
      ? [Math.floor(seconds), lang === "zh" ? "秒前" : "s ago"]
      : seconds < 3600
        ? [Math.floor(seconds / 60), lang === "zh" ? "分钟前" : "m ago"]
        : [fmt(seconds / 3600, 1), lang === "zh" ? "小时前" : "h ago"];
  return `${n} ${unit}`;
}
function translate() {
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i]").forEach((el) => {
    el.textContent = t(el.dataset.i);
  });
  text("language", lang === "zh" ? "English" : "中文");
  text("pause", t(paused ? "resume" : "pause"));
  if (snapshot) render(snapshot);
  else text("connection", t("loading"));
}
function setOptions(id, tags, prefer) {
  const el = $(id),
    previous = el.value;
  if (
    JSON.stringify([...el.options].map((o) => o.value)) !== JSON.stringify(tags)
  ) {
    el.replaceChildren(
      ...tags.map((tag) => {
        const o = document.createElement("option");
        o.value = tag;
        o.textContent = tag;
        return o;
      }),
    );
    el.value = tags.includes(previous)
      ? previous
      : tags.includes(prefer)
        ? prefer
        : (tags[0] ?? "");
  }
}
function chart(id, tag, color) {
  const container = $(id),
    data = snapshot.series[tag];
  container.replaceChildren();
  const points = data?.points ?? [],
    valid = points.filter((p) => p[1] != null);
  if (!valid.length) {
    const div = document.createElement("div");
    div.className = "empty-chart";
    div.textContent = t("noPoints");
    container.append(div);
    return;
  }
  const ns = "http://www.w3.org/2000/svg";
  const node = (name, attrs = {}, value) => {
    const el = document.createElementNS(ns, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    if (value != null) el.textContent = value;
    return el;
  };
  const width = Math.max(container.clientWidth, 220),
    height = container.clientHeight,
    left = 55,
    right = 15,
    top = 15,
    bottom = 30;
  const xmin = Math.min(...valid.map((p) => p[0])),
    xmax = Math.max(...valid.map((p) => p[0]));
  let ymin = Math.min(...valid.map((p) => p[1])),
    ymax = Math.max(...valid.map((p) => p[1]));
  const span = ymax - ymin || Math.max(Math.abs(ymax) * 0.1, 1);
  ymin -= span * 0.1;
  ymax += span * 0.1;
  const x = (n) =>
      left + ((n - xmin) / (xmax - xmin || 1)) * (width - left - right),
    y = (n) =>
      height - bottom - ((n - ymin) / (ymax - ymin)) * (height - top - bottom);
  const svg = node("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": `${tag} · ${axis()}`,
  });
  for (let i = 0; i <= 4; i++) {
    const v = ymin + ((ymax - ymin) * i) / 4;
    svg.append(
      node("line", {
        x1: left,
        x2: width - right,
        y1: y(v),
        y2: y(v),
        stroke: "#edf0eb",
      }),
    );
    svg.append(
      node(
        "text",
        { x: left - 8, y: y(v) + 3, "text-anchor": "end" },
        fmt(v, 2),
      ),
    );
  }
  (xmin === xmax ? [xmin] : [xmin, (xmin + xmax) / 2, xmax]).forEach((v) =>
    svg.append(
      node(
        "text",
        { x: x(v), y: height - 8, "text-anchor": "middle" },
        fmt(v, 0),
      ),
    ),
  );
  const alpha = Number($("smooth").value);
  function path(rows, opacity) {
    let d = "",
      drawing = false;
    rows.forEach((p) => {
      if (p[1] == null) {
        drawing = false;
        return;
      }
      d += `${drawing ? "L" : "M"}${x(p[0])},${y(p[1])} `;
      drawing = true;
    });
    svg.append(
      node("path", {
        d,
        fill: "none",
        stroke: color,
        "stroke-width": 2,
        opacity,
        "stroke-linejoin": "round",
      }),
    );
  }
  path(points, alpha ? 0.2 : 1);
  if (alpha) {
    let previous = null;
    path(
      points.map((p) => {
        previous =
          p[1] == null
            ? null
            : previous == null
              ? p[1]
              : alpha * previous + (1 - alpha) * p[1];
        return [p[0], previous];
      }),
      1,
    );
  }
  valid.forEach((p) => {
    const dot = node("circle", {
      cx: x(p[0]),
      cy: y(p[1]),
      r: valid.length === 1 ? 4 : 2.5,
      fill: color,
      opacity: alpha ? 0.3 : 0.85,
      "aria-hidden": "true",
    });
    dot.append(node("title", {}, `${tag} · ${at(p)} · ${fmt(p[1], 6)}`));
    svg.append(dot);
  });
  container.append(svg);
}
function drawCharts() {
  if (!snapshot?.selected) return;
  chart("main-chart", $("primary").value, "#16816c");
  chart("second-chart", $("secondary").value, "#8198ac");
}
function render(data) {
  snapshot = data;
  setOptions(
    "run",
    data.runs.map((r) => r.id),
    data.selected,
  );
  selected = data.selected;
  $("run").value = selected ?? "";
  const tags = Object.keys(data.series)
    .filter((tag) => data.series[tag].count)
    .sort();
  $("empty").hidden = !!tags.length;
  $("dashboard").hidden = !tags.length;
  text("source", `${t("source")}: ${data.root}`);
  text(
    "updated",
    `${t("readAt")} ${new Date(data.generated_at * 1000).toLocaleTimeString()}`,
  );
  text(
    "connection",
    t(
      paused
        ? "paused"
        : data.freshness === "recent"
          ? "recent"
          : tags.length
            ? "stale"
            : "empty",
    ),
  );
  $("dot").className =
    `dot ${data.freshness === "recent" && !paused ? "" : "waiting"}`;
  if (!tags.length) return;
  const prefer =
    data.metrics.eval_reward ??
    tags.find((s) => /val.*loss|eval.*loss/i.test(s)) ??
    tags[0];
  setOptions("primary", tags, prefer);
  setOptions(
    "secondary",
    tags,
    data.metrics.train_reward ?? tags.find((s) => s !== $("primary").value),
  );
  const primary = data.series[$("primary").value],
    last = primary.latest,
    previous = primary.previous_finite,
    direction = $("direction").value;
  text("axis-badge", axis());
  text("step", fmt(data.latest_step, 0));
  text("target", data.target ? `/ ${fmt(data.target, 0)}` : "");
  $("progress").hidden = !data.target;
  $("progress").value = data.target
    ? Math.min(100, (100 * data.latest_step) / data.target)
    : 0;
  text(
    "progress-note",
    !data.target
      ? t("unknown")
      : data.latest_step >= data.target
        ? t("reached")
        : `${fmt((100 * data.latest_step) / data.target, 1)}%`,
  );
  text("freshness", `${t("freshness")}: ${age(data.age_seconds)}`);
  text("latest", fmt(last?.[1], 4));
  text("metric-name", $("primary").value);
  text("metric-step", at(last));
  const best = direction === "min" ? primary.minimum : primary.best;
  text("best-title", t(direction === "none" ? "range" : "best"));
  text(
    "best",
    direction === "none"
      ? `${fmt(primary.minimum?.[1])} … ${fmt(primary.best?.[1])}`
      : fmt(best?.[1], 4),
  );
  text(
    "best-note",
    t(
      direction === "none"
        ? "noObjective"
        : direction === "min"
          ? "minimize"
          : "maximize",
    ),
  );
  text("best-step", direction === "none" ? "" : at(best));
  const change = previous && last?.[1] != null ? last[1] - previous[1] : null,
    improvement = direction === "min" ? -change : change;
  text(
    "change",
    change == null ? "—" : `${change > 0 ? "+" : ""}${fmt(change, 4)}`,
  );
  text(
    "change-note",
    t(
      change == null
        ? "waiting"
        : direction === "none"
          ? "noObjective"
          : change === 0
            ? "unchanged"
            : improvement > 0
              ? "better"
              : "worse",
    ),
  );
  $("change-note").className =
    `metric-note ${change == null || direction === "none" || change === 0 ? "" : improvement > 0 ? "positive" : "negative"}`;
  text("metric-note", `${$("primary").value} · ${at(last)}`);
  const invalid = Object.entries(data.series).filter(([, s]) => s.invalid),
    totalInvalid = invalid.reduce((sum, [, s]) => sum + s.invalid, 0);
  const facts = [
    [t("metrics"), tags.length],
    [t("points"), primary.count],
    [t("gaps"), totalInvalid],
    [t("freshness"), age(data.age_seconds)],
  ];
  $("facts").replaceChildren(
    ...facts.map(([k, v]) => {
      const row = document.createElement("div"),
        dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = k;
      dd.textContent = v;
      row.append(dt, dd);
      return row;
    }),
  );
  const notes = data.warnings.map(t);
  if (invalid.length)
    notes.push(
      `${t("invalid")} ${invalid.map(([tag, s]) => `${tag} (${s.invalid})`).join(", ")}`,
    );
  if (Object.values(data.series).some((s) => s.downsampled))
    notes.push(t("decimated"));
  text("warnings", notes.join("\n"));
  $("warnings").hidden = !notes.length;
  text("diagnostic-count", `${tags.length} ${t("metrics")}`);
  $("metric-table").replaceChildren(
    ...tags.map((tag) => {
      const s = data.series[tag],
        tr = document.createElement("tr");
      [
        tag,
        fmt(s.latest?.[1], 6),
        fmt(s.latest?.[0], 0),
        `${s.count - s.invalid} / ${s.count}`,
      ].forEach((v) => {
        const td = document.createElement("td");
        td.textContent = v;
        tr.append(td);
      });
      return tr;
    }),
  );
  drawCharts();
}
async function refresh(force = false) {
  if (controller && !force) return;
  if (controller) controller.abort();
  if (snapshot && selected !== snapshot.selected) {
    $("dashboard").hidden = true;
    text("connection", t("loading"));
  }
  const id = ++requestId,
    current = new AbortController();
  controller = current;
  const timer = setTimeout(() => current.abort(), 20000);
  try {
    const response = await fetch(
      `/api/snapshot${selected == null ? "" : `?run=${encodeURIComponent(selected)}`}`,
      { signal: current.signal, cache: "no-store" },
    );
    if (!response.ok) {
      if (response.status === 404) selected = null;
      throw new Error(t(response.status === 404 ? "missing" : "failure"));
    }
    const data = await response.json();
    if (id !== requestId) return;
    $("error").hidden = true;
    render(data);
  } catch (error) {
    if (id !== requestId) return;
    text("error", error.name === "AbortError" ? t("failure") : error.message);
    $("error").hidden = false;
    text("connection", t("failed"));
    $("dot").className = "dot error";
  } finally {
    clearTimeout(timer);
    if (id === requestId) controller = null;
  }
}
$("run").addEventListener("change", () => {
  selected = $("run").value;
  $("primary").replaceChildren();
  $("secondary").replaceChildren();
  $("direction").value = "none";
  refresh(true);
});
$("primary").addEventListener("change", () => {
  $("direction").value = "none";
  if (snapshot) render(snapshot);
});
["secondary", "smooth", "direction"].forEach((id) =>
  $(id).addEventListener("change", () => {
    if (snapshot) render(snapshot);
  }),
);
$("refresh").addEventListener("click", () => refresh(true));
$("pause").addEventListener("click", () => {
  paused = !paused;
  $("pause").setAttribute("aria-pressed", String(paused));
  translate();
  if (!paused) refresh(true);
});
$("language").addEventListener("click", () => {
  lang = lang === "zh" ? "en" : "zh";
  translate();
});
let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawCharts, 120);
});
setInterval(() => {
  if (!paused) refresh();
}, 5000);
translate();
refresh();
