# Agent OS — Plano

## Stack
| Peça | Escolha | Porquê |
|---|---|---|
| App | Next.js 15 (App Router) + TypeScript | Stack por omissão da equipa; route handlers servem a API e o SSE |
| UI | Tailwind CSS 4 | Stack habitual |
| Dados | Nenhuma BD — leitura direta de ficheiros JSONL/JSON | Os dados já existem em disco; só-leitura evita duplicar estado |
| Ao vivo | Server-Sent Events + `fs.watch` com fallback de polling (1 s) | Sem dependências extra; `fs.watch` recursivo funciona no Windows |
| Testes | Vitest (parser) + Playwright (e2e) | Parser é a parte frágil; e2e para QA |

## Dependências
`next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `@tailwindcss/postcss`, `vitest`,
`@playwright/test`. Nada mais.

## Comando de arranque
`npm install && npm run dev` em `projects/agent-os/` → http://localhost:4100

## Marcos
1. M1 — Parser + API REST a devolver dados reais de `~/.claude`.
2. M2 — UI desktop com janelas a ler a API (mocks até M1).
3. M3 — Stream SSE ligado; atualização ao vivo.
4. M4 — QA, SEO audit, documentação, entrega.

## Tarefas
### backend-dev
1. `lib/claude/paths.ts` + `lib/claude/parse.ts`: ler transcrições, meta de subagentes, equipas, tarefas → tipos do contrato. Done: testes Vitest com fixtures passam.
2. `GET /api/sessions`, `GET /api/sessions/:id` (agentes + eventos). Done: curl devolve JSON do contrato.
3. `GET /api/projects`, `GET /api/memory`. Done: curl devolve os projetos de `projects/`.
4. `GET /api/stream` (SSE) com watcher incremental (lê só bytes novos de cada ficheiro). Done: anexar uma linha a um `.jsonl` de teste gera um evento em < 2 s.
5. Fixtures em `fixtures/claude-home/` e `CLAUDE_HOME` configurável. Done: `CLAUDE_HOME=fixtures/claude-home npm run dev` mostra dados de exemplo.
6. Factos para TECHNICAL.md (env vars, formatos lidos, limitações) por mensagem ao tech-lead.

### frontend-dev
1. Shell desktop: fundo, barra de tarefas, relógio, gestor de janelas (abrir/fechar/focar/arrastar). Done: 5 janelas abrem e fecham.
2. Janela Agentes (cartões com estado ativo/inativo/terminado, última ação, ferramenta atual). Done: renderiza dados de `/api/sessions/:id`.
3. Janela Feed de atividade + vista de linha temporal por agente. Done: novos eventos aparecem no topo sem refresh.
4. Janelas Tarefas, Projetos (checklist de entregáveis, bugs), Memória.
5. Hook `useLiveStream` ligado a `/api/stream`, indicador "ao vivo"/"desligado", reconexão automática.
6. Implementar `SEO_SPEC.md` (title, meta, noindex, favicon, lang pt-PT).

### qa-engineer
1. `TEST_PLAN.md` a partir de DESIGN + contrato.
2. Testes de contrato da API com curl/Playwright contra fixtures.
3. E2E: abrir app, abrir cada janela, anexar evento a fixture e ver aparecer ao vivo.
4. Bugs em `docs/qa/bugs/BUG-NNN.md`; retestes.
5. `TEST_REPORT.md` com veredicto.

### growth-strategist
1. `KEYWORDS.md` (curto — ferramenta interna).
2. `SEO_SPEC.md`: title/meta por página, `noindex`, lang, favicon, microcopy pt-PT dos estados vazios.
3. `SEO_AUDIT.md` sobre a build a correr, com veredicto.

## Dependências entre tarefas
backend 1 → backend 2,3,4 · frontend 1–4 com mocks em paralelo → frontend 5 depende de backend 4 ·
growth 2 → frontend 6 → growth 3 · qa 1 cedo → qa 3 depende de backend 4 + frontend 5.

## File ownership
| Caminho (em `projects/agent-os/`) | Dono |
|---|---|
| `app/api/**`, `lib/claude/**`, `fixtures/**`, `tests/unit/**` | backend-dev |
| `app/(desktop)/**`, `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `components/**`, `hooks/**`, `public/**`, `lib/client/**` | frontend-dev |
| `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `vitest.config.ts` | backend-dev (frontend pede alterações por mensagem) |
| `tests/e2e/**`, `playwright.config.ts`, `docs/qa/**` | qa-engineer |
| `docs/seo/**` | growth-strategist |
| `docs/BRIEF.md`, `PLAN.md`, `DESIGN.md`, `TECHNICAL.md`, `FUNCTIONAL.md`, `README.md` | tech-lead |
| `docs/API_CONTRACT.md` | backend-dev (após o rascunho) |

## Runtime & test environment
(acrescentado a meio do projeto; devia ter existido desde o início — ver § Changes)
| Processo | Porta | Pasta de build | Dados | Dono |
|---|---|---|---|---|
| Dev server (`npm run dev`) | 4100 | `.next` | `~/.claude` real | backend-dev |
| Build paralelo (`NEXT_DIST_DIR=.next-build npm run build`) | — | `.next-build` | — | quem o corre, e apaga no fim |
| E2E (`npx playwright test`, `QA_PROD=1`) | 4120/4121 | cópia em `%TEMP%/agent-os-qa/app` | cópia temporária de `fixtures/claude-home` | qa-engineer |

### Segurança (acrescentado em 2026-11-17)
| Processo | Porta | Pasta de build | Dados | Dono |
|---|---|---|---|---|
| Testes dinâmicos de segurança | 4100 (só pedidos HTTP seguros; sem reiniciar nem fazer build) | — | `~/.claude` real, só leitura | security-engineer |
| Build de verificação, se precisar | — | `NEXT_DIST_DIR=.next-sec`, apagada no fim | — | security-engineer |
Orçamento: 30 min para a parte dinâmica.

`middleware.ts` (raiz da app) → backend-dev (acrescentado em 2026-11-17 para o SEC-002).

## Changes
- 2026-11-18: Tarefas mostra o `PLAN.md` § Tarefas quando a sessão não tem lista partilhada (`Project.planTasks`); removida a vista Órbita e o alternador (pedido do utilizador: não acrescentava valor).
- 2026-11-17: revisão de segurança (docs/security/). Correções: o servidor passa a escutar só em 127.0.0.1 (SEC-001/006), `middleware.ts` valida Host/Origin (SEC-002), cabeçalhos de segurança (SEC-004), limite de ligações SSE (SEC-005), `npm audit fix` sem saltos de versão maior (SEC-003).
- 2026-11-16: acrescentado § Runtime & test environment depois de o dev server e o servidor de testes partilharem `.next` e se partirem um ao outro. Lição registada em `.claude/agents/tech-lead.md` (Fase 1) e `qa-engineer.md`.

## v2 — Redesenho (2026-11-16, aprovado)
Escopo: só o frontend muda de layout (DESIGN.md § v2) + um campo novo no contrato. Sem dependências novas.

| Agente | Tarefa | Done |
|---|---|---|
| backend-dev | `Event.from`/`Event.to` em eventos `message` (enviada: from=agente, to=destinatário; recebida: from=remetente, to=agente); atualizar API_CONTRACT.md, fixtures e testes; avisar frontend-dev e qa | `npm test` passa; curl mostra from/to |
| frontend-dev | Substituir Desktop/janelas pelo layout v2: rail, header, Grafo, Órbita, alternador, Inspetor/Feed, linha do tempo da sessão, mobile; remover componentes mortos (Window, Taskbar, useWindowManager…) | `npm run build` passa (com `NEXT_DIST_DIR=.next-build`); Chrome 1440 px e 375 px sem erros de consola |
| qa-engineer | Atualizar tests/e2e para o v2 (seletores novos), correr `npx playwright test` uma vez em dev e uma em `QA_PROD=1`, bugs, atualizar TEST_REPORT.md | Verdict no relatório |

Ambiente: segue § Runtime & test environment acima. O dev server da 4100 é do tech-lead (já a correr); ninguém o reinicia nem faz build no `.next`. Orçamento e2e: 30 min.
