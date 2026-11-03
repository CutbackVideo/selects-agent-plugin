# Content-cut execution and join verification

Use this for every content cut. Scale reads and batches down for short Drafts;
do not skip the safety gates.

## Sections

- Boundary and coordinate policy
- Long-form and bounded-batch execution
- Script EDL build modes
- Stage evidence and typed seam review
- Discourse, source-room, and visual checks
- Exact reviewed-set commit
- Feasibility, final read-back, and final saved-Draft review

## Apply the selection route's boundary policy

The selection reference decides what content survives. This reference decides
how to express and verify that decision.

Use each read's declared return shape. `WordRow`, `SegmentRow`,
`SemanticCutSegmentRow`, `ChapterRow`, `DraftMatch`, and `SourceMatch` carry
`.span`; Draft variants carry `Span`, and Resource variants carry `SourceSpan`.
Transcript-view `words({ view: "transcript" })` returns `Word[]` observations
without `.span`; resolve an editable range through its owning handle before
editing. Combine compatible spans with `first.span.through(last.span)`.
For speech clip assembly or a whole discarded run without explicit boundary
constraints, call `.expand({ padding: "natural" })` on the combined span to include
available adjacent breathing room. Keep `.span` unchanged for exact word/frame
boundaries or zero-padding requests. Inspect the returned range; insert/remove/replace apply it exactly. Numeric
`.expand({ before, after })` adds seconds and may include speech; do not combine
numeric expansion and padding options. Frame ranges, pause spans, and chapter
spans stay exact unless explicitly expanded.

For an exact-boundary or zero-padding request, insert at the exact quote.
Do not expand it even when the surrounding clip contains only speech-free room:

```js
const ending = (await d.findUnique(endingQuote)).span;
await d.insert({ tracks: "all", source: bridge, at: { after: ending } });
```

Use `before` for the other side. The quote is the insertion anchor; the
inserted source needs its own verified boundary policy.

Only when the user wants reviewed speech-free room preserved may the anchor
move to its containing Main clip's edge. Choose the policy explicitly in the
call; the helper never infers it from the presence of silence:

```js
async function quoteInsertionAnchor(d, quote, side, policy) {
  if (policy === "exact") return quote;
  if (policy !== "preserve-reviewed-room")
    throw new Error("Choose exact or preserve-reviewed-room insertion.");
  // Playback words omit unknown placeholders. Their absence cannot prove
  // the room is safe; transcript coordinates must not be compared to playback.
  const hasUnknown = (await d.words({ view: "transcript" })).some(w => w.unanalyzed);
  if (hasUnknown) return quote;
  const clip = quote.expandTo("clip");
  const [start, end] = side === "before"
    ? [clip.startFrame, quote.startFrame]
    : [quote.endFrame, clip.endFrame];
  const crossesSpeech = (await d.words({ view: "playback" })).some(w =>
    w.startFrame < end && w.endFrame > start &&
    !w.nonSpeech && w.text.trim().length > 0
  );
  return crossesSpeech ? quote : clip;
}
const ending = (await d.findUnique(endingQuote)).span;
const anchor = await quoteInsertionAnchor(d, ending, "before", "preserve-reviewed-room");
await d.insert({ tracks: "all", source: bridge, at: { before: anchor } });
```

For an exact request, use the first example or pass `"exact"`. For insertion
after the quote, pass `"after"` and use `at: { after: anchor }`. Only inspect
the insertion side; another spoken line there keeps the exact quote. Review
the extra picture and audio before selecting `"preserve-reviewed-room"`.
Recompute anchors in both stage and commit calls, then read back the saved
source placement and check that its first/last frame touches the requested
quote boundary. Word order and total duration alone do not prove placement.
An explicit whole-clip request can use `expandTo("clip")` directly.
Natural padding is not whole-clip selection. `"clip"` is Draft-only and needs
one containing Main clip; a gap or cross-clip span fails rather than choosing.

- **Script-driven exact line:** resolve the selected quote to current words and
  keep the exact spoken-word head and tail. Do not expand it to a neighboring
  semantic unit merely because `semanticCutSegment` exists.
- **Story or complete spoken idea:** prefer expanding both located endpoints to
  `semanticCutSegment` before joining or removing them. When the runtime reports
  `semantic_cut_segments_unavailable`, keep the freshly resolved exact word
  endpoints and prove the resulting joins through the same stage/seam gates.
