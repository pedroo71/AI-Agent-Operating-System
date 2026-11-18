"use client";

import { useSyncExternalStore } from "react";

/** Devolve null no servidor/antes de hidratar, depois true/false. */
export function useMediaQuery(query: string): boolean | null {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}
