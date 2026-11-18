# Agent OS — Documentação técnica

## Architecture
App Next.js 15 (App Router, TypeScript, Tailwind 4) sem base de dados. Os route handlers (runtime
`nodejs`, `force-dynamic`) leem em modo só-leitura os ficheiros que o Claude Code escreve em
`~/.claude` e os documentos do repositório `product-team`, e servem-nos como JSON e como
Server-Sent Events.

```
~/.claude/projects/**.jsonl ─┐                 ┌─ GET /api/sessions[/:id[/agents/:a/events]]
~/.claude/teams, tasks ──────┼─► lib/claude ───┼─ GET /api/projects, /api/memory
repo/projects/*/docs ────────┤   (store +      └─ GET /api/stream (SSE) ─► useLiveStream ─► AgentOsContext ─► janelas
repo/.claude/agent-memory ───┘    watcher)
```

### Servidor (`lib/claude/`)
- `paths.ts` resolve `CLAUDE_HOME` e `PRODUCT_TEAM_DIR`; `parse.ts` converte linhas JSONL em
  `Event`/`Agent`/`Session`; `store.ts` guarda o estado; `projects.ts` lê entregáveis, bugs e memória;
  `watcher.ts` deteta alterações; `http.ts` contém os helpers de resposta e erro; `types.ts` os tipos do contrato.
- Estado em memória num singleton em `globalThis` (sobrevive ao HMR). Um tracker por `.jsonl` com
  offset de bytes: só lê bytes novos, só consome linhas terminadas em `\n`, reinicia se o ficheiro
  encolher. Linhas inválidas ou de tipo desconhecido são ignoradas. Máx. 20 000 eventos por ficheiro.
- SSE: hub singleton partilhado por todas as ligações. Ciclo de polling de 1 s (garante a latência) e
  `fs.watch` recursivo como acelerador (debounce 50 ms). Só corre enquanto houver ligações abertas.
  Heartbeat `: ping` a cada 15 s. O stream não repete histórico: o cliente faz o GET inicial e
  deduplica por `Event.id`.

### Cliente
- Rota única `/` → `app/page.tsx` → `components/AppShell.tsx` (layout v2, ver DESIGN.md § v2):
  `Nav` (rail no desktop, `TabBar` no mobile), `Header`, `SessionPicker`, `TeamView` com `GraphView`
  e `OrbitView`, `SidePanel` (Inspetor/Feed) com `BottomSheet` no mobile, `SessionTimeline`,
  `ListViews` (Tarefas/Projetos/Memória).
- `hooks/UiContext.tsx` (vista atual, agente selecionado, painel),
  `hooks/TeamContext.tsx` + `lib/client/team.ts` (nós e arestas a partir de `Event.from`/`to`, com o
  `summary` como alternativa; aresta ativa 4 s após uma mensagem), `hooks/useMediaQuery.ts`.
  Posições dos nós do grafo em `localStorage` por sessão.
- Estado: `hooks/AgentOsContext.tsx` (`useReducer`: sessões, sessão escolhida, agentes, eventos asc.
  máx. 2000 com dedupe por id, tarefas, projetos, memória). Carga inicial por `fetch` e depois
  `hooks/useLiveStream.ts` (`EventSource`) funde os eventos `event/agent/tasks/session/projects`.
  Reconexão com recuo exponencial de 1 s a 10 s e nova carga completa ao reconectar.
- Estado "ativo" recalculado no cliente (evento < 60 s). Toda a microcopy pt-PT em `lib/client/strings.ts`.
- SEO on-page: metadados em `app/layout.tsx`, `public/favicon.svg`, `public/robots.txt`;
  `X-Robots-Tag: noindex, nofollow` em todas as respostas via `next.config.ts`.

## Setup from a clean machine
Requisitos: Node.js ≥ 20 (testado com 24.14), npm, e o Claude Code já usado nesta máquina (para
existir `~/.claude`).
```bash
cd projects/agent-os
npm install
npm run dev            # http://localhost:4100
```
Arranque automático: o hook `SessionStart` em `<repo>/.claude/settings.json` corre
`node "$CLAUDE_PROJECT_DIR/scripts/start-agent-os.mjs"`. O script testa a porta 4100; se estiver livre,
lança `next dev -p 4100` destacado (`detached`, sem janela, stdout/stderr em `%TEMP%\agent-os-dev.log`)
e mostra uma mensagem; se já houver servidor, não faz nada. Nunca falha a sessão (sai sempre com 0).

