import { pingIndexNow, SITEMAP_PAGES } from "../src/lib/seo/sitemap.ts";

await pingIndexNow(SITEMAP_PAGES.map((page) => page.path));
