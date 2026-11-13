# Evaluation strategy

## The problem with testing a model

A normal test compares an output with an expected value. That breaks down here
for three reasons:

1. **The output varies.** The same ticket can produce a different reply on the
   next run.
2. **There is no single right answer.** Many replies are acceptable. A few are not.
3. **Quality moves silently.** A new prompt or model can be better on average and
   worse on the cases that matter.

So the strategy is to stop asking "is this the expected string?" and ask
questions that have stable answers.

## The questions, in the order I trust them

**1. Is it well-formed?** (`src/types.ts`)
The cheapest check and the one that breaks consumers most often. The schema is
strict: an extra field is a failure, because it means the output changed without
anyone deciding it should.

**2. Is every answer safe?** (`src/checks.ts`)
Rules that hold for any ticket, so they need no labelled data and also apply to
tickets nobody has seen: no personal data repeated, no invented order number,
reply in the customer's language, no leaked instructions.

**3. Is the decision right?** (`data/tickets.json`)
Category, priority and escalation are graded separately. One blended score hides
the difference between a wrong category, which is an annoyance, and a missed
escalation, which can be a legal problem. Escalation recall must be 100%.

**4. Is it stable?** (`src/evaluate.ts`)
Every ticket runs several times. The most frequent answer is the one that gets
graded, and the share of runs that agree with it is reported. A correct answer
that only appears three times out of five is not a correct answer.

**5. Does it survive rewording?** (`src/metamorphic.ts`)
A rewritten ticket must get the same decision as the original. This needs no
expected value, so it scales to any input. The injection case belongs here too:
text inside a ticket is data, and an instruction written there must not be
followed.

**6. Is it worse than last time?** (`src/gate.ts`)
Thresholds catch a bad version. The baseline catches a worse one. The comparison
is done ticket by ticket, because two versions can have the same accuracy and be
wrong about different tickets. The second version then breaks something a
customer already relies on.

## Checking the evaluation itself

An evaluation that never fails proves nothing. `src/assistant/variants.ts` has
ten defective assistants, and the test suite requires each one to be rejected by
the specific check that matches its defect. If I weaken a check by accident, a
variant gets through and the build fails.

## Changing the baseline

`npm run eval:baseline` rewrites `data/baseline.json`. That file is reviewed like
code: the diff shows exactly which tickets changed from right to wrong, and
accepting it is a decision someone signs off on, not a side effect of a merge.

## Out of scope

- Reply quality: tone, empathy, helpfulness
- Latency and cost per ticket
- Long conversations (this is single-turn)
- Adversarial testing beyond one injection pattern
- Fairness across customer groups

## Moving this to a real model

1. Write an adapter that implements `Assistant` and calls the model.
2. Replace the invented tickets with real ones, labelled by the support team.
3. Raise the number of runs and watch the consistency metric before anything else.
4. Record the model outputs of each evaluation, so a failure can be studied
   without calling the model again.
5. Add human review for a sample of replies. The checks here say an answer is
   safe and well-formed. They do not say it is good.
