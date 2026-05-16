import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "react-i18next";
import { useApiQuery } from "utils/query/api-query";

export default function Component({ service }) {
  const { t } = useTranslation();

  const { widget } = service;
  const podSelectorString = widget.podSelector !== undefined ? `podSelector=${widget.podSelector}` : "";
  const { data, error } = useApiQuery(`/api/kubernetes/summary/${widget.namespace}/${widget.app}?${podSelectorString}`);

  if (error || data?.error) {
    return <Container service={service} error={error ?? data?.error} />;
  }

  if (data && (!data.status || !(data.status.includes("running") || data.status.includes("partial")))) {
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
      </Container>
    );
  }

  return (
    <Container service={service}>
      {(data.stats.cpuLimit && (
        <Block
          label="docker.cpu"
          value={t("common.percent", { value: data.stats.cpuUsage })}
          highlightValue={data.stats.cpuUsage}
        />
      )) || (
        <Block
          label="docker.cpu"
          value={t("common.number", { value: data.stats.cpu, maximumFractionDigits: 4 })}
          highlightValue={data.stats.cpu}
        />
      )}
      <Block
        label="docker.mem"
        value={t("common.bytes", { value: data.stats.mem })}
        highlightValue={data.stats.mem}
      />
    </Container>
  );
}
