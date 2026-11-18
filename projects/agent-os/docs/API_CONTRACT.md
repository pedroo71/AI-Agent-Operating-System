# Agent OS — API Contract

Base: `http://localhost:4100`. Sem autenticação (só localhost). Todas as respostas JSON em UTF-8 (`Cache-Control: no-store`).
Tipos `Session`, `Agent`, `Event`, `Task`, `Project`, `Memory` definidos em `DESIGN.md` § Modelo de dados.
Erros: `{ "error": { "code": string, "message": string } }`.

Códigos de erro: `CLAUDE_HOME_UNREADABLE` (500), `SESSION_NOT_FOUND` (404), `AGENT_NOT_FOUND` (404),
`INVALID_QUERY` (400, parâmetro de query inválido), `FORBIDDEN_HOST` (403, `Host` fora de
localhost/127.0.0.1/[::1] nas portas 4100/4120/4121/4130, ou `Origin` estrangeira em `/api/*`; aplicado
por `middleware.ts`), `TOO_MANY_STREAMS` (429, mais de 20 ligações abertas a `/api/stream`).

O servidor escuta só em `127.0.0.1` (`-H 127.0.0.1`). Todas as respostas levam CSP,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` e `X-Robots-Tag`.

Parâmetros numéricos (`limit`, `events`): inteiro ≥ 1; valores acima do máximo são limitados ao máximo;
valores não numéricos, 0 ou negativos → 400 `INVALID_QUERY`.

## GET /api/sessions
Query: `cwd` (opcional, por omissão o `PRODUCT_TEAM_DIR`; `cwd=all` devolve sessões de todos os cwd), `limit` (opcional, 20, máx 200).
200 → `{ "sessions": Session[] }` ordenado por `lastEventAt` desc.
Se não houver nenhuma pasta de sessões para o cwd **por omissão** (ex.: `CLAUDE_HOME` apontado às fixtures), devolve as sessões de todos os cwd. Um `cwd` explícito sem sessões devolve `[]`.
500 `CLAUDE_HOME_UNREADABLE` se `~/.claude` (ou `CLAUDE_HOME`) não existir.
400 `INVALID_QUERY`.

## GET /api/sessions/:id
Query: `events` (opcional, nº de eventos mais recentes de **todos** os agentes, por omissão 200, máx 2000).
200 → `{ "session": Session, "agents": Agent[], "events": Event[], "tasks": Task[] }`
- `agents[0]` é sempre o agente principal (`id = "main"`); seguem-se os subagentes/teammates.
- `events` em ordem cronológica ascendente (o mais recente é o último).
- `tasks` vazio se a sessão não tiver equipa ou a pasta de tarefas não existir.
404 `SESSION_NOT_FOUND` (também para ids com caracteres inválidos). 400 `INVALID_QUERY`.

## GET /api/sessions/:id/agents/:agentId/events
Query: `before` (ISO ts, opcional; só eventos com `ts` < before), `limit` (opcional, 200, máx 2000; devolve os `limit` mais recentes que satisfazem `before`).
200 → `{ "agent": Agent, "events": Event[] }` cronológico asc.
`agentId` = `"main"` ou o `id` de um `Agent` da sessão.
404 `SESSION_NOT_FOUND` | `AGENT_NOT_FOUND`. 400 `INVALID_QUERY` (limit ou before inválidos).

## GET /api/projects
200 → `{ "projects": Project[] }` — uma entrada por pasta de `PRODUCT_TEAM_DIR/projects/`, ordenada por slug.
`deliverables` (por esta ordem; `present` = ficheiro existe e não está vazio): Brief `docs/BRIEF.md`, Plano `docs/PLAN.md`,
Design `docs/DESIGN.md`, Contrato da API `docs/API_CONTRACT.md`, Plano de testes `docs/qa/TEST_PLAN.md`, Relatório de testes
`docs/qa/TEST_REPORT.md`, Especificação SEO `docs/seo/SEO_SPEC.md`, Auditoria SEO `docs/seo/SEO_AUDIT.md`, Documentação técnica
`docs/TECHNICAL.md`, Documentação funcional `docs/FUNCTIONAL.md`, README `README.md`; mais Marketing `docs/marketing` só se o
BRIEF tiver `Marketing material: yes`.
`planTasks`: `{ agent, text }[]` de `docs/PLAN.md` — dentro de `## Tarefas` (ou `## Tasks`), cada `### <agente>` seguido de itens numerados ou com marcadores; só a 1.ª linha de cada item, sem markdown, ≤ 200 chars; `[]` sem plano. Sem estado.
`bugs`: um por `docs/qa/bugs/BUG-*.md`; `id` = nome do ficheiro sem `.md`; `severity` = `blocker|major|minor` (da linha
`Severity:`; por omissão `minor`); `open` = `false` se a linha `Status:` contiver verified/closed/resolved/wontfix, senão `true`.

