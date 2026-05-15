import { bookmarksResponse, servicesResponse, widgetsResponse } from "utils/config/api-response";
import { getSettings } from "utils/config/config";
import { validateConfigResponse } from "utils/config/validate";
import { normalizeLanguage } from "utils/i18n/language";
import createLogger from "utils/logger";

import type { HomePageProps } from "../types";

export async function loadHomePageProps(): Promise<HomePageProps> {
  let logger;

  try {
    logger = createLogger("index");
    const { providers, ...settings } = getSettings();

    const services = await servicesResponse();
    const bookmarks = await bookmarksResponse();
    const widgets = await widgetsResponse();
    const validation = validateConfigResponse();
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
        "/api/validate": validation,
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
        "/api/validate": [],
        "/api/widgets": [],
      },
      locale: "en",
    };
  }
}
