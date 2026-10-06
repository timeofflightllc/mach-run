import { useEffect, useState } from "react";
import { loadPublicSiteCopy } from "@/lib/site-copy/api";
import {
  boydQuotesFromSiteCopy,
  DEFAULT_BOYD_QUOTES,
} from "@/lib/site-copy/boyd-quotes";

let cache: string[] | null = null;
let inflight: Promise<string[]> | null = null;

function loadQuotes(): Promise<string[]> {
  if (!inflight) {
    inflight = loadPublicSiteCopy()
      .then((site) => {
        cache = boydQuotesFromSiteCopy(site);
        return cache;
      })
      .catch(() => {
        inflight = null;
        return cache ?? DEFAULT_BOYD_QUOTES;
      });
  }
  return inflight;
}

export function useBoydQuotes(): string[] {
  const [quotes, setQuotes] = useState<string[]>(cache ?? DEFAULT_BOYD_QUOTES);
  useEffect(() => {
    let live = true;
    void loadQuotes().then((next) => {
      if (live) setQuotes(next);
    });
    return () => {
      live = false;
    };
  }, []);
  return quotes;
}
