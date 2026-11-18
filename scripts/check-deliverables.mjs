#!/usr/bin/env node
// Deterministic delivery gate for a project folder. No dependencies.
// Usage: node scripts/check-deliverables.mjs projects/<slug>
// Exit 0 = all checks pass; exit 1 = at least one failure (listed).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error('Usage: node scripts/check-deliverables.mjs projects/<slug>');
  process.exit(1);
}

const failures = [];
const read = (p) => (existsSync(join(dir, p)) ? readFileSync(join(dir, p), 'utf8') : null);

// File must exist, be non-trivial, and mention each required topic (case-insensitive).
function requireDoc(path, topics = [], minChars = 300) {
  const text = read(path);
  if (text === null) return failures.push(`${path}: missing`);
  if (text.trim().length < minChars) failures.push(`${path}: too short (${text.trim().length} chars)`);
  const lower = text.toLowerCase();
  for (const t of topics) {
    const alts = Array.isArray(t) ? t : [t];
    if (!alts.some((a) => lower.includes(a))) failures.push(`${path}: no section on "${alts[0]}"`);
  }
}

requireDoc('README.md', [['npm ', 'pnpm ', 'docker', 'start']], 100);
requireDoc('docs/TECHNICAL.md', [
  'architecture',
  ['setup', 'install'],
  ['env', 'environment variable'],
  'data model',
  'api',
  'deploy',
  'rollback',
  ['known limitation', 'limitations'],
]);
requireDoc('docs/FUNCTIONAL.md', [['user flow', 'flows'], ['business rule', 'rules']]);
requireDoc('docs/API_CONTRACT.md', [], 200);
requireDoc('docs/qa/TEST_PLAN.md', [], 200);
requireDoc('docs/qa/TEST_REPORT.md', [['verdict', 'ready']]);
requireDoc('docs/seo/SEO_SPEC.md', ['title', 'meta']);
requireDoc('docs/seo/SEO_AUDIT.md', [['verdict', 'spec met']]);
requireDoc('docs/security/THREAT_MODEL.md', [], 200);
requireDoc('docs/security/SECURITY_REPORT.md', [['verdict: secure', 'verdict: seguro']]);
{
  const sec = (read('docs/security/SECURITY_REPORT.md') || '').toLowerCase();
  if (/verdict:\s*(not secure|não seguro|nao seguro)/.test(sec)) failures.push('docs/security/SECURITY_REPORT.md: verdict is not secure');
}

// Field labels may be English or pt-PT (Severity/Severidade, Status/Estado).
const closedRe = /\b(verified|verificad[oa]|closed|fechad[oa]|resolved|resolvid[oa]|won't fix|wont fix)\b/;
const statusOf = (t) => (/(?:status|estado)\W*:?\W*([^\n]*)/.exec(t) || [])[1] || '';

// Open blocker bugs block delivery.
const bugsDir = join(dir, 'docs/qa/bugs');
if (existsSync(bugsDir)) {
  for (const f of readdirSync(bugsDir).filter((n) => n.endsWith('.md'))) {
    const t = readFileSync(join(bugsDir, f), 'utf8').toLowerCase();
    const blocker = /(?:severity|severidade|gravidade)\W*blocker/.test(t);
    if (blocker && !closedRe.test(statusOf(t))) failures.push(`docs/qa/bugs/${f}: open blocker`);
  }
}

// Open critical/high security findings block delivery.
const secDir = join(dir, 'docs/security/findings');
if (existsSync(secDir)) {
  for (const f of readdirSync(secDir).filter((n) => n.endsWith('.md'))) {
    const t = readFileSync(join(secDir, f), 'utf8').toLowerCase();
    const serious = /(?:severity|severidade|gravidade)\W*(critical|crítica|critica|high|alta)/.test(t);
    const accepted = /accepted risk|risco aceite/.test(statusOf(t));
    if (serious && !closedRe.test(statusOf(t)) && !accepted) failures.push(`docs/security/findings/${f}: open critical/high finding`);
  }
}

// Marketing folder is required only when the brief asks for it.
const brief = (read('docs/BRIEF.md') || '').toLowerCase();
if (!read('docs/BRIEF.md')) failures.push('docs/BRIEF.md: missing');
const wantsMarketing = /marketing material:\s*(yes|sim)/.test(brief);
if (wantsMarketing) {
  const m = join(dir, 'docs/marketing');
  if (!existsSync(m) || readdirSync(m).length === 0) failures.push('docs/marketing/: brief asks for marketing but folder is empty');
}

if (failures.length) {
  console.log(`FAIL — ${failures.length} issue(s) in ${dir}:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS — all deliverable checks passed for ${dir}`);
