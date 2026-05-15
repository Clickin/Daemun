---
title: Translations
description: Contributing Translations
---

Daemun keeps the inherited locale files under `public/locales`. English is the
source language for new UI strings, and translated strings are maintained
directly in the repository.

## Support Translations

Daemun does not currently run an external translation sync service. If you'd
like to improve an existing translation:

1. Update the matching file under `public/locales/<locale>/common.json`.
2. Keep keys aligned with `public/locales/en/common.json`.
3. Open a pull request with the locale and area changed in the description.

## Adding a new language

To add a new language, copy `public/locales/en/common.json` into a new locale
directory, translate the values, and include a short note about the locale code
you chose.
