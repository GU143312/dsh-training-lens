import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Config, apply } from "../src/index.js";
import { MonitorManager } from "../src/manager.js";
import { Context } from "@deepseek-ai/cordis";
import * as plugin from "../src/index.js";

test("real Cordis dependency injection and disposal", async () => {
  const ctx = new Context();
  let tool;
  const provider = await ctx.plugin({
    name: "test-registry",
    apply(c) {
      c.provide("tools", {
        register(t) {
          tool = t;
        },
      });
    },
  });
  const fiber = await ctx.plugin(plugin, {});
  assert.equal(tool.name, "training_lens");
  assert.equal(
    JSON.parse(await tool.execute({ action: "status" })).state,
    "stopped",
  );
  await fiber.dispose();
  assert.equal(
    JSON.parse(await tool.execute({ action: "start" })).state,
    "error",
  );
  await provider.dispose();
});

test("DSH registration uses the canonical tool output contract and cleans up", async () => {
  let tool, cleanup;
  apply(
    {
      tools: {
        register(value) {
          tool = value;
        },
      },
      effect(fn) {
        cleanup = fn();
      },
    },
    {},
  );
  assert.equal(tool.name, "training_lens");
  const result = await tool.execute({ action: "status" });
  assert.equal(JSON.parse(result).state, "stopped");
  assert.deepEqual(tool.output.render({}, result), [
    { type: "text", text: result },
  ]);
  await cleanup();
  assert.equal(
    JSON.parse(await tool.execute({ action: "start" })).state,
    "error",
  );
});

test("plugin configuration validates port and fills defaults", () => {
  const parsed = Config({});
  assert.equal(parsed.port, 0);
  assert.equal(parsed.python, "python");
  assert.throws(() => Config({ port: -1 }));
});

test("invalid paths and missing interpreters fail without a shell or a leaked child", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lens-test-"));
  const manager = new MonitorManager();
  try {
    await assert.rejects(manager.run("start", { logdir: "." }), /absolute/);
    await assert.rejects(
      manager.run("start", { logdir: dir, port: -1 }),
      /Port/,
    );
    await assert.rejects(
      manager.run("start", {
        logdir: dir,
        python: "nonexistent-training-lens-python",
      }),
      /Cannot start Python/,
    );
    assert.equal((await manager.run("status")).state, "stopped");
  } finally {
    await manager.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});

test(
  "lifecycle start, idempotency, port conflict and owned-process cleanup",
  { skip: !process.env.TRAINING_LENS_TEST_PYTHON },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "lens-live-"));
    // Discovery must actually enter EventAccumulator, not only return an empty run list.
    await writeFile(join(dir, "events.out.tfevents.empty"), "");
    const manager = new MonitorManager({
      python: process.env.TRAINING_LENS_TEST_PYTHON,
    });
    const second = new MonitorManager({
      python: process.env.TRAINING_LENS_TEST_PYTHON,
    });
    try {
      const running = await manager.run("start", { logdir: dir });
      assert.equal(running.state, "running");
      assert.equal(
        (await manager.run("start", { logdir: dir })).pid,
        running.pid,
      );
      assert.equal((await fetch(`${running.url}/api/snapshot`)).status, 200);
      await assert.rejects(
        second.run("start", {
          logdir: dir,
          port: Number(new URL(running.url).port),
        }),
        /exited/,
      );
      assert.equal((await manager.run("status")).state, "running");
      assert.equal((await manager.run("stop")).state, "stopped");
      await assert.rejects(
        fetch(`${running.url}/api/health`, {
          signal: AbortSignal.timeout(1500),
        }),
      );
      await manager.run("start", { logdir: dir });
      await manager.dispose();
      assert.equal(manager.current, null);
    } finally {
      await manager.dispose();
      await second.dispose();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
