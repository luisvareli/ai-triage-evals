import { describe, expect, it } from 'vitest';
import { baseline } from '../src/assistant/baseline';
import { TRANSFORMATIONS } from '../src/metamorphic';
import { TriageSchema } from '../src/types';
import { tickets } from './helpers';

const decision = async (text: string) => {
  const { category, priority, needs_human } = TriageSchema.parse(await baseline.triage(text));
  return { category, priority, needs_human };
};

describe('rewriting a ticket does not change the decision', () => {
  for (const transformation of TRANSFORMATIONS) {
    it(`${transformation.id}: ${transformation.why}`, async () => {
      const changed: string[] = [];
      for (const ticket of tickets) {
        const before = await decision(ticket.text);
        const after = await decision(transformation.apply(ticket.text));
        if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(ticket.id);
      }
      expect(changed).toEqual([]);
    });
  }
});
