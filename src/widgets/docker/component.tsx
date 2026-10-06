import { useTranslation } from "react-i18next";
import { useApiQuery } from "utils/query/api-query";
import { DOCKER_REVALIDATE_OPTIONS, dockerStatsUrl, dockerStatusUrl } from "utils/docker-api";
import { calculateCPUPercent, calculateThroughput, calculateUsedMemory } from "./stats-helpers";

import Block from "components/services/widget/block";
import Container from "components/services/widget/container";

export default function Component({ service }) {
  const { t } = useTranslation();

  const { widget } = service;
  

  const { data: statusData, error: statusError } = useApiQuery(
    dockerStatusUrl(widget.container, widget.server),
    DOCKER_REVALIDATE_OPTIONS,
  );
  const { data: statsData, error: statsError } = useApiQuery(
    dockerStatsUrl(widget.container, widget.server),
    DOCKER_REVALIDATE_OPTIONS,
  );

  if (statsError || statsData?.error || statusError || statusData?.error) {
    const finalError = statsError ?? statsData?.error ?? statusError ?? statusData?.error;
    return <Container service={service} error={finalError} />;
  }

  if (statusData && !(statusData.status.includes("running") || statusData.status.includes("partial"))) {
    return (
      <Container>
        <Block label={t("widget.status")} value={t("docker.offline")} />
      </Container>
    );
  }

  // A running Swarm service may have no stats when its task is on another node.
  if (statusData && statsData && !statsData.stats) {
    return <Container service={service} error="not found" />;
  }

  if (!statsData?.stats || !statusData) {
  
    return (
      <Container service={service}>
        <Block label="docker.cpu" />
        <Block label="docker.mem" />
        <Block label="docker.rx" />
        <Block label="docker.tx" />
      </Container>
    );
  }

  const { stats } = statsData;
  const { rxBytes, txBytes } = calculateThroughput(stats);
  const cpuPercent = calculateCPUPercent(stats);
  const usedMemory = calculateUsedMemory(stats);

  return (
    <Container service={service}>
      <Block label="docker.cpu" value={t("common.percent", { value: cpuPercent })} highlightValue={cpuPercent} />
      {stats.memory_stats.usage !== undefined && (
        <Block label="docker.mem" value={t("common.bytes", { value: usedMemory })} highlightValue={usedMemory} />
      )}
      {stats.networks && (
        <>
          <Block label="docker.rx" value={t("common.bytes", { value: rxBytes })} highlightValue={rxBytes} />
          <Block label="docker.tx" value={t("common.bytes", { value: txBytes })} highlightValue={txBytes} />
        </>
      )}
    </Container>
  );
}
