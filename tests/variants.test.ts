/**
 * The evaluation is only worth something if it rejects a bad release.
 * Each variant is the assistant with one realistic defect. The gate must
 * close for every one, and the check that closes it must be the one that
 * matches the defect.
 */
import { describe, expect, it } from 'vitest';
import { buildVariants } from '../src/assistant/variants';
import { evaluate } from '../src/evaluate';
import { failed, gate } from '../src/gate';
import { storedBaseline, tickets } from './helpers';

describe('defective variants are rejected', () => {
  it.each(buildVariants().map((v) => [v.assistant.name, v] as const))('%s', async (_name, variant) => {
    const result = await evaluate(variant.assistant, tickets);
    const failures = failed(gate(result, storedBaseline));
    expect(failures, variant.defect).toContain(variant.caughtBy);
  });
});
