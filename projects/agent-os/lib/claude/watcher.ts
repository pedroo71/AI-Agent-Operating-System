import fs from 'node:fs';
import path from 'node:path';
import { claudeHomeReadable, listSessionFiles, loadSession, locateSession, onChange, projectDirsFor, readTasks, summarizeSession, type ChangeBatch } from './store';
import { productTeamDir, projectsRoot, tasksRoot, teamsRoot } from './paths';
import { projectsSignature, readProjects } from './projects';
import type { Agent } from './types';

/**
 * Hub SSE singleton partilhado por todas as ligações.
 * - Um ciclo de polling a cada 1 s (determinístico; é ele que garante a latência < 2 s).
 * - `fs.watch` recursivo só serve de acelerador: dispara um ciclo imediato (com debounce).
 * - Só corre enquanto houver subscritores.
 */

export type SendFn = (event: string, data: unknown) => void;
interface Sub {
  sessionId: string;
  send: SendFn;
}
interface SessionWatch {
  agentSigs: Map<string, string>;
  tasksJson: string;
}

const POLL_MS = 1000;
const KEY = Symbol.for('agent-os.hub');

class Hub {
  subs = new Set<Sub>();
  sessions = new Map<string, SessionWatch>();
  timer?: ReturnType<typeof setInterval>;
  watchers: fs.FSWatcher[] = [];
  debounce?: ReturnType<typeof setTimeout>;
  unlisten?: () => void;
  knownSessionFiles = new Set<string>();
  projectsSig = '';
  ticking = false;

  subscribe(sessionId: string, send: SendFn): () => void {
    const sub: Sub = { sessionId, send };
    this.subs.add(sub);
    if (!this.sessions.has(sessionId)) this.baseline(sessionId);
    if (this.subs.size === 1) this.start();
    return () => {
      this.subs.delete(sub);
      if (![...this.subs].some((s) => s.sessionId === sessionId)) this.sessions.delete(sessionId);
      if (this.subs.size === 0) this.stop();
    };
  }

  private baseline(sessionId: string) {
    const ref = locateSession(sessionId);
    const w: SessionWatch = { agentSigs: new Map(), tasksJson: '[]' };
    if (ref) {
      const l = loadSession(ref);
      for (const a of l.agents) w.agentSigs.set(a.id, sig(a));
      w.tasksJson = JSON.stringify(l.tasks);
    }
    this.sessions.set(sessionId, w);
  }

  private start() {
    this.unlisten = onChange((b) => this.onBatch(b));
    this.knownSessionFiles = new Set(listSessionFiles(this.cwdDirs()).map((f) => f.id));
    this.projectsSig = projectsSignature();
    this.timer = setInterval(() => this.tick(), POLL_MS);
    this.timer.unref?.();
    this.startWatchers();
  }

  private stop() {
    this.unlisten?.();
    if (this.timer) clearInterval(this.timer);
    if (this.debounce) clearTimeout(this.debounce);
    for (const w of this.watchers) {
      try {
        w.close();
      } catch {
        /* ignora */
      }
    }
    this.watchers = [];
    this.timer = undefined;
  }

  private cwdDirs(): string[] {
    const exact = projectDirsFor(productTeamDir());
    return exact.length ? exact : projectDirsFor(null);
  }

  private startWatchers() {
    const targets = [projectsRoot(), teamsRoot(), tasksRoot()];
    try {
      const pr = path.join(productTeamDir(), 'projects');
      for (const slug of fs.readdirSync(pr)) targets.push(path.join(pr, slug, 'docs')); // evita node_modules/.next
    } catch {
      /* sem projects/ */
    }
    for (const t of targets) {
      try {
        const w = fs.watch(t, { recursive: true }, () => this.kick());
        w.on('error', () => {
          /* o polling cobre */
        });
        this.watchers.push(w);
      } catch {
        /* diretoria inexistente ou sem suporte: o polling cobre */
      }
    }
  }

  private kick() {
    if (this.debounce) return;
    this.debounce = setTimeout(() => {
      this.debounce = undefined;
      this.tick();
    }, 50);
  }

  private broadcast(sessionId: string | null, event: string, data: unknown) {
    for (const s of [...this.subs]) {
      if (sessionId !== null && s.sessionId !== sessionId) continue;
      try {
        s.send(event, data);
      } catch {
        this.subs.delete(s);
      }
    }
  }

  private onBatch(b: ChangeBatch) {
    for (const e of b.events) this.broadcast(b.sessionId, 'event', e);
  }

  tick() {
    if (this.ticking || this.subs.size === 0) return;
    this.ticking = true;
    try {
      for (const [id, w] of this.sessions) this.tickSession(id, w);
      this.tickGlobal();
    } catch {
      /* um ciclo falhado não pára o seguinte */
    } finally {
      this.ticking = false;
    }
  }

  private tickSession(id: string, w: SessionWatch) {
    const ref = locateSession(id);
    if (!ref) return;
    const l = loadSession(ref); // sincroniza ficheiros → onBatch emite `event`
    for (const a of l.agents) {
      const s = sig(a);
      if (w.agentSigs.get(a.id) !== s) {
        w.agentSigs.set(a.id, s);
        this.broadcast(id, 'agent', a);
      }
    }
    const tj = JSON.stringify(l.tasks);
    if (tj !== w.tasksJson) {
      w.tasksJson = tj;
      this.broadcast(id, 'tasks', { tasks: l.tasks });
    }
  }

  private tickGlobal() {
    for (const f of listSessionFiles(this.cwdDirs())) {
      if (this.knownSessionFiles.has(f.id)) continue;
      this.knownSessionFiles.add(f.id);
      const s = summarizeSession(f.dir, f.id);
      if (s) this.broadcast(null, 'session', s);
    }
    const ps = projectsSignature();
    if (ps !== this.projectsSig) {
      this.projectsSig = ps;
      this.broadcast(null, 'projects', { projects: readProjects() });
    }
  }
}

const sig = (a: Agent) => `${a.status}|${a.toolCalls}|${a.tokens ?? ''}|${a.currentAction ?? ''}|${a.lastEventAt}|${a.model ?? ''}`;

export function hub(): Hub {
  const g = globalThis as any;
  return (g[KEY] ??= new Hub());
}

export { claudeHomeReadable };
