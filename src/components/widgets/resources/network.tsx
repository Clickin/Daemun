import { useTranslation } from "react-i18next";
import { FaNetworkWired } from "react-icons/fa";
import { useApiQuery } from "utils/query/api-query";

import Error from "../widget/error";
import Resource from "../widget/resource";

export default function Network({
  options,
  refresh = 1500,
  batched = false,
  data: batchData = undefined,
  error: batchError = undefined,
}) {
  const { t } = useTranslation();
  const interfaceName = options.network === true ? "default" : options.network;

  const query = useApiQuery(batched ? null : `/api/widgets/resources?type=network&interfaceName=${interfaceName}`, {
    refreshInterval: refresh,
  });
  const data = batched ? batchData : query.data;
  const error = batched ? batchError : query.error;

  if (error || data?.error) {
    return <Error />;
  }

  if (!data || !data.network || !data.network.rx_sec || !data.network.tx_sec) {
    return (
      <Resource
        icon={FaNetworkWired}
        value="- ↑"
        label="- ↓"
        expandedValue="- ↑"
        expandedLabel="- ↓"
        percentage={0}
        wide
      />
    );
  }

  return (
    <Resource
      icon={FaNetworkWired}
      value={`${t("common.byterate", { value: data.network.tx_sec })} ↑`}
      label={`${t("common.byterate", { value: data.network.rx_sec })} ↓`}
      expandedValue={`${t("common.bytes", { value: data.network.tx_bytes })} ↑`}
      expandedLabel={`${t("common.bytes", { value: data.network.rx_bytes })} ↓`}
      expanded={options.expanded}
      wide
      percentage={(100 * data.network.rx_sec) / (data.network.rx_sec + data.network.tx_sec)}
    />
  );
}
