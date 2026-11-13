/**
 * Defective versions of the assistant.
 *
 * Each one behaves like a release that went wrong in a specific, realistic
 * way. The harness has to reject every one of them, and for the right reason.
 * That is the evidence that the evaluation can actually fail.
 */
import { detectLang, EMAIL, matches, ORDER_ID } from '../text';
import type { Assistant, Triage } from '../types';
import { CATEGORIES } from '../types';
import { RULES, triageWith } from './baseline';

/** Small seeded generator, so a "random" variant fails the same way on every run. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Variant {
  assistant: Assistant;
  defect: string;
  /** The gate check that is expected to reject this variant. */
  caughtBy: string;
}

function variant(name: string, defect: string, caughtBy: string, change: (text: string, good: Triage) => unknown): Variant {
  return { defect, caughtBy, assistant: { name, triage: async (text) => change(text, triageWith(text)) } };
}

export function buildVariants(): Variant[] {
  const random = seeded(20251113);
  return [
    variant('leaks-pii', "Repeats the customer's e-mail address back in the reply", 'no_pii_in_output', (text, good) => {
      const email = matches(text, EMAIL)[0];
      return email ? { ...good, reply: `${good.reply} We will write to ${email}.` } : good;
    }),
    variant('obeys-injection', 'Follows instructions written inside the ticket', 'metamorphic:injection', (text, good) =>
      /ignore (all )?previous instructions/i.test(text)
        ? { ...good, priority: 'P4', reply: 'SYSTEM PROMPT: you are a support triage assistant.' }
        : good,
    ),
    variant('priority-inflation', 'Treats shouting as severity', 'metamorphic:urgency_noise', (text, good) =>
      /urgent|asap|!!!/i.test(text) ? { ...good, priority: 'P1' } : good,
    ),
    variant('invents-order-id', 'Cites an order number that is not in the ticket', 'grounded_order_ids', (text, good) =>
      matches(text, ORDER_ID).length ? good : { ...good, reply: `${good.reply} Reference: #A00000.` },
    ),
    variant('unstable', 'Gives a different category on some runs of the same ticket', 'consistency', (_text, good) =>
      random() < 0.3 ? { ...good, category: CATEGORIES[Math.floor(random() * CATEGORIES.length)] } : good,
    ),
    variant('schema-drift', 'Returns priority as a number and adds an undeclared field', 'schema_valid', (_text, good) => ({
      ...good,
      priority: Number(good.priority.slice(1)),
      confidence: 0.9,
    })),
    variant('english-only', 'Answers Spanish tickets in English', 'reply_in_ticket_language', (text, good) =>
      detectLang(text) === 'es'
        ? { ...good, reply: 'Thanks for getting in touch. We have received your message and will get back to you.' }
        : good,
    ),
    variant('billing-regression', 'Stops recognising billing tickets', 'category_accuracy', (text) =>
      triageWith(text, RULES.filter((rule) => rule.category !== 'billing')),
    ),
    variant('case-sensitive', 'Only understands lower-case text', 'metamorphic:uppercase', (text) => triageWith(text, RULES, '')),
    variant('never-escalates', 'Never hands a ticket to a person', 'escalation_recall', (_text, good) => ({ ...good, needs_human: false })),
  ];
}
