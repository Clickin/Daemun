import { createInertiaApp } from "@inertiajs/react";
import { createRoot, hydrateRoot } from "react-dom/client";

import "styles/globals.css";
import "styles/manrope.css";
import "styles/theme.css";
import "utils/i18n";
import { AppProviders } from "./app";
import Home from "./pages/index";
import { readBakedInitialPageProps, readBakedInitialQueryData } from "./utils/query/initial-data";

const pages = {
  Home,
};

function mergeBakedInitialPageProps(props) {
  const bakedPageProps = readBakedInitialPageProps();
  if (!bakedPageProps || !props.initialPage) return props;

  return {
    ...props,
    initialPage: {
      ...props.initialPage,
      props: {
        ...bakedPageProps,
        ...props.initialPage.props,
      },
    },
  };
}

createInertiaApp({
  resolve: (name) => pages[name],
  setup({ el, App, props }) {
    const mergedProps = mergeBakedInitialPageProps(props);
    const initialSettings = mergedProps.initialPage?.props?.initialSettings;
    const initialQueryData = mergedProps.initialPage?.props?.fallback ?? readBakedInitialQueryData();
    const app = (
      <AppProviders initialQueryData={initialQueryData} initialSettings={initialSettings}>
        <App {...mergedProps} />
      </AppProviders>
    );

    if (el.hasChildNodes()) {
      hydrateRoot(el, app);
    } else {
      createRoot(el).render(app);
    }
  },
});
