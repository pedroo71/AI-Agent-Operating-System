import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** QA_PROD=1: testa a build de produção (`next build` + `next start`) em vez do `next dev`. */
export const PROD = process.env.QA_PROD === '1';
export const PORT = Number(process.env.QA_PORT ?? 4120);
export const APP_DIR = path.resolve(__dirname, '..', '..', '..');
export const REPO_DIR = path.resolve(APP_DIR, '..', '..');
export const QA_ROOT = path.join(os.tmpdir(), 'agent-os-qa');
export const HOME_DIR = path.join(QA_ROOT, 'claude-home');
/** Cópia da app (sem .next) para não colidir com o servidor de desenvolvimento do projecto. */
export const RUN_DIR = path.join(QA_ROOT, 'app');
export const SESSION_ID = '11111111-aaaa-4bbb-8ccc-222222222222';
export const MAIN_JSONL = path.join(HOME_DIR, 'projects', 'C--fixtures-demo', `${SESSION_ID}.jsonl`);
export const BASE = `http://localhost:${PORT}`;

/** Copia as fixtures para uma pasta temporária (os testes escrevem lá, nunca nas fixtures do repo). */
export function resetHome() {
  fs.rmSync(HOME_DIR, { recursive: true, force: true });
  fs.cpSync(path.join(APP_DIR, 'fixtures', 'claude-home'), HOME_DIR, { recursive: true });
}

/** Copia o código da app para RUN_DIR (junction para node_modules) — o .next fica isolado. */
export function prepareRunDir() {
  stopServer();
  // remover primeiro a junction (nunca apagar recursivamente o node_modules real)
  try { fs.rmdirSync(path.join(RUN_DIR, 'node_modules')); } catch { /* não existe */ }
  // se algo ainda segurar ficheiros (EPERM), sobrescreve por cima em vez de falhar
  try { fs.rmSync(RUN_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { /* sobrescrever */ }
  fs.mkdirSync(RUN_DIR, { recursive: true });
  for (const e of fs.readdirSync(APP_DIR)) {
    if (['node_modules', '.next', 'test-results', 'docs', 'tests', 'fixtures'].includes(e)) continue;
    fs.cpSync(path.join(APP_DIR, e), path.join(RUN_DIR, e), { recursive: true });
  }
  if (!fs.existsSync(path.join(RUN_DIR, 'node_modules'))) fs.symlinkSync(path.join(APP_DIR, 'node_modules'), path.join(RUN_DIR, 'node_modules'), 'junction');
  if (PROD) execSync(`"${process.execPath}" node_modules/next/dist/bin/next build`, { cwd: RUN_DIR, stdio: 'inherit' });
}

function pidsOnPort(port: number): number[] {
  try {
    const out = execSync(`netstat -ano -p tcp`, { encoding: 'utf8' });
    const pids = new Set<number>();
    for (const l of out.split(/\r?\n/)) {
      if (l.includes('LISTENING') && new RegExp(':' + port + '\\s').test(l)) pids.add(Number(l.trim().split(/\s+/).pop()));
    }
    return [...pids].filter(Boolean);
  } catch {
    return [];
  }
}

export function stopServer() {
  for (let i = 0; i < 5; i++) {
    const pids = pidsOnPort(PORT);
    if (!pids.length) return;
    for (const pid of pids) {
      try { execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); } catch { /* já terminou */ }
    }
    execSync('ping -n 2 127.0.0.1 > nul', { stdio: 'ignore' });
  }
}

export async function waitUp(timeoutMs = 90_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/sessions`);
      if (r.status < 500 || r.status === 500) return;
    } catch { /* ainda a arrancar */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`servidor não respondeu em ${timeoutMs} ms`);
}

export async function startServer(opts: { home?: string } = {}) {
  const home = opts.home ?? HOME_DIR;
  const logFd = fs.openSync(path.join(os.tmpdir(), 'agent-os-qa-server.log'), 'a');
  const child = spawn(process.execPath, [path.join(APP_DIR, 'node_modules', 'next', 'dist', 'bin', 'next'), PROD ? 'start' : 'dev', '-p', String(PORT)], {
    cwd: RUN_DIR,
    env: { ...process.env, CLAUDE_HOME: home, PRODUCT_TEAM_DIR: REPO_DIR },
    detached: true,
    stdio: ['ignore', logFd, logFd],
    windowsHide: true,
  });
  child.unref();
  await waitUp();
}

/** Linha JSONL de assistente (texto) com id único; devolve o texto para procurar na UI. */
export function appendAssistantText(text: string, file = MAIN_JSONL) {
  const line = {
    parentUuid: null, isSidechain: false, userType: 'external', cwd: 'C:\fixtures\demo', sessionId: SESSION_ID,
    type: 'assistant',
    message: { model: 'claude-opus-5-5', id: `qa-${Date.now()}`, type: 'message', role: 'assistant', content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } },
    uuid: `qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };
  fs.appendFileSync(file, JSON.stringify(line) + '\n');
}
