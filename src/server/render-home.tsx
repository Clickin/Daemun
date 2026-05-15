import { renderToString } from "react-dom/server";

import { AppProviders } from "../app.tsx";
import Wrapper from "../pages/index.tsx";
import type { HomePageProps } from "../types";

export function renderHomeHtml(props: HomePageProps) {
  return renderToString(
    <AppProviders initialQueryData={props.fallback} initialSettings={props.initialSettings}>
      <Wrapper {...props} />
    </AppProviders>,
  );
}
