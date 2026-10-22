import { readFile, writeFile, rename, mkdir, rm } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { MonitorManager } from "./manager.js";
import { ActivityWatcher } from "./activity.js";

export function validateSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid settings.");
  const allowed = ["python", "logdir", "port", "startMode"];
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error("Unknown setting.");
  const settings = {
    python: "python",
    logdir: "",
    port: 0,
    startMode: "manual",
    ...value,
  };
  for (const field of ["python", "logdir"]) {
    if (
      typeof settings[field] !== "string" ||
      settings[field].length > 4096 ||
      settings[field].includes("\0")
    )
      throw new Error(`Invalid ${field}.`);
    settings[field] = settings[field].trim();
  }
  if (!settings.python)
    throw new Error("Specify the training environment Python executable.");
  if (settings.logdir && !isAbsolute(settings.logdir))
    throw new Error(
      "Use an absolute log directory. / 请使用日志目录的绝对路径。",
    );
  if (
    !Number.isInteger(settings.port) ||
    settings.port < 0 ||
    settings.port > 65535
  )
    throw new Error("Port must be 0–65535.");
  if (!["manual", "startup", "activity"].includes(settings.startMode))
    throw new Error("Invalid startup mode.");
  if (settings.startMode !== "manual" && !settings.logdir)
    throw new Error(
      "Configure a log directory before enabling automatic startup.",
    );
  return settings;
}

export class LensController {
  constructor(
    config = {},
    { stateFile, manager, watchIntervalMs = 5000 } = {},
  ) {
    this.settings = validateSettings({
      python: config.python || "python",
      logdir: config.logdir || "",
      port: config.port ?? 0,
      startMode: config.startMode || "manual",
    });
    this.manager = manager || new MonitorManager(config);
    Object.assign(this, {
      stateFile,
      watchIntervalMs,
      paused: false,
      closed: false,
      error: null,
    });
    this.queue = Promise.resolve();
    this.ready = this.initialize();
  }
  async initialize() {
    try {
      if (this.stateFile) {
        try {
          this.settings = validateSettings(
            JSON.parse(await readFile(this.stateFile, "utf8")),
          );
        } catch (error) {
          if (error.code !== "ENOENT")
            throw new Error(`Cannot load saved settings: ${error.message}`);
        }
      }
      if (!this.closed) await this.arm();
    } catch (error) {
      this.error = error.message;
    }
  }
  async arm() {
    this.watcher?.stop();
    this.watcher = null;
    if (this.closed || this.paused) return;
    if (this.settings.startMode === "startup")
      await this.manager.run("start", this.settings);
    if (this.settings.startMode === "activity") {
      this.watcher = new ActivityWatcher(
        this.settings.logdir,
        async () => {
          if (this.closed || this.paused) return;
          await this.manager.run("start", this.settings);
          this.error = null;
        },
        (error) => {
          this.error = error.message;
        },
        this.watchIntervalMs,
      );
      await this.watcher.start();
    }
  }
  run(action, args = {}) {
    const task = this.queue.then(async () => {
      await this.ready;
      if (this.closed) throw new Error("Training Lens has been unloaded.");
      if (action === "status") return this.status();
      this.error = null;
      if (action === "stop") {
        this.paused = true;
        this.watcher?.stop();
        this.watcher = null;
        await this.manager.run("stop");
      } else if (action === "start") {
        await this.manager.run("start", { ...this.settings, ...args });
      } else if (action === "save") {
        const settings = validateSettings(args.settings);
        const active = await this.manager.run("status");
        if (
          active.state !== "stopped" &&
          ["logdir", "python", "port"].some(
            (key) => settings[key] !== this.settings[key],
          )
        )
          throw new Error(
            "Stop the dashboard before changing its directory, Python or port. / 请先停止监控再更改目录、Python 或端口。",
          );
        if (this.stateFile) {
          await mkdir(dirname(this.stateFile), { recursive: true });
          const temporary = `${this.stateFile}.${randomUUID()}.tmp`;
          try {
            await writeFile(
              temporary,
              JSON.stringify(settings, null, 2) + "\n",
              { mode: 0o600 },
            );
            await rename(temporary, this.stateFile);
          } finally {
            await rm(temporary, { force: true });
          }
        }
        this.settings = settings;
        this.paused = false;
        await this.arm();
      } else throw new Error("Use start, status, stop or save.");
      return this.status();
    });
    this.queue = task.catch((error) => {
      this.error = error.message;
    });
    return task;
  }
  async status() {
    return {
      ...(await this.manager.run("status")),
      settings: { ...this.settings },
      watching: Boolean(this.watcher && !this.watcher.closed),
      autoPaused: this.paused,
      persistent: Boolean(this.stateFile),
      error: this.error,
    };
  }
  async dispose() {
    this.closed = true;
    this.watcher?.stop();
    await this.ready;
    this.watcher?.stop();
    await this.queue;
    await this.manager.dispose();
  }
}
