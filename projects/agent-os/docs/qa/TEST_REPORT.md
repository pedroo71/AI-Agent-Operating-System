# Agent OS — Relatório de testes

**Verdict: ready**

## v2 (redesenho Neural Graph + Órbita) — 2026-11-16

- **Build testada:** código de `projects/agent-os` em 2026-11-16 (v2: rail, Grafo/Órbita, Inspetor/Feed, linha do tempo da sessão, tab bar móvel), cópia isolada em `%TEMP%/agent-os-qa/app`.
- **Ambiente:** Windows 11, Node 24, Chrome (Playwright), 1280x800 e 375x812 touch; fixtures em cópia temporária; portas 4120 (dev) e 4121 (produção); nunca a 4100 nem o `.next` do projeto. API real só GET na 4100.
- **Plano:** `docs/qa/TEST_PLAN.md` (atualizado para v2). Testes: `tests/e2e/{api,ui,live,mobile,real-home}.spec.ts` + `helpers/ui.ts`; `dev-overlay.spec.ts` removido (o botão Início já não existe).

| Execução | Testes | Passaram | Falharam | Saltados |
|---|---|---|---|---|
| Dev (`npx playwright test`) | 46 | 46 | 0 | 0 |
| Produção (`QA_PROD=1 QA_PORT=4121 npx playwright test`) | 46 | 46 | 0 | 0 |

### Cobertura v2 (corrida nesta sessão)
- **API:** API-25 `from`/`to` em eventos `message` (presentes, não vazios, from != to, par entre agentes existentes; ausentes nos outros `kind`); restantes API-* inalterados.
- **UI desktop:** rail (4 botões + seletor de sessão, alvos >= 44 px, `aria-current`), header, metadados, alternador Grafo/Órbita + persistência em `localStorage`, nós = nomes de agente da API, arestas = pares com mensagens (conjunto igual ao da API), estado `finished` do Explore, seleção de nó (Grafo e Órbita) -> Inspetor (ferramentas/erros/modelo/tokens, linha temporal cronológica), seleção por omissão (1 nó), Feed (ordem + filtro por agente), linha do tempo da sessão (pistas, blocos, clique seleciona e foca), arrastar nó + persistência após recarregar, zoom +/repor, seletor de sessões, Tarefas/Projetos/Memória (painel direito mantém-se), pt-PT, `prefers-reduced-motion` (0 animações infinitas em Grafo e Órbita).
- **Ao vivo:** linha anexada no Feed 119–141 ms; Inspetor e nó (ação atual, `data-status=active`); SSE cru 123 ms; reconexão após reinício (indicador sai de `live`, volta, sem duplicados); LIVE-08: `SendMessage` anexado ativa a aresta (`data-active=true`, bolha presente) e desativa depois (medido 5,6–6,0 s do append até desligar, inclui latência e polling do teste; constante do código `EDGE_ACTIVE_MS=4000`), também na Órbita.
- **Móvel:** sem scroll horizontal, tab bar em baixo com 5 separadores visíveis sem scroll (alvos >= 40 px), órbita por omissão, linha do tempo escondida, nó -> folha "Inspetor" (fecha com botão e Esc), Feed sem overflow, Tarefas/Projetos/Memória.

### Notas
- Alteração de comportamento v1 -> v2 (não é bug): a faixa visível "Sem ligação — a mostrar os últimos dados recebidos." desapareceu; offline mostra o indicador do header ("Desligado"/"A ligar…") e o texto "Sem ligação…" só no `title`. DESIGN v2 não pede faixa; o teste foi ajustado.
- Flakiness de infraestrutura (não chasing): numa primeira execução dev, `real-home.spec.ts` recebeu 500 do 4100 (servidor partilhado a recompilar) e a falha de uma asserção deixou o servidor 4120 parado, em cascata. Corrigido no teste (`finally` repõe o servidor); repetido, passou.
- Dev + produção: uma execução cada, dentro do orçamento.

### Bugs v2
Nenhum bug novo. (BUG-001..003 abaixo são da v1; BUG-001 deixou de se aplicar.)

### Riscos em aberto (v2)
1. Não testado: aresta/bolha com muitas mensagens simultâneas, sessões com > 10 agentes (layout do Grafo/Órbita), teclado (Alt+setas) e leitores de ecrã, contraste medido.
2. Tarefas com dados reais continuam por validar (pastas `~/.claude/tasks/*` vazias nesta máquina).
3. Só Chrome/Windows. Sem faixa offline (ver notas): decisão de design a confirmar.

**Verdict: ready.** 46/46 em dev e produção, zero bugs abertos.

---
# Histórico — v1 (janelas)
- **Build testada:** código de `projects/agent-os` em 2026-11-16 (13:33–13:41), após as correções de BUG-001, BUG-002 e BUG-003.
- **Testador:** qa-engineer. Plano: `docs/qa/TEST_PLAN.md`.

### Ambiente
- Windows 11, Node 24, Google Chrome (canal `chrome` do Playwright 1.65), 1280x800 (desktop) e 375x812 touch (móvel).
- Fixtures: cópia temporária de `fixtures/claude-home` em `%TEMP%/agent-os-qa/claude-home` (os testes escrevem lá, nunca nas fixtures do repo).
- App sob teste: cópia do código em `%TEMP%/agent-os-qa/app` (`.next` isolado do servidor de desenvolvimento, ver `PLAN.md` § Runtime & test environment), portas 4120 (dev) e 4121 (produção, `next build` + `next start`).
- Dados reais: servidor de desenvolvimento em http://localhost:4100 com `~/.claude` real, só com pedidos GET.
- Comandos: `npx playwright test` (dev) e `QA_PROD=1 QA_PORT=4121 npx playwright test` (produção). Ficheiros em `tests/e2e/`.

