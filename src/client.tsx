import { createRoot, hydrateRoot } from "react-dom/client";

import "styles/globals.css";
import "styles/manrope.css";
import "styles/theme.css";
import "utils/i18n";
import { AppProviders } from "./app";
import Home from "./pages/index";
import { readBakedInitialPageProps, readBakedInitialQueryData } from "./utils/query/initial-data";
import type { HomePageProps } from "./types";

function readInitialHomeProps(): Pick<HomePageProps, "fallback" | "initialSettings" | "locale"> {
  const initialPageProps = readBakedInitialPageProps() ?? {};
  const initialQueryData = readBakedInitialQueryData() ?? {};

  return {
    fallback: initialQueryData as HomePageProps["fallback"],
    initialSettings: (initialPageProps.initialSettings ?? {}) as HomePageProps["initialSettings"],
    locale: typeof initialPageProps.locale === "string" ? initialPageProps.locale : "en",
  };
}

const el = document.getElementById("app");
if (!el) {
  throw new Error("Daemun client root element #app was not found");
}

const initialProps = readInitialHomeProps();
const app = (
  <AppProviders initialQueryData={initialProps.fallback} initialSettings={initialProps.initialSettings}>
    <Home {...initialProps} />
  </AppProviders>
);

if (el.hasChildNodes()) {
  hydrateRoot(el, app);
} else {
  createRoot(el).render(app);
}
