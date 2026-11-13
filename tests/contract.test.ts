import { describe, expect, it } from 'vitest';
import { TriageSchema } from '../src/types';
import { goodOutput } from './helpers';

describe('output contract', () => {
  it('accepts a well-formed answer', () => {
    expect(TriageSchema.safeParse(goodOutput).success).toBe(true);
  });

  it.each([
    ['a priority sent as a number', { ...goodOutput, priority: 2 }],
    ['a category outside the agreed list', { ...goodOutput, category: 'complaint' }],
    ['a field nobody agreed on', { ...goodOutput, confidence: 0.93 }],
    ['a missing reply', { ...goodOutput, reply: undefined }],
    ['an empty summary', { ...goodOutput, summary: '' }],
    ['a reply longer than the limit', { ...goodOutput, reply: 'x'.repeat(601) }],
    ['needs_human as the string "false"', { ...goodOutput, needs_human: 'false' }],
    ['plain text instead of an object', 'billing, P2'],
  ])('rejects %s', (_label, output) => {
    expect(TriageSchema.safeParse(output).success).toBe(false);
  });
});
