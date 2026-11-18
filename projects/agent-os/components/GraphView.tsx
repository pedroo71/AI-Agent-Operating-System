"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTeam } from "@/hooks/TeamContext";
import { IconMinus, IconPlus, IconReset } from "./Icons";
import { toneFor } from "@/lib/client/agentColors";
import { statusOf } from "@/lib/client/format";
import { EDGE_ACTIVE_MS, type TeamNode } from "@/lib/client/team";
import { STR } from "@/lib/client/strings";

interface Pt {
  x: number;
  y: number;
}
interface View {
  x: number;
  y: number;
  z: number;
}

const MIN_Z = 0.4;
const MAX_Z = 2;
const NODE_W = 200;
const NODE_W_SMALL = 168;
const storageKey = (sid: string) => `agent-os:graph:${sid}`;

function loadPositions(sid: string): Record<string, Pt> {
  try {
    const raw = localStorage.getItem(storageKey(sid));
    return raw ? (JSON.parse(raw) as Record<string, Pt>) : {};
  } catch {
    return {};
  }
}
function savePositions(sid: string, pos: Record<string, Pt>) {
  try {
    localStorage.setItem(storageKey(sid), JSON.stringify(pos));
  } catch {
    /* sem armazenamento */
  }
}

interface Props {
  sessionId: string;
  selectedKey?: string;
  onPick: (node: TeamNode) => void;
}

