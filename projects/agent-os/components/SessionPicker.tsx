"use client";

import { useEffect, useRef, useState } from "react";
import { useAgentOs } from "@/hooks/AgentOsContext";
import { IconSessions } from "./Icons";
import { formatDateTime } from "@/lib/client/format";
import { STR } from "@/lib/client/strings";

/** Botão com menu de sessões. `placement`: "rail" abre à direita, "header" abre por baixo. */
export function SessionPicker({ placement }: { placement: "rail" | "header" }) {
  const { sessions, sessionId, pickSession } = useAgentOs();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pos = placement === "rail" ? "bottom-0 left-[calc(100%+8px)]" : "right-0 top-[calc(100%+8px)]";

  return (
    <div ref={wrap} className="relative">
      <button ref={btn} type="button" className="icon-btn" aria-label={STR.pickSession} title={STR.nav.sessions} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <IconSessions />
      </button>
      {open && (
        <div role="menu" aria-label={STR.pickSession} className={`absolute z-50 w-[min(340px,calc(100vw-24px))] rounded-xl border border-line-strong bg-surface shadow-2xl shadow-black/60 ${pos}`}>
          <p className="px-3 pb-1 pt-3 text-xs font-semibold text-ink-soft">{STR.pickSession}</p>
          {sessions.length === 0 ? (
            <p className="px-3 pb-3 text-xs text-mute">{STR.noSessionHint}</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto pb-1.5">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={s.id === sessionId}
                    className="menu-item"
                    onClick={() => {
                      pickSession(s.id);
                      setOpen(false);
                    }}
                  >
                    <span className="block truncate text-sm text-ink">{s.title || s.id}</span>
                    <span className="mono block truncate text-[11px] text-mute">
                      {formatDateTime(s.lastEventAt)} · {s.agentCount} {STR.agents}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
