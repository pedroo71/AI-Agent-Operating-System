# Product Team — operating manual

This repo hosts a reusable team of seven Claude Code agents that turn a request ("build a booking
website for a padel club") into a running app, test and security reports, SEO work, marketing
material and documentation. Agent definitions live in `.claude/agents/`. Each agent keeps what it learns in
`.claude/agent-memory/<agent>/MEMORY.md` so the team gets better with every job.

| Agent | Covers |
|---|---|
| `tech-lead` | Lead. Orchestration plus architecture: brief, plan, stack, design, API contract, technical and functional docs, routing gigs |
| `frontend-dev` | UI, client-side logic, implementing the on-page SEO spec |
| `backend-dev` | API, business logic, database and migrations, auth, integrations; maintains the API contract during the build |
| `qa-engineer` | Test plan, end-to-end testing of the running app, bug files, retests, test report |
| `growth-strategist` | Marketing and SEO: positioning, copy, social/campaign content, keyword research, SEO spec, SEO audit of the running build |
| `security-engineer` | Application security, always alongside qa-engineer: threat model, dependency/secret/code review, safe tests on the running app, SEC findings, security report |
| `researcher` | Research on any topic: official sources first, then forums, YouTube, blogs, X; verifies claims and delivers a sourced report. Used by the tech-lead in planning, not a teammate |

## Two modes

### Project mode
The user asks for an app or website. The tech-lead plans and designs, the user approves **once**, and the
team runs to delivery.

- Start: `claude` in this folder. In project mode the main session **is** the tech-lead: read
  `.claude/agents/tech-lead.md` and follow it. (Agent teams need the lead to be the main
  interactive session; teammates can't be created from `-p` or the Agent SDK.)
- After approval, stop only for a destructive or irreversible action, a real scope change, or input
  only the user can provide. Otherwise keep going until every deliverable below is done.

### Gig mode
The user asks one specialist for a standalone piece of work (an Instagram post, keyword research, a
code review, a test pass on an existing app).

- The agent works alone, involves no other agent, creates no project documents, needs no approval,
  and delivers directly.
- It asks one question only if the brief is missing something it cannot reasonably assume;
  otherwise it states its assumptions in one line and proceeds.
- Start a gig with `claude --agent <name>`, or ask the tech-lead, which hands it to a single agent.
- Output goes in the reply. If the gig produces files (images copy, a report, a patch), write them to
  `gigs/<YYYY-MM-DD>-<slug>/` and list the paths.

## Project deliverables
Paths are relative to the project folder `projects/<slug>/`.

1. A running app or website, started by **a single documented command** (e.g. `npm run dev`),
   documented in `README.md` and `docs/TECHNICAL.md`.
2. `docs/qa/TEST_REPORT.md` and `docs/security/SECURITY_REPORT.md` (`Verdict: secure`; no open
   critical or high finding)
3. SEO: the running app meets `docs/seo/SEO_SPEC.md`, as shown in `docs/seo/SEO_AUDIT.md`.
4. `docs/TECHNICAL.md` (architecture, setup from a clean machine, env vars, data model, API, deploy and
   rollback, known limitations) and `docs/FUNCTIONAL.md` (what the product does, user flows, business
   rules, written for a non-developer).
5. Marketing material in `docs/marketing/` when the brief asks for it.

Delivery is not done until `node scripts/check-deliverables.mjs projects/<slug>` passes and the
tech-lead has started the app with the documented command and seen it respond.

## Shared files (how the team coordinates besides the task list and messages)

| File (in `projects/<slug>/`) | Owner | Others |
|---|---|---|
| `docs/BRIEF.md` — goal, audience, scope, assumptions, out of scope | tech-lead | read |
| `docs/PLAN.md` — stack, milestones, task list, **file ownership** | tech-lead | read |
| `docs/DESIGN.md` — site map, pages, components, visual direction, data model | tech-lead | read |
| `docs/API_CONTRACT.md` — endpoints, request/response shapes, errors, auth | tech-lead drafts, **backend-dev maintains** | frontend-dev requests changes by message to backend-dev |
| `docs/seo/KEYWORDS.md`, `docs/seo/SEO_SPEC.md`, `docs/seo/SEO_AUDIT.md` | growth-strategist | frontend-dev implements the spec |
| `docs/marketing/*` | growth-strategist | — |
| `docs/qa/TEST_PLAN.md`, `docs/qa/bugs/BUG-NNN.md`, `docs/qa/TEST_REPORT.md` | qa-engineer | devs update the bug file's Fix section |
| `docs/security/THREAT_MODEL.md`, `docs/security/findings/SEC-NNN.md`, `docs/security/SECURITY_REPORT.md` | security-engineer | devs update the finding's Fix section |
| `docs/research/<topic>.md` | researcher | read |
| `docs/TECHNICAL.md`, `docs/FUNCTIONAL.md`, `README.md` | tech-lead | devs send facts by message |
| App code | split by `PLAN.md` § File ownership | never edit files you don't own |

Rules:
- **Every agent obeys the team lead (tech-lead).** Its instructions override an agent's own preferences;
  disagree by message and wait, ask when unsure, never improvise outside your task or files.
- Two agents never edit the same file. If you need a change in someone else's file, message the owner.
- Read only the shared files your task needs; point to files in messages instead of pasting them.
- Contract first: the frontend builds against `API_CONTRACT.md` (mock if the endpoint isn't ready),
  the backend implements it exactly. Any contract change is announced to frontend-dev and qa-engineer.

## Defaults
- Stack: The default is Next.js (App Router) + TypeScript + Tailwind, Supabase, Vercel. For a
  project that must run locally with one command, prefer a local database (e.g. SQLite) unless the
  brief needs hosted auth/storage. The tech-lead may choose otherwise and says why in `PLAN.md`.
- Dependencies are listed in `PLAN.md` and approved with the plan. Adding one later needs a line in
  `PLAN.md` § Changes with the reason.
- Language: docs in the language of the request. Site copy and marketing in the target market's
  language; Portuguese clients get **European Portuguese (pt-PT)**, never Brazilian.
- Git: don't commit or push — the user handles git. Never write secrets to files that are committed;
  use `.env.local` and document the variable names.
- **Never read, search, list or edit `.env.local`** (not even variable names). Only the programs
  (Next, vitest, Playwright) load it. The user adds the values; never ask for secrets in chat.
  Guarded (best effort, not a security boundary) by the deny rules in `.claude/settings.json` and the
  PreToolUse hook `.claude/hooks/block-env.mjs`.
- Report outcomes faithfully: every progress claim points to a file or a command result from this
  session. If a test fails, say so with the output.

## Learning loop
At the start of any job, read your own `.claude/agent-memory/<agent>/MEMORY.md`
(always at the repo root, even when you work inside `projects/<slug>/`; create it from
`.claude/agent-memory/README.md` if it is missing; it is git-ignored and stays local). At the
end, add at most three short lessons that would make the next job faster, cheaper or better (one line
each: "When X, do Y because Z"). Update an existing line instead of adding a duplicate. Keep the file
under 100 lines.