## GET /api/memory
200 → `{ "memories": Memory[] }` — `PRODUCT_TEAM_DIR/.claude/agent-memory/<agent>/MEMORY.md` (`agent` = nome da pasta; `updatedAt` = mtime ISO). Agentes sem ficheiro são omitidos.

## GET /api/stream?session=:id
`Content-Type: text/event-stream`. Heartbeat `: ping` a cada 15 s. Ao ligar envia `retry: 2000` e `: connected`.
O stream **não repete o histórico**: o cliente carrega o estado inicial por `GET /api/sessions/:id` e depois aplica os eventos
(deduplicar por `Event.id`; um evento pode coincidir com o que já veio no GET). Latência típica < 1 s (ciclo de 1 s + `fs.watch`).
Eventos:
- `event: event` · `data: Event`
- `event: agent` · `data: Agent` (criado ou estado alterado: estado, nº de chamadas, tokens, ação atual, passagem ativo→inativo)
- `event: tasks` · `data: { "tasks": Task[] }` (lista completa quando algo muda)
- `event: session` · `data: Session` (nova sessão detetada no cwd; o cliente pode mudar)
- `event: projects` · `data: { "projects": Project[] }` (algum ficheiro em `projects/*/docs` mudou)
404 `SESSION_NOT_FOUND` (resposta JSON antes de abrir o stream; também sem o parâmetro `session`).

## Regras
- `Event.id` = `<uuid da linha>:<índice do bloco>` (estável entre GET e stream). `Event.agentId` = `"main"` ou o id do subagente.
- `kind`: `prompt` (texto do utilizador, sem system-reminders), `text` (texto do assistente), `tool_call`, `tool_result`
  (`tool` = ferramenta da chamada correspondente; `isError: true` se `is_error`), `message` (SendMessage enviada — `summary`
  `→ destinatário: …` com `tool: "SendMessage"` — ou mensagem recebida de um colega, `← remetente: assunto`, sem `tool`),
  `system` (linhas `system` com texto).
- `Event.from` / `Event.to` (strings, **só em `kind: "message"`**, sempre presentes nesse caso): nomes de agente iguais a `Agent.name`.
  Enviada (SendMessage): `from` = nome do agente que envia, `to` = `input.to` (`?` se em falta). Recebida (`<teammate-message>`):
  `from` = `teammate_id`, `to` = nome do agente que recebe. O agente principal usa o nome do líder (`team-lead`) ou `main`.
- `summary` de `tool_call`: Read/Write/Edit → caminho; Bash → `description` ou comando truncado a 120 chars; Grep/Glob → padrão; Agent → `subagent_type: description`; SendMessage → `→ destinatário: início da mensagem`; outros → nome da ferramenta.
- Conteúdo de `thinking` nunca é devolvido. Texto truncado a 500 chars (último carácter `…`).
- Linhas JSONL inválidas ou de tipo desconhecido são ignoradas.
- `Agent`: `id` = `"main"` ou o `agentId` do ficheiro `agent-<id>.jsonl`; `name` = `meta.name` (teammates) → `meta.agentType` → id;
  o agente principal usa o nome do líder da equipa (ex.: `team-lead`) ou `main`; `agentType` = `meta.agentType` (`subagent` se faltar);
  `description`/`parentToolUseId` vêm de `meta.description`/`meta.toolUseId`; `model` = último modelo visto na transcrição (ou `pickedEffortModel` da meta);
  `status`: `finished` se `meta.finished` é true; senão `active` se o último evento tem < 60 s, senão `idle`;
  `currentAction` = última ação do assistente numa linha (`Ferramenta: resumo`, `SendMessage → …` ou início do último texto, ≤ 160 chars);
  `toolCalls` = nº de blocos `tool_use`; `tokens` = soma por mensagem do assistente de `input + output + cache_creation` (leituras de cache excluídas; omitido se 0).
- `Session`: `cwd` = `cwd` das linhas da transcrição; `title` = último `ai-title` (campo `aiTitle`), senão início do 1.º prompt, senão `Sessão <8 chars>`;
  `agentCount` = 1 + subagentes; `teamName` presente se existir `teams/*/config.json` com `leadSessionId` igual ao id.
- `Task`: lido de `~/.claude/tasks/<teamName>/*.json` (ou `tasks/<sessionId>` sem equipa). Campos aceites: `id`, `subject`, `status`
  (`pending|in_progress|completed`), `owner`, `blockedBy`. Ordenadas por id numérico.
