---
name: transcript-guided-editing
description: "Create or edit a Selects web Draft from source footage and transcript evidence: assemble clips, follow a supplied script, select a story or shorten spoken video. Use speech-flow-editor for pacing-only adjustments."
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

# Transcript-guided editing

Use the transcript to prepare a Draft, decide which spoken material
survives, execute the edit with `run_script`, and verify the persisted result.
The footage is the source of truth; a transcript or supplied script is evidence
for locating and deciding content, not a replacement for the Draft Sequence.

Script-driven selection and all spoken-content cuts run through this Skill and
`run_script`.

## Choose the route before reading details

Choose one primary selection route, then follow that route's order.

- **Timeline setup only** — the user asked to put sources on a Draft or make a
  stringout, without asking to select or remove content. Follow **Prepare the
  timeline** and stop after verifying placement.
- **Script-driven** — the user supplied the actual words to be spoken: a
  script, narration, read-aloud transcript, or verbatim line list. This also
  includes recovering one unmatched script line on an existing Draft: read
  `references/transcript-lookup.md`
  without rebuilding the timeline or rematching completed lines. Otherwise prepare and
  persist the working Draft first, then read
  `references/script-driven-editing.md` and make the selection.
- **Length compression** — the user asked in compression words to make an
  existing spoken video shorter while keeping what it covers ("15분으로
  압축해줘", "cut it down to 20 minutes"). Read
  `references/length-compression.md`; it decides this route from the user's
  words, uses the chapter map and evidence reads from
  `references/storyline-planning.md`, and replaces its selection order and
  questions. Placement follows source order.
- **Storyline-driven** — the user described a story, duration, highlight,
  summary, or content goal, or asked to keep only some of the material,
  without supplying the spoken lines. A duration alone does not choose this
  route when the user used compression words; that is Length compression.
  Read `references/storyline-planning.md`, settle the storyline, then place
  sources in that order before cutting.
- **Targeted** — the user named one bounded spoken moment, retake, duplicate,
  or content change on an existing Draft. Work directly from that Draft and
  read `references/targeted-editing.md`; do not rebuild its timeline first.

Do not invent an assembly-editing mode. A request merely to “assemble” means
timeline setup unless the user also asks to select, shorten, or cut content.
An ambiguous request assembles and stops; never cut footage the user did not
ask to cut.

Pacing, silence, pause, filler, or speech-flow-only work belongs to
`speech-flow-editor`. Whole-Draft camera work belongs to the camera workflow
available on the host. Picture-led montage, shot search, or visual composition
belongs to `visual-editing`.

## Read the required references

Read the packaged reference named by the selected route. Before any content
cut, also read `references/cut-execution-and-review.md`; it owns provenance,
staging, seam review and persistence. For camera or overlay work additionally
read `references/multicam-and-overlays.md`. Read only applicable references;
if a required one is absent, stop before mutation and report the missing file.

## Prepare the timeline

### Read the source inventory

Run one `run_script`:

```js
const { clipCount, syncedTimelines, groups, residual, possibleAngles } =
  await selects.project(projectId).organizeClips();
```

`organizeClips` is an SDK method, not a tool. It folds a synced/multicam
timeline into one unit and excludes still-analyzing member clips. Use it for
analyzed source selection, not as the complete list of the user's requested
files. Reconcile it with the explicit source scope from `prepare-editing` and
`resources()` / `sourceFiles()`; never silently omit unanalyzed A/B/C. Use `syncedTimelines[].resourceId`, each
`groups[].resourceIds`, and `residual[].resourceId`; there is no `unitId`.

A synced timeline's members are folded into that one unit, and the client
merges their analyses up into the timeline — the synced result IS the analysis.
A member's own status, and its presence in the foldering-only `unanalyzed`
list, say nothing about the timeline. Judge the timeline by its own
`hasAnalysis` from `resources()` (a merged one reports status
`analysisMerged`, which HAS analysis) or by reading its words — never by a
member's status, and never by a null `genre`, which 2.0 content never carries.

`hasAnalysis: false` means usable analysis is absent, not that the media cannot
be edited at all. A merged timeline can also have partial member coverage;
verify the evidence for the intended range. Follow `prepare-editing` for an
analysis offer, refusal or in-progress work. Analyze eligible members only with
approval; never analyze the timeline Resource itself or overwrite legacy own
analysis.

`hasTranscription: true` makes the Resource's transcript available through
`project.transcription()` while full analysis continues. Read its actual words
and source times, then use `draft.insertResource({ resourceId, sourceRange })`
with source-timeline seconds for transcript-based placement. Do not call
analysis-dependent Resource SourceSpan methods until `hasAnalysis` is true.
The rest of the Draft stage/review/commit procedure still applies.

For transcript-led clipping, include `hasTranscription` sources from `resources()`;
`organizeClips()` can omit them during analysis. Read bounded windows with
`project.transcription()`, retaining resource IDs, source seconds and actual words.

Transcript-dependent selection needs real transcript evidence, but
setup or an explicit-time edit can use `draft.insertResource` with the requested
Project Resource ids, in order, and optional `sourceRange` in source-timeline
seconds. Read its declaration before use; persist with `commitAll` and verify
the saved Draft. Resource source reads, including `rangeAtFrames`, still require
usable analysis: do not invent handles or bypass that guard. After placement,
use current Draft spans for structural edits. After refusal, choose a grounded
supported alternative for content selection, rather than re-opening analysis,
inventing transcript evidence, or dropping files.

### Resolve source and target before mutation

- Treat whatever sequence the editor is showing as UI context, never as an
  implicit source or target. Where the harness offers `read_editor_state`, read
  it there; otherwise use the SDK editor state documented by this web editor. Either way it is
  the current Draft only when
  `(await selects.project(projectId).meta()).draftIds` contains it.
- Honor an explicit source first, including a named existing Draft or
  “this/current Draft” when the current Sequence is a project Draft. Using a
  Draft as source does not authorize modifying it.
- For an explicit NEW request, create a distinct target Draft. With no explicit
  source, use the sole applicable synced timeline or source unit from the
  inventory; take the likeliest when several are plausible and say which.
- Modify an existing Draft only for an explicit UPDATE or bounded targeted
  request. A NEW request sourced from an existing Draft must still write to a
  separate target.

Resolve the target before mutation. Persist its initial placement before a later
content-selection cut. Decide placement from the inventory, including uncertain `residual` or
`possibleAngles` clips, and name those in the report.

### Place whole sources once

Create or reuse only the resolved target Draft. An explicit source-time window is timeline setup
when the user has already chosen the footage and asks only to place it; use that
window with `insertResource`, not a transcript-dependent content-selection pass.
If the request does not identify
whether to revise an existing Draft or make a new one, make a new one, which
leaves the existing Draft untouched, and say so. Insert sources in play order as whole clips; content trimming
belongs to the selected route. For a storyline-driven edit, the settled
storyline determines this play order: do not place or persist sources before
it is settled.

In one `run_script`, create or modify the working copy, validate it, and call
`commitAll(reason)` with `allowCommit: true`. Open the committed Draft only
after commit. Open the saved Draft through the documented editor SDK. Internal Selects
action URLs are not external-host navigation links; report the Draft name and
verified time rather than inventing such a link.

Do not call `stage()` on a new, unsaved Draft. Initial placement uses the validated
`commitAll` above; stage/review applies to later content cuts on that saved target.

If anything fails after `edits` reports a commit, do not recreate or blindly
retry the Draft. Report the saved result and read it back. Timeline-setup-only
requests stop here after noting anything deliberately left off.

Before a later content cut, confirm that the right footage is present — nothing
missing or extra. This placement check is separate from settling a
storyline-driven cut plan.

### Keep speech on Main and pictures over it

The Transcript shows only Main. Speech on any other lane plays but cannot be
read, found or word-edited there, and a later filler or pause pass skips it.

- Speech the viewer should follow — voice-over, narration, an audio pickup, an
  interview line — goes on Main with `insertResource`, Audio files included.
- B-roll, cutaways and other pictures shown over the story go on a lane with
  `overlayResource`, never on Main. When no speech plays under them, first open
  blank time on Main with `insertGap` at a word boundary
  (`at: { before: word.span }`), then overlay the pictures across that blank
  time. A video overlays as picture only; pass `withSound: true` when its own
  sound should be heard there, as in that blank time.
- Music, sound effects and ambience go on a lane with `overlayResource`.

Example: a voice-over line under three setup shots → insert the voice-over on
Main, then overlay the three shots across its span.

## Gather transcript evidence while planning

For a bounded lookup or script-line recovery, `references/transcript-lookup.md`
is the complete read-only procedure. Load it before gathering evidence; do not
load the full script merge or cut-execution procedure until a mutation is in scope.

For a meaning-described spoken moment or an unmatched paraphrased script line,
read the SDK contract and start with `source.searchTranscript({ query, speaker? })`
on the relevant source Resource when `hasAnalysis` is true, before broad transcript
reads or repeated keyword probes. With only `hasTranscription`, use the lookup
reference's early path. Start with one concrete query, inspect its candidate text
and surrounding context, and reformulate only if the candidates do not resolve the request.
Search retrieves source candidates, not current Draft placements or cut boundaries;
resolve the intended current Draft occurrence from the verified actual words.
Empty candidates do not prove absence; use bounded transcript context as fallback.

Keep transcript reads scoped to the relevant chapter, range, or script lines.
If a result is clipped or incomplete, narrow, split, or page it until the
required evidence is complete. Never plan around missing text. Bounded
`draft.viewerTranscript()` reads after placement remain available for edit
verification and targeted edits.

## Produce a selection plan

Search terms are locators, not requirements; a failed search does not
remove the request. Inspect candidates in this project's source and select
the content with the context it needs. Distinguish required wording from
illustrative examples.

For specifically requested dialogue, preserve the intended occurrence rather
than substituting a similar line. If the transcript differs, inspect surrounding
turns and available media before deciding whether it is the same utterance.
Keep unresolved matches explicit; choose working notes as needed.

The selected reference must produce an ordered, source-grounded plan before
editing. Carry at least:

- what survives or changes and why;
- the owner and coordinate provenance of every target;
- a replayable resolution recipe — exact boundary quotes, occurrence/time
  hints, owner id, and internal cuts — so a later stage or commit call can
  resolve fresh owner-checked spans instead of reusing numeric frames;
- the required boundary policy: exact spoken-word boundaries for scripted
  lines, `semanticCutSegment` boundaries for story/content units when
  available, verified exact current-word boundaries plus staged seam review
  when that metadata is unavailable, or an explicit structural range for
  non-spoken work;
- retained dependencies, deliberate omissions, and unresolved choices;
- the requested Draft name, duration goal, and speech-flow wording.

The reference may use its own EDL or section shape. Do not flatten owner-checked
`Span` or `SourceSpan` targets into ad hoc reusable frame objects. If a source
selection must cross a JSON/model/subagent boundary, carry its explicit
`SourceSpanRef` from `sourceSpan.toRef()`; any short relationship key or
candidate label remains local to this plan and is not source identity.

### Interaction policy by route

- **Script-driven:** ask at most the one pacing question defined by its
  reference, then run unattended. Resolve ambiguity reasonably and report the
  assumption.
- **Storyline-driven:** before building, ask the forks that genuinely split
  the story, together in one host-supported question or message with your recommendation
  first, and settle the rest yourself; use the length the user stated, or the
  one the material supports best. Then build the cut without waiting for the
  plan to be approved, and play back the title, storyline, duration, and
  settings in the user's terms in your report.
- **Length compression:** ask only the route question its reference defines
  for mixed wording or a short-video-length target; otherwise choose the cuts
  and the speech-flow pass from its reference and report them.
- **Targeted:** execute a bounded request without reopening the whole story.
  When several interpretations remain, take the likeliest and say which.

Every question, option, and message must be in the user's language. Preserve
the selected `A:` label and its exact `Meaning:` when a prior user
answer supplies speech-flow policy.

## Apply content before speech flow

Satisfy requested content removals and the chosen-take policy before evaluating
duration or pacing. Never recover duration by restoring rejected takes,
undoing approved story decisions, or preserving meaningless silence.

When speech flow is also in scope, commit the content edit first. Then load
`speech-flow-editor` and pass the user's exact wording or the selected `A:`
label plus exact `Meaning:`. Do not turn a duration target into a pause rule.
For length compression, speech flow is in scope by default and its expected
saving is part of the content-removal budget; see
`references/length-compression.md`.

## Execute and verify every content cut

Read `references/cut-execution-and-review.md`, then make the edit yourself with
`run_script`. A selection result, a matcher with no flags, or a successful
`validate()` call does not authorize persistence by itself.

For every persistence boundary:

1. derive targets from fresh state and simulate one bounded batch;
2. validate the content facts and call `stage(reason)` without committing;
3. review the typed `findings` and every row in `review.changedSeams`;
4. repair and stage again when required evidence fails;
5. in a separate `allowCommit: true` call, recompute from fresh state and
   commit only the exact reviewed seam set;
6. read the authoritative persisted Draft back before continuing.

Never carry spans or playback coordinates from an earlier call into a
committing call. Never rerun a truncated, timed-out, or errored committing
script until its `edits` result and the persisted Draft prove no commit
occurred. If a later step fails after commit, continue from the saved Draft.

After the final commit, run the final saved-Draft review from the execution
reference and triage every flag before reporting completion.

## Topic labels after a substantial cut

Topic bands can become stale after content changes. Report this when observed.
Do not invoke the internal topic-regeneration tool: this plugin does not expose
it. Only offer automatic regeneration if the live web SDK documents an available
equivalent; otherwise leave the edit intact and describe manual review.

## Report the saved result

Report the persisted Draft, actual duration against the request, applied
speech-flow policy, script/story deviations, unresolved continuity flags, and
any source evidence that could not be read. If any extra Draft was created or
renamed, say so. When an edit's `diff.warnings` say lane clips came to the cut
or moved to a new lane, say which pictures, captions or sounds moved and where
they are now, and offer to remove the ones that belonged only to what was cut.
When they say an insert cut lane clips open, say where music or narration now
pauses, and offer to lay it again over the opening.

For a script-driven edit, keep the report brief: one result line, the pacing
applied and where it came from, then only deviations from the script — on-set
changes, dropped or unfound lines, a non-best take and why, and assumptions
made from ambiguous instructions. Do not emit a per-line table.

Transcript, seam, waveform metadata, frame captures, and `validate()` cannot
prove final audible or visible quality by themselves. Never claim how the edit
sounds, feels, looks, or paces without the corresponding perceptual evidence.
