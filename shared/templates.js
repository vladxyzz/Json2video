import longform from "../examples/make-longform.json" with { type: "json" };

export const makeTemplateId = "qbTOTIiERdOb3Ib3grfl";
export const templates = [
  { id: makeTemplateId, label: "Make · 10 scenes with voice", movie: longform },
];
export function resolveTemplate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Send a JSON object.");
  if (!Object.hasOwn(input, "template")) return structuredClone(input);
  const template = templates.find((t) => t.id === input.template);
  if (!template)
    throw new Error(`Template “${input.template}” does not exist on this server.`);
  const allowed = new Set([
    "template",
    "variables",
    "name",
    "webhook_url",
    "client-data",
    "resolution",
    "aspect-ratio",
    "fps",
    "quality",
  ]);
  for (const key of Object.keys(input))
    if (!allowed.has(key))
      throw new Error(`Unsupported field in a template request: ${key}.`);
  const { template: _, ...overrides } = input;
  return { ...structuredClone(template.movie), ...overrides };
}
