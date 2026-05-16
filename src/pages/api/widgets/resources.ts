import si from "systeminformation";

import createLogger from "utils/logger";

const logger = createLogger("resources");

function isMissingNetworkStat(networkData) {
  return (
    networkData.operstate === "unknown" &&
    networkData.rx_bytes === 0 &&
    networkData.rx_dropped === 0 &&
    networkData.rx_errors === 0 &&
    networkData.tx_bytes === 0 &&
    networkData.tx_dropped === 0 &&
    networkData.tx_errors === 0 &&
    networkData.rx_sec === null &&
    networkData.tx_sec === null &&
    networkData.ms === 0
  );
}

class ResourceLookupError extends Error {
  payload: { error: string };
  statusCode: number;

  constructor(statusCode: number, payload: { error: string }) {
    super(payload.error);
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

function firstQueryValue(value, fallback = undefined) {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function parseList(value) {
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .filter((entry) => typeof entry === "string")
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseDiskTargets(disks, target) {
  const diskValue = firstQueryValue(disks);
  if (typeof diskValue === "string" && diskValue) {
    try {
      const parsed = JSON.parse(diskValue);
      if (Array.isArray(parsed)) {
        return [...new Set(parsed.map((entry) => String(entry)).filter(Boolean))];
      }
    } catch {
      return [...new Set(parseList(diskValue))];
    }
  }

  const targetValue = firstQueryValue(target);
  return [typeof targetValue === "string" && targetValue ? targetValue : "/"];
}

async function readCpu() {
  const load = await si.currentLoad();
  return {
    cpu: {
      usage: load.currentLoad,
      load: load.avgLoad,
    },
  };
}

async function readFsSize() {
  const fsSize = await si.fsSize();
  logger.debug("fsSize:", JSON.stringify(fsSize));
  return fsSize;
}

function driveForTarget(fsSize, requested) {
  const drive = fsSize.find((fs) => {
    return fs.mount === requested;
  });

  if (!drive) {
    logger.warn(`Drive not found for target: ${requested}`);
    throw new ResourceLookupError(404, { error: "Resource not available." });
  }

  return drive;
}

async function readDisk(target) {
  const requested = typeof target === "string" && target ? target : "/";
  const fsSize = await readFsSize();
  return { drive: driveForTarget(fsSize, requested) };
}

async function readDisks(targets) {
  const fsSize = await readFsSize();
  return Object.fromEntries(
    targets.map((target) => {
      try {
        return [target, { drive: driveForTarget(fsSize, target) }];
      } catch (error) {
        if (error instanceof ResourceLookupError) {
          return [target, error.payload];
        }
        throw error;
      }
    }),
  );
}

async function readMemory() {
  const memory = await si.mem();
  logger.debug("memory:", JSON.stringify(memory));
  return {
    memory,
  };
}

async function readCpuTemp() {
  const cputemp = await si.cpuTemperature();
  logger.debug("cputemp:", JSON.stringify(cputemp));
  return {
    cputemp,
  };
}

async function readUptime() {
  const timeData = await si.time();
  logger.debug("timeData:", JSON.stringify(timeData));
  return {
    uptime: timeData.uptime,
  };
}

async function readNetwork(interfaceName = "default") {
  const requestedInterface = firstQueryValue(interfaceName, "default");
  const allNetworkData = await si.networkStats("*");
  type NetworkStats = (typeof allNetworkData)[number];
  let networkData: NetworkStats | null = null;
  let interfaceDefault;
  logger.debug("networkData:", JSON.stringify(allNetworkData));

  if (requestedInterface && requestedInterface !== "default") {
    networkData = allNetworkData.filter((network) => network.iface === requestedInterface).at(0) ?? null;
    if (!networkData) {
      const directNetworkData = await si.networkStats(requestedInterface);
      logger.debug("directNetworkData:", JSON.stringify(directNetworkData));
      networkData = Array.isArray(directNetworkData) ? directNetworkData.at(0) : null;

      if (!networkData || isMissingNetworkStat(networkData)) {
        networkData = null;
      }
    }
    if (!networkData) {
      throw new ResourceLookupError(404, {
        error: "Interface not found",
      });
    }
  } else {
    interfaceDefault = await si.networkInterfaceDefault();
    networkData = allNetworkData.filter((network) => network.iface === interfaceDefault).at(0) ?? null;
    if (!networkData) {
      throw new ResourceLookupError(404, {
        error: "Default interface not found",
      });
    }
  }

  return {
    network: networkData,
    interface: requestedInterface !== "default" ? requestedInterface : interfaceDefault,
  };
}

async function batchResponse(query) {
  const types = [...new Set(parseList(query.types))];
  if (types.length === 0) {
    throw new ResourceLookupError(400, { error: "invalid type" });
  }

  const tasks: [string, Promise<unknown>][] = [];
  if (types.includes("cpu")) tasks.push(["cpu", readCpu()]);
  if (types.includes("memory")) tasks.push(["memory", readMemory()]);
  if (types.includes("cputemp")) tasks.push(["cputemp", readCpuTemp()]);
  if (types.includes("uptime")) tasks.push(["uptime", readUptime()]);
  if (types.includes("network")) tasks.push(["network", readNetwork(query.interfaceName)]);
  if (types.includes("disk")) tasks.push(["disks", readDisks(parseDiskTargets(query.disks, query.target))]);

  if (tasks.length === 0) {
    throw new ResourceLookupError(400, { error: "invalid type" });
  }

  const entries = await Promise.all(
    tasks.map(async ([key, task]) => {
      try {
        return [key, await task];
      } catch (error) {
        if (error instanceof ResourceLookupError) {
          return [key, error.payload];
        }
        throw error;
      }
    }),
  );

  return Object.fromEntries(entries);
}

export default async function handler(req, res) {
  const { type, target, interfaceName = "default" } = req.query;

  try {
    if (type === "cpu") {
      return res.status(200).json(await readCpu());
    }

    if (type === "disk") {
      return res.status(200).json(await readDisk(target));
    }

    if (type === "memory") {
      return res.status(200).json(await readMemory());
    }

    if (type === "cputemp") {
      return res.status(200).json(await readCpuTemp());
    }

    if (type === "uptime") {
      return res.status(200).json(await readUptime());
    }

    if (type === "network") {
      return res.status(200).json(await readNetwork(interfaceName));
    }

    if (type === "batch") {
      return res.status(200).json(await batchResponse(req.query));
    }

    return res.status(400).json({
      error: "invalid type",
    });
  } catch (error) {
    if (error instanceof ResourceLookupError) {
      return res.status(error.statusCode).json(error.payload);
    }
    throw error;
  }
}
