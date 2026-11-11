import { getRouteApi } from "@tanstack/react-router";
import { heroFromSiteCopy, type HeroCopy } from "@/lib/site-copy/hero-copy";

const rootRoute = getRouteApi("__root__");

/** The saved homepage, already loaded with the page. */
export function useHeroCopy(): HeroCopy {
  return heroFromSiteCopy(rootRoute.useLoaderData().site);
}
