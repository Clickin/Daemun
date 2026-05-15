import { useApiQuery } from "utils/query/api-query";

import { formatProxyUrl } from "./api-helpers";

export interface WidgetApiOptions extends Record<string, unknown> {
  refreshInterval?: number | false;
}

type WidgetApiResult = {
  data: ReturnType<typeof JSON.parse> | undefined;
  error: ReturnType<typeof JSON.parse> | Error | null | undefined;
  mutate: ReturnType<typeof useApiQuery<ReturnType<typeof JSON.parse>>>["mutate"];
};

export default function useWidgetAPI(widget: unknown, ...options: [string?, WidgetApiOptions?]): WidgetApiResult {
  const config: WidgetApiOptions = {};
  if (options && options[1]?.refreshInterval !== undefined) {
    config.refreshInterval = options[1].refreshInterval;
  }
  let url = formatProxyUrl(widget, ...options);
  if (options[0] === "") {
    url = null;
  }
  const { data, error, mutate } = useApiQuery<ReturnType<typeof JSON.parse>>(url, config);
  // make the data error the top-level error
  return { data, error: data?.error ?? error, mutate };
}
