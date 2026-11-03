---
name: speech-flow-editor
description: "Edit pacing, long pauses, silence, filler words, repetition or playback speed in a Selects web Draft while preserving meaning and intentional delivery. Use for flow changes, not selecting a new storyline."
---

## Execution host

Use this plugin's `selects-connect` skill to establish or reuse the production
MCP connection. All editing executes in the connected **Selects web editor**.
Read current editor state and resolve the requested Project and Draft before
mutating. Never substitute the Electron app, local MCP, host filesystem edits,
or direct database writes.

Read current SDK documents with `read_agent_resource`: list paths first and
read the relevant `sdk/*.d.ts` and recipes. The connected editor's declarations
own method availability and input types; a newer skill is not evidence that an
older deployed editor supports a method. If a required method is absent, stop
that operation and explain the concrete missing capability.

Call the installed gateway's exact tool schema. `run_script` input contains
`script`, `summary`, and optionally `allowCommit`; do not add internal result
handles or timeout settings. Keep each operation's session and execution IDs
as described by selects-connect. The web runner currently has a 30-second
active script budget: split long work into bounded calls and save job IDs.
On an uncertain write, inspect its execution receipt and persisted state before
retrying. Manual editing is allowed; re-read fresh state before every commit.

Use the host's available question mechanism or ordinary conversation for genuine
ambiguities. Do not call Selects internal question, scheduler or subagent tools.
Preserve the user's exact answer and scope; no response is not consent.
Observe long-running jobs in later read-only calls using their existing IDs;
do not promise an automatic new turn unless this host actually provides it.

Packaged references below are relative to this skill, read with the host's
plugin-file reader. They are not paths on the editor's disk. Read only the
needed reference. If it is unavailable, report an incomplete plugin package;
do not replace it with an older editor skill whose policy may differ.

Keep paid-operation approval in Selects. Respect its decline or expiry and
never bypass confirmation. Do not claim playback or audible quality from
metadata alone: distinguish saved state, inspected frames and observed playback.

# Speech Flow Editor

Make the current Draft sound naturally paced while preserving the speaker's
meaning, emphasis, and intentional delivery.

For the current Draft's length and tagged-word inventory:

```ts
const draft = selects.draft(sequenceId);
const meta = await draft.meta();
const words = await draft.words();
return {
  durationSeconds: meta.durationSeconds,
  fps: meta.fps,
  taggedWordCount: words.filter((word) => word.filler != null).length,
};
```

This counts tagged words, not removable groups or approval to cut. Continue
with the scope and pacing procedure below. Extra timing or filler facts come
from `Word` in `sdk/transcript.d.ts`; Draft length and word-view contracts are
`DraftMeta` and `DraftHandle.words` in `sdk/draft.d.ts`. These reads describe
the current Draft; picture-dependent decisions still need footage review.

## Whole-clip playback speed

A playback-rate request changes how fast content plays; it does not remove
speech or silence. Use `setClipPlaybackSpeed` on the owning Draft or Synced
Timeline handle. Read its SDK declaration before calling it.

- Use live `draft.clips()` rows or this Synced handle's `layout().placements`.
  Select only the intended Main/Video/Audio clips, not annotation rows.
- Rate is absolute: `2/1` means 2x even when the clip is already accelerated.
  Rate changes retain pitch policy; `reset` requests 1x and retains pitch.
- To shorten D current frames by n with current rate p/q, request
  `{ numerator: p * D, denominator: q * (D - n) }`. Read current values first;
  reject non-positive target length, unsafe integers and rates outside 0.01–100. Pitch preservation is available only at 0.25–10x;
  rate/duration edits outside that range turn it off.
  For 1000 frames at 2x shortened by two frames, request 2000/998.
- To retime exactly one clip to a stated length, use
  `{ mode: "duration", durationSeconds }`; the rate follows. The length rounds
  to whole frames; several clips or under one frame are rejected. Read actual
  duration after applying it; disclose any mismatch. Never trim/delete content
  to conceal it.
- “Make it 5 seconds” alone does not select speed, content summarization or
  trimming. Use established context; otherwise clarify before any mutation.
  “Two frames earlier/faster” can also mean moving its start. Ask only when
  the conversation does not resolve that ambiguity.
