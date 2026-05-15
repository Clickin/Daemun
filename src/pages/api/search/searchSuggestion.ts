import { getSettings } from "utils/config/config";
import { widgetsFromConfig } from "utils/config/widget-helpers";
import { cachedRequest } from "utils/proxy/http";
import { searchProviderData } from "utils/search/providers";

export default async function handler(req, res) {
  const { query, providerName } = req.query;

  const matchedProvider = Object.values(searchProviderData).find(({ name }) => name === providerName);

  if (!matchedProvider) {
    return res.json([query, []]);
  }

  const provider = { ...matchedProvider };

  if (provider.name === "Custom") {
    const widgets = await widgetsFromConfig();
    const searchWidget = widgets.find((w) => w.type === "search");

    if (searchWidget) {
      provider.url = searchWidget.options.url;
      provider.suggestionUrl = searchWidget.options.suggestionUrl;
    } else {
      const settings = getSettings();
      if (settings.quicklaunch && settings.quicklaunch.provider === "custom") {
        provider.url = settings.quicklaunch.url;
        provider.suggestionUrl = settings.quicklaunch.suggestionUrl;
      }
    }
  }

  if (!provider.suggestionUrl) {
    return res.json([query, []]); // Responde with the same array format but with no suggestions.
  }

  return res.send(await cachedRequest(`${provider.suggestionUrl}${encodeURIComponent(query)}`, 5, "Mozilla/5.0"));
}
