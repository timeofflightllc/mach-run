import { getRouteApi } from "@tanstack/react-router";
import { boydQuotesFromSiteCopy } from "@/lib/site-copy/boyd-quotes";

const rootRoute = getRouteApi("__root__");

/** The saved Boyd quotes, already loaded with the page. */
export function useBoydQuotes(): string[] {
  return boydQuotesFromSiteCopy(rootRoute.useLoaderData().site);
}
