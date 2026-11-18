import { apiError, intParam, json } from '@/lib/claude/http';
import { readProjects, sessionProject } from '@/lib/claude/projects';
import { loadSession, locateSession, mergedEvents } from '@/lib/claude/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  const n = intParam(new URL(req.url).searchParams.get('events'), 200, 2000);
  if (n === null) return apiError(400, 'INVALID_QUERY', 'events deve ser um inteiro positivo');
  const ref = locateSession(id);
  if (!ref) return apiError(404, 'SESSION_NOT_FOUND', `Sessão ${id} não encontrada`);
  const l = loadSession(ref);
  const all = mergedEvents(l.trackers);
  const project = sessionProject(all, readProjects().map((p) => p.slug));
  return json({ session: l.session, agents: l.agents, events: all.slice(-n), tasks: l.tasks, ...(project ? { project } : {}) });
}
