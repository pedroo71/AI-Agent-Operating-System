# Agent OS — Plano de testes

Autor: qa-engineer · Entradas: `BRIEF.md`, `PLAN.md`, `DESIGN.md`, `API_CONTRACT.md`.

## 1. Âmbito
Dentro:
- API REST e SSE conforme `API_CONTRACT.md` (formas, códigos de erro, regras de `summary`, truncagem, `thinking` omitido, linhas inválidas ignoradas).
- UI desktop v2 em `/`: rail, header, vista Grafo/Órbita, painel Inspetor/Feed, linha do tempo da sessão, Tarefas/Projetos/Memória, seletor de sessão, indicador ao vivo.
- Atualização ao vivo (< 2 s) e reconexão após reinício do servidor.
- Largura móvel 375 px (barra de separadores em baixo, folha do Inspetor, < 768 px).
- Metadados básicos (title, `lang=pt-PT`, `noindex`, favicon) — verificação rápida; a auditoria SEO é do growth-strategist.
- Só-leitura: a app nunca altera `~/.claude` nem o repositório.

Fora de âmbito: controlar agentes, autenticação, custos, desempenho sob carga, navegadores além de Chromium, Linux/macOS, acessibilidade formal (apenas verificação de `prefers-reduced-motion` se houver tempo).

## 2. Ambientes
| Ambiente | Configuração |
|---|---|
| A — fixtures | `CLAUDE_HOME=fixtures/claude-home` (e `PRODUCT_TEAM_DIR` apontado para o repo), porta 4100 |
| B — real | `~/.claude` real do utilizador, só leitura (nenhuma escrita) |
| Desktop | Chromium 1280x800 |
| Móvel | Chromium 375x812 |
Sistema: Windows 11, Node actual, `npm run dev`.

Os testes que escrevem (anexar linha a `.jsonl`) correm **apenas** em fixtures, sobre uma cópia temporária da pasta de fixtures quando possível.

## 3. Casos de teste

### 3.1 API (contrato)
| ID | Caso | Esperado |
|---|---|---|
| API-01 | `GET /api/sessions` (fixtures) | 200, `sessions[]` com `id,cwd,title,startedAt,lastEventAt,agentCount`; ordenado por `lastEventAt` desc |
| API-02 | `GET /api/sessions?limit=1` | no máximo 1 sessão |
| API-03 | `GET /api/sessions` com `CLAUDE_HOME` inexistente | 500 `CLAUDE_HOME_UNREADABLE` com corpo `{error:{code,message}}` |
| API-04 | `GET /api/sessions/:id` | 200 com `session, agents, events, tasks`; agente principal com `id="main"` |
| API-05 | `?events=5` / `?events=99999` | 5 eventos mais recentes / limitado a 2000 |
| API-06 | `/api/sessions/inexistente` | 404 `SESSION_NOT_FOUND` |
| API-07 | `/api/sessions/:id/agents/:agentId/events` | 200, `agent` + `events` em ordem cronológica ascendente |
| API-08 | `before=<ts>` e `limit` | só eventos anteriores a `ts`; respeita `limit` |
| API-09 | agente inexistente / sessão inexistente | 404 `AGENT_NOT_FOUND` / `SESSION_NOT_FOUND` |
| API-10 | `GET /api/projects` | 200, `projects[]` com `slug, deliverables[{name,path,present}], bugs[{id,severity,open}]` |
| API-11 | `GET /api/memory` | 200, `memories[]` com `agent, content, updatedAt` |
| API-12 | Regras de `summary` (Read/Write/Edit caminho; Bash descrição ou 120 chars; Grep/Glob padrão; Agent `tipo: descrição`; SendMessage `→ destinatário: ...`; outras = nome) | conforme contrato |
| API-13 | `thinking` nunca presente em nenhuma resposta | nenhum texto de thinking |
| API-14 | Texto > 500 chars | truncado a 500 |
| API-15 | Linhas JSONL inválidas / tipo desconhecido nas fixtures | ignoradas, sem 500 |
| API-16 | Enums: `status` de agente, `kind` de evento, `status` de tarefa dentro do contrato | valores válidos |
| API-17 | `GET /api/stream?session=inexistente` | 404 JSON `SESSION_NOT_FOUND` (não abre stream) |
| API-18 | `GET /api/stream?session=<id>` | `Content-Type: text/event-stream`; liga-se |
| API-19 | Anexar linha válida a `.jsonl` | `event: event` recebido < 2 s com `Event` válido |
| API-20 | Alterar `tasks/*.json` / ficheiro em `projects/*/docs` | `event: tasks` / `event: projects` |
| API-21 | Linha parcial (sem `\n` final) e depois completada | sem evento duplicado nem perdido; sem crash |
| API-22 | Contra `~/.claude` real: todos os endpoints GET | 200, formas válidas, sem exceções, nenhum thinking, tempo de resposta razoável (< 3 s) |
| API-23 | Só-leitura: mtime/hash de `~/.claude` e repo inalterados após a bateria | inalterados |
| API-24 | Caracteres especiais (acentos pt-PT, emoji) em `summary` | UTF-8 correcto |
| API-25 | Eventos `message`: `from`/`to` | enviada: from=agente, to=destinatário; recebida: from=remetente, to=agente; forma conforme contrato v2; eventos não-`message` sem estes campos (ou conforme contrato) |

