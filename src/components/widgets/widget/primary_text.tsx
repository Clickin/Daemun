import type { ReactNode } from "react";

interface TextProps {
  children?: ReactNode;
}

export default function PrimaryText({ children }: TextProps) {
  return <span className="primary-text text-theme-800 dark:text-theme-200 text-sm">{children}</span>;
}
