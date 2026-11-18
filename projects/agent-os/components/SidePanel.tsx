"use client";

import { useEffect, useRef } from "react";
import { useUi, type PanelTab } from "@/hooks/UiContext";
import { FeedPanel } from "./FeedPanel";
import { IconClose } from "./Icons";
import { Inspector } from "./Inspector";
import { STR } from "@/lib/client/strings";

/** Painel direito (desktop): separadores Inspetor / Feed. */
export function SidePanel() {
  const { panelTab, setPanelTab } = useUi();
  const tabs: PanelTab[] = ["inspector", "feed"];
  return (
    <aside aria-label={STR.panel.label} className="flex w-[300px] shrink-0 flex-col border-l border-line lg:w-[380px]">
      <div role="tablist" aria-label={STR.panel.label} className="flex shrink-0 gap-1 border-b border-line px-3 py-2">
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={panelTab === t} aria-controls={`panel-${t}`} className="tab" onClick={() => setPanelTab(t)}>
            {STR.panel[t]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${panelTab}`} aria-labelledby={`tab-${panelTab}`} className="min-h-0 flex-1">
        {panelTab === "inspector" ? <Inspector /> : <FeedPanel />}
      </div>
    </aside>
  );
}

/** Folha inferior (telemóvel) com o Inspetor. */
export function BottomSheet() {
  const { sheetOpen, setSheetOpen } = useUi();
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sheetOpen) return;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheetOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen, setSheetOpen]);

  if (!sheetOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={() => setSheetOpen(false)} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={STR.panel.inspector} className="sheet relative flex h-[72dvh] flex-col rounded-t-2xl border-t border-line-strong bg-bg pb-[env(safe-area-inset-bottom)]">
        <div className="flex shrink-0 items-center border-b border-line pl-5 pr-2">
          <h2 className="text-sm font-semibold text-ink-soft">{STR.panel.inspector}</h2>
          <button ref={close} type="button" className="icon-btn ml-auto" aria-label={STR.inspector.close} onClick={() => setSheetOpen(false)}>
            <IconClose />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <Inspector />
        </div>
      </div>
    </div>
  );
}
