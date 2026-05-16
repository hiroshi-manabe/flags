# Learning Design

This project is a child-friendly flag memorization app for iPad mini. The app uses one app-facing quiz dataset, a two-choice answer format, and per-flag player mastery state.

## Dataset

The app-facing dataset is `data/countries.json`.

It contains 200 entries:

- 193 UN member states.
- 2 UN observer states: Vatican City / Holy See and Palestine.
- 5 common extra flags: Cook Islands, Niue, Taiwan, Kosovo, and Western Sahara.

Raw SVG assets for additional territories remain available in `assets/flags/4x3/`, but they are not part of the default quiz dataset.

## Modes

The app should provide two modes.

### Infinite Mode

Infinite Mode is the main learning mode.

Use the mastery-based scheduler described below:

- Start from a small active set.
- Introduce new flags gradually.
- Pair new flags with seed-known distractors first.
- Repeat missed flags soon.
- Review correct flags later using spacing.
- Update per-flag mastery after every answer.
- Continue indefinitely until the player stops.

This mode is optimized for learning and retention, not for covering every flag uniformly in one sitting.

### All Flags Mode

All Flags Mode is a complete random challenge over the 200-entry quiz dataset.

Use fully random target selection from `data/countries.json`:

- Do not use the active learning pool.
- Do not prioritize due items.
- Do not introduce flags gradually.
- Do not bias toward missed flags during the run.
- Choose the distractor randomly from the same dataset, excluding the target.

All Flags Mode may still record answers for statistics, but it should not be treated as the primary scheduler. Its purpose is challenge, variety, and checking broad exposure.

## HUD

The HUD should be compact and readable on iPad mini. It should show useful state without competing with the flag and two answer choices.

### Infinite Mode HUD

Show current-session accuracy:

- Correct answers / questions shown.
- Percentage accuracy.

Example:

```text
12/16 75%
```

The denominator is the number of questions shown in the current session, including timeouts.

### All Flags Mode HUD

Show current-session accuracy:

- Correct answers / questions shown.
- Percentage accuracy.

Also show full-run progress through the 200-entry quiz dataset:

- Seen questions / total questions.
- Total is 200.
- Include a horizontal progress bar for run completion.

Example:

```text
Accuracy 42/50 84%
Flags 50/200
```

All Flags Mode should avoid repeating targets until all 200 have appeared once in the run.

## Learning Principles

Infinite Mode should not sample randomly from all 200 flags. It should introduce a limited active set, repeat missed flags soon, and return correct flags later to confirm durable recall.

Research background:

- Retrieval practice: answering from memory improves later retention more than repeated study alone.
- Spacing: reviews spread over time are more effective than massed repetition.
- Successive relearning: items should be retrieved correctly across spaced opportunities before being treated as learned.
- Corrective feedback: especially for multiple choice, immediate feedback helps reinforce the correct answer and reduce confusion from distractors.

Because the app uses two choices, a correct answer is weak evidence. Random guessing has a 50% success rate:

- 1 correct by chance: 50%.
- 2 correct in a row by chance: 25%.
- 3 correct in a row by chance: 12.5%.
- 4 correct in a row by chance: 6.25%.
- 5 correct in a row by chance: 3.125%.

Do not mark a flag learned after one correct answer. Require multiple spaced correct answers, ideally with varied distractors.

## Child-Friendly Onboarding

New flags should initially be paired with already familiar flags.

The first distractor for a newly introduced flag should come from a seed-known set, not from another unknown flag. This makes the first encounter easier and lets the child learn by contrast.

Suggested seed-known flags:

- Japan
- United States
- United Kingdom
- France
- Germany
- Italy
- Canada
- Brazil
- China
- South Korea
- Australia
- India
- Spain
- Mexico
- Switzerland
- Sweden

Initial presentation pattern:

1. New flag plus famous known distractor.
2. New flag plus learned distractor.
3. New flag plus regional or visually similar distractor.
4. New flag appears as a distractor for another target.

Correct answers against easy distractors should count less than correct answers against harder distractors.

## Player Mastery State

Track mastery per player and per flag. Store locally at first, probably in `localStorage`.

Example state:

```js
{
  code: "jp",
  status: "seed-known",
  seen: 0,
  correct: 0,
  wrong: 0,
  streak: 0,
  mastery: 0,
  dueAt: 0,
  lastSeenAt: null,
  lastDistractors: []
}
```

