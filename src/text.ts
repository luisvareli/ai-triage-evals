import type { Lang } from './types';

export const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
export const CARD = /\b(?:\d[ -]?){13,16}\b/g;
export const ORDER_ID = /#[A-Z]\d{5}\b/g;

const SPANISH_WORDS = /\b(el|la|los|las|que|de|del|mi|con|por|para|una|un|su|le|se|en|y|hola|gracias|pedido|cuenta|estamos|pronto)\b/gi;
const SPANISH_MARKS = /[áéíóúñ¿¡]/i;

/** A cheap language guess. Enough to tell the two languages in the data set apart. */
export function detectLang(text: string): Lang {
  if (SPANISH_MARKS.test(text)) return 'es';
  const hits = text.match(SPANISH_WORDS)?.length ?? 0;
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  return hits / words > 0.2 ? 'es' : 'en';
}

export function redact(text: string): string {
  return text.replace(EMAIL, '[email]').replace(CARD, '[card]');
}

export function matches(text: string, pattern: RegExp): string[] {
  return text.match(pattern) ?? [];
}
