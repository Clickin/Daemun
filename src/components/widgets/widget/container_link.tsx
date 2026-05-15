import type { ReactNode } from "react";

import { getAllClasses, getBottomBlock, getInnerBlock } from "./container";
import type { WidgetContainerOptions } from "./container";

interface ContainerLinkProps {
  additionalClassNames?: string;
  children?: ReactNode;
  options: WidgetContainerOptions;
  target?: string;
}

export default function ContainerLink({ children = [], options, additionalClassNames = "", target }: ContainerLinkProps) {
  return (
    <a
      href={options.href || options.url}
      target={target}
      className={`${getAllClasses(options, additionalClassNames)} information-widget-link`}
    >
      {getInnerBlock(children)}
      {getBottomBlock(children)}
    </a>
  );
}
