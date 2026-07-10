import Block from "components/services/widget/block";
import Container from "components/services/widget/container";

import useWidgetAPI from "utils/proxy/use-widget-api";

const ACTIVE_STATUSES = ["online", "running"];

function countResources(data, resources, type) {
  const count = data?.stats?.byType?.[type];
  return typeof count === "number" ? count : resources?.filter((resource) => resource.type === type).length;
}

function formatResourceCount(resources, type) {
  const total = countResources(resources.data, resources.items, type);
  if (total === undefined) return undefined;
  if (!resources.items) return total;
  const active = resources.items.filter(
    (resource) => resource.type === type && ACTIVE_STATUSES.includes(resource.status),
  ).length;
  return `${active} / ${total}`;
}

export default function Component({ service }) {
  const { widget } = service;
  const { data, error } = useWidgetAPI(widget, "resources");

  if (error) return <Container service={service} error={error} />;

  const resources = { data, items: data?.resources ?? (data?.count === 0 ? [] : undefined) };
  return (
    <Container service={service}>
      <Block label="pulse.nodes" value={data && formatResourceCount(resources, "node")} />
      <Block label="pulse.vms" value={data && formatResourceCount(resources, "vm")} />
      <Block label="pulse.lxcs" value={data && formatResourceCount(resources, "container")} />
    </Container>
  );
}
