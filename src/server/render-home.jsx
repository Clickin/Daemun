import { renderToString } from "react-dom/server";

import { AppProviders } from "../app.jsx";
import Wrapper from "../pages/index.jsx";

export function renderHomeHtml(props) {
  return renderToString(
    <AppProviders initialQueryData={props.fallback} initialSettings={props.initialSettings}>
      <Wrapper {...props} />
    </AppProviders>,
  );
}