- **Targeted literal phrase:** follow the user's exact word boundary unless the
  request names the complete sentence or idea.
- **Structural or non-spoken range:** `rangeAtFrames()` is allowed only with
  explicit coordinate provenance and a reason it is not being used as an
  arbitrary speech edge.

Word identity across Sequences is text plus source timing, never `wordId`,
which is Sequence-local. Keep every editable target as the current
owner-checked `Span`, `SourceSpan`, or row returned by the Draft or Resource.
Never substitute a reusable plain frame object.

Use this narrow fallback for a verified pair of boundary quotes. Catch only the
stable capability error; every other expansion error remains a stop:

```js
// For complete-idea edits without exact-boundary or zero-padding constraints.
// Inputs are exact spans from words/find/turns; resolve padding last.
function spokenIdeaSpan(startSpan, endSpan) {
  try {
    return startSpan
      .expandTo("semanticCutSegment")
      .through(endSpan.expandTo("semanticCutSegment"))
      .expand({ padding: "natural" });
  } catch (error) {
    if (!String(error).includes("semantic_cut_segments_unavailable"))
      throw error;
    return startSpan.through(endSpan).expand({ padding: "natural" });
  }
}
```

The fallback is not permission to turn transcript/chapter scouting frames into edit
boundaries. Resolve the intended occurrence from the current transcript first.
`turns()` remains speaker context, and punctuation-based sentence grouping is
presentation context; neither one supplies a missing semantic boundary.

`draft.remove(targets, { tracks })` requires an explicit selection. Use `"all"`
for synchronized cuts across every lane, `"main"` for Main and its transcript
companions, or current track IDs for specific lanes. Selected media is trimmed
and rippled on its lane; excluded lanes keep their timing and content. With
`"main"`, lane clips move as a Transcript word delete moves them.
Use `removeClips()` for whole non-Main clips from current `ClipInfo` rows.
`insert()` accepts a source-owned live `SourceSpan`, its portable
`SourceSpanRef`, or an owner-checked Draft target. Keep that ownership explicit.
Across calls, create the ref with `sourceSpan.toRef()` and either pass it to the
edit directly or resolve a fresh live span through the owning Resource handle.

Pass multiple subtractive runs in one remove call; they share pre-call playback
coordinates. A mutation changes the working copy before `stage` or `commitAll`;
affected live Spans and clip rows may become invalid immediately. This also
applies when reading getters, calling `toJSON()`, or returning an old Span for
result serialization. Capture plain text and frame values needed for a
before-edit report before mutation; those values describe the old state and
are not editable targets. Re-read current rows and positions for post-edit
observations and subsequent edits, and recompute targets separately in stage
and commit calls. For an unedited stringout, confirm once that transcript,
playback, and source frames align before relying on that relation.

## Clip boundaries after a content edit

An edit can create a Main clip boundary at the intended split frame. Resolve
the intended boundary against the changed Draft, then read current `clips()`
before deciding whether another split is needed. `splitAt` accepts only a
frame strictly inside a Main clip, not an existing edge or Draft endpoint:

```ts
// boundaryFrame is resolved from the current, post-edit Draft.
const clips = await draft.clips();
if (clips.some((clip) => clip.trackKind === "main" &&
    clip.startFrame < boundaryFrame && boundaryFrame < clip.endFrame)) {
  await draft.splitAt({ frame: boundaryFrame });
}
const currentClips = await draft.clips();
```

Select transform targets from `currentClips` using the user's scope; a skipped
split does not itself select a clip. Re-read rows again after a transform or
other mutation before using them for another edit.

## Anchor long-form material

For a roughly 45+ minute source or Draft under a broad “tighten it” request,
start with one compact metadata-and-candidates scan: duration/fps, chapters,
pause counts, first and last few utterances, and likely real start/end anchors.
The script may read the transcript internally, but its result must remain
small. If the true show boundaries are clear and fit the approved goal, remove
pre-roll and post-roll before local cleanup.

## Cut at range level in bounded batches

Prefer whole abandoned takes, repeated utterances, production/meta chatter,
and tangent clusters. Do not globally remove every filler or truncated token;
remove an isolated filler only inside a semantic segment already selected for
removal. Otherwise leave it for a separately requested speech-flow pass. If the
plan approaches many dozens of word-level operations, return to utterance/range
candidates.

