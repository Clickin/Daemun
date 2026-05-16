import clsx from "clsx";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FiSearch } from "react-icons/fi";
import { useApiQuery } from "utils/query/api-query";
import { SettingsContext } from "utils/contexts/settings";
import type { QuickLaunchSettings } from "../types";

import ResolvedIcon from "./resolvedicon";
import { getStoredProvider, searchProviders } from "./widgets/search/providers";

const MOBILE_BUTTON_POSITIONS = {
  "top-left": "top-4 left-4",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-right": "bottom-4 right-4",
};

interface QuickLaunchItem {
  abbr?: ReactNode;
  app?: string;
  container?: string;
  description?: string;
  href: string;
  icon?: string;
  name: string;
  priority?: number;
  target?: string;
  type?: string;
}

type SearchProvider = QuickLaunchSettings & {
  name?: string;
  provider?: string | string[];
  showSearchSuggestions?: boolean;
  suggestionUrl?: string;
  url: string;
};

interface SearchWidget {
  options?: SearchProvider;
  type?: string;
}

interface QuickLaunchProps {
  servicesAndBookmarks: QuickLaunchItem[];
  searchString: string;
  setSearchString: (value: string) => void;
  isOpen: boolean;
  setSearching: (value: boolean) => void;
}

type SearchSuggestions = [string, string[]] | [];

const providerMap = searchProviders as unknown as Record<string, SearchProvider | undefined>;

function isProviderKey(provider: string): provider is keyof typeof searchProviders {
  return provider in searchProviders;
}

