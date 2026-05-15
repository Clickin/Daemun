import { isValidElement, type ReactNode } from "react";

interface RawProps {
  children?: ReactNode;
}

export default function Raw({ children }: RawProps) {
  if (isValidElement(children) && children.type === Raw) {
    return [children];
  }

  return children;
}
