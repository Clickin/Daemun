import ErrorBoundary from "components/errorboundry";
import { cachedDynamic } from "utils/dynamic";

const widgetMappings = {
  weatherapi: () => import("components/widgets/weather/weather"),
  openweathermap: () => import("components/widgets/openweathermap/weather"),
  resources: () => import("components/widgets/resources/resources"),
  search: () => import("components/widgets/search/search"),
  greeting: () => import("components/widgets/greeting/greeting"),
  datetime: () => import("components/widgets/datetime/datetime"),
  logo: () => import("components/widgets/logo/logo"),
  unifi_console: () => import("components/widgets/unifi_console/unifi_console"),
  glances: () => import("components/widgets/glances/glances"),
  openmeteo: () => import("components/widgets/openmeteo/openmeteo"),
  longhorn: () => import("components/widgets/longhorn/longhorn"),
  kubernetes: () => import("components/widgets/kubernetes/kubernetes"),
  stocks: () => import("components/widgets/stocks/stocks"),
};

export default function ResolvedWidget({ widget, style }) {
  const loader = widgetMappings[widget.type];
  const InfoWidget = loader ? cachedDynamic(loader, widget.type === "logo" ? { ssr: false } : undefined) : undefined;

  if (InfoWidget) {
    return (
      <ErrorBoundary>
        <InfoWidget options={{ ...widget.options, style }} />
      </ErrorBoundary>
    );
  }

  return (
    <div className="flex-none flex flex-row items-center justify-center">
      Missing <strong>{widget.type}</strong>
    </div>
  );
}
