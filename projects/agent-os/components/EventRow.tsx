"use client";

import { memo } from "react";
import type { AgentEvent } from "@/lib/client/types";
import { toneFor } from "@/lib/client/agentColors";
import { formatTime } from "@/lib/client/format";
import { STR } from "@/lib/client/strings";

interface Props {
  event: AgentEvent;
  /** Nome e tipo do agente que gerou o evento (para a cor). */
  agentName?: string;
  agentType?: string;
  /** Mostra o nome do agente (Feed). No Inspetor já é implícito. */
  showAgent?: boolean;
  /** O evento mais recente da lista ganha a cor do agente na margem. */
  latest?: boolean;
  focused?: boolean;
}

const KIND_GLYPH: Record<AgentEvent["kind"], string> = {
  prompt: "▸",
  text: "¶",
  tool_call: "ƒ",
  tool_result: "✓",
  message: "✉",
  system: "•",
};

export const EventRow = memo(function EventRow({ event, agentName, agentType, showAgent = true, latest, focused }: Props) {
  const tone = toneFor(agentName, agentType);
  const isErr = event.kind === "tool_result" && event.isError;
  const glyph = isErr ? "✕" : KIND_GLYPH[event.kind];

  return (
    <li
      className="event-row"
      data-id={event.id}
      data-ts={event.ts}
      data-kind={event.kind}
      data-error={event.isError ? "true" : undefined}
      data-latest={latest ? "true" : undefined}
      data-focus={focused ? "true" : undefined}
      style={{ "--tone": tone.color } as React.CSSProperties}
    >
      <div className="flex items-baseline gap-2 text-[11px]">
        <time className="mono text-mute" dateTime={event.ts}>
          {formatTime(event.ts)}
        </time>
        {showAgent && (
          <span className="font-semibold" style={{ color: "var(--tone)" }}>
            {agentName ?? event.agentId}
          </span>
        )}
        <span className="text-mute">
          {STR.kind[event.kind]}
          {event.tool ? ` · ${event.tool}` : ""}
          {event.kind === "tool_result" ? ` · ${event.isError ? STR.errorLabel : STR.ok}` : ""}
        </span>
      </div>
      <p className={`mono mt-1 break-words text-xs leading-snug ${isErr ? "text-err" : "text-ink-soft"}`}>
        <span className="event-glyph" aria-hidden="true">
          {glyph}
        </span>{" "}
        {event.summary}
      </p>
    </li>
  );
});
