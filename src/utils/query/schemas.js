import { z } from "zod";

const jsonScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const jsonValueSchema = z.lazy(() =>
  z.union([jsonScalarSchema, z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

export const arrayResponseSchema = z.array(jsonValueSchema);
export const hashResponseSchema = z.union([z.literal(false), z.object({ hash: z.string() }).passthrough()]);
export const releasesResponseSchema = z.array(
  z
    .object({
      html_url: z.string().optional(),
      tag_name: z.string().optional(),
    })
    .passthrough(),
);
export const validateResponseSchema = z.union([
  z.array(jsonValueSchema),
  z
    .object({
      error: jsonValueSchema.optional(),
    })
    .passthrough(),
]);

export function schemaForApiPath(path) {
  const pathname = new URL(path, "http://daemun.local").pathname;

  if (pathname === "/api/bookmarks" || pathname === "/api/services" || pathname === "/api/widgets") {
    return arrayResponseSchema;
  }

  if (pathname === "/api/hash") return hashResponseSchema;
  if (pathname === "/api/releases") return releasesResponseSchema;
  if (pathname === "/api/validate") return validateResponseSchema;

  return jsonValueSchema;
}
