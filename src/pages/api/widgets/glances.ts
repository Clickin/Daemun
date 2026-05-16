import { getPrivateWidgetOptions } from "utils/config/widget-helpers";
import createLogger from "utils/logger";
import { parseVersionForUrl } from "utils/proxy/api-helpers";
import { httpProxy } from "utils/proxy/http";

const logger = createLogger("glances");

async function retrieveFromGlancesAPI(privateWidgetOptions, endpoint) {
  let errorMessage;
  const url = privateWidgetOptions?.url;
  if (!url) {
    errorMessage = "Missing Glances URL";
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  const apiUrl = `${url}/api/${privateWidgetOptions.version}/${endpoint}`;
  const headers: Record<string, string> = {
    "Accept-Encoding": "application/json",
  };
  if (privateWidgetOptions.username && privateWidgetOptions.password) {
    headers.Authorization = `Basic ${Buffer.from(
      `${privateWidgetOptions.username}:${privateWidgetOptions.password}`,
    ).toString("base64")}`;
  }
  const params = { method: "GET", headers };

  const [status, , data] = await httpProxy(apiUrl, params);

  if (status === 401) {
    errorMessage = `Authorization failure getting data from glances API. Data: ${data.toString()}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  if (status !== 200) {
    errorMessage = `HTTP ${status} getting data from glances API. Data: ${data.toString()}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }

  return JSON.parse(Buffer.from(data).toString());
}

export default async function handler(req, res) {
  const { index, cputemp: includeCpuTemp, uptime: includeUptime, disk: includeDisks, version } = req.query;

  const privateWidgetOptions = await getPrivateWidgetOptions("glances", index);
  privateWidgetOptions.version = parseVersionForUrl(version, 3);

  try {
    const tasks: [string, Promise<unknown>][] = [
      ["cpu", retrieveFromGlancesAPI(privateWidgetOptions, "cpu")],
      ["load", retrieveFromGlancesAPI(privateWidgetOptions, "load")],
      ["mem", retrieveFromGlancesAPI(privateWidgetOptions, "mem")],
    ];

    // Disabled by default, dont call unless needed
    if (includeUptime) {
      tasks.push(["uptime", retrieveFromGlancesAPI(privateWidgetOptions, "uptime")]);
    }

    if (includeCpuTemp) {
      tasks.push(["sensors", retrieveFromGlancesAPI(privateWidgetOptions, "sensors")]);
    }

    if (includeDisks) {
      tasks.push(["fs", retrieveFromGlancesAPI(privateWidgetOptions, "fs")]);
    }

    const entries = await Promise.all(tasks.map(async ([key, task]) => [key, await task] as const));
    const data = Object.fromEntries(entries);

    return res.status(200).send(data);
  } catch (e) {
    return res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
  }
}
