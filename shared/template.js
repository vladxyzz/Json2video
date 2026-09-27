/** Inspect a template without interpolating it or inventing missing values. */
export function inspectTemplate(input) {
  const occurrences = new Map();
  function walk(value, path = []) {
    if (typeof value === "string")
      for (const match of value.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) {
        if (!occurrences.has(match[1])) occurrences.set(match[1], []);
        occurrences.get(match[1]).push(path.join("."));
      }
    else if (Array.isArray(value))
      value.forEach((v, i) => walk(v, [...path, i]));
    else if (value && typeof value === "object")
      Object.entries(value)
        .filter(([k]) => k !== "variables")
        .forEach(([k, v]) => walk(v, [...path, k]));
  }
  walk(input);
  const variables = [...occurrences].map(([name, paths]) => ({
    name,
    paths,
    defined: Object.hasOwn(input?.variables || {}, name),
    value: input?.variables?.[name],
  }));
  const elements = [
    ...(input?.elements || []),
    ...(input?.scenes || []).flatMap((s) => s.elements || []),
  ];
  return {
    variables,
    missing: variables.filter((v) => !v.defined).map((v) => v.name),
    scenes: input?.scenes?.length || 0,
    generatedImages: elements.filter(
      (e) => e.type === "image" && e.prompt && !e.src,
    ).length,
    voices: elements.filter((e) => e.type === "voice").length,
    subtitles: elements.filter((e) => e.type === "subtitles").length,
    automaticDuration: (input?.scenes || []).some(
      (s) => s.duration == null || s.duration === -1,
    ),
  };
}
