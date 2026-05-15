import type { MouseEventHandler, ReactNode } from "react";

import { getAllClasses, getBottomBlock, getInnerBlock } from "./container";
import type { WidgetContainerOptions } from "./container";

interface ContainerButtonProps {
  additionalClassNames?: string;
  callback?: MouseEventHandler<HTMLButtonElement>;
  children?: ReactNode;
  options?: WidgetContainerOptions;
}

export default function ContainerButton({ children = [], options, additionalClassNames = "", callback }: ContainerButtonProps) {
  return (
    <button
      type="button"
      onClick={callback}
      className={`${getAllClasses(options, additionalClassNames)} information-widget-container-button`}
    >
      {getInnerBlock(children)}
      {getBottomBlock(children)}
    </button>
  );
}
