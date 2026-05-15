import type { ReactNode } from "react";

interface WidgetLabelProps {
  label?: ReactNode;
}

export default function WidgetLabel({ label = "" }: WidgetLabelProps) {
  return (
    <div className="information-widget-label pt-1 text-center text-theme-800 dark:text-theme-200 text-xs">{label}</div>
  );
}
