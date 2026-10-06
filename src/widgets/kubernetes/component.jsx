import { useTranslation } from "react-i18next";
import { useApiQuery } from "utils/query/api-query";

import Block from "components/services/widget/block";
import Container from "components/services/widget/container";

export default function Component({ service }) {
  const { t } = useTranslation();

  const { widget } = service;
  const podSelectorString = widget.podSelector !== undefined ? `podSelector=${encodeURIComponent(widget.podSelector)}` : "";
  const servicePath = `${encodeURIComponent(widget.namespace)}/${encodeURIComponent(widget.app)}`;
  const { data: statusData, error: statusError } = useApiQuery(
    `/api/kubernetes/status/${servicePath}?${podSelectorString}`,
  );

  const { data: statsData, error: statsError } = useApiQuery(
    `/api/kubernetes/stats/${servicePath}?${podSelectorString}`,
  );

  if (statsError || statusError) {
    return <Container service={service} error={statsError ?? statusError ?? statusData} />;
  }

  if (
    statusData &&
    (!statusData.status || !(statusData.status.includes("running") || statusData.status.includes("partial")))
  ) {
    return (
      <Container>
        <Block label={t("widget.status")} value={t("docker.offline")} />
      </Container>
    );
  }

  if (!statsData || !statusData) {
    return (
      <Container service={service}>
        <Block label="docker.cpu" />
        <Block label="docker.mem" />
      </Container>
    );
  }

  return (
    <Container service={service}>
      {(statsData.stats.cpuLimit && (
        <Block
          label="docker.cpu"
          value={t("common.percent", { value: statsData.stats.cpuUsage })}
          highlightValue={statsData.stats.cpuUsage}
        />
      )) || (
        <Block
          label="docker.cpu"
          value={t("common.number", { value: statsData.stats.cpu, maximumFractionDigits: 4 })}
          highlightValue={statsData.stats.cpu}
        />
      )}
      <Block
        label="docker.mem"
        value={t("common.bytes", { value: statsData.stats.mem })}
        highlightValue={statsData.stats.mem}
      />
    </Container>
  );
}
