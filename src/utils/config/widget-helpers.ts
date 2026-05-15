import { promises as fs } from "fs";
import path from "path";

import yaml from "js-yaml";

import checkAndCopyConfig, { CONF_DIR, substituteEnvironmentVars } from "utils/config/config";

import type { UnknownRecord } from "../../types";

export interface WidgetOptions extends UnknownRecord {
  apiKey?: unknown;
  index: number;
  key?: unknown;
  password?: unknown;
  suggestionUrl?: string;
  url?: string;
  username?: unknown;
  version?: unknown;
}

interface WidgetConfig {
  options: WidgetOptions;
  type: string;
}

export async function widgetsFromConfig(): Promise<WidgetConfig[]> {
  checkAndCopyConfig("widgets.yaml");

  const widgetsYaml = path.join(CONF_DIR, "widgets.yaml");
  const rawFileContents = await fs.readFile(widgetsYaml, "utf8");
  const fileContents = substituteEnvironmentVars(rawFileContents);
  const widgets = yaml.load(fileContents);

  if (!widgets) return [];

  // map easy to write YAML objects into easy to consume JS arrays
  const widgetsArray: WidgetConfig[] = (widgets as UnknownRecord[]).map((group, index) => ({
    type: Object.keys(group)[0],
    options: {
      index,
      ...(group[Object.keys(group)[0]] as UnknownRecord),
    } as WidgetOptions,
  }));
  return widgetsArray;
}

export async function cleanWidgetGroups(widgets: WidgetConfig[]): Promise<WidgetConfig[]> {
  return widgets.map((widget, index) => {
    const sanitizedOptions = widget.options;
    const optionKeys = Object.keys(sanitizedOptions);

    // delete private options from the sanitized options
    ["username", "password", "key", "apiKey"].forEach((pO) => {
      if (optionKeys.includes(pO)) {
        delete sanitizedOptions[pO];
      }
    });

    // delete url from the sanitized options if the widget is not a search or glances widget
    if (widget.type !== "search" && widget.type !== "glances" && optionKeys.includes("url")) {
      delete sanitizedOptions.url;
    }

    return {
      type: widget.type,
      options: {
        index,
        ...sanitizedOptions,
      },
    };
  });
}

export async function getPrivateWidgetOptions(
  type: string,
  widgetIndex: string | number,
): Promise<WidgetOptions | undefined>;
export async function getPrivateWidgetOptions(): Promise<WidgetConfig[]>;
export async function getPrivateWidgetOptions(type?: string, widgetIndex?: string | number) {
  const widgets = await widgetsFromConfig();

  const privateOptions: WidgetConfig[] =
    widgets.map((widget) => {
      const { index, url, username, password, key, apiKey } = widget.options;

      return {
        type: widget.type,
        options: {
          index,
          url,
          username,
          password,
          key,
          apiKey,
        },
      };
    }) || [];

  return type !== undefined && widgetIndex !== undefined
    ? privateOptions.find((o) => o.type === type && o.options.index === parseInt(String(widgetIndex), 10))?.options
    : privateOptions;
}
