"use client";

import type { ReactNode } from "react";
import { useAgentOs } from "@/hooks/AgentOsContext";
import { EmptyState } from "@/components/EmptyState";
import { STR } from "@/lib/client/strings";

/** Mostra "a carregar" ou erro antes do conteúdo de uma vista. */
export function Gate({ children, needsSession = true }: { children: ReactNode; needsSession?: boolean }) {
  const { loading, error, reload } = useAgentOs();
  if (error) {
    return (
      <EmptyState
        title={STR.loadError}
        hint={`${error}. ${STR.loadErrorHint}`}
        action={
          <button type="button" className="btn" onClick={reload}>
            {STR.retry}
          </button>
        }
      />
    );
  }
  if (loading && needsSession) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center text-sm text-mute" role="status">
        {STR.loading}
      </div>
    );
  }
  return <>{children}</>;
}
