import Schema from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { MonitorManager } from "./manager.js";

export const name = "training-lens";
export const inject = ["tools"];
export const Config = Schema.object({
  python: Schema.string()
    .default("python")
    .description(
      "Python executable with TensorBoard installed / 训练环境 Python",
    ),
  logdir: Schema.string()
    .default("")
    .description("Default absolute TensorBoard log directory / 默认日志目录"),
  port: Schema.number()
    .min(0)
    .max(65535)
    .step(1)
    .default(0)
    .description("0 selects a free local port / 0 自动选端口"),
  staleSeconds: Schema.number()
    .min(1)
    .step(1)
    .default(120)
    .description("Log freshness threshold in seconds / 日志新鲜度阈值"),
  startupTimeoutMs: Schema.number()
    .min(1000)
    .step(1)
    .default(60000)
    .description("Dashboard startup timeout / 启动超时（毫秒）"),
});

export function apply(ctx, config) {
  const manager = new MonitorManager(config);
  ctx.effect(() => () => manager.dispose());
  ctx.tools.register(
    defineTool({
      name: "training_lens",
      description:
        "Training Lens · 训练视窗: start, inspect or stop a local read-only TensorBoard scalar dashboard. Only use directories requested by the user. Return the local URL for the user to open. Stopping affects only this plugin’s dashboard, never training. No dependencies are installed automatically.",
      parameters: {
        action: {
          type: "string",
          enum: ["start", "status", "stop"],
          required: true,
          description: "Dashboard action / 监控操作",
        },
        logdir: {
          type: "string",
          description:
            "Absolute TensorBoard event directory; required for start unless configured.",
        },
        python: {
          type: "string",
          description:
            "Existing Python executable with TensorBoard installed; no shell arguments.",
        },
        port: {
          type: "number",
          description:
            "Optional port, 0 selects an unused port. Does not take over occupied ports.",
        },
      },
      output: {
        schema: { type: "string" },
        render: (_args, value) => [{ type: "text", text: value }],
      },
      async execute(args) {
        try {
          return JSON.stringify(await manager.run(args.action, args));
        } catch (error) {
          return JSON.stringify({ state: "error", message: error.message });
        }
      },
    }),
  );
}
