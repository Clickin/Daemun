import { bookmarksResponse, servicesResponse, widgetsResponse } from "utils/config/api-response";
import { getSettings } from "utils/config/config";
import { normalizeLanguage } from "utils/i18n/language";
import createLogger from "utils/logger";

export async function loadHomePageProps() {
  let logger;

  try {
    logger = createLogger("index");
    const { providers, ...settings } = getSettings();

    const services = await servicesResponse();
    const bookmarks = await bookmarksResponse();
    const widgets = await widgetsResponse();
    const language = normalizeLanguage(settings.language);

    return {
      initialSettings: {
        ...settings,
        language,
      },
      fallback: {
        "/api/bookmarks": bookmarks,
        "/api/hash": false,
        "/api/services": services,
        "/api/widgets": widgets,
      },
      locale: language,
    };
  } catch (e) {
    if (logger && e) {
      logger.error(e);
    }

    return {
      initialSettings: {},
      fallback: {
        "/api/bookmarks": [],
        "/api/hash": false,
        "/api/services": [],
        "/api/widgets": [],
      },
      locale: "en",
    };
  }
}
