import Container from "../widget/container";
import Raw from "../widget/raw";
import { useApiQuery } from "utils/query/api-query";

import Cpu from "./cpu";
import CpuTemp from "./cputemp";
import Disk from "./disk";
import Memory from "./memory";
import Network from "./network";
import Uptime from "./uptime";

function getDiskTargets(disk) {
  if (Array.isArray(disk)) return disk.map((entry) => String(entry));
  if (disk) return [String(disk)];
  return [];
}

function resourcesBatchUrl(options) {
  const types: string[] = [];
  const params = new URLSearchParams({ type: "batch" });
  const diskTargets = getDiskTargets(options.disk);

  if (options.cpu) types.push("cpu");
  if (options.memory) types.push("memory");
  if (diskTargets.length) {
    types.push("disk");
    params.set("disks", JSON.stringify(diskTargets));
  }
  if (options.network) {
    types.push("network");
    params.set("interfaceName", options.network === true ? "default" : String(options.network));
  }
  if (options.cputemp) types.push("cputemp");
  if (options.uptime) types.push("uptime");

  if (!types.length) return null;

  params.set("types", types.join(","));
  return `/api/widgets/resources?${params.toString()}`;
}

export default function Resources({ options }) {
  const { expanded, units, diskUnits, tempmin, tempmax } = options;
  let { refresh } = options;
  if (!refresh) refresh = 1500;
  refresh = Math.max(refresh, 1000);

  const { data, error } = useApiQuery(resourcesBatchUrl(options), {
    refreshInterval: refresh,
  });
  const batched = true;

  return (
    <Container options={options}>
      <Raw>
        <div className="flex flex-row self-center flex-wrap justify-between">
          {options.cpu && <Cpu expanded={expanded} refresh={refresh} batched={batched} data={data?.cpu} error={error} />}
          {options.memory && (
            <Memory expanded={expanded} refresh={refresh} batched={batched} data={data?.memory} error={error} />
          )}
          {Array.isArray(options.disk)
            ? options.disk.map((disk) => (
                <Disk
                  key={disk}
                  options={{ disk }}
                  expanded={expanded}
                  diskUnits={diskUnits}
                  refresh={refresh}
                  batched={batched}
                  data={data?.disks?.[String(disk)]}
                  error={error}
                />
              ))
            : options.disk && (
                <Disk
                  options={options}
                  expanded={expanded}
                  diskUnits={diskUnits}
                  refresh={refresh}
                  batched={batched}
                  data={data?.disks?.[String(options.disk)]}
                  error={error}
                />
              )}
          {options.network && <Network options={options} refresh={refresh} batched={batched} data={data?.network} error={error} />}
          {options.cputemp && (
            <CpuTemp
              expanded={expanded}
              units={units}
              refresh={refresh}
              tempmin={tempmin}
              tempmax={tempmax}
              batched={batched}
              data={data?.cputemp}
              error={error}
            />
          )}
          {options.uptime && <Uptime refresh={refresh} batched={batched} data={data?.uptime} error={error} />}
        </div>
        {options.label && (
          <div className="ml-6 pt-1 text-center text-theme-800 dark:text-theme-200 text-xs">{options.label}</div>
        )}
      </Raw>
    </Container>
  );
}
