import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  outDir: "../dist-docs",
  publicDir: "../public",
  site: "https://clickin.github.io/Daemun/",
  srcDir: ".",
  integrations: [
    starlight({
      title: "Daemun",
      description: "A compact Hono and Vite dashboard for self-hosted services.",
      disable404Route: true,
      editLink: {
        baseUrl: "https://github.com/Clickin/Daemun/edit/main/docs-site/content/docs/",
      },
      favicon: "/daemun.ico",
      logo: {
        src: "../public/android-chrome-192x192.png",
      },
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
      ],
    }),
  ],
});