- A Draft occurrence edit uses the Draft working copy and `commitAll`.
  Synced edits save shared source content immediately with `allowCommit:true`;
  do not change shared Synced content for a request about one Draft occurrence.
- After a real change, re-read clip and transcript selections before further
  editing. Check persisted state after saving. For an unknown save outcome,
  re-read before retrying. Report verified rate and frame count, not just intent.

## Interpret pacing

Follow explicit timing, thresholds, padding, scopes, and keep rules exactly.
Explicit numeric instructions and zero-padding requests override qualitative
defaults.

When a request came from a prior choice, treat the selected `A:` label and its
`Meaning:` line as one instruction. Preserve the exact offered description; do
not collapse a choice such as “공백만 정리” to its short label when its Meaning
says “길게 늘어지는 침묵과 뜸만”. A custom answer has no inferred Meaning and
stands on its own.

A threshold decides which pauses are eligible for shortening; it does not mean
erasing each eligible pause. Unless the user explicitly asks for no boundary
room, leave natural padding around the speech that survives. A named scope
changes only where this rule applies; never use the raw detected pause as the
edit target when only its excess should be shortened.

In a speech-flow instruction, before and after mean the two speech-facing edges
of every eligible pause in scope. Do not reinterpret them as the Draft's head
and tail unless the user explicitly names the beginning or end of the video.
When the user gives one total or an approximate range and asks for an even
split, use that total's midpoint when needed and divide it evenly between the
two sides.

Use these presets for qualitative requests:

- `gentle`: relaxed and spacious, with generous room for breath and thought.
- `normal`: natural conversational pacing that removes distracting dead air
  while preserving comfortable sentence boundaries.
- `tight`: concise and energetic without sounding rushed.
- `jump_cut`: aggressively compact, prioritizing speed without harming meaning
  or intelligibility.

Treat a preset as the target state, not as an instruction to remove more
material. Compare the current Draft with that target and change only what is
needed to reach it. For relative requests, move only as far as needed in the
requested direction. If the current preset is known, “faster” moves one step
tighter and “slower” moves one step looser. An unqualified
natural/smooth/better request reads as `normal`.

For a preset-shaped qualitative request, call `silenceSpans` with that one
preset. Do not call `minSilenceSeconds` or `keepPaddingSeconds`, compare
alternate presets, or sweep numeric values unless the user explicitly supplied
that number or comparison. Two exceptions only: the deterministic
represented-distribution rule below, and read-only impact previews of the
fixed candidate set (see “Ground taste in measurements”) — never to search for
a value outside that set. This applies to
read-only simulations as well as commits.

Compare a target state with both material heard in playback and material that
is currently cut. Moving to a looser preset may require bringing back filler or
pause material that is hidden from playback; absence from playback is not proof
that the target word-and-filler state already holds.

## Ground taste in measurements

The first principle of pacing: a taste-dependent request is settled on
measured data, never on this skill's own reading of words like long, natural,
or tight.

Gate every pacing request first:

- **Exact request → execute.** The request is exact when it carries an
  explicit number (“cut every pause over 1 second”), an explicit measured
  reference (“like the gap you just showed me”), or an **existing anchor** —
  a value this user already picked or supplied for this Draft in this
  conversation, including one preserved in a `Meaning:` line or
  `deferredIntent`. Use that value verbatim.
- **Taste request → measure, then apply the recommendation.** Without an
  exact spec, words like 긴, 자연스럽게, 타이트하게, “비슷하게” are settled
  on the measurements, not on how the words sound. Do not stop to ask the
  user to choose; their reply to the result is the choice.

For a taste request, measure what the request depends on first:
pause distribution (`pauses({ mode: "represented", output: "summary" })`),
filler counts by category, a named reference gap's actual length. Derive 2–4
candidate values from those measurements with fixed formulas only — a
candidate is computed from the stats, never invented. Fill each candidate's
impact (how many targets, how many seconds) with read-only `silenceSpans`
previews of that fixed candidate set. Apply the recommended candidate.

Report in the user's language: what you applied as a human phrase with its
exact value, target count, and impact in seconds, then the other candidates
the same way, so the user can switch with one reply. A reply naming another
candidate or their own value is executed on its own terms.

