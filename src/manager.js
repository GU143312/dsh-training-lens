import { spawn } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const serverPath = fileURLToPath(
  new URL("../python/server.py", import.meta.url),
);

export class MonitorManager {
  constructor(config = {}) {
    this.config = {
      python: "python",
      port: 0,
      staleSeconds: 120,
      startupTimeoutMs: 20000,
      ...config,
    };
    this.current = null;
    this.queue = Promise.resolve();
    this.closed = false;
  }

  run(operation, args = {}) {
    const task = this.queue.then(() => {
      if (this.closed) throw new Error("Training Lens has been unloaded.");
      if (operation === "start") return this.start(args);
      if (operation === "status") return this.status();
      if (operation === "stop") return this.stop();
      throw new Error("Use start, status or stop.");
    });
    this.queue = task.catch(() => {});
    return task;
  }

  async start(args) {
    const logdir = args.logdir || this.config.logdir;
    if (!logdir || !isAbsolute(logdir))
      throw new Error(
        "Provide an absolute TensorBoard log directory. / 请提供日志目录的绝对路径。",
      );
    const root = await realpath(logdir);
    if (!(await stat(root)).isDirectory())
      throw new Error("The log path must be a directory.");
    const python = args.python || this.config.python;
    if (typeof python !== "string" || !python.trim() || python.includes("\0"))
      throw new Error("Specify a Python executable, without shell arguments.");
    const port = args.port ?? this.config.port;
    if (!Number.isInteger(port) || port < 0 || port > 65535)
      throw new Error("Port must be 0 (automatic) or 1–65535.");
    if (this.current) {
      if (
        this.current.root === root &&
        this.current.python === python &&
        this.current.requestedPort === port
      )
        return this.status();
      throw new Error(
        "A dashboard is already active. Stop it before changing its log directory or interpreter.",
      );
    }
    const instance = randomUUID();
    const child = spawn(
      python,
      [
        serverPath,
        "--logdir",
        root,
        "--port",
        String(port),
        "--stale-seconds",
        String(this.config.staleSeconds),
        "--parent-stdin",
      ],
      {
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
          PYTHONDONTWRITEBYTECODE: "1",
          TRAINING_LENS_INSTANCE: instance,
        },
      },
    );
    const record = {
      child,
      instance,
      root,
      python,
      requestedPort: port,
      url: null,
    };
    this.current = record;
    child.once("exit", () => {
      if (this.current === record) this.current = null;
    });
    child.stdin.on("error", () => {});
    try {
      await new Promise((resolve, reject) => {
        let stdout = "",
          stderr = "";
        const timer = setTimeout(
          () =>
            finish(
              new Error(
                "Dashboard startup timed out. Check Python and TensorBoard dependencies.",
              ),
            ),
          this.config.startupTimeoutMs,
        );
        const finish = (error) => {
          clearTimeout(timer);
          child.off("error", onError);
          child.off("exit", onExit);
          error ? reject(error) : resolve();
        };
        const onError = (error) =>
          finish(
            new Error(
              `Cannot start Python (${error.code || "spawn error"}). Configure the training environment interpreter.`,
            ),
          );
        const onExit = (code) =>
          finish(
            new Error(`Dashboard exited (${code}). ${stderr.slice(-1200)}`),
          );
        child.once("error", onError);
        child.once("exit", onExit);
        child.stderr.on("data", (chunk) => {
          stderr = (stderr + chunk.toString()).slice(-2000);
        });
        child.stdout.on("data", (chunk) => {
          stdout = (stdout + chunk.toString()).slice(-16000);
          let newline;
          while ((newline = stdout.indexOf("\n")) >= 0) {
            const line = stdout.slice(0, newline);
            stdout = stdout.slice(newline + 1);
            try {
              const ready = JSON.parse(line);
              if (
                ready.service !== "training-lens" ||
                ready.instance !== instance
              )
                continue;
              const url = new URL(ready.url);
              if (
                url.protocol !== "http:" ||
                url.hostname !== "127.0.0.1" ||
                !url.port
              )
                continue;
              record.url = url.origin;
              finish();
            } catch {
              /* Non-JSON library diagnostics are not readiness signals. */
            }
          }
        });
      });
      const status = await this.status();
      if (status.state !== "running")
        throw new Error("Dashboard did not pass readiness verification.");
      return status;
    } catch (error) {
      if (this.current === record) this.current = null;
      child.stdin.end();
      child.kill();
      throw error;
    }
  }

  async status() {
    const record = this.current;
    if (!record?.url) return { state: "stopped", service: "training-lens" };
    try {
      const response = await fetch(`${record.url}/api/health`, {
        signal: AbortSignal.timeout(3000),
      });
      const health = await response.json();
      if (!response.ok || health.instance !== record.instance)
        throw new Error("Unexpected service");
      return {
        state: "running",
        service: "training-lens",
        url: record.url,
        logdir: record.root,
        pid: record.child.pid,
        readOnly: true,
        note: "Dashboard process only; this does not certify trainer health.",
      };
    } catch {
      return {
        state: "unreachable",
        service: "training-lens",
        url: record.url,
        note: "The owned dashboard is not responding. Stop it before restarting.",
      };
    }
  }

  async stop() {
    const record = this.current;
    if (!record) return { state: "stopped", service: "training-lens" };
    // Close only the owned monitor. Never kill by port, executable name or a stored PID.
    await new Promise((resolve) => {
      if (record.child.exitCode !== null || record.child.signalCode !== null)
        return resolve();
      const timer = setTimeout(() => record.child.kill(), 3000);
      record.child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      record.child.stdin.end();
    });
    if (this.current === record) this.current = null;
    return {
      state: "stopped",
      service: "training-lens",
      note: "Training processes are unchanged.",
    };
  }

  async dispose() {
    this.closed = true;
    await this.queue;
    await this.stop();
  }
}
