# Agent OS — Relatório de segurança

Âmbito: código em `projects/agent-os` (lib/claude, app/api, components, hooks, lib/client, next.config.ts, package.json), `scripts/start-agent-os.mjs` e a entrada em `.claude/settings.json`; app em execução em `localhost:4100` (só pedidos GET seguros). Data: 2026-11-17.

## O que foi verificado
1. Modelo de ameaças: `THREAT_MODEL.md`.
2. Dependências: `npm audit` (9 avisos; ver SEC-003).
3. Segredos/config: sem `dangerouslySetInnerHTML`/`innerHTML`/`eval`; ficheiros de ambiente no `.gitignore`; varrimento de padrões de chaves (sk-, ghp_, AKIA, JWT, BEGIN) nos eventos de uma sessão real (1 520 eventos): 0 correspondências. `thinking` não é devolvido. Ficheiros de ambiente não foram abertos.
4. Código: path traversal mitigado (`SAFE_ID`, caminhos fixos; `..%2f`, `%00`, `\` -> 404); validação de `limit`/`before` correta (400); POST -> 405; erros sem stack trace (a mensagem reflete o id, mas em JSON); XSS mitigado pelo escape do React.
5. Dinâmico: escuta em 0.0.0.0 e acessível pelo IP da LAN (SEC-001); `Host` arbitrário aceite (SEC-002); sem CORS aberto; cabeçalhos de segurança em falta (SEC-004).

## Constatações
| ID | Título | Severidade | Dono | Estado |
|---|---|---|---|---|
| SEC-001 | Escuta em todas as interfaces, sem auth | high | backend-dev | Verified |
| SEC-006 | Hook arranca servidor sem `-H 127.0.0.1` | high | tech-lead | Verified |
| SEC-002 | Host/Origin não validados (DNS rebinding) | medium | backend-dev | Verified |
| SEC-003 | Dependências com avisos (dev/build) | low | backend-dev | Accepted risk |
| SEC-004 | Cabeçalhos de segurança em falta | low | backend-dev | Verified |
| SEC-005 | SSE sem limite de ligações | low | backend-dev | Verified |

## Não coberto
Teste de carga SSE (proibido); varrimento de segredos em todas as sessões (só uma); build `.next-sec` (não foi necessário); firewall do Windows (não alterada; só se observou que a LAN alcança a porta); `npm start` em produção.

## Riscos aceites
- SEC-003 (low), aceite pelo tech-lead em 2026-11-17: vitest/tinypool e postcss do next só correm em desenvolvimento e build, numa app só local; limpar obriga a subir versões maiores. Revisitar quando o next for atualizado.

## Reteste (2026-11-17)
Servidor escuta em 127.0.0.1:4100; IP da LAN sem ligação; Host/Origin estranhos -> 403; cabeçalhos de segurança presentes; teto de 20 ligações SSE; hook com -H 127.0.0.1. Todos os high/medium verificados.

Verdict: secure
