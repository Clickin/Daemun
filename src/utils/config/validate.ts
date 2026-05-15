import checkAndCopyConfig from "./config";

const configs = ["docker.yaml", "settings.yaml", "services.yaml", "bookmarks.yaml", "kubernetes.yaml", "proxmox.yaml"];

export function validateConfigResponse() {
  return configs.map((config) => checkAndCopyConfig(config)).filter((status) => status !== true);
}
