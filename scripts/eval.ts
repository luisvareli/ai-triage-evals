/**
 * Evaluates the assistant, prints a report and applies the release gate.
 *
 *   npm run eval              compare with data/baseline.json, exit 1 if the gate fails
 *   npm run eval:baseline     accept the current behaviour as the new baseline
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { baseline as assistant } from '../src/assistant/baseline';
import { evaluate, type EvalResult } from '../src/evaluate';
import { failed, gate } from '../src/gate';
import type { Ticket } from '../src/types';

const tickets = JSON.parse(readFileSync(new URL('../data/tickets.json', import.meta.url), 'utf8')) as Ticket[];
const baselineFile = new URL('../data/baseline.json', import.meta.url);

const result = await evaluate(assistant, tickets);

if (process.argv.includes('--write-baseline')) {
  // One ticket per line, so a change in the baseline reads clearly in a diff.
  const { cases, ...summary } = result;
  const lines = cases.map((c) => `    ${JSON.stringify(c)}`).join(',\n');
  writeFileSync(baselineFile, `${JSON.stringify(summary, null, 2).slice(0, -2)},\n  "cases": [\n${lines}\n  ]\n}\n`);
  console.log('Baseline written to data/baseline.json. Review the diff before committing it.');
  process.exit(0);
}

const previous = existsSync(baselineFile) ? (JSON.parse(readFileSync(baselineFile, 'utf8')) as EvalResult) : undefined;
const checks = gate(result, previous);
const wrong = result.cases.filter((c) => !(c.category_ok && c.priority_ok && c.escalation_ok)).map((c) => c.id);

const report = [
  `## Evaluation: ${result.assistant}`,
  '',
  `${result.tickets} tickets, ${result.runs} runs each, ${Object.keys(result.metamorphic).length} rewrites of every ticket.`,
  '',
  '| Check | Result | |',
  '| --- | --- | --- |',
  ...checks.map((c) => `| ${c.id} | ${c.detail} | ${c.passed ? 'pass' : '**FAIL**'} |`),
  '',
  `Tickets graded wrong: ${wrong.length ? wrong.join(', ') : 'none'}.`,
  '',
  failed(checks).length ? `**Gate closed.** Failed: ${failed(checks).join(', ')}` : '**Gate open.** This version is no worse than the baseline.',
].join('\n');

console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
process.exit(failed(checks).length ? 1 : 0);
