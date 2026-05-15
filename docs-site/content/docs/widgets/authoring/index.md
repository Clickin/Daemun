---
title: Guides & Tutorials
description: Learn how to create and customize Daemun-compatible widgets. Explore translations, widget components, widget metadata, proxy handlers, and making API calls.
icon: fontawesome/solid/graduation-cap
---

Widgets are a core component of Daemun. They are used to display information about your system, services, and environment.

## Overview

If you are new to Daemun widgets, and are looking to create a new widget, please follow along with the guide here: [Widget Tutorial](tutorial/).

### Translations

All text and numerical content in widgets should be translated and localized. English is the default language, and other locales are maintained directly in `public/locales`.

To learn more about translations, please refer to the guide here: [Translations Guide](translations/).

### Widget Component

The widget component is the core of the widget. It is responsible for [fetching data from the API](api/) and rendering the widget UI. Daemun keeps the inherited widget hooks and utilities for compatibility with upstream configuration.

To learn more about widget components, please refer to the guide here: [Component Guide](component/).

### Widget Metadata

Widget metadata defines the configuration of the widget. It defines the API endpoint to fetch data from, the proxy handler to use, and any data mappings.

To learn more about widget metadata, endpoint and data mapping, please refer to the guide here: [Metadata Guide](metadata/).

To learn more about proxy handlers, please refer to the guide here: [Proxies Guide](proxies/).

To learn more about making API calls from inside your widget, please refer to the guide here: [API Guide](api/).
