# Break Caption Lines

Move the line breaks in one Draft's captions, as the Captions panel shows them,
so each line ends where a phrase ends and reads naturally on screen. Only where
lines break changes: every word keeps its text, timing and visibility.

These are the Draft's caption document lines (`captionDocumentLines()`), not
the transcript's caption rows (`captions()`).

## Resolve the request

Use the Draft the user mentioned (`@Name [draft:<id>]`). If no Draft is named
and more than one could be meant, ask which one and stop.

Your breaks have the last say over the captions' own `lineLimit`. Use the
length the user asks for; without one, keep lines within `lineLimit`. A line
longer than `lineLimit` is saved as you break it, and "Max length per line" in
the Captions panel is raised to fit it; nothing is re-split.

Read the deployed `sdk/caption-documents.d.ts` through `read_agent_resource` before using these methods. The parent edit-captions skill owns the connection, target selection and user-assisted Add captions / Apply steps.

## Workflow

1. **Read.** In a read-only `run_script`, call
   `draft.captionDocumentLines({ limit: 500 })` and follow `nextOffset` until
   every page is read. If `hasCaptions` is false, return to the parent skill's Add captions step; do not invent lines or invoke desktop-only tools. Note `lineLimit` now and keep using this length for every batch: an earlier batch can raise the captions' own limit, so later reads may show a higher one.

2. **Group into runs.** A run is consecutive lines (`captionIndex` increasing
   by 1) with the same `speakerId` — never group by `speakerName`, which two
   speakers can share. Start a new run at a speaker change or a gap in
   `captionIndex`. Keep runs short — a sentence or two — so a failure
   affects little.
3. **Choose breaks.** For each run, join its lines' `words` in order and decide
   how many words go on each new line:
   - End lines at natural boundaries: after sentence or clause punctuation,
     before conjunctions and prepositions that start a phrase, never between an
     article or adjective and its noun, a name's parts, or a number and its
     unit.
   - Keep every line within the length chosen above: at most N words, or at
     most N letters counting the words' `text` joined by single spaces. With
     `lineLimit` off (both null) and no length requested, keep lines short
     enough to read at a glance. When both fit, prefer lines of similar length
     over one long and one very short line.
   - Keep a run's existing breaks where they are already natural.
   - Skip a run whose breaks would not change.
4. **Write.** In a `run_script` with `allowCommit: true`, re-read the lines and
   call `draft.breakCaptionDocumentLines({ runs })` with
   `{ lines, wordCounts }`, passing line objects from that script's own read.
   Write at most 100 runs per call, **starting from the end of the captions
   and working backwards**: re-breaking a run changes how many lines it has,
   which shifts the `captionIndex` of every line after it, so runs earlier in
   the captions stay valid only while the later ones are written first.
   - If a write fails because a line changed, re-read, recompute the runs
     from that read, and write again.
5. **Report.** Say how many lines were re-broken and give two or three
   before → after examples. If a write returned `raisedLineLimit`, say
   "Max length per line" in the Captions panel was raised to the last one
   returned. Mention the change can be undone. Caption clips already on
   the timeline keep their old lines until Apply is pressed in the Captions panel; say so. Do not press
   Apply unless the user asked for the timeline to change: on a Draft with no
   applied captions it places new clips.
