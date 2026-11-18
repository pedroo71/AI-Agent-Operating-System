import { apiError, intParam, json } from '@/lib/claude/http';
import { isSafeId } from '@/lib/claude/paths';
import { loadSession, locateSession } from '@/lib/claude/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string; agentId: string }> }): Promise<Response> {
  const { id, agentId } = await ctx.params;
  const q = new URL(req.url).searchParams;
  const limit = intParam(q.get('limit'), 200, 2000);
  if (limit === null) return apiError(400, 'INVALID_QUERY', 'limit deve ser um inteiro positivo');
  const before = q.get('before');
  if (before !== null && before !== '' && Number.isNaN(Date.parse(before))) {
    return apiError(400, 'INVALID_QUERY', 'before deve ser um timestamp ISO');
  }
  const ref = locateSession(id);
  if (!ref) return apiError(404, 'SESSION_NOT_FOUND', `Sessão ${id} não encontrada`);
  const l = loadSession(ref);
  const agent = isSafeId(agentId) ? l.agents.find((a) => a.id === agentId) : undefined;
  const tracker = l.trackers.find((t) => t.agentId === agentId);
  if (!agent || !tracker) return apiError(404, 'AGENT_NOT_FOUND', `Agente ${agentId} não encontrado na sessão`);
  let events = tracker.events;
  if (before) {
    const b = Date.parse(before);
    events = events.filter((e) => Date.parse(e.ts) < b);
  }
  return json({ agent, events: events.slice(-limit) });
}
