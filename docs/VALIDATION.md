# Release validation

Version: 0.1.0. Local validation date: 2026-10-21.

## Completed locally

- `npm run check`: passed manifest and public-source checks.
- `TRAINING_LENS_TEST_PYTHON=<existing Python executable> npm test`: five tests passed, no skips. On Windows, set the environment variable using PowerShell before running `npm test`.
- `python -m unittest discover -s tests -p 'test_*.py' -v`: ten tests passed with TensorBoard and PyYAML available. This covers live event append, TF2 scalar tensors, duplicate steps, non-finite values, extrema-preserving display downsampling, safe numeric configuration, route boundaries and foreign Host rejection.
- `node --check python/web/app.js`: passed.
- Real subprocess start, idempotency, conflicting port, status, stop, restart and plugin disposal passed. Windows uses an exclusive socket bind and imports numerical dependencies before starting request/watcher threads.
- DSH 0.2.1-rc.2 installed the tarball in an isolated test profile and included the `training-lens` entry in its merged configuration. Tool registration and cleanup also ran in a real Cordis context.
- Browser checks with generated scalar events: English/Chinese, minimum/maximum objective, small learning-rate values, pause/resume, desktop and 390-pixel viewport layouts; no observed browser console errors.

## Boundaries

No real training is started by the test suite. The preview and demo generator use synthetic data. An installed DSH configuration plus Cordis/tool tests is not a claim that every provider/model has completed a live chat tool round trip. The workflow tests Windows, Linux and macOS on GitHub Actions; consult the checks on the release commit for remote results. Other DSH versions are not verified.

The npm registry is a separate publication channel. GitHub releases provide the installation artifact; npm publication is not required to use that artifact.
