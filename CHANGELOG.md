# Changelog

## 0.3.0

- Scenario presets for general monitoring, reinforcement learning, supervised learning / fine-tuning and sampling performance, plus a custom view.
- Searchable, grouped metric library and up to six pinned cards, each with its own recorded step and timestamp.
- Explicit current-run scalar/evaluation counts and missing-evaluation guidance; independent runs are never combined.
- Per-run browser preferences for metrics, objectives and smoothing; manual choices survive refreshes, while automatic suggestions can adopt late evaluation metrics.
- Main metric statistics are expandable so focus cards and trends appear first. Name-based recommendations never infer an improvement direction or create absent metrics.

## 0.2.0

- DSH sidebar and plugin-detail launcher with saved Python/log-directory settings, start/view/stop controls and an embedded local dashboard.
- Optional startup with DSH or on TensorBoard event-file activity; no trainer changes or dependency installation.
- Settings persist per profile outside the package; manual stop pauses automatic startup for the current session.
- Strict DSH Remote control contract, loopback-only dashboard framing and explicit remote-host forwarding guidance.

## 0.1.0

- Installable DSH bundle with a `training_lens` tool for start, status and stop.
- Chinese / English dashboard, selectable scalar metrics and explicit improvement direction.
- Raw and smoothed curves, per-metric steps, missing-value gaps and expandable diagnostics.
- Existing TensorBoard event files remain read only; no trainer changes or automatic dependency installation.
- Automatic loopback port selection, readiness verification and owned-process cleanup on plugin disposal or parent exit.
