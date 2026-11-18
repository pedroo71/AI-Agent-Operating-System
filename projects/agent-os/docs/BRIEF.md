# Agent OS — Brief

## Objetivo
Um painel local, estilo "sistema operativo", onde o utilizador vê **ao vivo** o que os agentes da equipa
(tech-lead, frontend-dev, backend-dev, qa-engineer, growth-strategist e quaisquer subagentes) estão
a fazer: quem está ativo, a última ação de cada um, ferramentas usadas, mensagens trocadas, tarefas
da equipa e o estado dos entregáveis de cada projeto.

## Público
O utilizador, na própria máquina, enquanto a equipa trabalha num projeto ou gig.

## Âmbito
- Lê, em modo só-leitura, os ficheiros que o Claude Code já escreve em `~/.claude`:
  - `projects/<cwd-codificado>/<sessionId>.jsonl` — transcrição da sessão principal
  - `projects/<cwd-codificado>/<sessionId>/subagents/agent-*.jsonl` + `.meta.json` — subagentes/teammates
  - `teams/<team>/config.json` — membros da equipa
  - `tasks/<team>/*.json` — lista de tarefas partilhada
- Lê do repositório `product-team`: `projects/*/docs/**` (estado dos entregáveis, bugs) e
  `.claude/agent-memory/*/MEMORY.md`.
- Atualização ao vivo por Server-Sent Events (sem refresh manual), latência alvo < 2 s.
- Interface "desktop": janelas para Agentes, Feed de atividade, Tarefas, Projetos, Memória, com
  barra de tarefas e relógio. Clicar num agente abre a sua linha temporal detalhada.
- Filtro por sessão (por omissão: a sessão mais recente do `product-team`).

## Fora de âmbito
- Controlar agentes (enviar mensagens, parar, aprovar) — só observação.
- Autenticação, multiutilizador, alojamento na internet.
- Custos/faturação exatos (mostra só contagem de tokens se existir na transcrição).
- Histórico além do que está nos ficheiros do Claude Code.

## Pressupostos
- Corre só em `localhost`; o formato das transcrições é interno ao Claude Code e pode mudar — o parser ignora linhas que não reconhece.
- O conteúdo de "thinking" não é mostrado (vem vazio/assinado).
- Pasta `~/.claude` configurável por `CLAUDE_HOME`; repositório por `PRODUCT_TEAM_DIR`.
- Interface em pt-PT.
- SEO: ferramenta local, o requisito é metadados corretos e `noindex`.

Marketing material: no
