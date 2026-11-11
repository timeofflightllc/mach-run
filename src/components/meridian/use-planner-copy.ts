import { getRouteApi } from "@tanstack/react-router";
import { plannerFromSiteCopy, type PlannerCopy } from "@/lib/site-copy/planner-copy";

const rootRoute = getRouteApi("__root__");

/** The saved calculator instructions, already loaded with the page. */
export function usePlannerCopy(): PlannerCopy {
  return plannerFromSiteCopy(rootRoute.useLoaderData().site);
}
