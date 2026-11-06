import { keepPreviousData } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { useApiQuery } from "utils/query/api-query";

import { formatProxyUrl } from "./api-helpers";

export interface WidgetApiOptions extends Record<string, unknown> {
  refreshInterval?: number | false;
}

type ApiJson = ReturnType<typeof JSON.parse>;

// The SWR config options upstream widgets pass as useWidgetAPI's fourth argument.
export interface WidgetApiQueryConfig {
  keepPreviousData?: boolean;
  onSuccess?: (data: ApiJson) => void;
}

export type WidgetApiResult = {
  data: ApiJson | undefined;
  error: ApiJson | Error | null | undefined;
  mutate: ReturnType<typeof useApiQuery<ApiJson>>["mutate"];
};

export default function useWidgetAPI(
  widget: unknown,
  endpoint?: string,
  queryParams?: WidgetApiOptions,
  queryConfig: WidgetApiQueryConfig = {},
): WidgetApiResult {
  const config: Record<string, unknown> = {};
  if (queryParams?.refreshInterval !== undefined) {
    config.refreshInterval = queryParams.refreshInterval;
  }
  if (queryConfig.keepPreviousData) {
    config.placeholderData = keepPreviousData;
  }
  let url = formatProxyUrl(widget, endpoint, queryParams);
  if (endpoint === "") {
    url = null;
  }
  const { data, dataUpdatedAt, error, mutate } = useApiQuery<ApiJson>(url, config);

  // React Query v5 has no onSuccess; fire it once per successful fetch like SWR did.
  const onSuccessRef = useRef(queryConfig.onSuccess);
  onSuccessRef.current = queryConfig.onSuccess;
  useEffect(() => {
    if (dataUpdatedAt && data !== undefined) onSuccessRef.current?.(data);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- run per fetch, not per data identity
  }, [dataUpdatedAt]);

  // make the data error the top-level error
  return { data, error: data?.error ?? error, mutate };
}
