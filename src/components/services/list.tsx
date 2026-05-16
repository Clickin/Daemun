import clsx from "clsx";
import Item from "components/services/item";

import { columnMap } from "../../utils/layout/columns";
import type { LayoutRecord, ServiceRecord } from "../../types";

interface ServicesListProps {
  groupName: string;
  services: ServiceRecord[];
  layout?: LayoutRecord;
  useEqualHeights?: boolean;
  header?: boolean;
}

export default function List({ groupName, services, layout, useEqualHeights, header }: ServicesListProps) {
  return (
    <ul
      className={clsx(
        layout?.style === "row" ? `grid ${columnMap[layout?.columns]} gap-x-2` : "flex flex-col",
        header ? "mt-3" : "",
        "services-list",
      )}
    >
      {services.map((service) => (
        <Item
          key={[service.container, service.app, service.name].filter((s) => s).join("-")}
          service={service}
          groupName={groupName}
          useEqualHeights={layout?.useEqualHeights ?? useEqualHeights}
        />
      ))}
    </ul>
  );
}