Once a value is applied or supplied, that value is the anchor. Later relative
requests (“조금 더”, “한 단계 느슨하게”) move from the anchor; a new taste
dimension with no anchor yet is measured and applied the same way.

After applying, report the anchor value up front (“2.97초 기준 7곳”) and
offer the adjacent adjustment. Narrating the user's words while having
applied something else is a reporting failure, not an application.

### Handle long-pauses-only requests

“Long pauses only” is an eligibility restriction, not a synonym for bare
`normal`. Apply this rule only when the user's own wording or a preserved
`Meaning:` explicitly identifies long, lengthy, prolonged, 늘어지는, 긴, or
equivalent pauses/dead air. “Silence only” merely distinguishes silence from
fillers and does not activate this rule.

Read the preserved `Meaning:` for that vocabulary before you settle on a preset,
and let it decide eligibility even when the selected label maps cleanly onto one.
A label such as “여유 있게” resolves an intensity, never a scope; when its Meaning
says “눈에 띄게 긴 공백만”, the request is long-pauses-only at that intensity, so
the adaptive cutoff below supplies eligibility and the label supplies padding.
Reporting the Meaning back in prose is not applying it — a summary that says
“긴 공백 위주로” after a bare preset plan misstates what was committed.

If the user supplied a numeric pause threshold — directly, through a preserved
`Meaning:`, or as this Draft's existing anchor — use it exactly and skip this
adaptive rule. Otherwise this is a taste request: “긴” is the
user's to define, so read the requested scope with:

```
draft.pauses({ mode: "represented", output: "summary", scope })
```

This distribution includes both visible and soft-cut blank material, so it is
the stable basis for a repeated request. It is not an edit target. Derive the
two candidate thresholds:

```
strict   = max(p95, median * 3)   // "확실히 긴 것만" — recommend this one
moderate = median * 2             // "중간 길이까지"
tailLimit = max(1, ceil(count * 0.10))
```

A clear long tail exists only when count is nonzero, median/p95/max are present,
`max >= strict`, and `atOrAboveP95Count <= tailLimit`. Apply strict when the
tail is clear and moderate when it is not, and report the other candidate with
its exact seconds, its target count, and its previewed impact in seconds. Do not guess a round
threshold, invent a candidate outside these formulas, or ask `pauses()` for
individual represented ranges. A distribution with no distinct tail is not a
dead end: apply moderate and say in the report that no pause stands out.

With the applied or anchored cutoff, plan only:

```
draft.silenceSpans({
  scope,
  preset: <the intensity the request named, or "normal" when it named none>,
  minSilenceSeconds: cutoff,
})
```

The preset supplies natural padding and the computed cutoff supplies
eligibility, so a request that named an intensity keeps that intensity's
padding — “여유 있게” with a long-pauses-only Meaning plans `gentle` padding at
the cutoff, not `normal` padding. Only an unqualified long-pauses-only request
falls back to `normal`.
Never hard-code three seconds globally. Recompute the summary and the anchored
cutoff in the committing call. A repeated identical request must derive the
same distribution and candidates and reuse the same anchor;
if the target already holds, the plan has zero delta and nothing is committed.

### Handle missing semantic boundaries

Before a `gentle` target, or any plan with `semanticEndOnly: true`, can restore
hidden pauses, inspect transcript-view non-speech words in the requested scope.
Count represented blank words and the subset whose `semanticEnd` is true. This
semanticEnd coverage check is a preflight, not an edit.

When represented blanks exist but none has `semanticEnd`, treat the boundary
metadata as unavailable. The default `gentle` plan is a no-op for those pauses:
it must not restore their current cuts and must not be reported as an applied
pacing change. Never compensate by restoring every cut blank or a broad source
envelope.

For an explicit `gentle` or looser request, keep the same requested scope and
preset but use `semanticEndOnly: false` as the metadata fallback. This asks the
preset to compute bounded target padding for each represented pause; it is not
raw restoration. Preserve narrower scopes, explicit keeps, and the
intra-sentence policy below.

Simulate this fallback before committing. Return its cut and restore counts,
before/after duration and delta, and the longest resulting pauses. If the
duration expands unexpectedly or a few pauses dominate the restored delta,
re-plan more narrowly. When the fallback produces no cut or restore target,
leave the Draft unchanged and report that no represented delta was available;
do not claim that a pacing change was applied.

