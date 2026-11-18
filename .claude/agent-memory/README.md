# Agent memory

Each agent keeps its lessons in `.claude/agent-memory/<agent>/MEMORY.md` (one line each:
"When X, do Y because Z"; max 100 lines). The files are created on first use and are **git-ignored**:
lessons describe the projects and topics you worked on, so they stay on your machine.

Start of a new file:

```markdown
# <agent> — lessons

One line each: "When X, do Y because Z". Max 100 lines. Update, do not duplicate.
```
