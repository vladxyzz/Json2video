import fs from "node:fs/promises";
import { z } from "zod";
import { movieSchema } from "../shared/schema.js";
const schema = z.toJSONSchema(movieSchema);
const json = (schema) => ({ "application/json": { schema } });
const error = {
  description: "Request failed",
  content: json({
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
      errors: { type: "array", items: { type: "object" } },
    },
  }),
};
const status = {
  type: "object",
  properties: {
    project: { type: "string" },
    name: { type: "string" },
    status: { enum: ["pending", "running", "done", "error"] },
    progress: { type: "number" },
    success: { type: "boolean" },
    url: { type: ["string", "null"] },
    thumbnail: { type: ["string", "null"] },
    message: { type: "string" },
    "client-data": { type: "object", additionalProperties: true },
    duration: { type: "number" },
    width: { type: "integer" },
    height: { type: "integer" },
    size: { type: "integer" },
    webhook: { type: ["object", "null"] },
  },
};
const doc = {
  openapi: "3.1.0",
  info: {
    title: "Json2vid Studio",
    version: "1.1.0",
    description:
      "Independent JSON-to-MP4 API. Partial JSON2Video-style schema, built-in Make template, FLUX 1.1 Pro images, Azure speech-aligned subtitles. Automatic or explicit scene durations; <=900 seconds total. See README for limits.",
  },
  servers: [
    {
      url: "http://localhost:3000",
      description:
        "Local development. Configure a public HTTPS origin for Make.",
    },
  ],
  security: [{ ApiKey: [] }],
  components: {
    securitySchemes: {
      ApiKey: { type: "apiKey", in: "header", name: "x-api-key" },
    },
    schemas: {
      Movie: schema,
      Job: status,
      TemplateRequest: {
        type: "object",
        required: ["template"],
        additionalProperties: false,
        properties: {
          template: { type: "string", enum: ["qbTOTIiERdOb3Ib3grfl"] },
          variables: {
            type: "object",
            additionalProperties: { type: ["string", "number", "boolean"] },
          },
          name: { type: "string" },
          webhook_url: { type: "string", format: "uri" },
          "client-data": { type: "object" },
          resolution: { enum: ["sd", "hd", "full-hd"] },
          "aspect-ratio": { enum: ["9:16", "16:9", "1:1"] },
          fps: { enum: [24, 25, 30] },
          quality: { enum: ["low", "medium", "high"] },
        },
      },
    },
  },
  paths: {
    "/v2/movies": {
      post: {
        summary: "Queue a render",
        parameters: [
          {
            in: "header",
            name: "Idempotency-Key",
            required: false,
            schema: { type: "string", maxLength: 200 },
          },
        ],
        requestBody: {
          required: true,
          content: json({
            oneOf: [
              { $ref: "#/components/schemas/Movie" },
              { $ref: "#/components/schemas/TemplateRequest" },
            ],
          }),
        },
        responses: {
          202: {
            description: "Queued",
            content: json({
              type: "object",
              properties: {
                success: { type: "boolean" },
                project: { type: "string" },
                status: { const: "pending" },
              },
            }),
          },
          200: {
            description:
              "Same idempotency key reused; returns original project",
          },
          401: error,
          409: error,
          422: error,
          429: error,
        },
      },
      get: {
        summary: "Get a job or list last 100 jobs",
        parameters: [
          { in: "query", name: "project", schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Current state",
            content: json({
              type: "object",
              properties: {
                success: { type: "boolean" },
                movie: { $ref: "#/components/schemas/Job" },
                movies: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Job" },
                },
              },
            }),
          },
          401: error,
          404: error,
        },
      },
    },
    "/api/validate": {
      post: {
        summary: "Validate without rendering",
        requestBody: {
          required: true,
          content: json({
            oneOf: [
              { $ref: "#/components/schemas/Movie" },
              { $ref: "#/components/schemas/TemplateRequest" },
            ],
          }),
        },
        responses: {
          200: { description: "Valid normalized movie" },
          422: error,
        },
      },
    },
    "/api/templates": {
      get: {
        summary: "Read built-in templates and required variables",
        responses: { 200: { description: "Template list" }, 401: error },
      },
    },
    "/api/inspect": {
      post: {
        summary: "Inspect placeholders without interpolating or rendering",
        requestBody: { required: true, content: json({ type: "object" }) },
        responses: {
          200: { description: "Variables, missing values and media counts" },
          422: error,
        },
      },
    },
    "/api/movies/{id}/source": {
      get: {
        summary: "Read original normalized movie",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "Movie",
            content: json({ $ref: "#/components/schemas/Movie" }),
          },
          404: error,
        },
      },
    },
    "/api/movies/{id}/webhook/retry": {
      post: {
        summary: "Retry final webhook",
        parameters: [
          {
            in: "path",
            name: "id",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { 200: { description: "Webhook requeued" }, 400: error },
      },
    },
    "/healthz": {
      get: {
        summary: "Liveness",
        security: [],
        responses: { 200: { description: "Server is responding" } },
      },
    },
  },
  webhooks: {
    movieCompleted: {
      post: {
        summary: "At-least-once final job notification",
        requestBody: {
          content: json({
            type: "object",
            properties: {
              event: { enum: ["movie.done", "movie.error"] },
              success: { type: "boolean" },
              project: { type: "string" },
              movie: { $ref: "#/components/schemas/Job" },
            },
          }),
        },
        responses: { "2XX": { description: "Notification accepted" } },
      },
    },
  },
};
await fs.mkdir("docs", { recursive: true });
await fs.writeFile("docs/openapi.json", JSON.stringify(doc, null, 2) + "\n");
