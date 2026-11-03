# Storyline planning and transcript evidence

Read this reference only for a trim or another cut that selects or reorders
spoken story/content. The output is one section-by-section storyline that both
placement and the cut follow. This reference decides what survives;
`cut-execution-and-review.md` owns mutation and persistence.

## Sections

- Chapter overview mapping
- Bounded transcript evidence and failure handling
- User-owned storyline decisions, retakes, and visual-beat lookup

## Map chapter overviews

For `hasTranscription` sources without full analysis, plan from bounded
`project.transcription()` windows with source IDs and seconds. Read overlapping
windows across the requested scope to preserve context.

For inventory units with full analysis, map chapters down in the same `run_script`:

```js
(await selects.project(projectId).resource(resourceId).chapters()).map((c) => ({
  title: c.title,
  kind: c.kind,
  startFrame: c.startFrame,
  endFrame: c.endFrame,
}));
```

Never return raw `chapters()` because each row's `span.text` contains the full
transcript. Empty chapters do not imply a missing transcript; check
`hasTranscription` and actual words.

## Gather source transcript evidence

For sources with full analysis, read the relevant chapter or bounded range with
`selects.project(projectId).resource(resourceId).viewerTranscript({ startFrame,
endFrame })` through `run_script`. Narrow, split, or page an incomplete result
until the evidence required for sections, forks, highlights, and dependencies
is present. Do not fill gaps from chapter titles or expected subject matter.
For early transcripts, use the source-time read in `references/transcript-lookup.md`.
Proposed sections are editorial notes, not persisted analysis.

Ground every reported item in transcript evidence:

- sections carry a title, summary, and frame range;
- editorial forks identify the competing options and their ranges;
- highlights quote the exact moment and explain its value;
- dependencies quote and locate both sides of question/answer pairs, topic
  transitions, and antecedent/reference relationships.

If a dependency crosses read ranges, inspect an overlapping boundary range;
never infer it from summaries.

## Co-build the storyline

The storyline is the user's editorial decision where the material genuinely
supports different stories. Before building, put those forks — only those —
into one a host-supported question call, each with your recommended choice first. Settle
every other fork yourself and keep a line on what you chose for the report.
Once building starts, ask nothing more; continue until all sections are
decided.

Make the result dependency-closed:

- a kept question retains its relevant answer;
- a new topic retains a transition or self-contained entry;
- a pronoun or definite reference retains an introduced antecedent.

Retakes are a fork, not a raw “which take?” question. Read `takeGroups()`, judge
false starts, incomplete takes, and clean finals from their content, recommend
a take, and carry the user's choice into the cut. When re-working a Draft, use
`run_script` with `draft.searchScenes(...)` only when a desired visual beat is
not named by dialogue; inspect its original hits through `captureFrames` +
`display` before choosing one.
