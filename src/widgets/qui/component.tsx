import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "react-i18next";

import useWidgetAPI from "utils/proxy/use-widget-api";

const DEFAULT_FIELDS = ["leech", "download", "seed", "upload"];
const MAX_FIELDS = 4;

export default function Component({ service }) {
  const { t } = useTranslation();
  const { widget } = service;

  if (!widget.fields?.length) {
    widget.fields = DEFAULT_FIELDS;
  } else if (widget.fields.length > MAX_FIELDS) {
    widget.fields = widget.fields.slice(0, MAX_FIELDS);
  }

  const perInstance = widget.instance != null && widget.instance !== "";
  const { data, error } = useWidgetAPI(widget, perInstance ? "torrents" : "torrentsAll");

  if (error) {
    return <Container service={service} error={error} />;
  }

  if (!data?.stats) {
    return (
      <Container service={service}>
        {widget.fields.map((field) => (
          <Block key={field} label={`qui.${field}`} />
        ))}
      </Container>
    );
  }

  const { stats } = data;
  const status = data.counts?.status;
  const serverState = data.serverState;
  const completed = status?.completed ?? stats.seeding;
  const incomplete =
    typeof status?.all === "number" && typeof status.completed === "number"
      ? status.all - status.completed
      : stats.downloading;

  const values = {
    leech: `${t("common.number", { value: stats.downloading })} / ${t("common.number", { value: incomplete })}`,
    download: t("common.bibyterate", { value: stats.totalDownloadSpeed, decimals: 1 }),
    seed: `${t("common.number", { value: stats.seeding })} / ${t("common.number", { value: completed })}`,
    upload: t("common.bibyterate", { value: stats.totalUploadSpeed, decimals: 1 }),
    total: t("common.number", { value: status?.all ?? stats.total }),
    errored: t("common.number", { value: status?.errored ?? stats.error }),
    ...(serverState && {
      ratio: t("common.number", { value: Number.parseFloat(serverState.global_ratio) }),
      freeSpace: t("common.bbytes", { value: serverState.free_space_on_disk, maximumFractionDigits: 1 }),
    }),
  };

  return (
    <Container service={service}>
      {widget.fields.map((field) => {
        if (values[field] === undefined) return null;
        const highlightValue =
          field === "download" ? stats.totalDownloadSpeed : field === "upload" ? stats.totalUploadSpeed : undefined;
        return <Block key={field} label={`qui.${field}`} value={values[field]} highlightValue={highlightValue} />;
      })}
    </Container>
  );
}
