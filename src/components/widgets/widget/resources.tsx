import clsx from "clsx";
import { Children, isValidElement, type ReactNode } from "react";

import ContainerLink from "./container_link";
import type { WidgetContainerOptions } from "./container";
import Raw from "./raw";
import Resource from "./resource";
import WidgetLabel from "./widget_label";

interface ResourcesProps {
  additionalClassNames?: string;
  children?: ReactNode;
  options?: WidgetContainerOptions;
  target?: string;
}

export default function Resources({ options = {}, children, target, additionalClassNames }: ResourcesProps) {
  const widgetParts = Children.toArray(children).filter(isValidElement);
  const addedClassNames = clsx("information-widget-resources", additionalClassNames);

  return (
    <ContainerLink options={options} target={target} additionalClassNames={addedClassNames}>
      <Raw>
        <div className="flex flex-row self-center flex-wrap justify-between">
          {widgetParts.filter((child) => child && child.type === Resource)}
        </div>
        {widgetParts.filter((child) => child && child.type === WidgetLabel)}
      </Raw>
    </ContainerLink>
  );
}
