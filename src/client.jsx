import { createInertiaApp } from "@inertiajs/react";
import { createRoot, hydrateRoot } from "react-dom/client";

import "styles/globals.css";
import "styles/manrope.css";
import "styles/theme.css";
import "utils/i18n";
import { AppProviders } from "./app";
import Home from "./pages/index";
import { readBakedInitialQueryData } from "./utils/query/initial-data";

const pages = {
  Home,
};

createInertiaApp({
  resolve: (name) => pages[name],
  setup({ el, App, props }) {
    const initialSettings = props.initialPage?.props?.initialSettings;
    const initialQueryData = props.initialPage?.props?.fallback ?? readBakedInitialQueryData();
    const app = (
      <AppProviders initialQueryData={initialQueryData} initialSettings={initialSettings}>
        <App {...props} />
      </AppProviders>
    );

    if (el.hasChildNodes()) {
      hydrateRoot(el, app);
    } else {
      createRoot(el).render(app);
    }
  },
});
