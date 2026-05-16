import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "react-i18next";
import { useApiQuery } from "utils/query/api-query";

import { calculateCPUPercent, calculateThroughput, calculateUsedMemory } from "./stats-helpers";

export default function Component({ service }) {
  const { t } = useTranslation();

  const { widget } = service;

  const { data, error } = useApiQuery(`/api/docker/summary/${widget.container}/${widget.server || ""}`);

  if (error || data?.error) {
    return <Container service={service} error={error ?? data?.error} />;
  }

  if (data && !(data.status.includes("running") || data.status.includes("partial"))) {
    return (
      <Container>
        <Block label={t("widget.status")} value={t("docker.offline")} />
      </Container>
    );
  }

  if (!data?.stats) {
    return (
      <Container service={service}>
        <Block label="docker.cpu" />
        <Block label="docker.mem" />
        <Block label="docker.rx" />
        <Block label="docker.tx" />
      </Container>
    );
  }

  const { rxBytes, txBytes } = calculateThroughput(data.stats);
  const cpuPercent = calculateCPUPercent(data.stats);
  const usedMemory = calculateUsedMemory(data.stats);

  return (
    <Container service={service}>
      <Block label="docker.cpu" value={t("common.percent", { value: cpuPercent })} highlightValue={cpuPercent} />
      {data.stats.memory_stats.usage && (
        <Block label="docker.mem" value={t("common.bytes", { value: usedMemory })} highlightValue={usedMemory} />
      )}
      {data.stats.networks && (
        <>
          <Block label="docker.rx" value={t("common.bytes", { value: rxBytes })} highlightValue={rxBytes} />
          <Block label="docker.tx" value={t("common.bytes", { value: txBytes })} highlightValue={txBytes} />
        </>
      )}
    </Container>
  );
}
