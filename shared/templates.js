import longform from "../examples/make-longform.json" with { type: "json" };

export const makeTemplateId = "qbTOTIiERdOb3Ib3grfl";
export const templates = [
  { id: makeTemplateId, label: "Make · 10 scene cu voce", movie: longform },
];
export function resolveTemplate(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Trimite un obiect JSON.");
  if (!Object.hasOwn(input, "template")) return structuredClone(input);
  const template = templates.find((t) => t.id === input.template);
  if (!template)
    throw new Error(`Șablonul „${input.template}” nu există pe acest server.`);
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
      throw new Error(`Câmp neacceptat într-o cerere cu șablon: ${key}.`);
  const { template: _, ...overrides } = input;
  return { ...structuredClone(template.movie), ...overrides };
}