export default function QuickLaunch({
  servicesAndBookmarks,
  searchString,
  setSearchString,
  isOpen,
  setSearching,
}: QuickLaunchProps) {
  const { t } = useTranslation();

  const { settings } = useContext(SettingsContext);
  const quicklaunch = settings.quicklaunch ?? {};
  const { searchDescriptions = false, hideVisitURL = false } = quicklaunch;

  const searchField = useRef<HTMLInputElement>(null);

  const [results, setResults] = useState<QuickLaunchItem[]>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [url, setUrl] = useState<URL | null>(null);
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestions>([]);

  const { data: widgets } = useApiQuery("/api/widgets", { immutable: true });
  const widgetList = Object.values((widgets ?? {}) as Record<string, SearchWidget>);
  const searchWidget = widgetList.find((w) => w.type === "search");

  let searchProvider: SearchProvider | undefined | null;

  if (quicklaunch.provider === "custom" && quicklaunch.url && quicklaunch.url.length > 0) {
    searchProvider = quicklaunch as SearchProvider;
  } else if (quicklaunch.provider && quicklaunch.provider !== "custom" && isProviderKey(quicklaunch.provider)) {
    searchProvider = providerMap[quicklaunch.provider];
  } else if (searchWidget) {
    // If there is no search provider in quick launch settings, try to get it from the search widget
    if (Array.isArray(searchWidget.options?.provider)) {
      // If search provider is a list, try to retrieve from localstorage, fall back to the first
      const providerName = searchWidget.options.provider[0];
      searchProvider =
        (getStoredProvider() as SearchProvider | null) ?? (providerName ? providerMap[providerName] : undefined);
    } else if (searchWidget.options?.provider === "custom") {
      searchProvider = searchWidget.options;
    } else if (typeof searchWidget.options?.provider === "string") {
      searchProvider = providerMap[searchWidget.options.provider];
    }
  }

  if (searchProvider) {
    searchProvider.showSearchSuggestions = !!(
      quicklaunch.showSearchSuggestions ??
      searchWidget?.options?.showSearchSuggestions ??
      false
    );
  }

  const mobileButtonPosition =
    quicklaunch.mobileButtonPosition && quicklaunch.mobileButtonPosition in MOBILE_BUTTON_POSITIONS
      ? MOBILE_BUTTON_POSITIONS[quicklaunch.mobileButtonPosition as keyof typeof MOBILE_BUTTON_POSITIONS]
      : null;

  function openCurrentItem(newWindow: boolean) {
    const result = currentItemIndex === null ? undefined : results[currentItemIndex];
    if (!result) return;
    window.open(
      result.href,
      newWindow ? "_blank" : (result.target ?? searchProvider?.target ?? settings.target ?? "_blank"),
      "noreferrer",
    );
  }

  const closeAndReset = useCallback(() => {
    setSearching(false);
    setTimeout(() => {
      setSearchString("");
      setCurrentItemIndex(null);
      setSearchSuggestions([]);
    }, 200); // delay a little for animations
  }, [setSearching, setSearchString, setCurrentItemIndex, setSearchSuggestions]);

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const rawSearchString = event.target.value;
    try {
      if (!/.+[.:].+/g.test(rawSearchString)) throw new Error(); // basic test for probably a url
      let urlString = rawSearchString;
      if (urlString.toLowerCase().indexOf("http") !== 0) urlString = `https://${rawSearchString}`;
      setUrl(new URL(urlString)); // basic validation
      setSearchString(rawSearchString);
      return;
    } catch {
      setUrl(null);
    }
    setSearchString(rawSearchString.toLowerCase());
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;

    const selectedIndex = currentItemIndex ?? 0;
    if (event.key === "Escape") {
      closeAndReset();
      event.preventDefault();
    } else if (event.key === "Enter" && results.length) {
      closeAndReset();
      openCurrentItem(event.metaKey);
    } else if (event.key === "ArrowDown" && results[selectedIndex + 1]) {
      setCurrentItemIndex(selectedIndex + 1);
      event.preventDefault();
    } else if (event.key === "ArrowUp" && selectedIndex > 0) {
      setCurrentItemIndex(selectedIndex - 1);
      event.preventDefault();
    } else if (
      event.key === "ArrowRight" &&
      results[selectedIndex] &&
      results[selectedIndex].type === "searchSuggestion"
    ) {
      setSearchString(results[selectedIndex].name);
    }
  }

  function handleItemHover(event: ReactMouseEvent<HTMLButtonElement>) {
    setCurrentItemIndex(parseInt(event.currentTarget.dataset.index ?? "0", 10));
  }

  function handleItemClick(event: ReactMouseEvent<HTMLButtonElement>) {
    closeAndReset();
    openCurrentItem(event.metaKey);
  }

  function handleItemKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!isOpen) return;

    // native button handles other keys
    if (event.key === "Escape") {
      closeAndReset();
      event.preventDefault();
    }
  }

  useEffect(() => {
    const abortController = new AbortController();

    if (searchString.trim().length === 0) setResults([]);
    else {
      let newResults = servicesAndBookmarks.filter((r) => {
        const nameMatch = r.name.toLowerCase().includes(searchString);
        let descriptionMatch;
        if (searchDescriptions) {
          descriptionMatch = r.description?.toLowerCase().includes(searchString);
          r.priority = nameMatch ? 2 * +nameMatch : +descriptionMatch; // oxlint-disable-line no-param-reassign
        }
        return nameMatch || descriptionMatch;
      });

      if (searchDescriptions) {
        newResults = newResults.sort((a, b) => b.priority - a.priority);
      }

      if (searchProvider) {
        newResults.push({
          href: searchProvider.url + encodeURIComponent(searchString),
          name: `${searchProvider.name ?? t("quicklaunch.custom")} ${t("quicklaunch.search")}`,
          type: "search",
        });

        if (searchProvider.showSearchSuggestions && searchProvider.suggestionUrl) {
          if (searchString.trim() !== searchSuggestions[0]?.trim()) {
            fetch(
              `/api/search/searchSuggestion?query=${encodeURIComponent(searchString)}&providerName=${
                searchProvider.name ?? "Custom"
              }`,
              { signal: abortController.signal },
            )
              .then(async (searchSuggestionResult) => {
                const newSearchSuggestions: unknown = await searchSuggestionResult.json();

                if (Array.isArray(newSearchSuggestions) && Array.isArray(newSearchSuggestions[1])) {
                  setSearchSuggestions([
                    String(newSearchSuggestions[0] ?? ""),
                    newSearchSuggestions[1].map((suggestion) => String(suggestion)).slice(0, 4),
                  ]);
                }
              })
              .catch(() => {
                // If there is an error, just ignore it. There just will be no search suggestions.
              });
          }

          if (searchSuggestions[1]) {
            newResults = newResults.concat(
              searchSuggestions[1].map((suggestion) => ({
                href: searchProvider.url + encodeURIComponent(suggestion),
                name: suggestion,
                type: "searchSuggestion",
              })),
            );
          }
        }
      }

      if (!hideVisitURL && url) {
        newResults.unshift({
          href: url.toString(),
          name: `${t("quicklaunch.visit")} URL`,
          type: "url",
        });
      }

      setResults(newResults);

      if (newResults.length) {
        setCurrentItemIndex(0);
      }
    }

    return () => {
      abortController.abort();
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [searchString, servicesAndBookmarks, searchDescriptions, hideVisitURL, searchSuggestions, searchProvider, url]);

  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    function handleBackdropClick(event: globalThis.MouseEvent) {
      if (event.target instanceof HTMLElement && event.target.tagName === "DIV") closeAndReset();
    }

    if (isOpen) {
      searchField.current?.focus();
      document.body.addEventListener("click", handleBackdropClick);
      setHidden(false);
    } else {
      document.body.removeEventListener("click", handleBackdropClick);
      searchField.current?.blur();
      setTimeout(() => {
        setHidden(true);
      }, 300); // disable on close
    }
  }, [isOpen, closeAndReset]);

  function highlightText(text: string) {
    const parts = text.split(new RegExp(`(${searchString})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === searchString.toLowerCase() ? (
            // oxlint-disable-next-line react/no-array-index-key
            <span key={`${searchString}_${i}`} className="bg-theme-300/10">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </span>
    );
  }

  return (
    <>
      <div
        className={clsx(
          "relative z-40 ease-in-out duration-300 transition-opacity",
          hidden && !isOpen && "hidden",
          !hidden && isOpen && "opacity-100",
          !isOpen && "opacity-0",
        )}
      >
        <div className="fixed inset-0 bg-gray-500 opacity-50" />
        <div className="fixed inset-0 z-20 overflow-y-auto">
          <div className="flex min-h-full min-w-full items-start justify-center text-center">
            <dialog
              open
              aria-modal="true"
              className="mt-[10%] mx-auto min-w-[90%] max-w-[90%] md:min-w-[40%] md:max-w-[40%] rounded-md p-0 block font-medium text-theme-700 dark:text-theme-200 dark:hover:text-theme-300 shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-50 dark:bg-theme-800"
            >
              <input
                name="daemun-quicklaunch"
                placeholder="Search"
                className={clsx(
                  results.length > 0 && "rounded-t-md",
                  results.length === 0 && "rounded-md",
                  "w-full p-4 m-0 border-0 border-b border-slate-700 focus:border-slate-700 focus:outline-0 focus:ring-0 text-sm md:text-xl text-theme-700 dark:text-theme-200 bg-theme-60 dark:bg-theme-800",
                )}
                type="text"
                autoCorrect="false"
                ref={searchField}
                value={searchString}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
              />
              {results.length > 0 && (
                <ul className="max-h-[60vh] overflow-y-auto m-2">
                  {results.map((r, i) => (
                    <li key={[r.name, r.container, r.app, r.href].filter((s) => s).join("-")}>
                      <button
                        type="button"
                        data-index={i}
                        onMouseEnter={handleItemHover}
                        onClick={handleItemClick}
                        onKeyDown={handleItemKeyDown}
                        className={clsx(
                          "flex flex-row w-full items-center justify-between rounded-md text-sm md:text-xl py-2 px-4 cursor-pointer text-theme-700 dark:text-theme-200",
                          i === currentItemIndex && "bg-theme-300/50 dark:bg-theme-700/50",
                        )}
                      >
                        <div className="flex flex-row items-center mr-4 pointer-events-none">
                          {(r.icon || r.abbr) && (
                            <div className="w-5 text-xs mr-4">
                              {r.icon && <ResolvedIcon icon={r.icon} />}
                              {r.abbr}
                            </div>
                          )}
                          <div className="flex flex-col md:flex-row text-left items-baseline mr-4 pointer-events-none">
                            {r.type !== "searchSuggestion" && <span className="mr-4">{r.name}</span>}
                            {r.type === "searchSuggestion" && (
                              <div className="flex-nowrap">
                                <span className="whitespace-pre">
                                  {r.name.indexOf(searchString) === 0 ? searchString : ""}
                                </span>
                                <span className="whitespace-pre opacity-50">
                                  {r.name.indexOf(searchString) === 0 ? r.name.substring(searchString.length) : r.name}
                                </span>
                              </div>
                            )}
                            {r.description && (
                              <span className="text-xs text-theme-600 text-light">
                                {searchDescriptions && r.priority < 2 ? highlightText(r.description) : r.description}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-theme-600 font-bold pointer-events-none">
                          {t(`quicklaunch.${r.type?.toLowerCase() ?? "bookmark"}`)}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </dialog>
          </div>
        </div>
      </div>
      {mobileButtonPosition && (
        <button
          type="button"
          onClick={setSearching.bind(this, !isOpen)}
          className={`fixed ${mobileButtonPosition} z-40 p-2 rounded-full sm:hidden text-theme-700 dark:text-theme-200 bg-theme-50 dark:bg-theme-800 shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 transition-opacity duration-100`}
          style={{ opacity: isOpen ? 0 : 1 }}
        >
          <FiSearch className="w-4 h-4" />
        </button>
      )}
    </>
  );
}