Status values:

- `seed-known`: available as an easy early distractor.
- `new`: not introduced yet.
- `learning`: introduced and still fragile.
- `review`: known enough to space out, but not mastered.
- `mastered`: repeatedly correct across spaced reviews.

Suggested internal mastery bands:

- `0-19`: new or fragile.
- `20-49`: learning.
- `50-79`: review.
- `80-100`: mastered.

Do not expose raw scores to the child. Use friendly labels such as:

- New
- Practicing
- Getting stronger
- Learned

## Scheduling Rules

Use a small active pool rather than all 200 flags.

Initial pool:

- Start with the seed-known flags.
- Add 1 new flag at a time, or a few at a time once the child is succeeding.

When the target is answered wrong:

- Show immediate feedback.
- Reset short-term streak.
- Reduce mastery.
- Schedule the item soon, after 2-4 other questions.
- Keep it in the active set.

When the target is answered correctly:

- Show immediate feedback.
- Increase streak and mastery.
- Schedule the item later.
- Increase spacing only after repeated correct answers.

Possible mastery update:

```js
const difficultyWeight = {
  seedKnownDistractor: 0.5,
  learnedDistractor: 1,
  similarDistractor: 1.5,
};

if (answerCorrect) {
  item.streak += 1;
  item.correct += 1;
  item.mastery += 8 * difficultyWeight[distractorType];
  item.dueAt = now + nextSpacing(item);
} else {
  item.streak = 0;
  item.wrong += 1;
  item.mastery = Math.max(0, item.mastery - 10);
  item.dueAt = now + 2;
}
```

Suggested spacing by progress:

- First wrong: repeat after 2-4 questions.
- First correct: repeat after 4-6 questions.
- Second spaced correct: repeat after 10-15 questions.
- Third spaced correct: repeat in a later session.
- Fourth or fifth spaced correct: mark mastered, then review occasionally.

## Distractor Policy

Distractors should become harder over time.

Easy:

- Famous seed-known flags.
- Visually unrelated flags.
- Different continent or region.

Medium:

- Learned flags.
- Same broad region.
- Similar colors but different design.

Hard:

- Visually similar flags.
- Same region and similar layout.
- Historically common confusions, such as similar tricolors.

Avoid repeating the same target-distractor pair too often. Store recent distractors per flag and rotate choices.

## Input Design

Two answer choices should be laid out left and right.

Supported input:

- Tap on iPad.
- Mouse click.
- Keyboard Left Arrow for the left choice.
- Keyboard Right Arrow for the right choice.

Keyboard selection should submit immediately. Do not require a separate confirmation key. Arrow-key answers should use the same code path as tap and click answers so scoring, feedback, and scheduling stay identical across input methods.

Ignore repeated keyboard events while answer feedback is locked or while the next question is being prepared.

## Timing

Use a short answer time limit, initially around 3 seconds per question.

Show the remaining time visually with a horizontal progress bar. The bar should be easy to perceive at a glance and should not shift the answer layout as it changes.

Timer behavior:

- Start the timer when the flag and both answer choices are visible.
- Stop the timer immediately when the player answers by tap, click, Left Arrow, or Right Arrow.
- If time expires before an answer, treat the item as missed for scheduling and mastery.
- Track timeouts separately from wrong taps/clicks so later tuning can distinguish "confused" from "too slow."
- Lock all inputs during feedback and question transition.

The 3-second limit is meant to encourage recognition rather than slow elimination. It may need tuning for younger children, early onboarding, or accessibility.

## Implementation Notes

The first production implementation should be simple and transparent:

- Load `data/countries.json`.
- Provide Infinite Mode and All Flags Mode.
- Show a mode-aware HUD: accuracy in both modes, plus 200-flag progress in All Flags Mode.
- Keep player progress in local storage.
- Maintain a queue of due items by question count.
- Maintain a small active learning pool.
- Introduce new items only when the current pool is stable enough.
- Use two-choice questions.
- Place the two choices left and right, with immediate Left Arrow / Right Arrow selection.
- Add a visible 3-second progress-bar timer for each question.
- Treat every answer as target-practice for the shown flag, and optionally as weak exposure for the distractor.

The raw asset set can stay larger than the app-facing quiz dataset. The app should treat `data/countries.json` as the source of truth for playable flags.