### Resultados
| Execução | Casos | Passaram | Falharam | Saltados |
|---|---|---|---|---|
| Modo dev (`next dev`), 47 testes Playwright | 47 | 47 | 0 | 0 |
| Modo produção (`next build` + `next start`) | 47 | 46 | 0 | 1 (DEV-01, só faz sentido em dev) |

Execuções anteriores (antes dos fixes) falharam em UI-08, MOB-03 e DEV-01: eram os BUG-001..003. Duas falhas transitórias em `real-home.spec.ts` ocorreram quando o servidor 4100 estava a recarregar após uma alteração de código do dev; repetidas, passaram.

#### Cobertura por área (todos corridos nesta sessão)
- **API contra fixtures (`api.spec.ts`, 16):** sessões (forma, ordenação, `limit`), detalhe (agentes, eventos, tarefas, `events` até 2000), eventos por agente (`before`, `limit`, `main`), 404 (`SESSION_NOT_FOUND`, `AGENT_NOT_FOUND`), projetos, memória, regras de `summary`, ausência de `thinking`, traversal e métodos não-GET, `/api/stream` 404 e `text/event-stream`.
- **API contra `~/.claude` real (`real-home.spec.ts`, 2):** 46 sessões; 8 sessões completas (até 1753 eventos, 665 KB) com ordem, ids únicos, `thinking` ausente, `summary` <= 520, Bash <= 120, agentes e eventos por agente; `/api/projects` e `/api/memory`; 400 `INVALID_QUERY` para `limit`/`events`/`before` inválidos. Tempo por sessão < 3 s (observado ~70–120 ms).
- **UI desktop (`ui.spec.ts`, 13):** carregamento sem erros na consola, metadados (`lang="pt-PT"`, title, description, `noindex`, favicon), relógio, abrir/fechar as 6 janelas, minimizar/restaurar/z-index, arrastar, cartões vs API, linha temporal, Feed (ordem e filtros, estado vazio), Tarefas, Projetos, Memória, seletor de sessão, texto sem brasileirismos, `prefers-reduced-motion`.
- **Ao vivo (`live.spec.ts`, 9):** linha anexada ao `.jsonl` aparece no Feed em 112–220 ms (limite 2 s), na Linha temporal, cartão atualiza contador/ação/estado `ativo`, linha corrompida e tipo desconhecido ignorados, linha parcial sem `\n` só aparece depois de completa, SSE cru (`event`, `agent`, `tasks`) em ~115 ms, `ativo` → `inativo` ao fim de 60 s, reconexão automática após parar e reiniciar o servidor (indicador sai de "ao vivo", mostra faixa "Sem ligação", volta a "ao vivo", novos eventos chegam, sem duplicados), `CLAUDE_HOME` inexistente (API 500 `CLAUDE_HOME_UNREADABLE` e UI com mensagem pt-PT).
- **Móvel 375x812 (`mobile.spec.ts`, 5):** sem scroll horizontal, janelas a ecrã inteiro, abrir/fechar as 6 janelas, alvos >= 40 px, linha temporal/Feed sem overflow, seletor de sessão dentro do ecrã.
- **Manual (curl/Node, fora do Playwright):** evento SSE `projects` recebido no stream real do 4100 ao criar um ficheiro em `docs/qa/bugs/` (e removido a seguir); `next build` numa cópia (build OK); pesquisa no código por escritas em disco (`writeFile`, `appendFile`, `unlink`, `rmSync`, `mkdir`, `rename` em `app/`, `lib/`, `components/`, `hooks/`): nenhuma fora dos mocks.

### Bugs
| ID | Título | Severidade | Dono | Estado final |
|---|---|---|---|---|
| BUG-001 | Indicador do Next em `npm run dev` tapa o botão Início | minor | backend-dev | Verified |
| BUG-002 | Linha temporal em ordem descendente (DESIGN: cronológica) | minor | frontend-dev | Verified |
| BUG-003 | Móvel: alvos de toque pequenos e barra de tarefas com botões escondidos | minor | frontend-dev | Verified (limitação residual abaixo) |

Zero bugs abertos.

### Riscos em aberto
1. **Tarefas com dados reais não validadas:** as pastas `~/.claude/tasks/*` desta máquina estão vazias, por isso o formato real dos ficheiros de tarefas só foi testado com as fixtures (inventadas pelo backend a partir do contrato). Se o Claude Code usar outro formato, a janela Tarefas ficará vazia sem erro.
2. **Limitação de UX móvel (BUG-003):** em 375 px a barra só mostra ~3 botões; Feed/Tarefas/Projetos/Memória exigem scroll horizontal (com esbatido como indício).
3. **SSE `projects` e `session`:** `projects` verificado no stream real; o evento `session` (nova sessão no cwd) não foi testado.
4. **Só Chrome, só Windows:** Firefox/Safari, Linux/macOS e acessibilidade formal (leitores de ecrã, contraste) fora do âmbito.
5. **Escritas e carga:** não foi medido desempenho com transcrições muito maiores (maior sessão testada: 1753 eventos); o teste "só-leitura" é por inspeção de código, não por monitorização de I/O.
6. **Fontes Google em `next/font`:** em ambiente sem internet a build/dev pode falhar a obter Inter/JetBrains Mono; não testado offline.
7. O texto de erro da UI refere sempre "localhost:4100", mesmo noutra porta (cosmético, não registado como bug).

### Veredicto
**Verdict: ready.** Todos os casos corridos passam em dev e produção, não há bugs abertos, a atualização ao vivo cumpre o objetivo de < 2 s (medido 112–220 ms) e a reconexão automática funciona. Os riscos acima são conhecidos e não bloqueiam a entrega.
