# Agent OS — Design

## Mapa do site
Uma só página `/` (o "ambiente de trabalho"). Tudo o resto são janelas dentro dela.

## Janelas
| Janela | Conteúdo |
|---|---|
| **Agentes** | Um cartão por agente da sessão: nome, tipo, modelo, estado (`ativo` = evento < 60 s, `inativo`, `terminado`), ferramenta/ação atual, nº de chamadas de ferramenta, tokens. Clicar abre **Linha temporal**. |
| **Linha temporal** (por agente) | Eventos cronológicos: prompt recebido, texto, chamada de ferramenta (nome + resumo do input: ficheiro, comando, query), resultado (ok/erro), mensagens enviadas a outros agentes. |
| **Feed** | Todos os eventos da sessão em direto, mais recentes no topo, filtráveis por agente e tipo. |
| **Tarefas** | Lista de tarefas da equipa (`~/.claude/tasks/<team>`): pendente / em curso / concluída, dono, dependências. Se a sessão não tiver lista, mostra as tarefas por agente do `PLAN.md` § Tarefas de cada projeto (sem estado), com escolha de projeto. |
| **Projetos** | Cada `projects/<slug>`: checklist dos entregáveis do CLAUDE.md (existe/não), bugs abertos por severidade. |
| **Memória** | `MEMORY.md` de cada agente, só leitura. |

## Componentes
`Desktop`, `Taskbar` (botão Início com seletor de sessão, botões das janelas abertas, indicador
ao vivo, relógio), `Window` (barra de título, fechar, minimizar, arrastar, foco/z-index),
`AgentCard`, `EventRow`, `TaskRow`, `DeliverableChecklist`, `EmptyState`.

## Direção visual
Sistema operativo escuro e técnico, não retro-kitsch: fundo grafite com grelha subtil, janelas com
vidro ligeiro e bordas de 1 px, tipografia mono para eventos (JetBrains Mono) e sans para UI
(Inter). Cada agente tem uma cor fixa (tech-lead âmbar, frontend ciano, backend violeta, qa verde,
growth rosa, outros cinza) usada no cartão, no feed e na linha temporal. Pulso animado no estado
`ativo`. Respeita `prefers-reduced-motion`. Em ecrãs < 768 px as janelas empilham em ecrã inteiro.

## Modelo de dados (em memória, derivado dos ficheiros)
```ts
Session  { id, cwd, title, startedAt, lastEventAt, teamName?, agentCount }
Agent    { id, name, agentType, model?, description?, parentToolUseId?, status: 'active'|'idle'|'finished',
           lastEventAt, currentAction?, toolCalls, tokens? }
Event    { id, sessionId, agentId, ts, kind: 'prompt'|'text'|'tool_call'|'tool_result'|'message'|'system',
           tool?, summary, isError? }
Task     { id, subject, status: 'pending'|'in_progress'|'completed', owner?, blockedBy: string[] }
Project  { slug, deliverables: { name, path, present }[], bugs: { id, severity, open }[] }
Memory   { agent, content, updatedAt }
```
O agente principal da sessão tem `id = "main"`; subagentes usam o `agentId` do ficheiro.

---

## v2 — Redesenho "Neural Graph + Órbita" (aprovado em 2026-11-16)

> **2026-11-18:** a vista Órbita e o alternador foram removidos (não acrescentavam valor). A vista central é só o Grafo, também no telemóvel. O texto abaixo fica como histórico.
Substitui o ambiente de trabalho com janelas. Maquetes de referência (abrir no browser só para ver o
aspeto; o código final é React/Tailwind): `docs/design/B-neural-graph.html` (base) e
`docs/design/A-mission-control.html` (só a secção "Órbita"). Quadro: https://claude.ai/artifact/6muJjQ64Mh8VuYt74MHwLW

### Layout (desktop ≥ 1024 px)
```
┌rail┬ header: Agent OS / título da sessão ········· ● Ao vivo · latência · relógio ┬───────────────┐
│ ⌘  │ vista central (alternador  [Grafo | Órbita])                                  │ painel direito│
│ ◎  │                                                                                │ [Inspetor|Feed]│
│ ☰  │                                                                                │               │
│ ▤  ├────────────────────────────────────────────────────────────────────────────────┤               │
│ ◍  │ linha do tempo da sessão: uma pista por agente, blocos = períodos com eventos  │               │
└────┴────────────────────────────────────────────────────────────────────────────────┴───────────────┘
```
- **Rail** (64 px, ícones SVG com `aria-label`, alvos ≥ 44 px): Equipa (grafo/órbita) · Tarefas · Projetos · Memória · Sessões (seletor). Tarefas/Projetos/Memória substituem a vista central; o painel direito mantém-se.
- **Header**: nome, título da sessão, indicador Ao vivo/Desligado (pulso), latência do último evento, relógio.
- **Vista Grafo**: um nó-cartão por agente (ponto de cor, nome, estado, ação atual em mono). Arestas entre agentes que trocaram mensagens; a aresta anima (traço a correr) durante 4 s após uma mensagem nova e mostra a bolha com o início da mensagem. Nós arrastáveis; posições guardadas em `localStorage` por sessão (try/catch). Fundo de pontos. Zoom com roda + botões ±.
- **Vista Órbita**: agente principal (team-lead) no núcleo; restantes em círculo, igualmente espaçados; anel tracejado e anel interior a rodar devagar; linha núcleo→agente acende com gradiente quando há mensagem entre eles (4 s) e mostra a bolha; nó ativo com brilho; terminado com opacidade 0,6. Mesmo clique = selecionar.
- **Alternador Grafo/Órbita** no canto superior da vista central; escolha guardada em `localStorage`.
- **Painel direito**: separadores **Inspetor** (agente selecionado: nome, modelo, nº ferramentas, nº erros, tokens, linha temporal cronológica com o mais recente no fim e auto-scroll) e **Feed** (todos os eventos, mais recente no topo, filtro por agente).
- **Linha do tempo da sessão**: pista por agente com blocos onde houve eventos (bins de 1 min) e marcador "agora"; clicar num bloco seleciona o agente e salta o Inspetor para esse momento.
- Seleção por omissão: o agente ativo mais recente.

### Visual
Fundo `#0a0a0f`, superfícies `#15151d`/`#121218`, bordas `#1d1d28`/`#2e2e3e`, texto `#e6e6ef`, secundário `#9a9ab0`. Acento verde-lima `#c6f36b` (ao vivo, seleção, arestas animadas). Cores por agente mantêm-se (tech-lead/team-lead âmbar `#f5b84b`, frontend ciano `#4cd6e8`, backend violeta `#a78bfa`, qa verde `#5bd69a`, growth rosa `#f48fb1`, outros `#9a9ab0`). Inter para UI, JetBrains Mono para ações/eventos. `prefers-reduced-motion`: sem animações de arestas/anéis. Contraste ≥ 4.5:1.

### Mobile (< 768 px)
Rail passa a barra de separadores em baixo (Equipa, Feed, Tarefas, Projetos, Memória); vista central a ecrã inteiro (órbita por omissão, cabe melhor); Inspetor abre como folha inferior ao tocar num nó; linha do tempo escondida.

### Dados novos
Evento `message` passa a ter `from` e `to` (nomes dos agentes) — ver API_CONTRACT.md — para desenhar arestas sem interpretar texto.
