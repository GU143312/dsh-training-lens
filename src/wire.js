// Explicit, shared Host/Client wire contract for the plain-JavaScript plugin.
// Strict codecs use the public TypertSchema.parse / TypertCodec.create surface.
const stringCodec = (name, limit) => ({
  mode: "strict",
  typeSymbol: `dsh-training-lens#${name}`,
  create: () => ({
    parse(value) {
      if (typeof value !== "string" || value.length > limit)
        throw new Error("Invalid Training Lens request.");
      return value;
    },
  }),
});
export const TYPERT_REMOTE = {
  package: "dsh-training-lens",
  descriptors: [
    {
      id: "dsh-training-lens#trainingLens/control",
      service: "trainingLens",
      namespace: "trainingLens",
      method: "control",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "request",
          wire: "request",
          source: "json",
          codec: stringCodec("request", 20000),
        },
      ],
      result: stringCodec("result", 40000),
    },
  ],
};
export const TYPERT = {
  package: "dsh-training-lens",
  face: "host",
  schemas: [],
  model: { services: [], events: [], objects: [] },
  invocations: TYPERT_REMOTE.descriptors,
};
