import { z } from 'zod';

export const CATEGORIES = ['outage', 'account', 'billing', 'shipping', 'bug', 'other'] as const;
export const PRIORITIES = ['P1', 'P2', 'P3', 'P4'] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Lang = 'en' | 'es';

/**
 * The contract the assistant must honour. `.strict()` matters: an extra or
 * renamed field is how a prompt or model change usually breaks a consumer.
 */
export const TriageSchema = z
  .object({
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    needs_human: z.boolean(),
    summary: z.string().min(1).max(200),
    reply: z.string().min(1).max(600),
  })
  .strict();

export type Triage = z.infer<typeof TriageSchema>;

/**
 * Anything that can triage a ticket: a rule-based stand-in, a recorded run,
 * or an adapter around a real model. It returns `unknown` on purpose. Output
 * from a model is untrusted until it has been validated.
 */
export interface Assistant {
  name: string;
  triage(ticketText: string): Promise<unknown>;
}

export interface Ticket {
  id: string;
  lang: Lang;
  text: string;
  expected: { category: Category; priority: Priority; needs_human: boolean };
  note?: string;
}
