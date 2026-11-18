import { prepareRunDir, resetHome, startServer, stopServer } from './server';

export default async function globalSetup() {
  stopServer();
  prepareRunDir();
  resetHome();
  await startServer();
  // aquecer rotas (next dev compila a pedido)
  for (const p of ['/', '/api/sessions', '/api/projects', '/api/memory']) {
    await fetch(`http://localhost:${process.env.QA_PORT ?? 4120}${p}`).catch(() => {});
  }
}
