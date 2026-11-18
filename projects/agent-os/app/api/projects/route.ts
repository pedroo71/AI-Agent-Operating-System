import { json } from '@/lib/claude/http';
import { readProjects } from '@/lib/claude/projects';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return json({ projects: readProjects() });
}
