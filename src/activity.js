import { readdir, lstat } from "node:fs/promises";
import { join } from "node:path";

// Only the explicitly selected log tree is inspected; never follow child links.
export async function eventFiles(root) {
  const files = new Map();
  let visited = 0;
  async function visit(directory, depth) {
    if (depth > 16)
      throw new Error("Log tree is too deep; select a narrower log directory.");
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      if (++visited > 10000)
        throw new Error(
          "Log tree is too large; select a narrower log directory.",
        );
      if (entry.isSymbolicLink()) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (
          !entry.name.startsWith(".") &&
          !entry.name.startsWith("checkpoint") &&
          !["node_modules", "__pycache__", "ray"].includes(entry.name)
        )
          await visit(path, depth + 1);
      } else if (
        entry.isFile() &&
        entry.name.startsWith("events.out.tfevents.")
      ) {
        try {
          const info = await lstat(path);
          if (info.isFile())
            files.set(path, { size: info.size, mtime: info.mtimeMs });
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
    }
  }
  await visit(root, 0);
  return files;
}

export class ActivityWatcher {
  constructor(root, onActivity, onError, intervalMs = 5000) {
    Object.assign(this, { root, onActivity, onError, intervalMs });
    this.closed = false;
    this.previous = null;
    this.armedAt = Date.now();
  }
  async start() {
    await this.poll();
    if (!this.closed) {
      this.timer = setInterval(() => {
        void this.poll();
      }, this.intervalMs);
      this.timer.unref?.();
    }
  }
  async poll() {
    if (this.closed || this.busy) return;
    this.busy = true;
    try {
      const next = await eventFiles(this.root);
      const changed = [...next].some(([path, file]) => {
        const before = this.previous?.get(path);
        return this.previous === null
          ? file.mtime >= this.armedAt - 15000
          : !before || file.size !== before.size || file.mtime !== before.mtime;
      });
      this.previous = next;
      if (changed && !this.closed) await this.onActivity();
    } catch (error) {
      if (!this.closed) this.onError(error);
    } finally {
      this.busy = false;
    }
  }
  stop() {
    this.closed = true;
    clearInterval(this.timer);
  }
}
