interface SearchProviderData {
  name: string;
  suggestionUrl?: string;
  url: string | false;
}

export const searchProviderData: Record<string, SearchProviderData> = {
  google: {
    name: "Google",
    url: "https://www.google.com/search?q=",
    suggestionUrl: "https://www.google.com/complete/search?client=chrome&q=",
  },
  duckduckgo: {
    name: "DuckDuckGo",
    url: "https://duckduckgo.com/?q=",
    suggestionUrl: "https://duckduckgo.com/ac/?type=list&q=",
  },
  bing: {
    name: "Bing",
    url: "https://www.bing.com/search?q=",
    suggestionUrl: "https://api.bing.com/osjson.aspx?query=",
  },
  baidu: {
    name: "Baidu",
    url: "https://www.baidu.com/s?wd=",
    suggestionUrl: "http://suggestion.baidu.com/su?&action=opensearch&ie=utf-8&wd=",
  },
  brave: {
    name: "Brave",
    url: "https://search.brave.com/search?q=",
    suggestionUrl: "https://search.brave.com/api/suggest?&rich=false&q=",
  },
  custom: {
    name: "Custom",
    url: false,
  },
};
