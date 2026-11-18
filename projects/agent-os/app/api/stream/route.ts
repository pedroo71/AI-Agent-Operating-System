import { apiError } from '@/lib/claude/http';
import { locateSession } from '@/lib/claude/store';
import { hub } from '@/lib/claude/watcher';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const HEARTBEAT_MS = 15_000;
const MAX_STREAMS = 20; // SEC-005: teto global de ligações SSE
const g = globalThis as unknown as { __agentOsSse?: number };

export async function GET(req: Request): Promise<Response> {
  const sessionId = new URL(req.url).searchParams.get('session') ?? '';
  if (!locateSession(sessionId)) return apiError(404, 'SESSION_NOT_FOUND', `Sessão ${sessionId || '(em falta)'} não encontrada`);

  if ((g.__agentOsSse ?? 0) >= MAX_STREAMS) return apiError(429, 'TOO_MANY_STREAMS', `Máximo de ${MAX_STREAMS} ligações em tempo real`);
  g.__agentOsSse = (g.__agentOsSse ?? 0) + 1;

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          close();
        }
      };
      const unsubscribe = hub().subscribe(sessionId, (event, data) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const ping = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);
      function close() {
        if (closed) return;
        closed = true;
        g.__agentOsSse = Math.max(0, (g.__agentOsSse ?? 1) - 1);
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* já fechado */
        }
      }
      cleanup = close;
      req.signal.addEventListener('abort', close);
      write('retry: 2000\n: connected\n\n');
    },
    cancel() {
      cleanup();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