For length compression, sentence- and utterance-level removals inside chapters
are the intended edit, not noise to consolidate: keep them, and split them into
more batches rather than returning to larger ranges. Fillers and pauses still
belong to the speech-flow pass that compression runs after the content cut.

Transcript frame ranges and chapter times are scouting windows, not edit
boundaries. Never turn one into spoken content by filtering words inside the
window and inserting `words[0].span.through(words.at(-1).span).expand({ padding: "natural" })`, and never use
`rangeAtFrames()` to remove a spoken word or phrase. Locate the chosen quote on
its Resource, then expand both endpoints before assembly:

```js
const source = selects.project(projectId).resource(resourceId);
const start = await source.findUnique(startQuote);
const end = await source.findUnique(endQuote);
const spokenRange = spokenIdeaSpan(start.span, end.span);
await d.insert({ tracks: "all", source: spokenRange });
```

For spoken-range removals, find the intended Draft occurrence and pass its first
and last exact word spans through `spokenIdeaSpan()`. When exact word endpoints
bound one coherent discarded run, `first.span.through(last.span)` explicitly
includes its interior silence. When source-backed breathing room is intended,
use `.expand({ padding: "natural" })` on the combined span before removal.
If an interior reaction, visual action, or timing
beat must remain, keep the speech targets separate. `remove()` leaves non-target
silence unchanged, even when it becomes isolated; no declaration is required.
`rangeAtFrames()` remains an advanced coordinate escape hatch for structural or
non-spoken work; it does not make an arbitrary speech edge natural.

Use one chapter or one editing purpose per batch. If the planned batch would
create more than about 10 joins, split it before staging. Recompute matches and
spans separately in every stage or commit call.

## Build a script-driven EDL

The script reference's numeric EDL is audit evidence, not a persistence input.
In every stage or commit call, re-run its compact quote/time resolver from the
handed-off resolution recipes against fresh `draft.words()` and keep the
resulting owner-checked spans in memory only for that call. A recipe carries
the Draft owner id, exact start/end quotes, occurrence/time hints, and internal
cuts. If it no longer resolves to the reviewed line set, stop and stage again;
never fall back to the earlier EDL frames.

When those freshly resolved kept spans are monotonic, remove their complete
complement back-to-front on the existing persisted working Draft: the head
before the first kept span, every inter-span gap, and the tail after the last
kept span. Do not remove a zero-length range.

When they are non-monotonic, rebuild in script order on that same persisted
working Draft rather than choosing worse takes to avoid rearrangement. Derive
all source spans and one explicit structural target for the original Main
playback from fresh state; append the source spans in EDL order, then remove
the original playback target in the same working copy. The timeline-setup step
must already have committed this working Draft because `stage()` rejects an
unsaved new Draft. Never create a second Draft for the rebuild.

`insert` and `replace` apply the supplied ranges exactly. Neither adds source
room nor expands the removal target.

Before `stage()` and again in the fresh commit call, read the working-copy
viewer transcript and verify:

- every selected `spokenLine` appears once and in script order;
- no selected line was duplicated or lost;
- no kept token ends in `--` unless the source transcription proves it is not
  an abandoned restart;
- no words outside a selected spoken line slipped into the rebuilt Draft;
- planned removals contain no words belonging to a kept line;
- the Draft name exactly matches the task.

Return a diagnosis without staging or committing when one of these checks
fails. A new Draft is persisted only by its successful `commitAll`; a failed
simulation must not create a “DISCARD” Draft. If a persisted Draft is flawed,
repair that same Draft id instead of forking. One task creates at most one new
Draft.

## Stage evidence before committing each batch

Use separate stage, review, and commit calls. In the stage call, snapshot seam
`reviewKey`s before editing, apply one batch, inspect the working copy, then
compare the joins whose key is new with the typed review returned by `stage()`.
Compare keys, not ids: a cut beside an earlier join changes that join's review
state but not its id.

