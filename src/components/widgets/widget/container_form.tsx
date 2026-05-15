import type { FormEventHandler, ReactNode } from "react";

import { getAllClasses, getBottomBlock, getInnerBlock } from "./container";
import type { WidgetContainerOptions } from "./container";

interface ContainerFormProps {
  additionalClassNames?: string;
  callback?: FormEventHandler<HTMLFormElement>;
  children?: ReactNode;
  options?: WidgetContainerOptions;
}

export default function ContainerForm({ children = [], options, additionalClassNames = "", callback }: ContainerFormProps) {
  return (
    <form onSubmit={callback} className={`${getAllClasses(options, additionalClassNames)} information-widget-form`}>
      {getInnerBlock(children)}
      {getBottomBlock(children)}
    </form>
  );
}
