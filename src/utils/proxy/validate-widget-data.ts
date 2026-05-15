import createLogger from "utils/logger";
import widgets from "widgets/widgets";

import type { UnknownRecord } from "../../types";

const logger = createLogger("validateWidgetData");

interface WidgetMapping {
  allowEmpty?: boolean;
  endpoint?: string;
  validate?: string[];
}

interface WidgetDefinition {
  mappings?: Record<string, WidgetMapping>;
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object";
}

export default function validateWidgetData(widget, endpoint, data: Buffer | unknown) {
  let valid = true;
  let dataParsed: unknown = data;
  let error: unknown;
  let mapping: WidgetMapping | undefined;
  const mappings = (widgets[widget.type] as WidgetDefinition | undefined)?.mappings;
  if (mappings) {
    mapping = Object.values(mappings).find((m) => m.endpoint === endpoint);
  }

  if (mapping?.allowEmpty && Buffer.isBuffer(data) && data.length === 0) return true;

  if (Buffer.isBuffer(data)) {
    try {
      dataParsed = JSON.parse(data.toString());
    } catch (e) {
      try {
        // try once more stripping whitespace
        dataParsed = JSON.parse(data.toString().replace(/\s/g, ""));
      } catch (e2) {
        error = e || e2;
        valid = false;
      }
    }
  }

  if (isRecord(dataParsed) && Object.entries(dataParsed).length) {
    mapping?.validate?.forEach((key) => {
      if (dataParsed[key] === undefined) {
        valid = false;
      }
    });
  }

  if (!valid) {
    logger.error(
      `Invalid data for widget '${widget.type}' endpoint '${endpoint}':\nExpected:${mapping?.validate}\nParse error: ${
        error ?? "none"
      }\nData: ${JSON.stringify(data)}`,
    );
  }

  return valid;
}
