import * as yaml from "js-yaml";

const EMPTY_DOCUMENT_ERROR = "expected a document, but the input is empty";
// Keep js-yaml v4 parsing behavior (timestamps, merge keys, non-string keys) on v5.
const DEFAULT_SCHEMA = yaml.CORE_SCHEMA.withTags(yaml.timestampTag, yaml.mergeTag, yaml.legacyMapTag);

// js-yaml v4 shipped untyped, so config readers were written against `any`.
// Keep that shape here instead of retyping every config consumer.
// oxlint-disable-next-line no-explicit-any
export function loadYaml(input: string, options?: yaml.LoadOptions): any {
  try {
    return yaml.load(input, { schema: DEFAULT_SCHEMA, ...options });
  } catch (error) {
    // js-yaml v4 returned undefined for empty and comment-only documents.
    if ((error as { reason?: string } | null)?.reason === EMPTY_DOCUMENT_ERROR) return undefined;
    throw error;
  }
}
