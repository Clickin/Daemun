import clsx from "clsx";
import { Children, isValidElement, useContext, type ReactElement, type ReactNode } from "react";
import type { UnknownRecord } from "../../../types";
import { SettingsContext } from "utils/contexts/settings";

import PrimaryText from "./primary_text";
import Raw from "./raw";
import SecondaryText from "./secondary_text";
import WidgetIcon from "./widget_icon";

export interface WidgetContainerOptions extends UnknownRecord {
  href?: string;
  style?: {
    cardBlur?: string;
    header?: string;
    isRightAligned?: boolean;
  };
  target?: string;
  url?: string;
}

interface ContainerProps {
  additionalClassNames?: string;
  children?: ReactNode;
  options?: WidgetContainerOptions;
}

function getChildArray(children: ReactNode): ReactElement[] {
  return Children.toArray(children).filter(isValidElement);
}

export function getAllClasses(options?: WidgetContainerOptions, additionalClassNames = "") {
  if (options?.style?.header === "boxedWidgets") {
    if (options?.style?.cardBlur !== undefined) {
      // oxlint-disable-next-line no-param-reassign
      additionalClassNames = [
        additionalClassNames,
        `backdrop-blur${options.style.cardBlur.length ? "-" : ""}${options.style.cardBlur}`,
      ].join(" ");
    }

    return clsx(
      "flex flex-col justify-center",
      "mt-2 m:mb-0 rounded-md shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5 p-2 pl-3 pr-3",
      additionalClassNames,
    );
  }

  let widgetAlignedClasses = "flex flex-col max-w:full sm:basis-auto self-center grow-0 flex-wrap";
  if (options?.style?.isRightAligned) {
    widgetAlignedClasses = "flex flex-col justify-center";
  }

  return clsx(widgetAlignedClasses, additionalClassNames);
}

export function getInnerBlock(children: ReactNode) {
  if (isValidElement(children) && children.type === Raw) {
    return false;
  }

  const childArray = getChildArray(children);

  // children won't be an array if it's Raw component
  return (
    childArray.length > 0 && (
      <div className="flex flex-row items-center justify-end widget-inner">
        <div className="flex flex-col items-center widget-inner-icon">
          {childArray.find((child) => child.type === WidgetIcon)}
        </div>
        <div className="flex flex-col ml-3 text-left widget-inner-text">
          {childArray.find((child) => child.type === PrimaryText)}
          {childArray.find((child) => child.type === SecondaryText)}
        </div>
      </div>
    )
  );
}

export function getBottomBlock(children: ReactNode) {
  if (isValidElement(children) && children.type === Raw) {
    return [children];
  }

  return getChildArray(children).find((child) => child.type === Raw) || [];
}

export default function Container({ children = [], options, additionalClassNames = "" }: ContainerProps) {
  const { settings } = useContext(SettingsContext);
  return options?.href ? (
    <a
      href={options.href}
      target={options.target ?? settings.target ?? "_blank"}
      className={getAllClasses(options, `${additionalClassNames} widget-container`)}
    >
      {getInnerBlock(children)}
      {getBottomBlock(children)}
    </a>
  ) : (
    <div className={getAllClasses(options, `${additionalClassNames} widget-container`)}>
      {getInnerBlock(children)}
      {getBottomBlock(children)}
    </div>
  );
}
