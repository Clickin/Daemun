import { renderToString } from "react-dom/server";

import { AppProviders } from "../app.tsx";
import Wrapper from "../pages/index.tsx";

export function renderHomeHtml(props) {
  return renderToString(
    <AppProviders initialQueryData={props.fallback} initialSettings={props.initialSettings}>
      <Wrapper {...props} />
    </AppProviders>,
  );
}
