import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  appendFile,
  rm,
  utimes,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Context } from "@deepseek-ai/cordis";
import { TypertRegistry } from "@deepseek-ai/dsh-typert-registry";
import { TypertGatewayService } from "@deepseek-ai/dsh-api-gateway";
import { LensController } from "../src/controller.js";
import { ActivityWatcher } from "../src/activity.js";
import { TrainingLensService } from "../src/service.js";
import { TYPERT } from "../src/wire.js";

class FakeMonitor {
  state = "stopped";
  starts = 0;
  async run(action, args) {
    if (action === "start" && this.state !== "running") {
      this.starts++;
      this.state = "running";
      this.args = args;
    }
    if (action === "stop") this.state = "stopped";
    return {
      state: this.state,
      ...(this.state === "running" ? { url: "http://127.0.0.1:12345" } : {}),
    };
  }
  async dispose() {
    await this.run("stop");
  }
}

test("settings persist per profile and startup uses the saved interpreter and directory", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lens-settings-"));
  const stateFile = join(dir, "training-lens.settings.json");
  const manager = new FakeMonitor();
  const first = new LensController({}, { stateFile, manager });
  let second;
  try {
    const settings = {
      python: "python-custom",
      logdir: dir,
      port: 0,
      startMode: "startup",
    };
    const result = await first.run("save", { settings });
    assert.equal(result.state, "running");
    assert.equal(manager.starts, 1);
    assert.deepEqual(JSON.parse(await readFile(stateFile, "utf8")), settings);
    await first.dispose();
    const next = new FakeMonitor();
    second = new LensController({}, { stateFile, manager: next });
    assert.equal((await second.run("status")).state, "running");
    assert.equal(next.args.python, "python-custom");
    await assert.rejects(
      second.run("save", {
        settings: { ...settings, logdir: join(dir, "other") },
      }),
      /Stop/,
    );
    await assert.rejects(
      second.run("save", { settings: { ...settings, extra: true } }),
      /Unknown/,
    );
  } finally {
    await first.dispose();
    await second?.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});

test("activity mode waits for missing logs, starts on writes, and explicit stop disarms it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lens-watch-"));
  const logdir = join(dir, "future");
  const manager = new FakeMonitor();
  const controller = new LensController(
    { logdir, startMode: "activity" },
    { manager, watchIntervalMs: 60000 },
  );
  try {
    assert.equal((await controller.run("status")).watching, true);
    assert.equal(manager.starts, 0);
    await mkdir(logdir);
    const event = join(logdir, "events.out.tfevents.test");
    await writeFile(event, "first");
    await controller.watcher.poll();
    assert.equal(manager.starts, 1);
    await appendFile(event, "next");
    await controller.watcher.poll();
    assert.equal(manager.starts, 1);
    const oldWatcher = controller.watcher;
    const stopped = await controller.run("stop");
    assert.equal(stopped.watching, false);
    assert.equal(stopped.autoPaused, true);
    await appendFile(event, "later");
    await oldWatcher.poll();
    assert.equal(manager.state, "stopped");
    assert.equal(manager.starts, 1);
    await controller.dispose();
    await assert.rejects(controller.run("start"), /unloaded/);
  } finally {
    await controller.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});

test("activity watch ignores old logs and checkpoint copies, but notices an appended event", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lens-old-"));
  let hits = 0;
  const errors = [];
  const watcher = new ActivityWatcher(
    dir,
    async () => hits++,
    (error) => errors.push(error),
    60000,
  );
  try {
    const event = join(dir, "events.out.tfevents.old");
    await writeFile(event, "old");
    await utimes(event, new Date(0), new Date(0));
    await mkdir(join(dir, "checkpoint-1"));
    await writeFile(
      join(dir, "checkpoint-1", "events.out.tfevents.copy"),
      "fresh",
    );
    await watcher.start();
    assert.equal(hits, 0);
    await appendFile(event, "new");
    await watcher.poll();
    assert.equal(hits, 1);
    assert.deepEqual(errors, []);
  } finally {
    watcher.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("the real DSH Typert gateway accepts the launcher contract and rejects invalid wire input", async () => {
  const ctx = new Context();
  const manager = new FakeMonitor();
  const controller = new LensController({}, { manager });
  const provider = await ctx.plugin({
    apply(c) {
      c.provide("remoteAccess", { decide: () => ({ allowed: false }) });
    },
  });
  const registry = await ctx.plugin(TypertRegistry);
  const gateway = await ctx.plugin(TypertGatewayService, {});
  const owner = await ctx.plugin({
    inject: ["typert"],
    apply(c) {
      new TrainingLensService(c, controller);
      c.typert.register(TYPERT);
    },
  });
  const peer = {
    id: "lens-test",
    principal: { kind: "owner" },
    signal: new AbortController().signal,
  };
  const invoke = (args) =>
    ctx.typertGateway.invoke({
      namespace: "trainingLens",
      method: "control",
      args,
      peer,
    });
  try {
    const result = JSON.parse(
      await invoke({ request: JSON.stringify({ action: "status" }) }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.value.state, "stopped");
    await assert.rejects(invoke({ request: 42 }));
    await assert.rejects(invoke({ request: "{}", extra: true }));
    assert.equal(
      JSON.parse(await invoke({ request: '{"action":"unknown"}' })).ok,
      false,
    );
    assert.equal(manager.starts, 0);
  } finally {
    await controller.dispose();
    await owner.dispose();
    await gateway.dispose();
    await registry.dispose();
    await provider.dispose();
  }
});
