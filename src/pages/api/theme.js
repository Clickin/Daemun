import checkAndCopyConfig, { getSettings } from "utils/config/config";

export default function handler(req, response) {
  const res = response || req.res;
  checkAndCopyConfig("settings.yaml");
  const settings = getSettings();

  const color = settings.color || "slate";
  const theme = settings.theme || "dark";

  return res.status(200).json({
    color,
    theme,
  });
}
