#!/usr/bin/env node
// Arranca o Agent OS (projects/agent-os, `next dev -p 4100`) em segundo plano se a porta 4100
// estiver livre. Usado pelo hook SessionStart em .claude/settings.json. Nunca falha a sessão.
import { spawn } from 'node:child_process';
import { existsSync, openSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 4100;
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(repo, 'projects', 'agent-os');
const nextBin = path.join(app, 'node_modules', 'next', 'dist', 'bin', 'next');
const log = path.join(os.tmpdir(), 'agent-os-dev.log');

const say = (msg) => process.stdout.write(JSON.stringify({ systemMessage: msg }) + '\n');

function portInUse(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
    s.setTimeout(1000, () => { s.destroy(); resolve(false); });
  });
}

try {
  if (await portInUse(PORT)) process.exit(0); // já está a correr
  if (!existsSync(nextBin)) {
    say(`Agent OS não arrancou: falta node_modules (corre "npm install" em ${app}).`);
    process.exit(0);
  }
  const fd = openSync(log, 'a');
  // -H 127.0.0.1: só esta máquina chega ao painel (SEC-006); as transcrições têm conteúdo sensível.
  const child = spawn(process.execPath, [nextBin, 'dev', '-H', '127.0.0.1', '-p', String(PORT)], {
    cwd: app,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', fd, fd],
  });
  child.unref();
  say(`Agent OS a arrancar em http://localhost:${PORT} (log: ${log})`);
} catch (e) {
  say(`Agent OS não arrancou: ${e.message}`);
}
process.exit(0);
