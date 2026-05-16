export const DOCKER_REVALIDATE_OPTIONS = {
  refetchOnReconnect: "always",
  refetchOnWindowFocus: "always",
} as const;

export function dockerStatusUrl(container?: string | null, server?: string | null) {
  return `/api/docker/status/${container ?? ""}/${server || ""}`;
}

export function dockerStatsUrl(container?: string | null, server?: string | null) {
  return `/api/docker/stats/${container ?? ""}/${server || ""}`;
}
