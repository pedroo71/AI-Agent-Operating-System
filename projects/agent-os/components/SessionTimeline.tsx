"use client";

import { useMemo } from "react";
import { useAgentOs } from "@/hooks/AgentOsContext";
import { useTeam } from "@/hooks/TeamContext";
import { useUi } from "@/hooks/UiContext";
import { toneFor } from "@/lib/client/agentColors";
import { formatHM } from "@/lib/client/format";
import { STR } from "@/lib/client/strings";

const MIN = 60_000;
const MAX_BINS = 240;

interface Run {
  from: number;
  to: number;
  count: number;
  firstTs: number;
}

/** Linha do tempo da sessão (desktop): uma pista por agente, blocos onde houve eventos (bins de 1 min). */
export function SessionTimeline() {
  const { session, events, selectAgent } = useAgentOs();
  const { nodes, nodeOf, now, selectedNode } = useTeam();
  const { focusAt, reveal } = useUi();

  const endMin = now ? Math.ceil(now / MIN) * MIN : 0;
  const first = events.length ? new Date(events[0].ts).getTime() : 0;
  const start = session ? Math.min(new Date(session.startedAt).getTime() || first || endMin, first || Infinity) : first;

  const model = useMemo(() => {
    if (!endMin || !start || start >= endMin) return null;
    const span = endMin - start;
    const bin = Math.max(MIN, Math.ceil(span / MAX_BINS / MIN) * MIN);
    const total = Math.ceil(span / bin);
    const lanes = new Map<string, Map<number, { count: number; firstTs: number }>>();
    for (const e of events) {
      const n = nodeOf(e.agentId);
      if (!n) continue;
      const ts = new Date(e.ts).getTime();
      const idx = Math.min(total - 1, Math.max(0, Math.floor((ts - start) / bin)));
      let lane = lanes.get(n.key);
      if (!lane) lanes.set(n.key, (lane = new Map()));
      const cell = lane.get(idx);
      if (cell) cell.count++;
      else lane.set(idx, { count: 1, firstTs: ts });
    }
    const runs = new Map<string, Run[]>();
    for (const [key, lane] of lanes) {
      const idxs = [...lane.keys()].sort((a, b) => a - b);
      const out: Run[] = [];
      for (const i of idxs) {
        const c = lane.get(i)!;
        const last = out[out.length - 1];
        if (last && i === last.to + 1) {
          last.to = i;
          last.count += c.count;
        } else out.push({ from: i, to: i, count: c.count, firstTs: c.firstTs });
      }
      runs.set(key, out);
    }
    return { bin, total, runs };
  }, [events, nodeOf, start, endMin]);

  return (
    <section aria-label={STR.sessionTimeline.title} className="shrink-0 border-t border-line px-6 py-3.5">
      <div className="mb-2.5 flex justify-between text-xs text-mute">
        <h2 className="font-normal">{STR.sessionTimeline.title}</h2>
        <span className="mono">
          {start ? formatHM(start) : "--:--"} → {STR.sessionTimeline.now}
        </span>
      </div>
      <div className="grid items-center gap-y-1.5 text-xs" style={{ gridTemplateColumns: "110px 1fr" }}>
        {nodes.map((n) => {
          const tone = toneFor(n.name, n.rep.agentType);
          const runs = model?.runs.get(n.key) ?? [];
          return (
            <div key={n.key} className="contents" data-lane={n.name}>
              <span className="truncate pr-2" style={{ color: tone.color }}>
                {n.name}
              </span>
              <div className="relative h-6 rounded-md bg-[#17171f]">
                {model &&
                  runs.map((r) => {
                    const left = (r.from / model.total) * 100;
                    const width = ((r.to - r.from + 1) / model.total) * 100;
                    const t0 = start + r.from * model.bin;
                    const t1 = start + (r.to + 1) * model.bin;
                    return (
                      <button
                        key={r.from}
                        type="button"
                        aria-label={`${n.name}, ${formatHM(t0)} – ${formatHM(t1)}, ${r.count} ${STR.sessionTimeline.block}`}
                        title={`${formatHM(t0)} – ${formatHM(t1)} · ${r.count}`}
                        data-block={n.name}
                        onClick={() => {
                          selectAgent(n.rep.id);
                          focusAt(r.firstTs);
                          reveal();
                        }}
                        className="absolute inset-y-0 min-w-3 cursor-pointer rounded-[4px] border-0 p-0 hover:brightness-125"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          background: tone.color,
                          outline: selectedNode?.key === n.key ? "1px solid var(--color-accent)" : undefined,
                        }}
                      />
                    );
                  })}
                <span className="pointer-events-none absolute inset-y-0 right-0 w-px bg-accent/70" aria-hidden="true" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