Qualitative intensity must not introduce a made-up numeric threshold. Requests
to cut even short pauses or make the result as compact as possible select
`jump_cut`; zero padding or removing every silence regardless of length must be
explicit.

A target duration for the overall edit is not a pause threshold, padding rule,
or instruction to weaken this target state. Apply the user's speech-flow request
on its own terms. If the resulting duration conflicts with an outer edit-length
target, return that conflict to the edit decision; never search thresholds or
retain meaningless silence just to make the total duration fit. Never revert a
requested speech-flow result merely to recover duration.

When `transcript-guided-editing` hands off a length-compression pass with no
pacing named by the user, apply the `normal` preset and its filler defaults
across the requested scope without asking taste questions. It is still that
preset, not a threshold tuned to the target length.

If the outer edit resolves that conflict by accepting a shorter result —
including its explicit autonomous-completion fallback — the committed result
must still be this requested speech-flow state. Do not report a pre-pacing
candidate as the shorter fallback after only simulating the preset.

## Own the requested result

The request defines the result you are responsible for. When the user names one
thing or gives an exact rule, do only that. If they also ask for a natural join,
take responsibility for that join and no more.

When the user asks for a finished result, such as natural pacing, a rough cut,
or an assembly cut, own the flow of the requested scope, including silence left
meaningless by what you removed. One request may combine these responsibilities;
each part keeps its own boundary. Follow exact timing, category, keep, and
restore directions literally.

Preserve purposeful pauses for delivery or picture, such as breath, emphasis,
reaction, humor, visual action, or an explicit direction, by leaving them outside
the removal targets. `remove()` deletes exactly its targets; retained silence
needs no declaration and does not block a spoken edit.

For an outcome-oriented edit, follow the requested pacing and continuity goals.
When one coherent discarded run includes unwanted interior silence,
`first.span.through(last.span)` includes that exact interior. Keep targets
separate when intervening speech or pauses should remain. A newly isolated pause
alone is not a reason to reject the edit or expand its deletion range.
When no exact-boundary or zero-padding constraint applies, use
`.expand({ padding: "natural" })` to include adjacent room and inspect the
expanded target before removal.

For script-aligned speech assembled from different Resources or takes, judge
continuity by the script sentence rather than by source seams. An unrequested
gap inside one script sentence may need tighter treatment than a real sentence
or turn boundary so the selected fragments still sound like one sentence. For
a qualitative pacing request, normally treat such an intra-sentence gap one
preset step tighter, capped at `jump_cut`. Do not turn the whole edit into a
jump cut, change its selected words, or override explicit timing, `no_cut`,
keep, or protection rules.

While selecting and retaining material, preserve pauses that support:

- a sentence or change of thought;
- emphasis, emotion, reaction, or natural breathing;
- a question-and-answer beat;
- a quotation, joke, visual action, or intentional dramatic moment;
- an explicit keep or protection from the user.

Do not make neighboring words collide, cut off sentence endings, erase
intentional hesitation, or change the speaker's meaning or emphasis.

## Respect direction and scope

Change only the dimension the user named.

- “Shorten,” “cut,” or “remove” reduces the requested material.
- “Extend,” “restore,” or “bring back” recovers the requested material.
- A silence-only request preserves the current filler state.
- A filler-only request preserves the current silence state.
- A broad pacing request applies both the preset's silence policy and its
  eligible filler policy.

When script fidelity is an active constraint, treat script-selected spoken
words as protected content. A qualitative pacing request changes silence and
padding by default; it does not activate preset filler removal. Remove fillers
only when the user explicitly requests their removal or relaxes script
fidelity. Filler metadata decides which authorized filler targets are safe to
remove; it does not authorize changing script-selected wording by itself.

### Pacing a script-based cut

A Draft assembled from a script already dropped the dead air between the
selected lines, so only within-sentence pauses remain and `gentle` — which
cuts at sentence boundaries only — has nothing left to act on. Recommend and
apply one step tighter than the genre baseline: `PODCAST` no silence pass,
`REVIEW` `tight`, every other genre `normal`. Resolve each Resource's genre
with the `DraftMeta.genre` contract in `sdk/draft.d.ts`, not once from the
Draft's `meta()`. `null` and `OTHER` are not a genre here: infer one as that
contract says rather than going straight to `normal`. When the outer flow
already settled the intensity with the user, apply that selection and do not
reopen the question.

