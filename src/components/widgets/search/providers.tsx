import { BiLogoBing } from "react-icons/bi";
import { FiSearch } from "react-icons/fi";
import { SiBaidu, SiBrave, SiDuckduckgo, SiGoogle } from "react-icons/si";

import { searchProviderData } from "utils/search/providers";

export const searchProviders = {
  google: {
    ...searchProviderData.google,
    icon: SiGoogle,
  },
  duckduckgo: {
    ...searchProviderData.duckduckgo,
    icon: SiDuckduckgo,
  },
  bing: {
    ...searchProviderData.bing,
    icon: BiLogoBing,
  },
  baidu: {
    ...searchProviderData.baidu,
    icon: SiBaidu,
  },
  brave: {
    ...searchProviderData.brave,
    icon: SiBrave,
  },
  custom: {
    ...searchProviderData.custom,
    icon: FiSearch,
  },
};

const localStorageKey = "search-name";

export function getStoredProvider() {
  if (typeof window !== "undefined") {
    const storedName = window.localStorage.getItem(localStorageKey);
    if (storedName) {
      return Object.values(searchProviders).find((el) => el.name === storedName);
    }
  }
  return null;
}

type SearchProvider = (typeof searchProviders)[keyof typeof searchProviders];

export function storeProvider(provider: SearchProvider) {
  window.localStorage.setItem(localStorageKey, provider.name);
}
