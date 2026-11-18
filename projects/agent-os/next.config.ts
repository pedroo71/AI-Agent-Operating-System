import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false, // o indicador "N" do dev tapava o botão Início (BUG-001)
  distDir: process.env.NEXT_DIST_DIR || '.next', // permite compilar sem tocar no .next do servidor de dev
  // Ferramenta local: nada deve ser indexado (SEO_SPEC.md § robots), em HTML e em /api/*.
  async headers() {
    // CSP (SEC-004). O Next injeta scripts inline para hidratar, por isso 'unsafe-inline' em scripts;
    // em dev precisa também de 'unsafe-eval' e do websocket do HMR. Fontes: next/font (self-hosted).
    const dev = process.env.NODE_ENV !== 'production';
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src 'self'${dev ? ' ws://localhost:* ws://127.0.0.1:*' : ''}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
    ];
  },
};

export default nextConfig;
