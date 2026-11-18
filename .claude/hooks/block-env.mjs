#!/usr/bin/env node
// PreToolUse hook: blocks any Claude Code tool call (main session and agents) that touches a local
// env file (.env.local and disguised forms like env.loc*, .env*, ".env" + ".local").
// Secrets stay out of the model's context; Next, vitest and Playwright load the file themselves.
// Wired in .claude/settings.json via $CLAUDE_PROJECT_DIR.
// Best-effort guard against accidental access, not a security boundary: with node/curl pre-approved,
// a determined command (globs like .e*, string concatenation) can still get around it.
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  // If the input cannot be parsed, check the raw text (never let it through by mistake).
  let text = raw;
  try {
    const { tool_name: tool, tool_input: input = {} } = JSON.parse(raw);
    // For file writes only the path counts: docs may mention the file name.
    text = ['Edit', 'Write', 'NotebookEdit'].includes(tool)
      ? String(input.file_path ?? input.notebook_path ?? '')
      : JSON.stringify(input);
  } catch {}
  text = text.toLowerCase().replace(/\\+/g, '\\');
  const suspicious =
    // .env.local, env.loc*, env.l?cal — but not process.env.LOG_LEVEL / process.env.length
    /(^|[^a-z0-9_])\.?env\.l(oc|[?*\[])/.test(text) ||
    /\.env[*?\[{]/.test(text) || // .env*, .env?local, .env[.]local
    /\.env\\?['"`]\s*\+/.test(text) || // ".env" + ".local"
    /local\.env/.test(text);
  if (suspicious) {
    process.stderr.write(
      'Blocked: .env.local is private. No agent reads, searches or edits it. ' +
        'The programs (next, vitest, playwright) load it themselves; there is no need to open it.\n',
    );
    process.exit(2);
  }
  process.exit(0);
});
