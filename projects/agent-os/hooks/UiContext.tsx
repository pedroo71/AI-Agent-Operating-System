"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type View = "team" | "feed" | "tasks" | "projects" | "memory";
export type PanelTab = "inspector" | "feed";

interface UiCtx {
  isDesktop: boolean;
  view: View;
  setView: (v: View) => void;
  panelTab: PanelTab;
  setPanelTab: (t: PanelTab) => void;
  sheetOpen: boolean;
  setSheetOpen: (o: boolean) => void;
  /** Momento para onde o Inspetor deve saltar (clique na linha do tempo). */
  focus: { ts: number; nonce: number } | null;
  focusAt: (ts: number) => void;
  /** Mostra o Inspetor: separador no desktop, folha inferior no telemóvel. */
  reveal: () => void;
}

const Ctx = createContext<UiCtx | null>(null);

export function UiProvider({ isDesktop, children }: { isDesktop: boolean; children: ReactNode }) {
  const [view, setView] = useState<View>("team");
  const [panelTab, setPanelTab] = useState<PanelTab>("inspector");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focus, setFocus] = useState<{ ts: number; nonce: number } | null>(null);

  const focusAt = useCallback((ts: number) => setFocus((f) => ({ ts, nonce: (f?.nonce ?? 0) + 1 })), []);
  const reveal = useCallback(() => {
    setPanelTab("inspector");
    setSheetOpen(true);
  }, []);

  // No desktop o Feed é um separador do painel, não uma vista.
  const effView: View = isDesktop && view === "feed" ? "team" : view;

  const value = useMemo<UiCtx>(
    () => ({ isDesktop, view: effView, setView, panelTab, setPanelTab, sheetOpen, setSheetOpen, focus, focusAt, reveal }),
    [isDesktop, effView, panelTab, sheetOpen, focus, focusAt, reveal],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUi(): UiCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUi fora de UiProvider");
  return c;
}
