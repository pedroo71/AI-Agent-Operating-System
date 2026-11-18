"use client";

import { AgentOsProvider } from "@/hooks/AgentOsContext";
import { TeamProvider } from "@/hooks/TeamContext";
import { UiProvider, useUi } from "@/hooks/UiContext";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Header } from "./Header";
import { Rail, TabBar } from "./Nav";
import { FeedPanel } from "./FeedPanel";
import { MemoryView, ProjectsView, TasksView } from "./ListViews";
import { SessionTimeline } from "./SessionTimeline";
import { BottomSheet, SidePanel } from "./SidePanel";
import { TeamView } from "./TeamView";

function Layout() {
  const { isDesktop, view } = useUi();
  return (
    <div className="fixed inset-0 flex bg-bg">
      {isDesktop && <Rail />}
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="main" tabIndex={-1} className="relative min-h-0 flex-1 overflow-hidden outline-none">
          {view === "team" && <TeamView />}
          {view === "feed" && <FeedPanel />}
          {view === "tasks" && <TasksView />}
          {view === "projects" && <ProjectsView />}
          {view === "memory" && <MemoryView />}
        </main>
        {isDesktop && view === "team" && <SessionTimeline />}
        {!isDesktop && <TabBar />}
      </div>
      {isDesktop ? <SidePanel /> : <BottomSheet />}
    </div>
  );
}

function Shell() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  // Antes de hidratar não se sabe a largura: evita piscar o layout errado.
  if (isDesktop === null) return <div className="fixed inset-0 bg-bg" id="main" aria-busy="true" />;
  return (
    <UiProvider isDesktop={isDesktop}>
      <Layout />
    </UiProvider>
  );
}

export function AppShell() {
  return (
    <AgentOsProvider>
      <TeamProvider>
        <Shell />
      </TeamProvider>
    </AgentOsProvider>
  );
}
