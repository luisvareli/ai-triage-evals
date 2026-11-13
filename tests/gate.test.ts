import { describe, expect, it } from 'vitest';
import { baseline } from '../src/assistant/baseline';
import { evaluate, type EvalResult } from '../src/evaluate';
import { failed, gate } from '../src/gate';
import { storedBaseline, tickets } from './helpers';

describe('release gate', () => {
  it('opens for the current assistant', async () => {
    const result = await evaluate(baseline, tickets);
    expect(failed(gate(result, storedBaseline))).toEqual([]);
  });

  it('the stored baseline is the current behaviour, not a stale file', async () => {
    const result = await evaluate(baseline, tickets);
    expect(result.metrics).toEqual(storedBaseline.metrics);
    expect(result.cases).toEqual(storedBaseline.cases);
  });

  it('closes when a metric falls against the baseline, even above the threshold', () => {
    const worse: EvalResult = structuredClone(storedBaseline);
    worse.metrics.priority_accuracy = storedBaseline.metrics.priority_accuracy - 0.05;
    expect(worse.metrics.priority_accuracy).toBeGreaterThan(0.85); // still above the absolute threshold
    expect(failed(gate(worse, storedBaseline))).toEqual(['no_metric_drop']);
  });

  it('closes when a ticket that was right becomes wrong, even if the totals hold', () => {
    const swapped: EvalResult = structuredClone(storedBaseline);
    const nowWrong = swapped.cases.find((c) => c.category_ok)!;
    const nowRight = swapped.cases.find((c) => !c.category_ok)!;
    nowWrong.category_ok = false;
    nowRight.category_ok = true; // same accuracy, different tickets
    const checks = gate(swapped, storedBaseline);
    expect(failed(checks)).toEqual(['no_new_failures']);
    expect(checks.find((c) => c.id === 'no_new_failures')!.detail).toContain(nowWrong.id);
  });

  it('does not hide the tickets the assistant gets wrong', () => {
    const wrong = storedBaseline.cases.filter((c) => !c.category_ok).map((c) => c.id);
    expect(wrong).toEqual(['T31', 'T32']); // known limits of keyword matching, kept in the data on purpose
  });
});
