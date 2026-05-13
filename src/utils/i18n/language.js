const LANGUAGE_ALIASES = {
  "zh-cn": "zh-Hans",
};

export function normalizeLanguage(language) {
  if (!language) return "en";
  const alias = LANGUAGE_ALIASES[language.toLowerCase()];
  return alias || language;
}
