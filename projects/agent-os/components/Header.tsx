"use client";

import { useAgentOs } from "@/hooks/AgentOsContext";
import { useTeam } from "@/hooks/TeamContext";
import { useUi } from "@/hooks/UiContext";
import { SessionPicker } from "./SessionPicker";
import { formatClock, relativeTime } from "@/lib/client/format";
import { STR } from "@/lib/client/strings";

export function Header() {
  const { live, error, session, events } = useAgentOs();
  const { now } = useTeam();
  const { isDesktop } = useUi();

  const down = live === "disconnected" && !!error;
  const liveLabel = down ? STR.serverDown : live === "live" ? STR.live : live === "connecting" ? STR.connecting : STR.disconnected;
  const liveTitle = down ? STR.liveTitle.serverDown : STR.liveTitle[live];
  const lastTs = events.length ? events[events.length - 1].ts : session?.lastEventAt;
  const latency = live === "live" && lastTs && now ? relativeTime(lastTs, now) : "";

  return (
    <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-line px-4 py-2 md:gap-4 md:px-6">
      <div className="text-base font-bold">{STR.appName}</div>
      <div className="min-w-0 flex-1 truncate text-[13px] text-mute">{session?.title ? <>/ {session.title}</> : null}</div>
      <div className="live shrink-0" data-state={down ? "disconnected" : live} role="status" title={liveTitle}>
        <span className="live-dot" aria-hidden="true" />
        <span>{liveLabel}</span>
        {latency && isDesktop ? (
          <span className="text-mute">
            · {STR.lastEvent} {latency}
          </span>
        ) : null}
      </div>
      {isDesktop && (
        <div className="mono shrink-0 text-[13px] text-ink-soft" aria-label={STR.clock}>
          <time suppressHydrationWarning>{now ? formatClock(new Date(now)) : "--:--:--"}</time>
        </div>
      )}
      {!isDesktop && <SessionPicker placement="header" />}
    </header>
  );
}
