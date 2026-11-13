import { readFileSync } from 'node:fs';
import type { EvalResult } from '../src/evaluate';
import type { Ticket, Triage } from '../src/types';

const read = <T>(file: string) => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8')) as T;

export const tickets = read<Ticket[]>('tickets.json');
export const storedBaseline = read<EvalResult>('baseline.json');

export const goodOutput: Triage = {
  category: 'billing',
  priority: 'P2',
  needs_human: false,
  summary: 'Customer was charged twice for one order.',
  reply: 'Thanks for getting in touch. We are reviewing the charge on your account.',
};
