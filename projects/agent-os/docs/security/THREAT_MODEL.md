# Agent OS — Modelo de ameaças (2026-11-17)

## Ativos
- Transcrições de sessões e subagentes em `~/.claude` (prompts, resumos de ficheiros, comandos Bash, resultados): conteúdo sensível, possivelmente com segredos colados pelo utilizador ou impressos por comandos.
- Caminhos locais (`cwd`, nome de utilizador), memórias dos agentes, documentos de `projects/*/docs`.
- A máquina do utilizador (o hook SessionStart lança um processo).

## Pontos de entrada
REST `GET /api/sessions`, `/api/sessions/:id`, `/api/sessions/:id/agents/:agentId/events`, `/api/projects`, `/api/memory`; SSE `/api/stream?session=`; UI em `/`. Parâmetros: `:id`, `:agentId`, `session`, `cwd`, `limit`, `events`, `before`. Entrada indireta: conteúdo dos ficheiros JSONL (pode conter texto controlado por terceiros, p. ex. páginas web lidas por um agente).

## Fronteiras de confiança
1. Browser do utilizador <-> servidor Node em `:4100` (sem autenticação; a segurança assenta em "só localhost").
2. Servidor <-> ficheiros em `~/.claude` e no repo (só leitura; conteúdo não confiável).
3. Outros sites abertos no browser do utilizador <-> `localhost:4100` (cross-origin, DNS rebinding).
4. Outros dispositivos da rede <-> porta 4100 (se escutar em todas as interfaces).

## Quem pode fazer o quê
Qualquer cliente que alcance a porta lê tudo (sem auth, sem verificação de Host/Origin). Nada escreve: só GET; POST devolve 405.

## Principais riscos (ordenados)
1. Exposição na rede: servidor escuta em 0.0.0.0 (SEC-001, SEC-006).
2. DNS rebinding / Host não validado (SEC-002).
3. Dependências com avisos (SEC-003), cabeçalhos em falta (SEC-004), SSE sem limite (SEC-005).
4. XSS por conteúdo de transcrição: mitigado (React escapa; sem `dangerouslySetInnerHTML`/`innerHTML`/`eval`).
5. Path traversal: mitigado (`SAFE_ID` + caminhos fixos); testado.
6. Fuga de segredos: texto truncado a 500 chars, `thinking` omitido, eventos só com `summary`. Sem correspondências a padrões de chaves numa sessão real (outras sessões por confirmar).
