import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "../../../public/locales/en/common.json";

import { homepageFormatterPlugin } from "./formatters";

const localeModules = import.meta.glob("../../../public/locales/*/common.json", {
  query: "?raw",
  import: "default",
});

const fallbackLanguage = "en";
const namespace = "common";

function localeModulePath(language) {
  return `../../../public/locales/${language}/${namespace}.json`;
}

export async function loadLanguage(language = fallbackLanguage) {
  const requestedLanguage = language || fallbackLanguage;

  if (i18n.hasResourceBundle(requestedLanguage, namespace)) {
    return requestedLanguage;
  }

  const loadModule = localeModules[localeModulePath(requestedLanguage)];

  if (!loadModule) {
    return fallbackLanguage;
  }

  const rawTranslations = await loadModule();
  i18n.addResourceBundle(requestedLanguage, namespace, JSON.parse(rawTranslations), true, true);

  return requestedLanguage;
}

if (!i18n.isInitialized) {
  i18n
    .use(homepageFormatterPlugin)
    .use(initReactI18next)
    .init({
      defaultNS: "common",
      fallbackLng: fallbackLanguage,
      interpolation: {
        escapeValue: false,
      },
      lng: fallbackLanguage,
      ns: [namespace],
      resources: {
        [fallbackLanguage]: {
          [namespace]: enCommon,
        },
      },
    });
}

export default i18n;