Produção local: `npm run build && npm start`. Dados de exemplo:
`CLAUDE_HOME=fixtures/claude-home npm run dev` (PowerShell: `$env:CLAUDE_HOME='fixtures/claude-home'; npm run dev`).
As fontes (Inter, JetBrains Mono) vêm de `next/font/google`: precisa de rede no primeiro build; sem
rede usa as fontes do sistema.

Testes: `npm test` (Vitest, parser e store) e `npx playwright test` (e2e).

## Environment variables
Nenhuma é obrigatória e nenhuma é secreta; não é preciso `.env.local`.

| Variável | Por omissão | Para quê |
|---|---|---|
| `CLAUDE_HOME` | `~/.claude` | Pasta de dados do Claude Code |
| `PRODUCT_TEAM_DIR` | dois níveis acima do cwd (raiz do repo) | Origem de `projects/` e `.claude/agent-memory/` |
| `NEXT_DIST_DIR` | `.next` | Pasta de build alternativa, para correr `next build` com o dev server ligado |
| `NEXT_PUBLIC_AGENT_OS_MOCKS` | — | `1` = UI com dados simulados, sem API |

Caminhos relativos resolvem-se contra o cwd do processo. A porta 4100 está fixa nos scripts.

## Data model
Sem persistência própria; os tipos são derivados dos ficheiros (detalhe em `DESIGN.md` e `API_CONTRACT.md`).
- `Session { id, cwd, title, startedAt, lastEventAt, teamName?, agentCount }`
- `Agent { id, name, agentType, model?, description?, parentToolUseId?, status, lastEventAt, currentAction?, toolCalls, tokens? }`
- `Event { id, sessionId, agentId, ts, kind, tool?, summary, isError? }`
- `Task { id, subject, status, owner?, blockedBy[] }`
- `Project { slug, deliverables[], bugs[] }`, `Memory { agent, content, updatedAt }`

Ficheiros lidos:
- `CLAUDE_HOME/projects/<cwd com não-alfanuméricos → '-'>/<sessionId>.jsonl`
- `…/<sessionId>/subagents/agent-<id>.jsonl` + `agent-<id>.meta.json`
- `CLAUDE_HOME/teams/*/config.json` (`leadSessionId` liga equipa e sessão)
- `CLAUDE_HOME/tasks/<team>/*.json`
- `PRODUCT_TEAM_DIR/projects/*/docs/**`, `README.md`, `PRODUCT_TEAM_DIR/.claude/agent-memory/*/MEMORY.md`

## API
Contrato completo em `docs/API_CONTRACT.md`. Resumo:
`GET /api/sessions`, `GET /api/sessions/:id`, `GET /api/sessions/:id/agents/:agentId/events`,
`GET /api/projects`, `GET /api/memory`, `GET /api/stream?session=:id` (SSE). Erros
`{ error: { code, message } }` com `CLAUDE_HOME_UNREADABLE`, `SESSION_NOT_FOUND`, `AGENT_NOT_FOUND`, `INVALID_QUERY`.

Segurança: ids de sessão e agente validados (`^[A-Za-z0-9][A-Za-z0-9_-]*$`), por isso não há path
traversal; `thinking` nunca é devolvido; sem autenticação, pensado só para localhost.

## Deploy and rollback
Não há deploy: é uma ferramenta local. "Deploy" = `npm install && npm run dev` (ou `build` + `start`).
Não há migrações nem estado persistente. Rollback = repor a versão anterior do código com git e
reiniciar o servidor.

## Known limitations
1. O formato de `~/.claude` é interno ao Claude Code e pode mudar; o parser é tolerante, mas campos novos não aparecem.
2. Não existiam ficheiros reais em `~/.claude/tasks` nesta máquina: o formato das tarefas foi inferido e só foi validado com fixtures.
3. Teammates só aparecem depois de terem transcrição em `subagents/`.
4. `tokens` = input + output + cache_creation por mensagem; não é custo.
5. Transcrições grandes ficam em memória (tecto de 20 000 eventos por ficheiro); o Feed mostra no máximo 300.
6. `fs.watch` recursivo pode falhar nalguns sistemas; o polling de 1 s cobre.
7. Teammates em processo não escrevem `meta.finished`, por isso ficam `active`/`idle`, nunca `finished`.
8. Um nó por nome de agente: instâncias relançadas com o mesmo nome fundem-se no grafo e na linha do tempo. Não testado com mais de 10 agentes, só com teclado nem com leitores de ecrã.
9. Sem autenticação; não expor fora de localhost.
10. Nunca corras `next build` no mesmo `.next` que um `next dev` ativo: usa `NEXT_DIST_DIR=.next-build`.
