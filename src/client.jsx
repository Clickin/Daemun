import { createInertiaApp } from "@inertiajs/react";
import { createRoot } from "react-dom/client";

import "styles/globals.css";
import "styles/manrope.css";
import "styles/theme.css";
import "utils/i18n";
import { AppProviders } from "./app";
import Home from "./pages/index";

const pages = {
  Home,
};

createInertiaApp({
  resolve: (name) => pages[name],
  setup({ el, App, props }) {
    const initialSettings = props.initialPage?.props?.initialSettings;

    createRoot(el).render(
      <AppProviders initialSettings={initialSettings}>
        <App {...props} />
      </AppProviders>,
    );
  },
});
