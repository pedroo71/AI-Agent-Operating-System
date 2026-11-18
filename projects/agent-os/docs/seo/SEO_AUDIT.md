# Agent OS — SEO_AUDIT

Auditoria de http://localhost:4100 em 2026-11-16 (curl ao HTML e aos recursos).

| # | Item do spec | Resultado | Valor observado |
|---|---|---|---|
| 1 | `<html lang="pt-PT">` | pass | `lang="pt-PT"` |
| 2 | `<title>` ≤ 60 | pass | "Agent OS — painel ao vivo da equipa de agentes" (47) |
| 3 | meta description ≤ 155 | pass | texto exato do spec |
| 4 | viewport | pass | `width=device-width, initial-scale=1` |
| 5 | robots meta | pass | `noindex, nofollow, noarchive` |
| 6 | theme-color | pass | `#0c0e11` (acordado com o CSS) |
| 7 | color-scheme | pass | `dark` |
| 8 | favicon | pass | `<link rel="icon" href="/favicon.svg">`; GET 200 `image/svg+xml` |
| 9 | h1 único "Agent OS" | pass | `<h1 class="sr-only">Agent OS</h1>`; 1 ocorrência |
| 10 | /robots.txt | pass | 200, `User-agent: *` / `Disallow: /` |
| 11 | Sem canonical, sitemap, OG, JSON-LD | pass | não existem no HTML |
| 12 | Indicador ao vivo `role=status` + `aria-live=polite` | pass | na barra de tarefas; estado "A ligar…" |
| 13 | Microcopy pt-PT (carregar, ligar, botões, aria-labels) | pass | "A carregar…", "A ligar…", "Minimizar Agentes", "Início" |
| 14 | Cabeçalho `X-Robots-Tag: noindex, nofollow` em HTML e `/api/*` | pass | presente em `/`, `/api/sessions`, `/robots.txt`, `/favicon.svg` (reaudit) |
| 15 | Seletor de sessão com opção "Mais recente (product-team)" | desvio aceite | frontend-dev: lista de sessões, mais recente por omissão |

Nota: estados vazio/erro/desligado por janela só são visíveis em runtime (cliente); verificados por mensagem do frontend-dev, não por curl.

Reauditoria (2026-11-16): `/` 200; itens 1-14 confirmados de novo por curl (lang, title, robots, theme-color, viewport, favicon, h1 único, robots.txt, ausência de canonical/OG, X-Robots-Tag).

Verdict: spec met
