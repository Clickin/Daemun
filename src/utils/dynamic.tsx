import { lazy, Suspense } from "react";
import type { ComponentType } from "react";

type DynamicModule<P extends object> = { default: ComponentType<P> } | ComponentType<P>;

interface DynamicOptions {
  ssr?: boolean;
}

function hasDefault<P extends object>(module: DynamicModule<P>): module is { default: ComponentType<P> } {
  return typeof module === "object" && module !== null && "default" in module;
}

export default function dynamic<P extends object = Record<string, unknown>>(
  loader: () => Promise<DynamicModule<P>>,
  _options?: DynamicOptions,
) {
  const LazyComponent = lazy(async () => {
    const module = await loader();
    return { default: hasDefault(module) ? module.default : module };
  });

  return function DynamicComponent(props: P) {
    return (
      <Suspense fallback={null}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}
