import { apiError, intParam, json } from '@/lib/claude/http';
import { productTeamDir } from '@/lib/claude/paths';
import { claudeHomeReadable, listSessionFiles, projectDirsFor, summarizeSession } from '@/lib/claude/store';
import type { Session } from '@/lib/claude/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams;
  const limit = intParam(q.get('limit'), 20, 200);
  if (limit === null) return apiError(400, 'INVALID_QUERY', 'limit deve ser um inteiro positivo');
  if (!claudeHomeReadable()) return apiError(500, 'CLAUDE_HOME_UNREADABLE', 'A pasta do Claude (CLAUDE_HOME) não existe ou não é legível');

  const cwdParam = q.get('cwd');
  let dirs: string[];
  if (cwdParam === 'all') dirs = projectDirsFor(null);
  else {
    dirs = projectDirsFor(cwdParam || productTeamDir());
    // sem sessões para o cwd por omissão (ex.: CLAUDE_HOME de fixtures) → todas
    if (!dirs.length && !cwdParam) dirs = projectDirsFor(null);
  }
  const sessions: Session[] = [];
  for (const f of listSessionFiles(dirs).slice(0, limit)) {
    const s = summarizeSession(f.dir, f.id);
    if (s) sessions.push(s);
  }
  sessions.sort((a, b) => (a.lastEventAt < b.lastEventAt ? 1 : a.lastEventAt > b.lastEventAt ? -1 : 0));
  return json({ sessions });
}
