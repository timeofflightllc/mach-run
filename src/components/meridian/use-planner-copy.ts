import { useEffect, useState } from "react";
import { loadPublicSiteCopy } from "@/lib/site-copy/api";
import {
  DEFAULT_PLANNER_COPY,
  plannerFromSiteCopy,
  type PlannerCopy,
} from "@/lib/site-copy/planner-copy";

let cache: PlannerCopy | null = null;
let inflight: Promise<PlannerCopy> | null = null;

function loadPlannerCopy(): Promise<PlannerCopy> {
  if (!inflight) {
    inflight = loadPublicSiteCopy()
      .then((site) => {
        cache = plannerFromSiteCopy(site);
        return cache;
      })
      .catch(() => {
        inflight = null;
        return cache ?? DEFAULT_PLANNER_COPY;
      });
  }
  return inflight;
}

export function usePlannerCopy(): PlannerCopy {
  const [copy, setCopy] = useState<PlannerCopy>(cache ?? DEFAULT_PLANNER_COPY);
  useEffect(() => {
    let live = true;
    void loadPlannerCopy().then((next) => {
      if (live) setCopy(next);
    });
    return () => {
      live = false;
    };
  }, []);
  return copy;
}
