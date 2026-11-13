# AI triage evals

[![eval](https://github.com/luisvareli/ai-triage-evals/actions/workflows/eval.yml/badge.svg)](https://github.com/luisvareli/ai-triage-evals/actions/workflows/eval.yml)

An evaluation harness for an AI assistant that triages support tickets: it reads a
ticket and returns a category, a priority, whether a person must step in, a summary
and a reply.

You cannot test this kind of system with `expect(output).toBe(...)`. The same input
can give a different answer tomorrow, there is no single correct reply, and a new
prompt or model version can quietly get worse at something it used to do well.
This project shows how I test it anyway, and how I decide whether a new version
is safe to release.

## Read this first: what is real here

The assistant in this repo is **not a language model**. It is a rule-based stand-in
(`src/assistant/baseline.ts`), so the project runs offline, for free and in CI.
The harness only talks to it through one interface:

```ts
interface Assistant {
  name: string;
  triage(ticketText: string): Promise<unknown>;
}
```

An adapter around a real model implements the same interface, and nothing else
changes. What this project demonstrates is the evaluation method. It does not
claim results about any real model. The tickets are invented.

## What gets checked

| Layer | Question | How |
| --- | --- | --- |
| Contract | Can a program consume the answer? | Strict schema: wrong types, missing or extra fields are rejected |
| Output checks | Is each answer safe and grounded? | No e-mail or card number repeated, no invented order number, reply in the customer's language, no leaked instructions |
| Labelled accuracy | Is the decision right? | 36 labelled tickets in English and Spanish; category, priority and escalation graded separately |
| Consistency | Would it say the same thing tomorrow? | Every ticket runs 5 times; the share of runs that agree is a metric |
| Metamorphic tests | Does rewording change the decision? | Capitals, stray whitespace, a greeting, shouting, and an instruction injected into the ticket must not change it |
| Release gate | Is this version worse than the last one? | Absolute thresholds, plus a comparison with a stored baseline, ticket by ticket |

## How I know the evaluation can fail

`src/assistant/variants.ts` holds ten versions of the assistant, each with one
realistic defect. `npm test` requires the gate to close for every one of them,
and to close on the check that matches the defect.

| Variant | What is wrong with it | Check that rejects it |
| --- | --- | --- |
| leaks-pii | Repeats the customer's e-mail address in the reply | `no_pii_in_output` |
| obeys-injection | Follows instructions written inside the ticket | `metamorphic:injection` |
| priority-inflation | Treats shouting as severity | `metamorphic:urgency_noise` |
| invents-order-id | Cites an order number that is not in the ticket | `grounded_order_ids` |
| unstable | Gives a different category on some runs | `consistency` |
| schema-drift | Returns priority as a number and adds a field | `schema_valid` |
| english-only | Answers Spanish tickets in English | `reply_in_ticket_language` |
| billing-regression | Stops recognising billing tickets | `category_accuracy` |
| case-sensitive | Only understands lower-case text | `metamorphic:uppercase` |
| never-escalates | Never hands a ticket to a person | `escalation_recall` |

## What it found while I was building it

The harness caught two defects in my own stand-in before I had written a single
defective variant:

1. **Double spaces changed the decision.** The whitespace rewrite passed on only
   69% of tickets. Phrases such as "locked out" stopped matching when the text had
   two spaces. Fixed by normalising whitespace first.
2. **A Spanish ticket was graded wrong.** "nunca llegó" did not match, because `\b`
   in a regular expression does not treat "ó" as a letter. Fixed with
   Unicode-aware boundaries.

Two tickets are still graded wrong, and they are kept in the data on purpose
(T31 and T32). They mention one topic and are about another, which is exactly
where keyword matching fails. A test asserts that they stay visible.

## Run it

Requires Node 22. No API key, no network.

```bash
npm install
npm test              # 41 tests, including the ten defective variants
npm run eval          # report and release gate against data/baseline.json
npm run eval:baseline # accept the current behaviour as the new baseline
```

## Layout

```
src/
  types.ts              the output contract and the Assistant interface
  checks.ts             checks every answer must pass
  metamorphic.ts        rewrites that must not change the decision
  evaluate.ts           runs the data set and computes the metrics
  gate.ts               thresholds and comparison with the baseline
  assistant/baseline.ts the rule-based stand-in
  assistant/variants.ts ten defective versions
data/
  tickets.json          36 labelled tickets
  baseline.json         the last accepted evaluation
docs/eval-strategy.md   why each layer exists and what is out of scope
```

## Limits

- A rule-based stand-in is deterministic, so the consistency metric is only
  exercised by the `unstable` variant. With a real model it would be the first
  number I look at.
- Injection resistance is trivially true for keyword rules. The test earns its
  place with a real model, and here with the `obeys-injection` variant.
- 36 tickets are enough to show the method and far too few to trust an accuracy
  figure. A real data set comes from real tickets, labelled by the people who
  handle them.
- Reply quality (tone, helpfulness) is not graded. That needs human review or a
  second model as a judge, and both need their own checks.

## Author

Luis Vargas Elizondo, QA engineer. [Site](https://luisvareli.github.io/) · [LinkedIn](https://www.linkedin.com/in/luis-vargas-elizondo)
