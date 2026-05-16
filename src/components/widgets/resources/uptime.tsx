import { useTranslation } from "react-i18next";
import { FaRegClock } from "react-icons/fa";
import { useApiQuery } from "utils/query/api-query";

import Error from "../widget/error";
import Resource from "../widget/resource";

export default function Uptime({
  refresh = 1500,
  batched = false,
  data: batchData = undefined,
  error: batchError = undefined,
}) {
  const { t } = useTranslation();

  const query = useApiQuery(batched ? null : `/api/widgets/resources?type=uptime`, {
    refreshInterval: refresh,
  });
  const data = batched ? batchData : query.data;
  const error = batched ? batchError : query.error;

  if (error || data?.error) {
    return <Error />;
  }

  if (!data) {
    return <Resource icon={FaRegClock} value="-" label={t("resources.uptime")} percentage={0} />;
  }

  const percent = Math.round((new Date().getSeconds() / 60) * 100);

  return (
    <Resource
      icon={FaRegClock}
      value={t("common.duration", { value: data.uptime })}
      label={t("resources.uptime")}
      percentage={percent}
    />
  );
}
