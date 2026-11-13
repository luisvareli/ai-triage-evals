import { OUTPUT_CHECKS } from './checks';
import { TRANSFORMATIONS } from './metamorphic';
import { TriageSchema, type Assistant, type Ticket, type Triage } from './types';

export interface CaseResult {
  id: string;
  category_ok: boolean;
  priority_ok: boolean;
  escalation_ok: boolean;
  consistency: number;
}

export interface EvalResult {
  assistant: string;
  runs: number;
  tickets: number;
  metrics: {
    schema_valid: number;
    category_accuracy: number;
    priority_accuracy: number;
    escalation_recall: number;
    escalation_precision: number;
    consistency: number;
  };
  metamorphic: Record<string, number>;
  /** Check id -> ticket ids where at least one output broke it. */
  violations: Record<string, string[]>;
  cases: CaseResult[];
}

const labels = (t: Triage) => `${t.category}|${t.priority}|${t.needs_human}`;
const ratio = (hits: number, total: number) => (total === 0 ? 1 : hits / total);

async function ask(assistant: Assistant, text: string): Promise<Triage | null> {
  try {
    const parsed = TriageSchema.safeParse(await assistant.triage(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // an assistant that throws is an assistant that returned nothing usable
  }
}

/**
 * Runs every ticket several times. One run tells you what the assistant said
 * once; several runs tell you whether it would say the same thing tomorrow.
 */
export async function evaluate(assistant: Assistant, tickets: Ticket[], runs = 5): Promise<EvalResult> {
  let outputs = 0, valid = 0;
  const violations: Record<string, Set<string>> = Object.fromEntries(OUTPUT_CHECKS.map((c) => [c.id, new Set<string>()]));
  const metamorphicHits: Record<string, number> = Object.fromEntries(TRANSFORMATIONS.map((t) => [t.id, 0]));
  const cases: CaseResult[] = [];
  let flaggedRight = 0, shouldFlag = 0, flagged = 0;

  const inspect = (ticket: Ticket, text: string, output: Triage) => {
    for (const check of OUTPUT_CHECKS) {
      if (check.violated(text, output)) violations[check.id]!.add(ticket.id);
    }
  };

  for (const ticket of tickets) {
    const votes = new Map<string, { count: number; output: Triage }>();
    for (let run = 0; run < runs; run++) {
      outputs++;
      const output = await ask(assistant, ticket.text);
      if (!output) continue;
      valid++;
      inspect(ticket, ticket.text, output);
      const key = labels(output);
      votes.set(key, { count: (votes.get(key)?.count ?? 0) + 1, output });
    }

    // The answer the assistant gives most often is the one that gets graded.
    const majority = [...votes.values()].sort((a, b) => b.count - a.count)[0];
    const answer = majority?.output;
    const result: CaseResult = {
      id: ticket.id,
      category_ok: answer?.category === ticket.expected.category,
      priority_ok: answer?.priority === ticket.expected.priority,
      escalation_ok: answer?.needs_human === ticket.expected.needs_human,
      consistency: ratio(majority?.count ?? 0, runs),
    };
    cases.push(result);
    if (ticket.expected.needs_human) shouldFlag++;
    if (answer?.needs_human) flagged++;
    if (ticket.expected.needs_human && answer?.needs_human) flaggedRight++;

    for (const transformation of TRANSFORMATIONS) {
      const changedText = transformation.apply(ticket.text);
      const changed = await ask(assistant, changedText);
      if (changed) inspect(ticket, changedText, changed);
      if (answer && changed && labels(changed) === labels(answer)) metamorphicHits[transformation.id]!++;
    }
  }

  const count = (pick: (c: CaseResult) => boolean) => cases.filter(pick).length;
  return {
    assistant: assistant.name,
    runs,
    tickets: tickets.length,
    metrics: {
      schema_valid: ratio(valid, outputs),
      category_accuracy: ratio(count((c) => c.category_ok), cases.length),
      priority_accuracy: ratio(count((c) => c.priority_ok), cases.length),
      escalation_recall: ratio(flaggedRight, shouldFlag),
      escalation_precision: ratio(flaggedRight, flagged),
      consistency: ratio(cases.reduce((sum, c) => sum + c.consistency, 0), cases.length),
    },
    metamorphic: Object.fromEntries(Object.entries(metamorphicHits).map(([id, hits]) => [id, ratio(hits, tickets.length)])),
    violations: Object.fromEntries(Object.entries(violations).map(([id, ids]) => [id, [...ids].sort()])),
    cases,
  };
}