### 3.2 UI desktop v2 (Playwright, 1280x800; layout completo >= 1024 px)
O v1 (janelas, barra de tarefas, Início) foi substituído; casos UI-03..UI-06 e UI-13 do v1 ficam obsoletos. Seletores concretos: pendentes da mensagem do frontend-dev.
| ID | Caso | Esperado |
|---|---|---|
| UI-01 | Abrir `/` | carrega sem erros na consola; rail, header, vista central, painel direito e linha do tempo visíveis |
| UI-02 | Metadados | `<html lang="pt-PT">`, `<title>`, `meta robots noindex`, favicon |
| UI-20 | Rail: 5 itens com `aria-label` (Equipa, Tarefas, Projetos, Memória, Sessões), alvos >= 44 px | presentes e visíveis |
| UI-21 | Navegar Tarefas / Projetos / Memória / Equipa | a vista central muda; o painel direito mantém-se; conteúdo corresponde à API |
| UI-22 | Header: título da sessão, indicador Ao vivo, latência, relógio | visíveis; relógio avança |
| UI-23 | Alternador Grafo/Órbita | muda a vista; escolha persiste em `localStorage` após recarregar |
| UI-24 | Grafo: um nó por agente (nome, estado, ação atual); arestas só entre agentes que trocaram mensagens | corresponde à API (`from`/`to`) |
| UI-25 | Órbita: agente principal no núcleo, restantes em círculo | nº de nós = nº de agentes |
| UI-26 | Clicar num nó (Grafo e Órbita) | nó fica selecionado; Inspetor mostra esse agente (nome, modelo, ferramentas, erros, tokens) |
| UI-27 | Seleção por omissão | agente ativo mais recente (ou principal se nenhum ativo) |
| UI-28 | Inspetor: linha temporal em ordem cronológica, mais recente no fim | ordem ascendente; auto-scroll ao fim |
| UI-29 | Separador Feed: mais recentes no topo; filtro por agente | filtro funciona |
| UI-30 | Linha do tempo da sessão: pista por agente, blocos, marcador "agora"; clicar num bloco | seleciona o agente e o Inspetor salta para esse momento |
| UI-31 | Arrastar nó no Grafo | posição muda e persiste em `localStorage` por sessão após recarregar |
| UI-32 | Zoom (botões +/- e roda) no Grafo | escala muda |
| UI-33 | Seletor de sessões (rail) | muda os dados; por omissão a mais recente |
| UI-14 | Estados vazios (pt-PT) | mensagem em vez de ecrã em branco |
| UI-15 | Texto em pt-PT (sem "arquivo", "tela", ...) | conforme |
| UI-16 | `prefers-reduced-motion` | sem animação de arestas/anéis |
| UI-34 | Tarefas, Projetos, Memória | conteúdo corresponde à API (checklist, bugs por severidade, MEMORY.md) |

### 3.3 Ao vivo
| ID | Caso | Esperado |
|---|---|---|
| LIVE-01 | Indicador "ao vivo" após abrir | ligado |
| LIVE-02 | Anexar linha ao `.jsonl` (fixture temporária) | aparece no Feed (topo) em <= 2 s sem refresh |
| LIVE-03 | Mesma linha no Inspetor do agente selecionado | <= 2 s |
| LIVE-04 | Nó do agente atualiza (ação atual/estado ativo) | <= 2 s |
| LIVE-05 | Parar o servidor | indicador "desligado" |
| LIVE-06 | Reiniciar o servidor | reconecta sozinho, volta a "ao vivo", novos eventos chegam |
| LIVE-07 | Sem duplicados de evento após reconexão | cada `id` uma vez |
| LIVE-08 | Mensagem nova entre dois agentes (`SendMessage` anexado) | aresta (Grafo) / linha núcleo->agente (Órbita) fica em estado animado ~4 s com bolha, depois volta ao normal |
| LIVE-09 | Aresta animada com `prefers-reduced-motion` | sem animação |

### 3.4 Móvel v2 (375x812)
| ID | Caso | Esperado |
|---|---|---|
| MOB-01 | Abrir `/` | sem scroll horizontal; barra de separadores em baixo com Equipa, Feed, Tarefas, Projetos, Memória |
| MOB-02 | Vista Equipa | órbita por omissão; cabe no ecrã |
| MOB-03 | Alternar separadores | cada um mostra o seu conteúdo; alvos >= 40 px, todos os 5 visíveis sem scroll |
| MOB-04 | Tocar num nó | Inspetor abre como folha inferior; consegue fechar |
| MOB-05 | Linha do tempo da sessão | escondida |
| MOB-06 | Feed e Inspetor em móvel | sem texto ilegível nem overflow |

### 3.5 Robustez
| ID | Caso | Esperado |
|---|---|---|
| ROB-01 | `CLAUDE_HOME` inválido | UI mostra erro compreensível, não crash |
| ROB-02 | Sessão com 0 eventos / sem subagentes | estado vazio |
| ROB-03 | Ficheiro `.jsonl` com linha corrompida a meio | resto continua |
| ROB-04 | Tentativas de path traversal em `:id` / `:agentId` (`..%2f`) | 404, nunca lê fora de `CLAUDE_HOME` |
| ROB-05 | Métodos não-GET (POST/DELETE) em `/api/*` | 405 ou equivalente, sem escrita |

## 4. Critérios
- Passa: todos os casos de API e UI-01, UI-20..UI-34, LIVE-01..LIVE-08, MOB-01..MOB-05 sem bugs blocker/major abertos.
- Veredicto "pronto" exige zero blockers e zero majors abertos.

## 5. Automatização
- `tests/e2e/api.spec.ts` (Playwright `request`): API-*.
- `tests/e2e/ui.spec.ts`, `live.spec.ts`, `mobile.spec.ts`: UI, LIVE, MOB.
- Casos manuais (curl, inspecção) registados no `TEST_REPORT.md`.
- Execução: `npx playwright test` com `playwright.config.ts` (webServer = `npm run dev`, `CLAUDE_HOME=fixtures/claude-home`).