```js
const d = selects.draft(draftId);
const beforeKeys = new Set((await d.seams()).map(({ reviewKey }) => reviewKey));
const [dupes] = await d.findAll(["so the trick is to rest the dough"]);
await d.remove(
  dupes.matches.slice(1).map((m) => spokenIdeaSpan(m.span, m.span))
, { tracks: "main" });
const changedSeams = (await d.seams()).filter(
  ({ reviewKey }) => !beforeKeys.has(reviewKey)
);
// Gather the checks below and display required frame strips for changedSeams.
const staged = await d.stage(reason);
const review = staged.review;
if (review.changedSeamsTruncated)
  return { ready: false, reason: "changed seam review truncated; split batch" };
const observedKeys = changedSeams.map(({ reviewKey }) => reviewKey);
const stagedKeys = review.changedSeams.map(({ reviewKey }) => reviewKey);
if (
  observedKeys.length !== stagedKeys.length ||
  observedKeys.some((key) => !stagedKeys.includes(key))
)
  return { ready: false, reason: "observed and staged seam sets differ" };
return {
  ready: true,
  reviewedSeamKeys: stagedKeys,
  changedSeams: review.changedSeams,
  findings: staged.findings,
  evidence,
};
```

`Seam` and `StageFinding` are different SDK contracts. A seam has `id`,
`playbackFrame`, `before`, `after`, `removedText`, `hiddenDraftFrames`,
`sourceJump`, `sourceGap`, and `videoAngleChanged`. It has no `severity` field.
Only `staged.findings[]` has `severity: "hard" | "soft"` and an optional
`seamId`. Never cast either result to `any`, invent aliases such as
`startFrame` for a seam's position, or treat missing fields as null defaults.

Treat a malformed or internally implausible review as a failed inspection, not
a clean result. Examples include a missing required field, a changed-seam count
that disagrees with the rows, truncated review presented as complete, or
multiple distinct internal joins all reported at playback frame zero. A zero
changed-seam result is acceptable only when the simulated operation is a
verified no-op or changes an outer edge without creating a join; record that
reason explicitly.

Gather evidence for every changed seam before `stage()`, return its transcript
and room evidence, and `display()` every required frame strip. Do not commit in
this call. Review the typed findings, returned seams, and displayed evidence in
the primary context. Resolve every `hard` finding and explain or resolve every
`soft` finding before the commit call. An empty matcher `flags` array or empty
`staged.findings` array does not replace the seam-by-seam checks below.

## Prove discourse continuity at changed joins

`semanticCutSegment`, when available, supplies a local boundary, not proof that
the kept ideas belong together. Exact-word fallback boundaries carry even less
semantic evidence. During the stage call, inspect the working copy as the
viewer will hear it. For a short Draft use `draft.viewerTranscript()`; for a
long one, read bounded windows around every row in `changedSeams`. Do not infer
changed joins from positions or nearby edits.

Classify each affected join:

- the kept question is followed by its relevant answer;
- a topic change retains setup or starts self-contained;
- a pronoun or definite noun reference has an introduced, unambiguous
  antecedent.

Judge discourse markers such as “So” or “Yeah” from meaning, not string rules.
When this edit caused a break, extend/move the cut or remove the dependent unit,
then re-read the same window. If repair changes the settled storyline, choose
the repair that keeps its intent and name the change in the report.
Do not commit while a discourse break caused by this cut remains unexplained.

## Preserve source-backed room at affected joins

After range assembly or spoken-content removal, inspect every row in
`changedSeams` and its adjacent `draft.words()`. Playback room is
`after.startFrame - before.endFrame`; `sourceGap` and `hiddenDraftFrames` are
not what the viewer hears.

Unless zero padding or an immediate hard cut was explicitly requested, a
zero-frame join is unfinished when either kept edge has adjacent blank source
room. Recover only that source-backed room.

If the blank remains as cut material, use a join-local scope:

```js
const scope = seam.before.through(seam.after);
const plan = await d.silenceSpans({
  scope,
  preset: "gentle",
  semanticEndOnly: false,
});
const restores = plan.flatMap((row) => row.restoreRanges);
```

Pass only exact `restores` to `restoreFrom()` and ignore `cutSpans`.

If the blank is physically absent, read the Resource's adjacent pauses and
choose the source range that explicitly includes the intended room. Use
`resource.rangeAtFrames(startFrame, endFrame)` in Resource coordinates, then
`replace({ target: fragment, source })`. Both ranges are applied exactly.
Simulate first and verify Draft duration, repaired room, kept wording, and the
opposite boundary. Recompute targets for the commit and read the same facts
afterward.

Never borrow unrelated silence, insert a gap, apply one fixed duration to every
join, or widen this into global pacing. If no eligible source room exists,
leave the join and report that exact limitation.

