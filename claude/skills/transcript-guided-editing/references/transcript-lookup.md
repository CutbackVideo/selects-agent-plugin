# Locate a spoken moment

Use for a meaning-described moment or a script line whose recorded wording
differs. This is a lookup, including when it prepares a later targeted cut.
The result is verified source speech and its current Draft occurrence.

## Keep the read small

Read `source.d.ts`'s search contract and the declarations used below. Use this
recipe rather than inventing a transcript scanner. Execute the blocks as written,
binding only the known ids and query; do not add speculative inventory fields.
`ClipInfo` exposes frame fields directly, not `clip.span` or `sourceName`.
`findCandidates` returns
`match`, `beforeTurns`, and `afterTurns` as Spans: read their text/frame fields,
not `speakerId`. Paged `turns()` returns `.items`, not an array or `nextToken`.
`contextTurns` accepts only `0`, `1`, or `2`; use a bounded transcript range if
more surrounding context is genuinely needed.

Resolve the named Draft from `read_editor_state` or `project.meta().draftIds`.
If the relevant source Resource is already known, check its readiness and use
the corresponding path below. Otherwise list Resources with a transcript
represented on Main:

```js
const project = selects.project(projectId);
const draft = selects.draft(draftId);
const [clips, resources] = await Promise.all([
  draft.clips({ trackScope: "main" }),
  project.resources(),
]);
const ids = new Set(clips.map((clip) => clip.resourceId));
return resources
  .filter((r) => ids.has(r.resourceId) && r.hasTranscription)
  .map((r) => ({
    resourceId: r.resourceId,
    name: r.name,
    hasAnalysis: r.hasAnalysis,
  }));
```

Resolve any genuine source ambiguity from this inventory and the request.

## Early transcript, without full analysis

With `hasTranscription` only, read bounded source-time windows. Narrow clipped
output; for long-source selection, page overlapping windows across the requested scope.

```js
const { utterances } = await selects.project(projectId).transcription();
return utterances
  .filter(
    (u) =>
      u.resourceId === resourceId &&
      u.end > startSeconds &&
      u.start < endSeconds
  )
  .map((u) => ({
    resourceId: u.resourceId,
    start: u.start,
    end: u.end,
    transcript: u.transcript,
  }));
```

Times are source seconds. For new Drafts, re-read selected words and place with
`draft.insertResource({ resourceId, sourceRange })`. For existing Draft cuts,
resolve current occurrences and edit fresh Draft spans. Follow the owning edit
Skill's boundary review. If no transcript is linked, follow `prepare-editing`
for readiness.

## Full-analysis semantic lookup

When `hasAnalysis` is true, search the relevant source once with the user's distinctive wording or meaning.
For example, “the message demanding interest and threatening a formal notice”
or the unmatched script line itself. Do not pre-run synonymous queries.

```js
const source = selects.project(projectId).resource(resourceId);
const draft = selects.draft(draftId);
const { fps } = await draft.meta();
const page = await source.searchTranscript({ query });
const compact = (span) => ({
  text: span.text,
  startFrame: span.startFrame,
  endFrame: span.endFrame,
});
const candidates = [];
for (const { span, probability } of page.candidates) {
  const matches = await draft.findCandidates(span.text, {
    maxResults: 3,
    contextTurns: 1,
  });
  candidates.push({
    source: { ...compact(span), context: span.context },
    probability,
    placementsTruncated: matches.some(
      (m) => m.occurrenceCount > matches.length
    ),
    placements: matches.map((m) => ({
      match: compact(m.match),
      startSeconds: m.match.startFrame / fps,
      endSeconds: m.match.endFrame / fps,
      before: m.beforeTurns.map(compact),
      after: m.afterTurns.map(compact),
      occurrenceCount: m.occurrenceCount,
    })),
  });
}
return {
  candidates,
  eligibleCount: page.eligibleCount,
  scoredCount: page.scoredCount,
};
```

Verify the intended meaning and occurrence from these source and Draft contexts.
Source and Draft frames are different coordinate systems; never copy source
frames into a Draft edit. Multiple placements require occurrence/source checks;
zero placements may mean the speech is already absent or partly cut. In either
case inspect only the unresolved context, not the whole Draft.
Check every returned source candidate: higher-ranked candidates may already be
absent from the Draft. The three-placement limit is only an initial context read.
If `placementsTruncated` is true and the requested occurrence is unresolved, or
the user needs every occurrence, use `draft.findAll([actualText])` to enumerate
the remaining exact placements and inspect the relevant bounded context. Never
report a limited placement preview as exhaustive or choose its first occurrence
just because it is first.

If a previous read already returned the candidate's actual text, pass that text
directly to `draft.findCandidates`; do not repeat a successful semantic query to
recreate a SourceSpan or to get Draft timestamps. Plain quote/context evidence
can cross read-only calls. Fresh editable spans are required when editing, not
as a reason to repeat successful discovery while the source is unchanged.

If search is empty or unrelated, reformulate once using the distinctive content,
then read a bounded relevant chapter/range if still unresolved. Do not call an
empty result proof of absence. A matching but incomplete delivery is useful
location evidence, not proof that the script's missing ending was spoken.

Stop when the actual words, intended Draft occurrence and adjacent context are
established. Report the verified Draft name, time and actual words.
For navigation use the documented editor SDK; do not construct internal action
URLs in the external chat. Saved playback coordinates and source coordinates
are different: report only the known owner and coordinate system.

A read-only lookup needs no genre/pacing choice, full transcript dump, clip audit,
seam review, preparation workflow, or repeated unchanged-state check. Reconcile
an actual unresolved prior mutation only if one exists. Before a requested cut,
return to the selection route and `cut-execution-and-review.md` for fresh targets,
boundary policy, stage/review/commit and persisted verification.
