/**
 * The release gate: turns an evaluation into a yes or a no.
 *
 * Two kinds of check. Absolute thresholds say what is never acceptable.
 * The comparison with the stored baseline says whether this version is worse
 * than the last one that was accepted, even if it is still above the threshold.
 */
import type { EvalResult } from './evaluate';

export interface GateCheck {
  id: string;
  passed: boolean;
  detail: string;
}

export const THRESHOLDS = {
  schema_valid: 1,
  category_accuracy: 0.9,
  priority_accuracy: 0.85,
  escalation_recall: 1,
  consistency: 0.95,
  metamorphic: 0.95,
  /** How far a metric may fall below the baseline before the gate closes. */
  allowed_drop: 0.02,
} as const;

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export function gate(result: EvalResult, baseline?: EvalResult): GateCheck[] {
  const checks: GateCheck[] = [];
  const atLeast = (id: string, value: number, minimum: number) =>
    checks.push({ id, passed: value >= minimum, detail: `${pct(value)} (needs ${pct(minimum)})` });

  atLeast('schema_valid', result.metrics.schema_valid, THRESHOLDS.schema_valid);
  atLeast('category_accuracy', result.metrics.category_accuracy, THRESHOLDS.category_accuracy);
  atLeast('priority_accuracy', result.metrics.priority_accuracy, THRESHOLDS.priority_accuracy);
  atLeast('escalation_recall', result.metrics.escalation_recall, THRESHOLDS.escalation_recall);
  atLeast('consistency', result.metrics.consistency, THRESHOLDS.consistency);

  for (const [id, tickets] of Object.entries(result.violations)) {
    checks.push({
      id,
      passed: tickets.length === 0,
      detail: tickets.length === 0 ? 'no violations' : `violated on ${tickets.length} ticket(s): ${tickets.slice(0, 5).join(', ')}`,
    });
  }
  for (const [id, rate] of Object.entries(result.metamorphic)) {
    atLeast(`metamorphic:${id}`, rate, THRESHOLDS.metamorphic);
  }

  if (baseline) {
    const dropped = (Object.keys(result.metrics) as (keyof EvalResult['metrics'])[]).filter(
      (key) => baseline.metrics[key] - result.metrics[key] > THRESHOLDS.allowed_drop,
    );
    checks.push({
      id: 'no_metric_drop',
      passed: dropped.length === 0,
      detail: dropped.length === 0 ? 'no metric fell against the baseline' : `fell against the baseline: ${dropped.join(', ')}`,
    });

    const wasRight = new Map(baseline.cases.map((c) => [c.id, c.category_ok && c.priority_ok && c.escalation_ok]));
    const newlyWrong = result.cases
      .filter((c) => wasRight.get(c.id) && !(c.category_ok && c.priority_ok && c.escalation_ok))
      .map((c) => c.id);
    checks.push({
      id: 'no_new_failures',
      passed: newlyWrong.length === 0,
      detail: newlyWrong.length === 0 ? 'every ticket that was right is still right' : `right before, wrong now: ${newlyWrong.slice(0, 8).join(', ')}`,
    });
  }
  return checks;
}

export const failed = (checks: GateCheck[]) => checks.filter((c) => !c.passed).map((c) => c.id);
