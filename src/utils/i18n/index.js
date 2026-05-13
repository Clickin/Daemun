import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { homepageFormatterPlugin } from "./formatters";

const localeModules = import.meta.glob("../../../public/locales/*/common.json", {
  eager: true,
});

const resources = Object.fromEntries(
  Object.entries(localeModules).map(([file, module]) => {
    const language = file.match(/public\/locales\/([^/]+)\/common\.json$/)?.[1];
    return [language, { common: module.default }];
  }),
);

if (!i18n.isInitialized) {
  i18n
    .use(homepageFormatterPlugin)
    .use(initReactI18next)
    .init({
      defaultNS: "common",
      fallbackLng: "en",
      interpolation: {
        escapeValue: false,
      },
      lng: "en",
      ns: ["common"],
      resources,
    });
}

export default i18n;
