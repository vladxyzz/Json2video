import { z } from "zod";
import { resolveTemplate } from "./templates.js";

const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a HEX color, for example #141820.");
const time = z.number().min(0).max(900);
const metadata = {
  id: z.string().max(120).optional(),
  comment: z.string().max(2000).optional(),
};
const duration = z
  .union([z.number().positive().max(900), z.literal(-1), z.literal(-2)])
  .optional();
const coord = z.union([
  z.number().min(-1920).max(1920),
  z.enum(["left", "center", "right", "top", "bottom"]),
  z
    .string()
    .regex(/^-?\d+(\.\d+)?(px|%)$/)
    .max(16),
]);
const url = z
  .string()
  .url()
  .refine((v) => /^https:\/\//i.test(v), "A public HTTPS URL is required.");
const common = {
  ...metadata,
  start: time.default(0),
  duration,
  "fade-in": time.default(0),
  "fade-out": time.default(0),
};
const visual = {
  x: coord.default("center"),
  y: coord.default("center"),
  width: z.number().int().min(16).max(1920).optional(),
  height: z.number().int().min(16).max(1920).optional(),
};
const text = z.strictObject({
  type: z.literal("text"),
  text: z.string().min(1).max(2000),
  ...common,
  ...visual,
  "font-size": z
    .union([z.number().min(12).max(250), z.string().regex(/^\d+(\.\d+)?px$/)])
    .default(64),
  style: z.enum(["plain", "shadow"]).default("plain"),
  color: color.default("#ffffff"),
  "font-weight": z.enum(["normal", "bold"]).default("bold"),
  "text-align": z.enum(["left", "center", "right"]).default("center"),
});
const image = z.strictObject({
  type: z.literal("image"),
  src: url.optional(),
  prompt: z.string().min(1).max(10000).optional(),
  model: z.enum(["flux-pro", "flux-pro-1.1"]).optional(),
  zoom: z.number().min(-10).max(10).default(0),
  ...common,
  ...visual,
  fit: z.enum(["cover", "contain"]).default("cover"),
});
const video = z.strictObject({
  type: z.literal("video"),
  src: url,
  ...common,
  ...visual,
  fit: z.enum(["cover", "contain"]).default("cover"),
  seek: time.default(0),
});
const audio = z.strictObject({
  type: z.literal("audio"),
  src: url,
  ...common,
  volume: z.number().min(0).max(2).default(1),
});
const voice = z.strictObject({
  type: z.literal("voice"),
  text: z.string().min(1).max(5000),
  ...common,
  provider: z.enum(["local", "azure"]).default("local"),
  model: z.enum(["local", "azure"]).optional(),
  voice: z
    .string()
    .regex(/^[a-zA-Z0-9-]+$/)
    .default("en-US-JennyNeural"),
  language: z
    .string()
    .regex(/^[a-z]{2}-[A-Z]{2}$/)
    .default("en-US"),
  volume: z.number().min(0).max(2).default(1),
});
const subtitles = text.extend({
  type: z.literal("subtitles"),
  "font-size": z
    .union([z.number().min(12).max(250), z.string().regex(/^\d+(\.\d+)?px$/)])
    .default(34),
  y: coord.default("85%"),
  style: z.enum(["plain", "shadow"]).default("shadow"),
  timing: z.enum(["speech", "estimated"]).default("speech"),
});
export const elementSchema = z.discriminatedUnion("type", [
  text,
  image,
  video,
  audio,
  voice,
  subtitles,
]);
export const movieSchema = z
  .strictObject({
    ...metadata,
    name: z.string().min(1).max(120).default("Untitled video"),
    quality: z.enum(["low", "medium", "high"]).default("high"),
    resolution: z.enum(["full-hd", "hd", "sd"]).default("hd"),
    "aspect-ratio": z.enum(["9:16", "16:9", "1:1"]).default("16:9"),
    fps: z.union([z.literal(24), z.literal(25), z.literal(30)]).default(30),
    variables: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .default({}),
    "client-data": z.record(z.string(), z.unknown()).default({}),
    webhook_url: url.optional(),
    scenes: z
      .array(
        z.strictObject({
          ...metadata,
          name: z.string().max(100).optional(),
          duration: z
            .union([z.number().min(0.25).max(300), z.literal(-1)])
            .optional(),
          "background-color": color.default("#151820"),
          elements: z.array(elementSchema).max(20).default([]),
        }),
      )
      .min(1)
      .max(30),
    elements: z
      .array(z.union([audio, voice]))
      .max(5)
      .default([]),
  })
  .superRefine((movie, ctx) => {
    const total = movie.scenes.reduce(
      (sum, s) => sum + Math.max(0, s.duration || 0),
      0,
    );
    const allExplicit = movie.scenes.every((s) => s.duration > 0);
    if (total > 900)
      ctx.addIssue({
        code: "custom",
        path: ["scenes"],
        message: "The total duration is limited to 900 seconds.",
      });
    movie.scenes.forEach((s, i) =>
      s.elements.forEach((e, j) => {
        if (
          s.duration > 0 &&
          (e.start >= s.duration ||
            (e.duration > 0 && e.start + e.duration > s.duration + 0.001))
        )
          ctx.addIssue({
            code: "custom",
            path: ["scenes", i, "elements", j],
            message: "The element must fit within the scene duration.",
          });
        if (["left", "right"].includes(e.y) || ["top", "bottom"].includes(e.x))
          ctx.addIssue({
            code: "custom",
            path: ["scenes", i, "elements", j],
            message:
              "x accepts left/center/right; y accepts top/center/bottom.",
          });
        if (
          e.type === "image" &&
          (!!e.src === !!e.prompt || (e.prompt && !e.model))
        )
          ctx.addIssue({
            code: "custom",
            path: ["scenes", i, "elements", j],
            message: "An image needs either src, or a prompt and a model.",
          });
        if (
          e["font-size"] &&
          (parseFloat(e["font-size"]) < 12 || parseFloat(e["font-size"]) > 250)
        )
          ctx.addIssue({
            code: "custom",
            path: ["scenes", i, "elements", j, "font-size"],
            message: "Font size must be between 12 and 250px.",
          });
        if (
          e.type === "subtitles" &&
          e.timing === "speech" &&
          !s.elements.some(
            (v) =>
              v.type === "voice" && v.provider === "azure" && v.text === e.text,
          )
        )
          ctx.addIssue({
            code: "custom",
            path: ["scenes", i, "elements", j],
            message:
              "Synced subtitles need an Azure voice with the same text in the same scene. For approximate timing, set timing: estimated.",
          });
      }),
    );
    movie.elements.forEach((e, i) => {
      if (
        allExplicit &&
        (e.start >= total ||
          (e.duration > 0 && e.start + e.duration > total + 0.001))
      )
        ctx.addIssue({
          code: "custom",
          path: ["elements", i],
          message: "The audio track is longer than the video.",
        });
    });
    movie.scenes.forEach((s, i) => {
      if (
        !(s.duration > 0) &&
        !s.elements.some(
          (e) =>
            e.duration > 0 ||
            (["voice", "audio", "video"].includes(e.type) && e.duration !== -2),
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["scenes", i, "duration"],
          message:
            "Automatic duration needs a voice, audio, video, or an element with an explicit duration.",
        });
    });
  });
export function interpolate(value, variables) {
  if (typeof value === "string")
    return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
      if (!Object.hasOwn(variables, key))
        throw new Error(`Variable “${key}” is not defined.`);
      return String(variables[key]);
    });
  if (Array.isArray(value)) return value.map((v) => interpolate(v, variables));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, interpolate(v, variables)]),
    );
  return value;
}
export function validateMovie(input) {
  try {
    input = resolveTemplate(input);
    const vars = z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .parse(input?.variables || {});
    const expanded = interpolate({ ...input, variables: undefined }, vars);
    if (!expanded.name && typeof vars.title === "string" && vars.title.trim())
      expanded.name = vars.title.slice(0, 120);
    for (const el of [
      ...(expanded.elements || []),
      ...(expanded.scenes || []).flatMap((s) => s.elements || []),
    ]) {
      if (el.type === "voice" && !el.provider)
        el.provider = el.model || (el.voice ? "azure" : "local");
    }
    return movieSchema.safeParse({ ...expanded, variables: vars });
  } catch (error) {
    return {
      success: false,
      error: { issues: [{ path: ["variables"], message: error.message }] },
    };
  }
}
export function pixelValue(value, size) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /%$/.test(value))
    return (parseFloat(value) * size) / 100;
  if (typeof value === "string" && /px$/.test(value)) return parseFloat(value);
  return undefined;
}
export function dimensions(movie) {
  const long = { sd: 640, hd: 1280, "full-hd": 1920 }[movie.resolution];
  return movie["aspect-ratio"] === "9:16"
    ? [(long * 9) / 16, long]
    : movie["aspect-ratio"] === "1:1"
      ? [long, long]
      : [long, (long * 9) / 16];
}
