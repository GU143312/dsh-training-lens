import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

export class TrainingLensService extends TypertRemoteService {
  constructor(ctx, controller) {
    super(ctx, "trainingLens");
    this.controller = controller;
  }
  async control(request) {
    try {
      const data = JSON.parse(request);
      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        Object.keys(data).some((key) => !["action", "settings"].includes(key))
      )
        throw new Error("Invalid control request.");
      return JSON.stringify({
        ok: true,
        value: await this.controller.run(data.action, data),
      });
    } catch (error) {
      return JSON.stringify({ ok: false, message: error.message });
    }
  }
}
