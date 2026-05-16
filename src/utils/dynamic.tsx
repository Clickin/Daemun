import { lazy, Suspense } from "react";
import type { ComponentType } from "react";

type DynamicModule<P extends object> = { default: ComponentType<P> } | ComponentType<P>;
export type DynamicLoader<P extends object = Record<string, unknown>> = () => Promise<DynamicModule<P>>;

export interface DynamicOptions {
  ssr?: boolean;
}

const dynamicComponentCache = new WeakMap<DynamicLoader<object>, ComponentType<object>>();

function hasDefault<P extends object>(module: DynamicModule<P>): module is { default: ComponentType<P> } {
  return typeof module === "object" && module !== null && "default" in module;
}

export default function dynamic<P extends object = Record<string, unknown>>(
  loader: DynamicLoader<P>,
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

export function cachedDynamic<P extends object = Record<string, unknown>>(
  loader: DynamicLoader<P>,
  options?: DynamicOptions,
) {
  const cacheKey = loader as DynamicLoader<object>;
  const cached = dynamicComponentCache.get(cacheKey);
  if (cached) return cached as ComponentType<P>;

  const component = dynamic(loader, options);
  dynamicComponentCache.set(cacheKey, component as ComponentType<object>);
  return component;
}
