/** Respostas JSON do contrato (sem NextResponse, para poder testar os handlers em Node puro). */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function apiError(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

/** Inteiro positivo opcional da query; `null` = inválido; `fallback` quando ausente. Valores acima de `max` ficam em `max`. */
export function intParam(v: string | null, fallback: number, max: number): number | null {
  if (v === null || v === '') return fallback;
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  if (n < 1) return null;
  return Math.min(n, max);
}
