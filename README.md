# Product Team

A reusable seven-agent Claude Code team. Rules, modes and deliverables: `CLAUDE.md`.

## Requirements
- [Claude Code](https://docs.claude.com/en/docs/claude-code) (agent teams are an experimental feature)
- Node.js ≥ 20 and npm
- Optional, for the live dashboard: `cd projects/agent-os && npm install` (see `projects/agent-os/README.md`)

`projects/` and `gigs/` hold your own work. `gigs/*` is git-ignored; `projects/agent-os` ships as the
team's live dashboard.

## Project mode
```
git clone <repo-url> product-team
cd product-team
claude
> Build a booking website for a padel club in Évora. Marketing material: yes.
```
The main session acts as the tech-lead, plans, asks for approval once, then runs the team.
Projects land in `projects/<slug>/`. Delivery gate: `node scripts/check-deliverables.mjs projects/<slug>`.

## Gig mode
```
claude --agent growth-strategist "Instagram post announcing evening padel classes, pt-PT"
claude --agent qa-engineer "Test pass on the app at http://localhost:3000"
claude --agent researcher "Compara Supabase Auth e Clerk para uma app pequena em Portugal: preço, RGPD, limites"
claude --agent security-engineer "Revisão de segurança do projects/agent-os e da app em http://localhost:4100"
```
Or ask the tech-lead in a normal session and it hands the gig to one agent.

## Agents
`.claude/agents/` — tech-lead, frontend-dev, backend-dev, qa-engineer, security-engineer,
growth-strategist, researcher. In projects, security-engineer runs alongside qa-engineer and its
`docs/security/SECURITY_REPORT.md` is part of the delivery gate; researcher is called by the
tech-lead when a decision needs facts.
Each keeps lessons in `.claude/agent-memory/<agent>/MEMORY.md`, created on first use and git-ignored
(they describe what you worked on); see `.claude/agent-memory/README.md`.

On Windows, teammates run in-process: ↑/↓ in the agent panel to select, Enter to open, Ctrl+T for the task list.

## What `.claude/settings.json` turns on (review before your first session)
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`: agent teams, for this folder only.
- **Pre-approved commands**: `npm`, `npx`, `node`, `pnpm`, `curl`, `ls`, `mkdir` and read-only git run
  without a prompt. That is effectively arbitrary code execution by the agents; remove entries from
  `permissions.allow` if you want to approve each one. `git commit`/`git push` are denied: you handle git.
- **PreToolUse hook** `.claude/hooks/block-env.mjs` plus deny rules: no agent reads, searches or edits
  `.env.local`. Put secrets there yourself; Next, vitest and Playwright load it. This is a best-effort
  guard against accidental access, not a security boundary (globs or string concatenation in a
  pre-approved `node`/`curl` command can get around it).
- **SessionStart hook** `scripts/start-agent-os.mjs`: if port 4100 is free and `projects/agent-os` has
  `node_modules`, it starts the dashboard on http://127.0.0.1:4100 (localhost only; log in your temp
  folder). To turn it off, delete the `SessionStart` entry, or put your own overrides in
  `.claude/settings.local.json` (git-ignored).

## License
MIT — see `LICENSE`.