More specific rules override broader rules. A named Chapter, Subchapter,
speaker, quote, or other narrow scope must not affect material outside that
scope. Explicit keep and protection rules override every removal rule.

When several interpretations remain valid, choose the narrower and more
conservative edit. How a value is settled is decided by the taste gate in
“Ground taste in measurements”, not by feel: an exact spec or anchor executes,
and everything else applies the recommended measured candidate.

## Handle fillers

For broad pacing requests, use these filler defaults:

- `gentle`: remove no fillers automatically.
- `normal`: remove disposable hesitation and accidental repetition.
- `tight` and `jump_cut`: remove disposable hesitation, hedging, and accidental
  repetition.

Pause padding belongs to the speech that survives. Reach the requested
word-and-filler state first, including any restoration required by a looser
preset, then judge silence from that resulting Draft. Any spoken-content change
invalidates an earlier pause judgment.

When the user names a filler category, repeated wording, or an example such as
“um” or “uh,” that is an exact spec: keep the target within that metadata
family and execute without asking. Do not widen a named example or category to
every filler type. A bare filler request with no named family and no anchor is
a taste request: count the stamped fillers by category first and offer the
measured choices (for example, tagged fillers only — N words — versus every
occurrence of the named vocabulary — M words) before removing anything.

Use the analysis metadata as the source of truth. Target only words marked as
fillers. Treat every word with the same group id as one all-or-none decision,
and automatically change the group only when every member is marked removable.
If a word has no filler tag, or any member of its group is not removable, do not
remove it automatically. Do not replace this metadata with a subjective second
judgment about meaning or delivery.

A filler group remains one all-or-none semantic decision. When all removable
members form one discarded run and the interval contains no kept speech or
purposeful pause, remove `first.span.through(last.span)` so the exact interior
leaves in the original operation. Apply the boundary policy above to adjacent
room; an exact word-boundary request keeps the combined span unchanged. Never
use `through()` across kept speech,
protected content, or a pause retained for delivery or picture. In that case,
keep the word targets separate. Restoring filler words still restores the member
words, not the source interval between them.

## Secure the requested padding

Loosening pacing does not bring back content the user deliberately deleted;
only an explicit restore does.

When an assembled best-take Draft needs more seam room, preserve the current
silence eligibility threshold and adjust `keepPaddingSeconds`. Do not switch
the whole Draft to a looser preset merely to widen seam padding.

For any restore request, first restore eligible retained or cut material
already represented in the current Draft. If the requested material is
physically absent, recover only its exact source-backed content. Restore target
fragments rather than a broad envelope when that envelope contains silence,
fillers, or words the user did not request. When the request needs more pause
room, recover source-backed silence only when it is directly adjacent to the
relevant utterance boundary. Check the beginning and end of the Draft as well as
internal seams. Do not borrow unrelated silence or invent synthetic silence;
use only real source-backed silence.

Do not infer that physically absent source-backed room is unavailable from a
current-Draft-only read. Before asking the user to choose a fallback, inspect
the relevant source boundary or verify recoverability with a no-commit
simulation.

For an exact word-only restoration, recover each requested word fragment on its
own, including adjacent members of one filler group. Do not enclose the source
space between members; any non-target frames there stay absent unless the user
also requested their restoration.

Do not skip an entire missing source interval just because it also contains
material outside the request. Split mixed intervals into exact fragments. For a
silence-only restore, recover each eligible blank fragment around or between
omitted words while leaving those word fragments absent.

An explicit request to restore silence protects every exact source-backed blank
fragment in scope, including a fragment between omitted words. Treat "only
silence" as excluding speech from restoration, not as permission to skip or
later delete an isolated requested blank.

An internal seam list does not cover the requested scope's outer edges. Define
those source-backed boundaries independently from transcript words: the first
and last word are not the start and end of the scope. For a whole-Draft restore,
include eligible silence before the first source word and after the last source
word, then apply the same requested target at both edges.

