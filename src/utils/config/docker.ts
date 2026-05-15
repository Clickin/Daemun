import { readFileSync } from "fs";
import path from "path";

import yaml from "js-yaml";

import checkAndCopyConfig, { CONF_DIR, substituteEnvironmentVars } from "utils/config/config";

export interface DockerConnectionArgs {
  ca?: Buffer;
  cert?: Buffer;
  headers?: Record<string, string>;
  host?: string;
  key?: Buffer;
  port?: number | string;
  protocol?: string;
  socketPath?: string;
}

interface DockerServerConfig {
  headers?: Record<string, string>;
  host?: string;
  port?: number | string;
  protocol?: string;
  socket?: string;
  swarm?: boolean;
  tls?: {
    caFile: string;
    certFile: string;
    keyFile: string;
  };
}

export interface DockerServerArguments {
  conn: DockerConnectionArgs;
  swarm: boolean;
}

export type DockerArguments = DockerConnectionArgs | DockerServerArguments | null;

export function getDefaultDockerArgs(platform = process.platform) {
  if (platform !== "win32" && platform !== "darwin") {
    return { socketPath: "/var/run/docker.sock" };
  }

  return { host: "127.0.0.1" };
}

function dockerServerArguments(config: DockerServerConfig): DockerServerArguments {
  const conn: DockerConnectionArgs = {};

  if (config.socket) {
    conn.socketPath = config.socket;
  }

  if (config.host) {
    conn.host = config.host;
  }

  if (config.port) {
    conn.port = config.port;
  }

  if (config.tls) {
    conn.ca = readFileSync(path.join(CONF_DIR, config.tls.caFile));
    conn.cert = readFileSync(path.join(CONF_DIR, config.tls.certFile));
    conn.key = readFileSync(path.join(CONF_DIR, config.tls.keyFile));
    conn.protocol = "https";
  }

  if (config.protocol) {
    conn.protocol = config.protocol;
  }

  if (config.headers) {
    conn.headers = config.headers;
  }

  return { conn, swarm: !!config.swarm };
}

export default function getDockerArguments(): DockerConnectionArgs;
export default function getDockerArguments(server: string): DockerServerArguments | null;
export default function getDockerArguments(server?: string): DockerArguments {
  checkAndCopyConfig("docker.yaml");

  const configFile = path.join(CONF_DIR, "docker.yaml");
  const rawConfigData = readFileSync(configFile, "utf8");
  const configData = substituteEnvironmentVars(rawConfigData);
  const servers = (yaml.load(configData) ?? {}) as Record<string, DockerServerConfig>;

  if (!server) {
    return getDefaultDockerArgs();
  }

  if (servers[server]) {
    return dockerServerArguments(servers[server]);
  }
  return null;
}
