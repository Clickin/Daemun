import type { ReactNode } from "react";

interface TextProps {
  children?: ReactNode;
}

export default function SecondaryText({ children }: TextProps) {
  return <span className="secondary-text text-theme-800 dark:text-theme-200 text-xs">{children}</span>;
}