Never use the same source silence twice or leave duplicate, overlapping, or
touching silence fragments. Treat contiguous silence at one utterance boundary
as one pause, then leave only the final padding requested by the user.

## Reach the result through the reads

Silence and filler edits operate on the rows returned by the Draft's pause and
word reads. Pass pacing cut rows as-is. For spoken removal, group each coherent
discarded run into `first.span.through(last.span)` and apply the boundary policy above;
do not join separate runs or cross kept content. Submit all resulting targets
in one removal call. For a restore request, read the reference Draft's words or pauses,
select the requested rows, and pass them as-is; source room between restore
rows joins only when the user asked for it.

Verify a timing-only edit from the resulting Draft's metadata, such as
duration. When the edit touches spoken words or a named scope, confirm the
affected words themselves with a targeted transcript read.

### Guard every pacing result

Every pacing pass — removal-only, restoration, filler, preset, numeric, or
relative — first runs in a separate `run_script` call without `allowCommit`.
Read the baseline, plan from the current working copy, apply the complete plan,
and return a compact impact report. The report includes:

- before/after/delta frames and resulting duration;
- plan-row count, cut/restore fragment counts and frames, and changes per minute;
- min/median/p95/max duration of touched pause rows and semantic/non-semantic
  row counts;
- the densest 60-second window and largest delta contributors. Compute cut
  density in playback coordinates and restore density in base coordinates
  separately; never mix the two coordinate systems;
- non-speech versus spoken-word cut-state changes from transcript-view words;
- represented pause summary before/after and stranded-pause count before/after.

Compute counts, frame totals, density, and contributor evidence that reads a
planned `Span` before applying the first mutation. Spans become stale when the
working copy changes; after applying the plan, discard them and obtain every
post-edit fact from a fresh read. Base restore ranges are still recomputed in
the eventual committing call, never carried forward.

If the policy has a scope, re-derive the equivalent scope from fresh semantic
anchors before the post-edit `silenceSpans` check. Never reuse the pre-mutation
scope `Span`, including one created by `rangeAtFrames`; it is stale after the
first edit. Preserve the same named or anchored content, not the old numeric
playback boundary.

After applying the simulated plan, call `silenceSpans` again with the exact
same policy and current scope. A target-state pass is complete only when this
second plan is empty. Keep every raw Span and base range inside this simulation;
only scalar evidence crosses into the next call.

Do not commit when any hard guard fails:

- a target escapes the named scope or an explicit keep/protection;
- a silence-only pass changes any spoken word, or a filler pass changes a word
  outside its explicitly authorized filler groups;
- the post-plan still violates an explicit threshold, padding, or target state;
- a relative tighter/looser request produces the opposite duration direction;
- the missing-semantic-boundary safety rule is bypassed;
- a taste-gated value was applied that is neither the user's pick or anchor
  nor the recommended candidate, or a candidate was used that the fixed
  formulas cannot produce; or
- the plan has zero delta but would be reported as an applied change.

Treat an unexpectedly concentrated 60-second window, a few rows dominating the
delta, or a surprisingly large duration change as a soft anomaly. Re-plan at
most once using a narrower subset of the already authorized scope while keeping
the requested preset, threshold, padding, and direction unchanged. Never weaken
an explicit `tight`, `jump_cut`, numeric, or zero-padding request merely to pass
the review. If the second simulation still fails, leave the Draft unchanged and
report the evidence.

Only after a passing simulation may a fresh `allowCommit: true` call re-read
the current Draft, recompute every target, re-run the same hard guards, and
commit. Never carry raw cut or restore ranges from the simulation. After commit,
use a new read-only call to verify the persisted duration, represented summary,
spoken-word state, stranded pauses, and zero remaining delta for the requested
target. A spoken-content change that precedes a pause judgment remains its own
stage.

## Finish safely

Make the decision from the current Draft and the user's request alone. The same
current Draft should produce the same result regardless of how it was created
or which edit history led to it. Do not require the user to describe that
history.

After the last change, look at the final result once. Keep every change inside
the responsibility the user gave you and leave unrelated edits intact. Do not
expand a removal merely because it leaves an isolated pause. Never remove a keep,
a deliberately retained pause, or restored material.

Do nothing when the requested result already holds. Complete a fully specified
request as one committed edit.
