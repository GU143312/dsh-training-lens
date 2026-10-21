# Changelog

## 0.1.0

- Installable DSH bundle with a `training_lens` tool for start, status and stop.
- Chinese / English dashboard, selectable scalar metrics and explicit improvement direction.
- Raw and smoothed curves, per-metric steps, missing-value gaps and expandable diagnostics.
- Existing TensorBoard event files remain read only; no trainer changes or automatic dependency installation.
- Automatic loopback port selection, readiness verification and owned-process cleanup on plugin disposal or parent exit.
