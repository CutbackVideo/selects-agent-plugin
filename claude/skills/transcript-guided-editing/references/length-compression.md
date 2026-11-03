# Length compression

Read this reference when the user asks to make existing footage shorter while
keeping what it covers: "compress this to 15 minutes", "cut it down by 10
minutes", "1시간짜리를 15분으로 압축해줘", "영상 줄여줘". The result is the same
video, tightened. The scope is a whole spoken video or Draft, or a range the
user names in it. Trimming a single clip, changing speed, or shortening music,
captions or other non-spoken material is not this. File size, bitrate, or
export compression is not this either; it changes no content.

Decide the route from the user's words, not from how much is removed:

- Compression words ("압축", "줄여", "compress", "shorten", "cut it down",
  "tighten") with none of the words below: use this reference.
- Selection words ("요약", "핵심만", "하이라이트", "쇼츠", "summary", "key
  points", "highlights", "best parts", "a short", "teaser"): not compression;
  use the storyline route or `suggest-highlights`.
- Compression words with a target of about 90 seconds or less: ask once with
  a host-supported question whether to pick highlights or tighten the whole video,
  recommending picking highlights first.
- Both kinds of words with a longer target ("15분 하이라이트로 줄여줘"): ask
  the same question once, recommending tightening the whole video first.
- After the answer, follow the chosen route.

`storyline-planning.md` still supplies the chapter map and transcript evidence
reads. This reference replaces its selection order and its storyline questions;
`cut-execution-and-review.md` still owns mutation and persistence.

## Aim for the stated length

- "N minutes", "to N minutes" or "under N minutes" targets close to N, not well
  below it. Stop removing once the Draft is within about 10% of N, or at N for
  "under N".
- "By N minutes" removes about N minutes.
- With no length, remove what is repeated, abandoned or off-topic and keep
  the rest. Do not invent a target.

Apart from the one route question above, do not ask about length, taste or
story forks. Choose, build, and report what you chose.

## Plan the budget before cutting

1. Read the Draft duration and chapter map.
2. Estimate what the speech-flow pass will save. Simulate the `normal` preset
   with `speech-flow-editor` against the placed Draft without committing, or
   estimate it from pause and filler counts. That estimate includes pauses in
   material you will remove, so scale it by the share of the Draft you expect
   to keep. Subtract the result from the amount to remove; the rest is the
   content-removal budget.
3. Spend the budget in the order below, erring on removing too little: a
   result that is still long gets another pass, but removed material is not
   restored. Move to the next tier only when the tiers before it cannot cover
   the budget.

### Removal tiers

1. **Repeats and failed takes** — abandoned or repeated takes, restated
   sentences, false starts, production and meta chatter, pre-roll and post-roll.
2. **Inside each chapter** — tangents, repeated explanations, extra examples
   that make the same point, and over-long setups. Cut at sentence or utterance
   level and keep every chapter's core point and its transitions. Spread these
   cuts across the chapters instead of emptying one.
3. **Whole chapters** — the last resort, only when tiers 1–2 cannot reach the
   target. Remove the chapters that matter least to the whole and keep the
   result dependency-closed (see `storyline-planning.md`).

Sentence-level cuts in tiers 1–2 are the expected shape of this edit. Many
small cuts are fine: split them into more batches, but do not merge them into
larger ranges to reduce the operation count.

## Execute

Keep the order in `SKILL.md` § Apply content before speech flow: commit the
content cuts, then load `speech-flow-editor` for the speech-flow pass with the
`normal` preset and its filler defaults, unless the user named another pacing.
That pass runs unattended and asks no taste questions.

After the speech-flow pass, compare the saved duration with the target. If it
is still long, remove more in tier order. Never restore removed material to
reach the target. If the result is short by more than about 10%, say how much
shorter it is and offer to keep more.

## Report

State the saved duration against the target and what was removed in each tier,
in the user's terms. Name every removed chapter with its length. If the target
needed whole-chapter removals, say so plainly so the user can ask to keep one.
