# Agent OS

Painel local, estilo sistema operativo, para ver ao vivo o que os agentes do Claude Code estão a fazer.

## Arrancar
```bash
cd projects/agent-os
npm install
npm run dev
```
Abre http://localhost:4100.

**Arranque automático:** ao abrir o Claude Code na pasta `product-team`, o hook `SessionStart`
(`.claude/settings.json`) corre `scripts/start-agent-os.mjs`, que arranca o painel em segundo plano
se a porta 4100 estiver livre. Log em `%TEMP%\agent-os-dev.log`. Para desligar: `/hooks`.

## Com dados de exemplo
```bash
CLAUDE_HOME=fixtures/claude-home npm run dev
```

## Testes
```bash
npm test               # testes unitários (parser)
npx playwright test    # e2e: arranca o seu próprio servidor na 4120 com fixtures, numa cópia em %TEMP%
QA_PROD=1 QA_PORT=4121 npx playwright test   # e2e contra a build de produção
```

Documentação: `docs/FUNCTIONAL.md` (o que faz) e `docs/TECHNICAL.md` (como funciona).
