import { useEffect, useState } from "react";
import { loadPublicSiteCopy } from "@/lib/site-copy/api";
import { DEFAULT_HERO_COPY, heroFromSiteCopy, type HeroCopy } from "@/lib/site-copy/hero-copy";

let cache: HeroCopy | null = null;
let inflight: Promise<HeroCopy> | null = null;

function loadHeroCopy(): Promise<HeroCopy> {
  if (!inflight) {
    inflight = loadPublicSiteCopy()
      .then((site) => {
        cache = heroFromSiteCopy(site);
        return cache;
      })
      .catch(() => {
        inflight = null;
        return cache ?? DEFAULT_HERO_COPY;
      });
  }
  return inflight;
}

export function useHeroCopy(): HeroCopy {
  const [copy, setCopy] = useState<HeroCopy>(cache ?? DEFAULT_HERO_COPY);
  useEffect(() => {
    let live = true;
    void loadHeroCopy().then((next) => {
      if (live) setCopy(next);
    });
    return () => {
      live = false;
    };
  }, []);
  return copy;
}