This check proves only represented playback room and recoverable source-backed
blank space. A low-energy breath or mouth sound absorbed inside a word's source
timestamps may produce no separate blank span for `seams()`, `words()`, or
`silenceSpans()` to expose. Without listening or another perceptual audio
surface, report that limit instead of declaring the join audibly natural.

## Display visual evidence at visual joins

Capture and display a six-frame strip for every row in `changedSeams` whose
`videoAngleChanged === true`. Also do this for every changed join when the batch
touched Video, overlay, or B-roll lanes. Spread three frames across the last
roughly one second available before the join and three across the first roughly
one second after it. Use numeric resolved Draft frames with
`draft.captureFrames`, and call `display()`; combine at most two strips in one
12-frame sheet. Split the batch again if the per-run display limits cannot
cover every required join.

Check that the intended subject or speaker is visible, the action reads
continuously, and no black or flash frame appears. A spoken-content join with
no visual change needs only the discourse and source-room evidence above.

## Commit only the reviewed join set

After the stage evidence passes, start a separate committing call with
`allowCommit: true`. Recompute the same operations from fresh state, snapshot
seam `reviewKey`s before them, and diff a fresh `seams()` afterward. Compare the
keys of the joins whose key is new with the exact `reviewedSeamKeys` from the
approved stage round. Ids are not enough: a word beside a join can change after
review while the join keeps its id. Apply the operations in the same verb calls
and order as the stage round; keys include the clips each call creates, so a
regrouped batch differs and must be staged again.

```js
const d = selects.draft(draftId);
const beforeKeys = new Set((await d.seams()).map(({ reviewKey }) => reviewKey));
// Recompute and apply the same operations from fresh state.
const changedSeams = (await d.seams()).filter(
  ({ reviewKey }) => !beforeKeys.has(reviewKey)
);
const reviewed = new Set(reviewedSeamKeys);
const actual = changedSeams.map(({ reviewKey }) => reviewKey);
if (actual.length !== reviewed.size || actual.some((key) => !reviewed.has(key)))
  return { committed: false, reason: "join set changed; stage again", actual };
return await d.commitAll(reason);
```

If the sets differ, stop without committing and stage the recomputed batch for
review. Never approve by join count or playback position.

## Re-check feasibility after required cleanup

Build a complete no-commit candidate after all requested content removals. If
speech flow is also in scope, commit content first, then load
`speech-flow-editor` and apply the user's exact policy in a no-commit simulation
on that persisted Draft. Do not recreate content removals in the speech-flow
working copy.

Before treating duration as feasible:

1. include every requested content removal, including internal false starts and
   retakes inside broad ranges;
2. simulate the exact named speech-flow preset when applicable — never search
   numeric thresholds for a qualitative request;
3. measure the post-cleanup candidate without committing it merely to measure.

Treat the requested length as a guideline, not a hard limit. Do not keep
trimming or restore content just to land on the number, and never restore
rejected takes, manufacture silence, or weaken speech-flow cleanup to add
length. Commit the result and report its actual duration next to the request.

## Final read-back

Report the actual duration next to the requested length. When length or speech flow
was in scope, read compact scalar evidence for spoken seconds and playback
pause count, total, and maximum. Inspect known retake, false-start, or filler
defects in the final viewer transcript, then repeat discourse classification on
the final kept joins. Report unresolved dependencies explicitly.

For wide scouting after the anchor scan, inspect bounded ranges of one chapter
or 10–20 minutes with a concrete target/rubric and compact evidence. Merge the
candidates, resolve overlaps, and keep every cut decision grounded in the
corresponding transcript range.

## Final saved-Draft review before the completion report

After commit, re-read the persisted Draft in fresh read-only calls. Compare
the original user request, including later corrections, with saved content.
Check requested sections, omissions, meaning dependencies beyond local seams,
joins, duration, pacing, and source-backed audio/visual evidence.
Do not invoke the internal reviewer tool, which is absent from this plugin.
This is a same-agent saved-result review, not an independent review.
Record pass, fail or partial for request adherence. Missing source evidence or
failed inspection means partial, not proof that the request was impossible or
completed. Fix confirmed in-scope defects through the same staged editing
procedure, and disclose unresolved concerns. Never infer audible quality from
transcript data or a camera's identity from its track label alone.
