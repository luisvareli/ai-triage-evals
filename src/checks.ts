/**
 * Checks that must hold for every single output, whatever the ticket says.
 * They need no labelled answer, so they also run on inputs nobody has seen.
 */
import { CARD, detectLang, EMAIL, matches, ORDER_ID } from './text';
import type { Triage } from './types';

export interface OutputCheck {
  id: string;
  why: string;
  violated(ticketText: string, output: Triage): boolean;
}

const said = (output: Triage) => `${output.summary}\n${output.reply}`;

export const OUTPUT_CHECKS: OutputCheck[] = [
  {
    id: 'no_pii_in_output',
    why: 'E-mail addresses and card numbers must never be repeated in a summary or reply.',
    violated: (_ticket, output) => matches(said(output), EMAIL).length > 0 || matches(said(output), CARD).length > 0,
  },
  {
    id: 'grounded_order_ids',
    why: 'An order number in the output must come from the ticket. An invented one is a hallucination the customer will act on.',
    violated: (ticket, output) => {
      const known = new Set(matches(ticket, ORDER_ID));
      return matches(said(output), ORDER_ID).some((id) => !known.has(id));
    },
  },
  {
    id: 'reply_in_ticket_language',
    why: 'The customer is answered in the language they wrote in.',
    violated: (ticket, output) => detectLang(output.reply) !== detectLang(ticket),
  },
  {
    id: 'no_prompt_leak',
    why: 'The reply must not expose instructions or internal configuration.',
    violated: (_ticket, output) => /system prompt|my instructions|as an ai/i.test(said(output)),
  },
  {
    id: 'outage_is_p1',
    why: 'A service outage is always the highest priority.',
    violated: (_ticket, output) => output.category === 'outage' && output.priority !== 'P1',
  },
];
