"use client";

import { useAgentOs } from "@/hooks/AgentOsContext";
import { useTeam } from "@/hooks/TeamContext";
import { useUi } from "@/hooks/UiContext";
import { EmptyState } from "./EmptyState";
import { Gate } from "./Gate";
import { GraphView } from "./GraphView";
import type { TeamNode } from "@/lib/client/team";
import { STR } from "@/lib/client/strings";

/** Vista central "Equipa": o grafo da equipa. */
export function TeamView() {
  const { sessionId, selectAgent, sessions } = useAgentOs();
  const { nodes, selectedNode } = useTeam();
  const { reveal } = useUi();

  const pick = (n: TeamNode) => {
    selectAgent(n.rep.id);
    reveal();
  };

  return (
    <Gate>
      <h2 className="sr-only">{STR.nav.team}</h2>
      {nodes.length === 0 ? (
        <EmptyState {...(sessions.length === 0 ? { title: STR.noSessions, hint: STR.noSessionHint } : STR.empty.agents)} />
      ) : (
        <div className="relative h-full">
          <GraphView key={sessionId ?? "none"} sessionId={sessionId ?? "none"} selectedKey={selectedNode?.key} onPick={pick} />
        </div>
      )}
    </Gate>
  );
}
