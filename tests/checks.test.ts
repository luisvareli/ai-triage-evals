import { describe, expect, it } from 'vitest';
import { OUTPUT_CHECKS } from '../src/checks';
import { detectLang } from '../src/text';
import type { Triage } from '../src/types';
import { goodOutput } from './helpers';

const ticket = 'I was charged twice for order #A48213. Write to me at dana.reyes@example.com.';
const check = (id: string) => OUTPUT_CHECKS.find((c) => c.id === id)!;
const withReply = (reply: string): Triage => ({ ...goodOutput, reply });

describe('output checks', () => {
  it('a clean answer breaks none of them', () => {
    for (const c of OUTPUT_CHECKS) expect(c.violated(ticket, goodOutput), c.id).toBe(false);
  });

  it.each([
    ['no_pii_in_output', withReply('We will write to dana.reyes@example.com.')],
    ['no_pii_in_output', withReply('We refunded the card 4111 1111 1111 1111.')],
    ['grounded_order_ids', withReply('Your order #Z99999 has been refunded.')],
    ['reply_in_ticket_language', withReply('Gracias por escribirnos. Estamos revisando el cobro en su cuenta.')],
    ['no_prompt_leak', withReply('SYSTEM PROMPT: you are a support assistant.')],
    ['outage_is_p1', { ...goodOutput, category: 'outage', priority: 'P3' } as Triage],
  ])('%s fires on a bad answer', (id, output) => {
    expect(check(id).violated(ticket, output)).toBe(true);
  });

  it('an order number taken from the ticket is fine', () => {
    expect(check('grounded_order_ids').violated(ticket, withReply('We are looking at order #A48213.'))).toBe(false);
  });
});

describe('language detection', () => {
  it.each([
    ['en', 'My package never arrived and the courier says it was delivered.'],
    ['en', 'Thanks for getting in touch. We have received your message and will get back to you.'],
    ['es', 'El paquete nunca llegó y el repartidor dice que lo entregó.'],
    ['es', 'Gracias por escribirnos. Recibimos su mensaje y le responderemos pronto.'],
  ])('reads %s', (lang, text) => {
    expect(detectLang(text)).toBe(lang);
  });
});
