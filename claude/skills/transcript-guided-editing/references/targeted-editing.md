# Targeted transcript edit

Use this reference when the user names one bounded spoken-content change on an
existing Draft. It selects the target; `cut-execution-and-review.md` owns the
actual mutation and verification.

## Keep the scope bounded

Examples include removing one named sentence or duplicate, choosing another
take for one line, removing retakes, or trimming a named head or tail. Do not
rebuild the storyline, rematch a supplied script, or widen the request into a
general cleanup pass.

Pacing, silence, pause, or filler-only requests belong to
`speech-flow-editor`, even when the user names a range. A visual moment that is
not identifiable from dialogue belongs to `visual-editing` unless the user has
already supplied an exact Draft range.

## Resolve the target from current state

For a meaning-described moment, follow `references/transcript-lookup.md` first.
It locates the source speech and current Draft occurrence without a whole-Draft
audit. Return here for the boundary decision only when the user requests a cut.

Read only the bounded Draft context needed for the request. Locate dialogue
with `findUnique` when the quote is unique; otherwise use `findAll` and resolve
the intended occurrence from nearby transcript, time, speaker, or the user's
named context. Never choose the first match merely because it is first.

For a unique quoted passage, inspect its current Draft coordinates directly:

```ts
const draft = selects.draft(sequenceId);
const match = await draft.findUnique(quote);
const meta = await draft.meta();
return {
  text: match.span.text,
  startFrame: match.span.startFrame,
  endFrame: match.span.endFrame,
  startSeconds: match.span.startFrame / meta.fps,
  endSeconds: match.span.endFrame / meta.fps,
};
```

For another observation, follow its returned type: `ClipInfo` in
`sdk/draft.d.ts` describes placed clips. In `sdk/transcript.d.ts`, `Word` is
an observation with text and timing fields; it has neither `.span` nor
`.source`. `WordRow<S>` adds `.span: S` and `.source: SourceSpan | null`.
Draft playback rows use `WordRow<Span>`; Resource rows use
`WordRow<SourceSpan>`. Draft `words({ view: "transcript" })` returns raw
`Word[]`. Read source timing fields or a row's non-null `.source` for
provenance; keep the original owner-checked rows for edits. `Span` in
`sdk/core.d.ts` owns Draft range operations. A new lookup still needs the
occurrence decision above.

For retakes, read current `takeGroups()` and keep these guards:

- When `analysis?.status === "skipped"` or `selection == null`, preserve the
  group's placements during automatic retake cleanup. Alternative order is not
  a best-take decision. `analysis.mode` states which media supported a choice;
  an `audio_only` judgment does not assess visual quality.
- Remove a retake only when the same group has more than one current
  `placement`.
- Remove only the unwanted `placement.spans`; `selection.spans` and
  `alternatives[].spans` are transcript-derived evidence, not exact current
  placement footprints.
- Change one placement with generic `replace({ target, source })`, using its
  exact Draft placement Span and the target physical take from the source
  group's deterministic `takes` inventory. Pass that take's fully mapped exact
  `SourceSpan` or ordered `SourceSpan[]`. These already include the intended
  take room; pass them unchanged because `replace` copies the supplied ranges
  exactly.
- If “remove retakes” finds no duplicates, report a no-op instead of cutting.
- A Draft that currently uses a non-selection take may be deliberate; do not
  replace it without the user's request or evidence that it is the named flaw.

## Hand off a precise plan

Return the intended occurrence, reason, owner-checked target provenance, and
the narrowest boundary policy that matches the request. Use exact word edges
for a named literal phrase, prefer `semanticCutSegment` for a complete spoken
idea, and use the verified exact current-word endpoints when that metadata is
unavailable. The fallback still requires the staged seam review; never replace
the missing metadata with speaker turns or punctuation-based sentences. Use an
explicit structural range only for non-spoken work.

If multiple valid interpretations would remove different content, take the
likeliest and name it in the report. Hand the plan directly to
`cut-execution-and-review.md` and preserve every unrelated edit.
