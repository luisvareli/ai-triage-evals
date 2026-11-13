/**
 * A rule-based stand-in for the assistant.
 *
 * It exists so the project runs offline, for free and in CI. The harness only
 * talks to it through the `Assistant` interface, which is the same one an
 * adapter around a real model would implement. Nothing in the evaluation
 * knows or cares that this one is made of regular expressions.
 */
import { detectLang, matches, ORDER_ID, redact } from '../text';
import type { Assistant, Category, Lang, Priority, Triage } from '../types';

interface Rule {
  category: Category;
  when: RegExp;
  urgent: RegExp;
}

export const RULES: Rule[] = [
  {
    category: 'outage',
    when: /\b(outage|is down|are down|not loading|503|unavailable for everyone|ca[ií]d[oa]|no carga)\b/,
    urgent: /./,
  },
  {
    category: 'account',
    when: /\b(password|log ?in|sign in|two-factor|2fa|my account|contraseña|iniciar sesi[oó]n|mi cuenta)\b/,
    urgent: /\b(locked out|hacked|someone else|not me|bloquead[oa]|hackead[oa]|otra persona)\b/,
  },
  {
    category: 'billing',
    when: /\b(charged?|refund|invoice|payment|billing|subscription|cobr\w+|factura|reembolso|pago|suscripci[oó]n)\b/,
    urgent: /\b(twice|double|two times|fraud|unauthori[sz]ed|dos veces|doble|fraude)\b/,
  },
  {
    category: 'shipping',
    when: /\b(deliver\w*|shipp\w+|tracking|package|parcel|courier|env[ií]o|paquete|entrega\w*|repartidor)\b/,
    urgent: /\b(lost|never arrived|missing|stolen|perdid[oa]|nunca lleg[oó]|robad[oa])\b/,
  },
  {
    category: 'bug',
    when: /\b(error|crash\w*|bug|broken|freez\w+|glitch|falla\w*|se cierra|no funciona)\b/,
    urgent: /\b(crash\w*|data loss|lost my data|every time|se cierra|pierd\w+|cada vez)\b/,
  },
];

const ESCALATE = /\b(lawyer|attorney|sue|legal action|chargeback|speak to a (human|person|manager)|abogad[oa]|demanda\w*|hablar con una persona|hackead[oa]|hacked|fraud|fraude)\b/;

const REPLIES: Record<Lang, Record<Category, string>> = {
  en: {
    outage: 'Thanks for reporting this. We are looking into the service problem now and will update you as soon as it is resolved.',
    account: 'Thanks for getting in touch. We will help you get back into your account and will follow up with the next steps.',
    billing: 'Thanks for getting in touch. We are reviewing the charge on your account and will get back to you with what we find.',
    shipping: 'Thanks for getting in touch. We are checking with the courier and will get back to you with an update on the delivery.',
    bug: 'Thanks for reporting this. We have passed the details to the team and will let you know when there is a fix.',
    other: 'Thanks for getting in touch. We have received your message and will get back to you.',
  },
  es: {
    outage: 'Gracias por avisarnos. Estamos revisando el problema del servicio y le avisaremos en cuanto se resuelva.',
    account: 'Gracias por escribirnos. Le ayudaremos a recuperar el acceso a su cuenta y le indicaremos los siguientes pasos.',
    billing: 'Gracias por escribirnos. Estamos revisando el cobro en su cuenta y le responderemos con lo que encontremos.',
    shipping: 'Gracias por escribirnos. Estamos consultando con la empresa de transporte y le daremos novedades de la entrega.',
    bug: 'Gracias por avisarnos. Pasamos los detalles al equipo y le avisaremos cuando haya una solución.',
    other: 'Gracias por escribirnos. Recibimos su mensaje y le responderemos pronto.',
  },
};

/**
 * `\b` only knows ASCII letters, so it does not see the end of "llegó".
 * These boundaries work for accented words too.
 */
function compile(pattern: RegExp, flags: string): RegExp {
  const source = pattern.source.replace(/^\\b/, '(?<![\\p{L}\\d])').replace(/\\b$/, '(?![\\p{L}\\d])');
  return new RegExp(source, `${flags}u`);
}

export function classify(text: string, rules: Rule[] = RULES, flags = 'i'): { category: Category; priority: Priority } {
  for (const rule of rules) {
    if (compile(rule.when, flags).test(text)) {
      const urgent = rule.category === 'outage' || compile(rule.urgent, flags).test(text);
      return { category: rule.category, priority: rule.category === 'outage' ? 'P1' : urgent ? 'P2' : 'P3' };
    }
  }
  return { category: 'other', priority: 'P4' };
}

export function triageWith(rawText: string, rules: Rule[] = RULES, flags = 'i'): Triage {
  // Pasted text comes with line breaks and double spaces. Collapse them first,
  // or a phrase like "locked out" stops matching.
  const text = rawText.replace(/\s+/g, ' ').trim();
  const lang = detectLang(text);
  const { category, priority } = classify(text, rules, flags);
  const firstSentence = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  const orderIds = matches(text, ORDER_ID);
  const orderNote = orderIds.length ? (lang === 'es' ? ` Referencia: ${orderIds[0]}.` : ` Reference: ${orderIds[0]}.`) : '';

  return {
    category,
    priority,
    needs_human: compile(ESCALATE, 'i').test(text),
    summary: redact(firstSentence).slice(0, 160),
    reply: REPLIES[lang][category] + orderNote,
  };
}

export const baseline: Assistant = {
  name: 'baseline',
  async triage(text) {
    return triageWith(text);
  },
};
