import { NextResponse, type NextRequest } from 'next/server';

// SEC-002: protege contra DNS rebinding e pedidos cross-origin. Só aceita Host local nas portas
// da app (4100) e dos testes e2e (4120/4121/4130); /api/* rejeita ainda um Origin estrangeiro.
const HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const PORTS = new Set(['4100', '4120', '4121', '4130']);

function allowed(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  const m = /^(\[[0-9a-f:]+\]|[^:\[\]]+)(?::(\d+))?$/i.exec(hostHeader.trim());
  return !!m && HOSTS.has(m[1].toLowerCase()) && !!m[2] && PORTS.has(m[2]);
}

function forbidden(msg: string): NextResponse {
  return NextResponse.json({ error: { code: 'FORBIDDEN_HOST', message: msg } }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
}

export function middleware(req: NextRequest) {
  if (!allowed(req.headers.get('host'))) return forbidden('Host não permitido');
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin');
    if (origin) {
      let host: string | null = null;
      try {
        host = new URL(origin).host;
      } catch {
        /* origem inválida */
      }
      if (!allowed(host)) return forbidden('Origin não permitido');
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
