import createLogger from "utils/logger";

import checkAndCopyConfig from "./config";

const configs = ["docker.yaml", "settings.yaml", "services.yaml", "bookmarks.yaml", "kubernetes.yaml", "proxmox.yaml"];
const logger = createLogger("configValidationHandler");

export function validateConfigResponse() {
  let errors = configs.map((config) => checkAndCopyConfig(config)).filter((status) => status !== true);
  if (errors.length > 0) {
    logger.error("Configuration validation errors", errors);
    errors = errors.map((error) => ({
      name: error.name,
      config: error.config,
      reason: error.reason,
      mark: { line: error.mark?.line },
    }));
  }
  return errors;
}