export function GraphView({ sessionId, selectedKey, onPick }: Props) {
  const { nodes, edges, now } = useTeam();
  const box = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [pos, setPos] = useState<Record<string, Pt>>({});
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 });
  const posRef = useRef(pos);
  posRef.current = pos;
  const viewRef = useRef(view);
  viewRef.current = view;
  const [baseZ, setBaseZ] = useState(1);
  const viewInit = useRef(false);

  // Mede o contentor.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Posições guardadas por sessão.
  useEffect(() => {
    setPos(loadPositions(sessionId));
  }, [sessionId]);

  // Zoom inicial menor em ecrãs estreitos.
  useEffect(() => {
    if (viewInit.current || size.w === 0) return;
    viewInit.current = true;
    if (size.w < 560) {
      setBaseZ(0.65);
      setView({ x: 0, y: 0, z: 0.65 });
    }
  }, [size.w]);

  // Disposição por omissão: núcleo ao centro, restantes numa elipse.
  const defaults = useMemo(() => {
    const out: Record<string, Pt> = {};
    const z = baseZ;
    const cx = size.w / 2 / z;
    const cy = size.h / 2 / z;
    const rx = Math.max(60, Math.min((size.w / z) * 0.36, size.w / z / 2 - (size.w < 560 ? NODE_W_SMALL : NODE_W) / 2 - 8));
    const ry = Math.max(90, (size.h / z) * 0.28);
    const others = nodes.filter((n) => !n.isCore);
    nodes.forEach((n) => {
      if (n.isCore) out[n.key] = { x: cx, y: cy };
    });
    others.forEach((n, i) => {
      const a = -Math.PI / 2 + (i / Math.max(others.length, 1)) * Math.PI * 2;
      out[n.key] = { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
    });
    return out;
  }, [nodes, size.w, size.h, baseZ]);

  const at = useCallback((key: string): Pt => posRef.current[key] ?? defaults[key] ?? { x: 0, y: 0 }, [defaults]);

  // Roda do rato: zoom em torno do cursor (listener não passivo para impedir o scroll).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function zoomAt(factor: number, px: number, py: number) {
    setView((v) => {
      const z = Math.min(MAX_Z, Math.max(MIN_Z, v.z * factor));
      const k = z / v.z;
      return { z, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
    });
  }
  const zoomButton = (f: number) => zoomAt(f, size.w / 2, size.h / 2);
  const reset = () => {
    setPos({});
    savePositions(sessionId, {});
    setView({ x: 0, y: 0, z: size.w < 560 ? 0.65 : 1 });
  };

  // ---- Arrastar nós e fundo ----
  const drag = useRef<{ key: string; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const pan = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const suppress = useRef(false);

  const nodeDown = (e: React.PointerEvent<HTMLButtonElement>, key: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    suppress.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = at(key);
    drag.current = { key, sx: e.clientX, sy: e.clientY, ox: p.x, oy: p.y, moved: false };
  };
  const nodeMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    const z = viewRef.current.z;
    setPos((p) => ({ ...p, [d.key]: { x: d.ox + dx / z, y: d.oy + dy / z } }));
  };
  const nodeUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      suppress.current = true;
      savePositions(sessionId, { ...defaults, ...posRef.current });
    }
  };
  const nodeKey = (e: React.KeyboardEvent, key: string) => {
    const step = e.shiftKey ? 40 : 12;
    const d: Record<string, Pt> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const m = d[e.key];
    if (!m || !e.altKey) return; // Alt + setas move o nó; setas sozinhas ficam para o navegador.
    e.preventDefault();
    const p = at(key);
    const next = { ...posRef.current, [key]: { x: p.x + m.x, y: p.y + m.y } };
    setPos(next);
    savePositions(sessionId, { ...defaults, ...next });
  };

  const bgDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pan.current = { sx: e.clientX, sy: e.clientY, ox: viewRef.current.x, oy: viewRef.current.y };
  };
  const bgMove = (e: React.PointerEvent<HTMLElement>) => {
    const p = pan.current;
    if (!p) return;
    setView((v) => ({ ...v, x: p.ox + e.clientX - p.sx, y: p.oy + e.clientY - p.sy }));
  };
  const bgUp = () => {
    pan.current = null;
  };

  const nodeW = size.w < 560 ? NODE_W_SMALL : NODE_W;
  const ready = size.w > 0 && nodes.length > 0;

  return (
    <section
      ref={box}
      aria-label={STR.teamView.graphLabel}
      className="dot-bg relative h-full w-full touch-none select-none overflow-hidden"
      onPointerDown={bgDown}
      onPointerMove={bgMove}
      onPointerUp={bgUp}
      onPointerCancel={bgUp}
      data-view="graph"
    >
      {ready && (
        <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})` }}>
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width="1" height="1" aria-hidden="true">
            {edges.map((e) => {
              const p1 = at(e.a);
              const p2 = at(e.b);
              const on = now - e.arrivedAt < EDGE_ACTIVE_MS;
              return (
                <line
                  key={`${e.a}|${e.b}`}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={on ? "#c6f36b" : "#3a3a4c"}
                  strokeWidth={on ? 2 : 1}
                  className={on ? "edge-flow" : undefined}
                  data-edge={`${e.a}|${e.b}`}
                  data-active={on}
                />
              );
            })}
          </svg>

          {edges.map((e) => {
            if (now - e.arrivedAt >= EDGE_ACTIVE_MS || !e.text) return null;
            const p1 = at(e.a);
            const p2 = at(e.b);
            return (
              <div
                key={`b-${e.a}|${e.b}`}
                className="pointer-events-none absolute z-20 max-w-[240px] -translate-x-1/2 -translate-y-1/2 truncate rounded-lg border border-accent bg-[#1f2a12] px-2.5 py-1.5 text-xs text-[#e2fbb0]"
                style={{ left: (p1.x + p2.x) / 2, top: (p1.y + p2.y) / 2 }}
                data-testid="edge-bubble"
                aria-hidden="true"
              >
                “{e.text}”
              </div>
            );
          })}

          {nodes.map((n) => {
            const p = at(n.key);
            const tone = toneFor(n.name, n.rep.agentType);
            const status = statusOf(n.rep, now);
            const selected = n.key === selectedKey;
            const border = selected ? "var(--color-accent)" : status === "active" ? tone.color : "var(--color-line-strong)";
            return (
              <button
                key={n.key}
                type="button"
                onPointerDown={(e) => nodeDown(e, n.key)}
                onPointerMove={nodeMove}
                onPointerUp={nodeUp}
                onPointerCancel={nodeUp}
                onKeyDown={(e) => nodeKey(e, n.key)}
                onClick={() => {
                  if (suppress.current) {
                    suppress.current = false;
                    return;
                  }
                  onPick(n);
                }}
                aria-pressed={selected}
                aria-label={`${n.name}, ${STR.status[status]}. ${STR.teamView.node}`}
                data-agent={n.name}
                data-status={status}
                className={`absolute z-10 block -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-2xl p-3.5 text-left active:cursor-grabbing ${status === "active" ? "bg-surface" : "bg-surface-2"} ${selected || status === "active" ? "node-glow" : ""}`}
                style={{
                  left: p.x,
                  top: p.y,
                  width: nodeW,
                  border: `1px ${status === "finished" ? "dashed" : "solid"} ${border}`,
                  opacity: status === "finished" ? 0.7 : 1,
                  touchAction: "none",
                }}
              >
                <span className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: tone.color }} aria-hidden="true" />
                  <span className="truncate font-semibold text-ink">{n.name}</span>
                  <span className={`ml-auto shrink-0 text-[11px] ${nodeW < NODE_W ? "sr-only" : ""}`} style={{ color: status === "active" ? tone.color : "var(--color-mute)" }}>
                    {STR.status[status]}
                  </span>
                </span>
                <span className={`mono mt-2 block truncate text-[11px] ${status === "active" ? "text-[#b9b9c8]" : "text-mute"}`} title={n.rep.currentAction}>
                  {n.rep.currentAction ?? STR.noAction}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="absolute bottom-3 right-3 z-30 flex flex-col gap-1.5">
        <button type="button" className="icon-btn border border-line-strong bg-bg/85" aria-label={STR.teamView.zoomIn} onClick={() => zoomButton(1.25)} onPointerDown={(e) => e.stopPropagation()}>
          <IconPlus />
        </button>
        <button type="button" className="icon-btn border border-line-strong bg-bg/85" aria-label={STR.teamView.zoomOut} onClick={() => zoomButton(0.8)} onPointerDown={(e) => e.stopPropagation()}>
          <IconMinus />
        </button>
        <button type="button" className="icon-btn border border-line-strong bg-bg/85" aria-label={STR.teamView.reset} onClick={reset} onPointerDown={(e) => e.stopPropagation()}>
          <IconReset />
        </button>
      </div>
      <p className="pointer-events-none absolute bottom-4 left-4 z-30 max-w-[70%] text-xs text-mute">{STR.teamView.hint}</p>
    </section>
  );
}
