import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  base: "/Daemun",
  outDir: "../dist-docs",
  publicDir: "../public",
  site: "https://clickin.github.io",
  srcDir: ".",
  integrations: [
    starlight({
      title: "Daemun",
      description: "A compact Hono and Vite dashboard for self-hosted services.",
      disable404Route: true,
      editLink: {
        baseUrl: "https://github.com/Clickin/Daemun/edit/main/docs-site/",
      },
      favicon: "/favicon.svg",
      logo: {
        src: "../public/daemun.svg",
      },
      pagefind: true,
      social: [
        {
          href: "https://github.com/Clickin/Daemun",
          icon: "github",
          label: "GitHub",
        },
      ],
      sidebar: [
        {
          label: "Guides",
          items: [
            { label: "Overview", link: "/" },
            { label: "Stack Migration", link: "/stack-migration/" },
          ],
        },
        {
          label: "Installation",
          items: [{ autogenerate: { directory: "installation" } }],
        },
        {
          label: "Configuration",
          items: [{ autogenerate: { directory: "configs", collapsed: true } }],
        },
        {
          label: "Widgets",
          items: [{ autogenerate: { directory: "widgets", collapsed: true } }],
        },
        {
          label: "Troubleshooting",
          items: [{ autogenerate: { directory: "troubleshooting" } }],
        },
        {
          label: "More",
          items: [{ autogenerate: { directory: "more", collapsed: true } }],
        },
      ],
    }),
  ],
});
