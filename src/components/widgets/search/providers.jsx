import { BiLogoBing } from "react-icons/bi";
import { FiSearch } from "react-icons/fi";
import { SiBaidu, SiBrave, SiDuckduckgo, SiGoogle } from "react-icons/si";

export const searchProviders = {
  google: {
    name: "Google",
    url: "https://www.google.com/search?q=",
    suggestionUrl: "https://www.google.com/complete/search?client=chrome&q=",
    icon: SiGoogle,
  },
  duckduckgo: {
    name: "DuckDuckGo",
    url: "https://duckduckgo.com/?q=",
    suggestionUrl: "https://duckduckgo.com/ac/?type=list&q=",
    icon: SiDuckduckgo,
  },
  bing: {
    name: "Bing",
    url: "https://www.bing.com/search?q=",
    suggestionUrl: "https://api.bing.com/osjson.aspx?query=",
    icon: BiLogoBing,
  },
  baidu: {
    name: "Baidu",
    url: "https://www.baidu.com/s?wd=",
    suggestionUrl: "http://suggestion.baidu.com/su?&action=opensearch&ie=utf-8&wd=",
    icon: SiBaidu,
  },
  brave: {
    name: "Brave",
    url: "https://search.brave.com/search?q=",
    suggestionUrl: "https://search.brave.com/api/suggest?&rich=false&q=",
    icon: SiBrave,
  },
  custom: {
    name: "Custom",
    url: false,
    icon: FiSearch,
  },
};

const localStorageKey = "search-name";

export function getStoredProvider() {
  if (typeof window !== "undefined") {
    const storedName = localStorage.getItem(localStorageKey);
    if (storedName) {
      return Object.values(searchProviders).find((el) => el.name === storedName);
    }
  }
  return null;
}

export function storeProvider(provider) {
  localStorage.setItem(localStorageKey, provider.name);
}
