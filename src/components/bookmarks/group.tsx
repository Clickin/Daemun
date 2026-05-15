import { Disclosure, Transition } from "@headlessui/react";
import classNames from "classnames";
import List from "components/bookmarks/list";
import ErrorBoundary from "components/errorboundry";
import ResolvedIcon from "components/resolvedicon";
import { useEffect, useRef } from "react";
import { MdKeyboardArrowDown } from "react-icons/md";
import type { BookmarkGroupRecord, LayoutRecord } from "../../types";

interface BookmarksGroupProps {
  bookmarks: BookmarkGroupRecord;
  layout?: LayoutRecord;
  disableCollapse?: boolean;
  groupsInitiallyCollapsed?: boolean;
  bookmarksStyle?: string;
  maxGroupColumns?: number | string;
}

export default function BookmarksGroup({
  bookmarks,
  layout,
  disableCollapse = false,
  groupsInitiallyCollapsed = false,
  bookmarksStyle,
  maxGroupColumns,
}: BookmarksGroupProps) {
  const panel = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (layout?.initiallyCollapsed ?? groupsInitiallyCollapsed) {
      if (panel.current) panel.current.style.height = `0`;
    }
  }, [layout, groupsInitiallyCollapsed]);

  return (
    <div
      key={bookmarks.name}
      className={classNames(
        "bookmark-group flex-1 overflow-hidden",
        layout?.style === "row" ? "basis-full" : "basis-full md:basis-1/4 lg:basis-1/5 xl:basis-1/6",
        layout?.style !== "row" && maxGroupColumns && parseInt(String(maxGroupColumns), 10) > 6
          ? `3xl:basis-1/${maxGroupColumns}`
          : "",
        layout?.header === false ? "px-1" : "p-1 pb-0",
      )}
    >
      <Disclosure defaultOpen={!(layout?.initiallyCollapsed ?? groupsInitiallyCollapsed)}>
        {({ open }) => (
          <>
            {layout?.header !== false && (
              <Disclosure.Button disabled={disableCollapse} className="flex w-full select-none items-center group">
                {layout?.icon && (
                  <div className="shrink-0 mr-2 w-7 h-7 bookmark-group-icon">
                    <ResolvedIcon icon={layout.icon} />
                  </div>
                )}
                <h2 className="text-theme-800 dark:text-theme-300 text-xl font-medium bookmark-group-name">
                  {bookmarks.name}
                </h2>
                <MdKeyboardArrowDown
                  className={classNames(
                    disableCollapse ? "hidden" : "",
                    "transition-all opacity-0 group-hover:opacity-100 ml-auto text-theme-800 dark:text-theme-300 text-xl",
                    open ? "" : "rotate-180",
                  )}
                />
              </Disclosure.Button>
            )}
            <Transition
              as="div"
              // Otherwise the transition group does display: none and cancels animation
              className="block!"
              unmount={false}
              beforeLeave={() => {
                if (!panel.current) return;
                panel.current.style.height = `${panel.current.scrollHeight}px`;
                setTimeout(() => {
                  if (panel.current) panel.current.style.height = `0`;
                }, 1);
              }}
              beforeEnter={() => {
                if (!panel.current) return;
                panel.current.style.height = `0px`;
                setTimeout(() => {
                  if (panel.current) panel.current.style.height = `${panel.current.scrollHeight}px`;
                }, 1);
              }}
            >
              <Disclosure.Panel className="transition-all overflow-hidden duration-300 ease-out" ref={panel} static>
                <ErrorBoundary>
                  <List bookmarks={bookmarks.bookmarks} layout={layout} bookmarksStyle={bookmarksStyle} />
                </ErrorBoundary>
              </Disclosure.Panel>
            </Transition>
          </>
        )}
      </Disclosure>
    </div>
  );
}
