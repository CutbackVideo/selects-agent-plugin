# Script-driven selection

The user gives a **script** (their intended narration/dialogue) plus analyzed
footage. Produce an ordered EDL whose kept content follows that script: each
line matched to what was actually recorded, trimmed to the line, on the
intended take, in script order. This reference decides what survives;
`cut-execution-and-review.md` owns Draft mutation and persistence.

**Do the edit yourself with `run_script`.**

An attached script is already readable text in your context — work from it
directly, never as `scriptAttachmentId`.

Terms used below: **EDL** = Edit Decision List, the ordered numeric audit of
the spans selected in one merge run. It is not reusable edit input. The
replayable handoff is a **resolution recipe**: Draft owner id, exact boundary
quotes, occurrence/time hints, and internal-cut quotes. You own the EDL
decision: choose the matching strategy, keep the evidence complete, let scripts
resolve occurrences, and have the common executor re-resolve fresh
owner-checked spans before it stages and commits.

## Sections

- Pacing and end-to-end flow
- On-set change semantics
- Enhance-and-match strategy
- Merge pipeline
- Trimming and retake guards
- Executor handoff and success criteria

## Non-interactive — one pacing question, then never ask

The pacing question below is the ONE host-supported question this flow may make, and it
comes before step 0. Otherwise the flow runs unattended: NEVER ask again or
pause mid-edit. On ambiguity, pick the most reasonable interpretation, produce
the EDL, and state the assumption in the final report.

## Pacing

The build keeps whole delivered lines, so the dead air INSIDE them survives,
and only the user can say whether it stays.

- **The task already said it** (an intensity, "remove dead air", a length
  target, a preserved `Meaning:`) → follow that, no question. Read it from the
  instructions, never from the draft's name.
- **Otherwise ask ONCE**, before step 0: one host-supported question in the user's
  language, your recommended option FIRST. Wait for the actual user answer when a decision is needed. Read the packaged `speech-flow-editor` skill. That Skill owns
  the vocabulary, the recommendation, and the edit itself; follow it rather
  than inventing levels or thresholds here.
- **Apply after the EDL commit**, never before — a removal invalidates every
  frame you read for the build. Carry the selected `A:` label and its exact
  `Meaning:` into that pass, and do not let it reopen the question.

## The flow

0. **`analyze_retakes({ projectId, draftId })` first — once no Main source
   is still being analyzed.**
   It analyzes the sources already on the Draft and fails on an empty Main
   track, so place and persist the sources first (the Skill's **Place whole
   sources once**).
   A source counts as still being analyzed while `project.workflows()` shows
   a `project:analyze-resource` workflow for it that is `queued` or
   `running`. The server refuses the job while one is running, and one that
   finishes while the retake job runs changes the Draft's input, so the job
   fails as stale. Sources whose analysis was never requested do not block
   it; they simply yield no takes. While any Main source is mid-analysis, do
   not call it: preserve their workflow IDs, inspect them in later bounded
   read-only calls as described by `prepare-editing`, and proceed only after
   they reach a terminal state. Do not promise automatic agent resumption.
   Never check for existing take groups before calling: it no-ops when they
   already exist. Takes minutes — wait for the follow-up message, and read no
   frame, word id, or span until it lands (it rewrites the draft in place).

1. **Read (light)** — the script (given) + ONE size probe:
   `return (await selects.draft(ID).words({view:"transcript"})).filter(w=>w.text?.trim()).length`
   Use the count to plan compact reads, not to trigger fan-out. Read only the
   timestamped transcript and take-group fields needed for matching. Project or
   page large results; if a read is clipped or incomplete, request a narrower
   result and do not treat the partial text as complete evidence.
2. **Preprocess the script** — split into numbered dialogue lines; drop stage
   directions (only clearly non-dialogue markup: `*action*` lines,
   camera/production notes, parentheticals, editor marks, section markers
   like `[Intro]`). **When in doubt, treat it as spoken** — a misclassified
   direction just won't match, but a misclassified speech line gets wrongly
   cut. If the task itself says how to treat non-speech parts, follow it;
   otherwise drop them and note it in the report.
3. **Enhance + Match** (section below).
4. **Merge → review flags → word-level trim** (section below). Matched
   `spokenLine`s SUPERSEDE the user's script.
5. **Resolve the EDL** — the MERGE PIPELINE resolves quotes to frames and
   orders the EDL. **Out-of-order best takes are NORMAL in a stringout**
   because retakes are often shot later. Never downgrade to a worse take to
   keep the EDL monotonic.
6. **Hand off** — pass the clean resolution recipes, numeric EDL audit,
   monotonic flag, per-line audit, spoken lines, omissions, exact Draft name,
   and pacing policy to `cut-execution-and-review.md`. Numeric EDL frames may
   explain the selection but may never be used by its stage or commit call.

## Enhance — on-set changes (compact rules)

The script is the _plan_; the footage is the _truth_. Match the SPOKEN
version, not the page. Rules, one line each:

- **Addition/restructure** the speaker clearly performed → keep the spoken form.
- **Ad-libs — mode-dependent.** Verbatim script: standalone ad-lib sentences
  OUT; keep only mid-sentence additions inside a kept line. Loose/authorial
  script: keep asides attached to the chosen take. Never rescue a joke from
  a rejected take. NOT ad-libs: crew talk, read instructions, abandoned
  attempts.
- **Omission — CUT.** Line dropped on set → match the shorter spoken version;
  don't hunt an earlier take just to cover scripted words.
- **NOT changes**: fillers/stutters, self-corrections (match target = the
  corrected words; the abandoned attempt is trimmed, not kept),
  contractions, STT typos, same-meaning rephrasing.
- **Quote boundaries (verbatim)**: `startQuote` starts at the CLEAN delivery
  (opening stutter repeat like "While, While Elon…" → start at the
  repetition); `endQuote` = the line's final SCRIPTED words — anything the
  speaker adds after the scripted sentence end is a trailing ad-lib, OUT.
- **Change vs unrecorded**: shares the line's meaning → change; no meaningful
  overlap nearby → not recorded, mark dropped, never map onto unrelated speech.
- **Grounded, no duplication**: every kept word exists in the transcript; a
  repeated phrase belongs to ONE line, not two.

## Enhance+match strategy

Read compact evidence and match every preprocessed line against it.

1. Read a compact take-groups summary and timestamped transcript through
   `run_script`. Return only matching-relevant fields. When paging is useful,
   include `startIndex`, `nextIndex`, `total`, and `done` so coverage is
   explicit rather than inferred from text length.
2. If a result is clipped or incomplete, reduce the projection or page size and
   continue from the last verified index. Never match against a partial result
   presented as the whole transcript.
3. Apply the on-set-change rules above and produce complete `{ lines: [...] }`
   result objects using the line-object contract below. Paste them into the
   unchanged MERGE PIPELINE.

## Matching evidence and result contract

Keep search and judgment grounded in the compact evidence and use the
structured contract below.

- **Matching units**: use one complete result for all lines when its evidence and
  output fit reliably. Split only when one result would be clipped or incomplete,
  or recovery would otherwise repeat already completed lines. When splitting,
  keep lines contiguous, prefer natural script-section or take-group boundaries,
  and size each unit for one complete compact evidence read and structured result.
  Do not target a fixed line count. A matching unit is only a result boundary; it
  does not prescribe how the work is executed. Use the template below as a
  matching checklist. Keep footage data in compact reads, not repeated inside
  the notes.

  ```
  Match script lines <N>–<M> to the footage (transcript + retake summary in
  your context). Your lines live roughly in <T1>–<T2>s of the source (from
  the take-group chronology) — when your line's wording also appears in
  OTHER parts of the source, prefer the occurrence inside your window;
  similar lines outside it belong to other matching units. Per line: enhance
  (match the SPOKEN version — rephrasing/omission on set wins over the
  page; standalone ad-libs <OUT|keep attached>), pick the take (start from
  the group's selection; alternates only for a delivery flaw — audible
  stutter repeats in the selection mean switch to the lowest-rank accept
  alternative — say why), and return exact quotes + segment-marker times.
  Lines (yours):
  <N>. <line text>
  ...
  Other matching units' lines, if split (index only — do NOT resolve; if
  your line's wording matches one of these better than your own, yours is elsewhere):
  <for every other line: "N. first-3-words …">
  Return every line in script order, including dropped lines as omit_line,
  through the required structured result.
  ```

  Windows come from the dry-run take-groups summary (groups are
  chronological; map line ranges to group startSec ranges, pad ±60s) —
  hints, not fences; a relocated line may cross one, but say so.

- **Recover narrowly.** If a matching unit fails, retry it once or retrieve
  only its evidence through a compact read. After a second failure, resolve
  only the remaining lines or report them as unresolved; do not restart the
  completed units.
- **Evidence reads** — these two compact projections provide the take summary
  and timestamped transcript:

  ```
  const evidenceReads = [
    { name: "run_script", label: "take groups summary",
      input: { script: `
  const fps = (await selects.draft("<ID>").meta()).fps;
  const first8 = (s: string) => (s ?? "").split(/\\s+/).slice(0, 8).join(" ");
  const secs = (spans: any[]) => spans?.length ? {
  startSec: +(spans[0].startFrame / fps).toFixed(1),
  endSec: +(spans[spans.length - 1].endFrame / fps).toFixed(1) } : null;
  const gs = await selects.draft("<ID>").takeGroups({ alternatives: 2 });
  return gs.map((g) => ({
  groupIndex: g.groupIndex,
  ref: first8(g.referenceText),
  reason: g.selectionReason,
  analysis: g.analysis,
  placements: g.placements.map((p) => ({ takeIndex: p.takeIndex,
    spans: p.spans.map((s) => s.toJSON()) })),
  selection: g.selection ? { text: first8(g.selection.text),
    ...secs(g.selection.spans), status: g.selection.mappingStatus } : null,
  alternatives: (g.alternatives ?? []).map((t) => ({
    takeIndex: t.takeIndex, verdict: t.verdict, rank: t.rank,
    ...secs(t.spans), firstWords: first8(t.text) })),
  }));`, summary: "Read take groups summary" } },
    { name: "run_script", label: "timestamped transcript",
      input: { script: `
  const ws = (await selects.draft("<ID>").words({ view: "transcript" }))
  .filter((w) => w.text && w.text.trim());
  const fps = (await selects.draft("<ID>").meta()).fps;
  const lines: string[] = [];
  let cur: string[] = []; let start = 0; let lastEnd = -1;
  const flush = () => { if (cur.length) lines.push(
  "[" + (start / fps).toFixed(1) + "–" + (lastEnd / fps).toFixed(1) + "s] "
  + cur.join(" ")); cur = []; };
  for (const w of ws) {
  if (cur.length && (w.startFrame - lastEnd) > fps * 1.2) flush();
  if (!cur.length) start = w.startFrame;
  cur.push(w.text); lastEnd = w.endFrame;
  }
  flush();
  return lines.join("\\n");`, summary: "Read timestamped transcript" } }
  ];
  ```

  Segment markers are `[start–end s]`; times in results must be COPIED from
  them, never guessed — a time hint is the only way to pick the right
  occurrence among repeated takes.

- **Dry-run both evidence scripts first, shape-only** (`{ok, chars, head:
slice(0,80)}` — never ingest the data): a typecheck failure would silently
  propagate the same error. Fix until `ok`, then run the complete scripts.
- **Never place a span on a take whose `verdict` is reject.** The take-groups
  summary carries `verdict`/`rank` per alternative: a reject take is footage
  the director threw away (stutter, incomplete, wrong content) and keeping it
  is a hard error, not a defensible alternate choice. Before returning a
  decision, confirm the chosen occurrence sits inside the group's `selection`
  or an alternative whose verdict is accept. If every registered take of a
  group is reject, say so in the result rather than silently keeping one.
- **Matching duties** (enhance AND match per line): map
  the line to a take group (ref/firstWords); **start from the group's
  `selection`** — the system-inferred pick (`reason` says why). Jump to its
  `startSec` in the transcript and verify the delivery; treat it as a
  SUGGESTION, not truth. Prefer a verdict=accept alternative (lowest rank
  first) or a cleaner unregistered repeat (grouping misses repetitions; the
  final polished take is often near the END of the stringout) only when the
  selection has a delivery flaw or `status` ≠ "mapped" — and say why. A
  matched group is an ANCHOR, not the full candidate set. No group → scan
  the transcript IN YOUR TIME WINDOW BY MEANING, not wording — intros,
  bridges, and outros are often never registered as take groups, and on a
  loose/authorial script the spoken words routinely differ from the page.
  Declare "omit_line" only after a meaning-level scan of the window finds
  nothing; a line you can't find verbatim is usually there in other words.
- **Line result shape** (structure only — free text feeds rumination). Return
  lines in script order, dropped lines included (disposition `omit_line`), each
  with its `scriptLine` so the merge can align:

  ```json
  {
    "fields": [
      {
        "name": "lines",
        "kind": "array",
        "items": {
          "kind": "object",
          "fields": [
            { "name": "lineId", "kind": "string" },
            {
              "name": "scriptLine",
              "kind": "string",
              "description": "Verbatim script line from the brief"
            },
            {
              "name": "spokenLine",
              "kind": "string",
              "description": "Authoritative as-delivered text"
            },
            {
              "name": "scriptDeviation",
              "kind": "enum",
              "values": ["none", "rephrased", "shortened", "dropped", "added"]
            },
            {
              "name": "decision",
              "kind": "object",
              "fields": [
                {
                  "name": "startQuote",
                  "kind": "string",
                  "nullable": true,
                  "description": "5-7 verbatim words, or null for an omitted line"
                },
                {
                  "name": "endQuote",
                  "kind": "string",
                  "nullable": true,
                  "description": "5-7 verbatim words, or null for an omitted line"
                },
                {
                  "name": "approxStartSec",
                  "kind": "number",
                  "nullable": true,
                  "description": "Copied from the segment marker containing the quote; never guessed"
                },
                {
                  "name": "approxEndSec",
                  "kind": "number",
                  "nullable": true,
                  "description": "Copied from the segment marker containing the quote; never guessed"
                },
                {
                  "name": "internalCuts",
                  "kind": "array",
                  "description": "Aborted same-phrase restarts inside the span",
                  "items": {
                    "kind": "object",
                    "fields": [
                      { "name": "startQuote", "kind": "string" },
                      { "name": "endQuote", "kind": "string" }
                    ]
                  }
                },
                { "name": "groupIndex", "kind": "integer", "nullable": true },
                {
                  "name": "takeIndex",
                  "kind": "integer",
                  "nullable": true,
                  "description": "Null when using the group's selection"
                },
                { "name": "verdict", "kind": "string", "nullable": true },
                { "name": "rank", "kind": "integer", "nullable": true },
                {
                  "name": "disposition",
                  "kind": "enum",
                  "values": ["use", "omit_line", "merge_with_prev"]
                }
              ]
            },
            {
              "name": "alternates",
              "kind": "array",
              "items": {
                "kind": "object",
                "fields": [
                  { "name": "startQuote", "kind": "string" },
                  { "name": "approxStartSec", "kind": "number" },
                  { "name": "oneLineReason", "kind": "string" }
                ]
              }
            },
            {
              "name": "adLibs",
              "kind": "array",
              "items": {
                "kind": "object",
                "fields": [
                  { "name": "quote", "kind": "string" },
                  { "name": "attachedToLine", "kind": "string" }
                ]
              }
            },
            { "name": "confidence", "kind": "number" }
          ]
        }
      }
    ]
  }
  ```

### Recover unmatched lines

For an existing Draft with already-matched script lines, enter here directly.
Recover only the unresolved lines; skip timeline preparation, pacing questions,
and full-script matching. A read-only recovery request stops at verified matches.
Follow `references/transcript-lookup.md` for the executable lookup recipe.

- **Empty/low-confidence lines** → recover just those lines with one compact
  targeted probe. When wording differs or ASR spelling prevented a match, read
  the SDK contract and, when `hasAnalysis` is true, use
  `source.searchTranscript({ query, speaker? })` on the relevant source Resource
  before repeatedly scanning transcript windows. With only `hasTranscription`,
  use the lookup reference's early path. For
  example, a script line “We delayed filming because of the rain” can use
  `query: "filming was postponed because of rain"` to locate a paraphrased
  delivery. Inspect candidate text and surrounding context against the intended
  line and take; semantic similarity alone does not establish the right take.
  Recover actual spoken quotes and locate their intended current Draft
  occurrence for the existing line-result contract and merge pipeline. A source
  hit is not a Draft placement, and search does not replace exact quote or
  word-boundary resolution. Do not search every already-matched script line.
  Empty candidates are not proof that a line was unrecorded: inspect the bounded
  transcript/take context before marking it not-recorded.

## Merge → review → trim

- **`spokenLine`s SUPERSEDE the user's script.** NEVER judge by "the original
  script contains these words" — words absent from `spokenLine` were cut on
  set.
- **Accept every line's `decision` as-is — no re-judging, no overrides.**
  Only duplicate claims with the same disposition are resolved by the
  pipeline (higher confidence wins). Duplicates with different dispositions
  stay in `lineFlags` even though the pipeline keeps one row — that line is
  not complete. Adjacency/overlap conflicts surface as pipeline `globalFlags`.
  Your job at
  merging is transport, not review. Do NOT re-verify matched times against
  the transcript: a time off by up to ~20s is absorbed by the pipeline's
  nearest-match, and real mismatches surface as flags. The ONLY pre-pipeline
  check allowed: if several lines share a suspiciously identical
  approxStartSec (copy-paste artifact), ONE probe for those lines, then
  straight to the pipeline.
- **The merge is a SCRIPT, and flags are handled by PROBES**: paste the
  completed matching result objects into the MERGE PIPELINE verbatim and run it
  in the same response you receive the results. **The pipeline is an OPAQUE block: never
  read, trace, or mentally execute its code — interact only with its RETURN
  value** (`lineFlags` + `globalFlags` + `perLine` table). **`lineFlags` is the
  handoff gate; `globalFlags` is not.** Fill `EXPECTED` with every
  preprocessed script lineId in script order, not just the ones the batches
  returned. `lineFlags` empty means every expected line has exactly one
  disposition — kept and resolved, or explicitly `omit_line` — no row names a
  line outside the script, and transcript occurrence resolution is
  complete — make no extra matching
  probes and hand the returned resolution recipes to the common executor. The
  numeric EDL is audit-only. Neither result proves seam quality or authorizes a
  commit. `lineFlags` non-empty → sort the flags by kind first; only
  occurrence flags are cleared by a probe. Settle the `missing` and
  `not in script` re-runs before the occurrence probe — a re-run recomputes
  every line from BATCHES and would undo spans already spliced in:
  - **Malformed input** (`EXPECTED is empty`, a malformed batch, a row with no
    `lineId`, `missing quote/time on a kept line`): repair or replace that
    line object or batch first.
  - **Occurrence flags** (`no match`, `end before start`, `resolved … vs …`,
    `span overrun`, `span … wrong occurrence?`, `internal cut …`): run ONE
    probe script covering ALL of them at once (print each flag's competing
    `occ()` candidates with times) — never one probe per flag in separate
    turns — and fix ONLY those lines with a SHORT patch script: re-declare
    just their corrected quotes/times, resolve them with a compact occ()
    lookup, and splice the resulting spans into the previous pipeline output
    (which you already have verbatim in the last tool result). NEVER retype
    the full pipeline + all batch JSONs a second time — that costs more
    streaming time than the merge itself.
  - **`missing`**: a probe cannot clear it. Recover the line through **Recover
    narrowly** above (same retry limit). If that yields a valid row, add only
    that line's row to the existing BATCHES and re-run the pipeline with the
    same `EXPECTED` — the one narrow exception to "never retype", and that
    re-run counts toward the two-round cap. Without a valid row, the line stays unresolved.
  - **`not in script`**: an input error in that matching unit's result, and it
    blocks handoff. Do not widen `EXPECTED` or drop the flag. Correct that
    unit's result through **Recover narrowly** (same retry limit), put the
    corrected result in place of that unit's batch, and re-run the pipeline
    under the same exception and cap. If the error remains, do not hand off
    as complete or for saving; report the unit and the stray `lineId` as the
    cause.
  - **`conflicting dispositions`**: report the line as unresolved with both
    dispositions as the reason — do not pick one yourself, and do not probe.

  When no occurrence flag remains, run no probe. If a response of yours
  contains flag analysis but no tool call while an occurrence flag, `missing`
  recovery or `not in script` correction is pending, you are rehearsing — run
  it.

- **`globalFlags` describe the whole EDL — overlapping spans, an EDL far wider
  than its own script — so no single line's quotes can clear them.** Never
  loop on them and never treat them as a reason to abandon the pipeline and
  cut by raw time ranges. Read them as evidence that some line took the wrong
  occurrence, name the suspect lines yourself, repair those through
  `lineFlags`' patch path, and carry whatever remains into your report so the
  executor stages with it visible.
- **Two-round cap**: after 2 probe or recovery→re-run rounds, hand off the
  best clean resolution plan and its numeric EDL audit — drop still-flagged lines and
  report them as unresolved, never as omitted or complete; a `missing` line is
  one no unit judged. This cap applies only after every batch is structurally valid;
  a malformed or missing-`lineId` batch must be replaced, never dropped as one
  flagged line, and an uncorrected `not in script` result stops the handoff
  as above. The common executor still stages and reviews the partial result
  before any commit.

  ```ts
  // ── MERGE PIPELINE — OPAQUE: paste verbatim, edit only BATCHES/EXPECTED/ID.
  //    Never read or trace this code; consume only its RETURN value. ──
  // Keep the `: any[]` annotation — the sandbox typecheck needs it.
  const BATCHES: any[] = [
    /* batch JSONs */
  ];
  // Every preprocessed script lineId, in script order — not only the ones
  // the batches returned.
  const EXPECTED: string[] = [
    /* "1", "2", ... */
  ];
  const ws = (await selects.draft(ID).words({ view: "transcript" })).filter(
    (w) => w.text && w.text.trim()
  );
  const fps = (await selects.draft(ID).meta()).fps;
  const norm = (s: string) =>
    (s ?? "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}' ]/gu, " ")
      .split(/\s+/)
      .filter(Boolean);
  // One entry per SEARCHABLE token, with `owner` mapping it back to its
  // transcript word — a word that normalizes to several tokens
  // (self-governance, 3.5, U.S.) stays searchable, and one that normalizes to
  // none drops out instead of breaking adjacency.
  const toks: string[] = [];
  const owner: number[] = [];
  ws.forEach((w, i) =>
    norm(w.text).forEach((t) => {
      toks.push(t);
      owner.push(i);
    })
  );
  const wordAt = (i: number) => ws[owner[i]];
  const occ = (q: string) => {
    const t = norm(q);
    const out: number[] = [];
    // A quote with nothing searchable in it matches nowhere, not everywhere.
    if (!t.length) return out;
    for (let i = 0; i + t.length <= toks.length; i++)
      if (t.every((x, j) => toks[i + j] === x)) out.push(i);
    return out;
  };
  const nearest = (idxs: number[], sec: number) =>
    idxs.reduce((a, b) =>
      Math.abs(wordAt(a).startFrame / fps - sec) <=
      Math.abs(wordAt(b).startFrame / fps - sec)
        ? a
        : b
    );
  // `flags` block handoff (line repair or malformed batch); `globalFlags`
  // describe the EDL as a whole and are reported, never "fixed" by editing
  // one line.
  const flags: string[] = [];
  const globalFlags: string[] = [];
  // dedupe by lineId (higher confidence wins), drop omit_line; a malformed
  // batch blocks handoff, and EXPECTED IS the script order (lineIds are
  // labels, not sortable numbers). Every expected line needs a row — an
  // omitted line needs an explicit omit_line — and rows outside EXPECTED or
  // claiming one line with different dispositions block handoff.
  const byLine: Record<string, any> = {};
  const orderOf: Record<string, number> = {};
  const expected = [...new Set(EXPECTED.map(String))];
  expected.forEach((id, i) => (orderOf[id] = i));
  if (!expected.length)
    flags.push("EXPECTED is empty: list every script lineId");
  BATCHES.forEach((b: any, bi: number) => {
    const rows = (b && b.lines) || b;
    if (!Array.isArray(rows)) {
      flags.push(`batch ${bi} malformed (no lines array)`);
      return;
    }
    for (const ln of rows as any[]) {
      if (ln == null || ln.lineId == null) {
        flags.push(`batch ${bi} carries a row with no lineId`);
        continue;
      }
      const id = String(ln.lineId);
      if (!(id in orderOf)) {
        flags.push(`${id}: not in script (batch ${bi})`);
        continue;
      }
      const cur = byLine[id];
      if (cur && cur.decision?.disposition !== ln.decision?.disposition)
        flags.push(
          `${id}: conflicting dispositions ${cur.decision?.disposition}/${ln.decision?.disposition}`
        );
      if (!cur || (ln.confidence ?? 0) > (cur.confidence ?? 0))
        byLine[id] = { ...ln, lineId: id };
    }
  });
  for (const id of expected)
    if (!byLine[id])
      flags.push(`${id}: missing (no row and no explicit omit_line)`);
  const kept = expected
    .filter((id) => byLine[id])
    .map((id) => byLine[id])
    .filter((l: any) => l.decision?.disposition !== "omit_line");
  // a kept line without quotes/times is a contract violation, not a crash —
  // and never a silent drop: it stays in perLine as FLAGGED.
  const lines = kept.filter((l: any) => {
    const d = l.decision;
    const okShape =
      d &&
      d.startQuote &&
      d.endQuote &&
      typeof d.approxStartSec === "number" &&
      isFinite(d.approxStartSec);
    if (!okShape) flags.push(`${l.lineId}: missing quote/time on a kept line`);
    return okShape;
  });
  // two kept lines carrying the same spoken sentence = one take kept twice
  const byText: Record<string, string[]> = {};
  for (const l of lines as any[]) {
    const key = norm(l.spokenLine ?? "").join(" ");
    if (key) (byText[key] ??= []).push(l.lineId);
  }
  for (const ids of Object.values(byText))
    if (ids.length > 1)
      globalFlags.push(`duplicate line content: ${ids.join("/")}`);
  // time picks the occurrence, quote fixes the boundary
  const spans: any[] = [];
  const splitLines = new Set<string>();
  const recoveredVia: Record<string, string> = {};
  const recoveredAnchors: Record<
    string,
    { startQuote: string; endQuote: string }
  > = {};
  const transcriptQuote = (startToken: number, tokenCount: number) =>
    ws
      .slice(owner[startToken], owner[startToken + tokenCount - 1] + 1)
      .map((w) => w.text)
      .join(" ");
  for (const l of lines as any[]) {
    const d = l.decision;
    const spokenToks = norm(l.spokenLine ?? "");
    let startTokens = norm(d.startQuote);
    let si = occ(d.startQuote),
      ei = occ(d.endQuote);
    let endTokens = norm(d.endQuote);
    let startRecovered = false,
      endRecovered = false;
    // A quote the matcher cleaned up (stutters dropped, fillers added)
    // misses the verbatim transcript; the line's own spokenLine is the
    // authoritative as-delivered text — retry the anchors from it.
    if (!si.length && spokenToks.length) {
      startTokens = spokenToks.slice(0, 7);
      si = occ(startTokens.join(" "));
      if (si.length) {
        startRecovered = true;
        recoveredVia[l.lineId] = "spokenLine";
      }
    }
    if (!ei.length && spokenToks.length) {
      const tail = spokenToks.slice(-7);
      ei = occ(tail.join(" "));
      if (ei.length) {
        endTokens = tail;
        endRecovered = true;
        recoveredVia[l.lineId] = "spokenLine";
      }
    }
    if (!si.length || !ei.length) {
      flags.push(`${l.lineId}: no match`);
      continue;
    }
    const a = nearest(si, d.approxStartSec);
    const eiAfter = ei.filter((i) => i >= a);
    const b = eiAfter.length
      ? nearest(eiAfter, d.approxEndSec ?? d.approxStartSec)
      : nearest(ei, d.approxEndSec ?? d.approxStartSec);
    if (b < a) {
      flags.push(`${l.lineId}: end before start`);
      continue;
    }
    if (startRecovered || endRecovered)
      recoveredAnchors[l.lineId] = {
        startQuote: startRecovered
          ? transcriptQuote(a, startTokens.length)
          : d.startQuote,
        endQuote: endRecovered
          ? transcriptQuote(b, endTokens.length)
          : d.endQuote,
      };
    const end = b + endTokens.length - 1;
    const sf = wordAt(a).startFrame,
      ef = wordAt(end)?.endFrame ?? wordAt(b).endFrame;
    if (Math.abs(sf / fps - d.approxStartSec) > 20)
      flags.push(
        `${l.lineId}: resolved ${(sf / fps).toFixed(0)}s vs ~${d.approxStartSec}s`
      );
    // span-overrun guards
    const spanWords = end - a + 1;
    const lineWords = norm(l.spokenLine ?? d.endQuote).length;
    if (spanWords > lineWords * 1.6 + 8)
      flags.push(
        `${l.lineId}: span overrun (${spanWords}w vs line ${lineWords}w)`
      );
    if ((ef - sf) / fps > 45)
      flags.push(
        `${l.lineId}: span ${((ef - sf) / fps).toFixed(0)}s — wrong occurrence?`
      );
    // internal cuts → sub-spans
    let subs = [{ s: a, e: end }];
    for (const c of d.internalCuts ?? []) {
      const cs = occ(c.startQuote).filter((i) => i >= a && i <= end);
      const ce = occ(c.endQuote).filter((i) => i >= a && i <= end);
      if (!cs.length || !ce.length) {
        flags.push(`${l.lineId}: internal cut no match`);
        continue;
      }
      const c0 = cs[0],
        c1 = ce[0] + norm(c.endQuote).length - 1;
      if (c1 < c0) {
        flags.push(`${l.lineId}: internal cut reversed`);
        continue;
      }
      let applied = false;
      subs = subs.flatMap((r) => {
        // Inclusive at the edges: an aborted restart at the very start or end
        // of the span trims it rather than being silently ignored.
        if (c0 < r.s || c1 > r.e) return [r];
        applied = true;
        return [
          { s: r.s, e: c0 - 1 },
          { s: c1 + 1, e: r.e },
        ].filter((x) => x.e >= x.s);
      });
      if (applied) splitLines.add(l.lineId);
      else flags.push(`${l.lineId}: internal cut outside span`);
    }
    for (const r of subs)
      spans.push({
        lineId: l.lineId,
        startFrame: wordAt(r.s).startFrame,
        endFrame: wordAt(r.e).endFrame,
        words: r.e - r.s + 1,
      });
  }
  // overlap/total guards
  spans.sort((x, y) => x.startFrame - y.startFrame);
  // Compare against the widest span seen so far, not just the neighbour: a
  // span nested inside an earlier, longer one clears its neighbour.
  let coveredTo = -1,
    coveredBy = "";
  for (const s of spans) {
    if (s.startFrame < coveredTo)
      globalFlags.push(`overlap: ${coveredBy}/${s.lineId}`);
    if (s.endFrame > coveredTo) {
      coveredTo = s.endFrame;
      coveredBy = s.lineId;
    }
  }
  const totalSec =
    spans.reduce((s, r) => s + (r.endFrame - r.startFrame), 0) / fps;
  // Budget the EDL against the script it claims to cut, not a fixed duration —
  // a long script legitimately makes a long edit; an EDL far wider than its
  // own words means some line landed on the wrong occurrence.
  const keptWords = spans.reduce((n, r) => n + r.words, 0);
  const scriptWords = (lines as any[]).reduce(
    (n, l) => n + norm(l.spokenLine ?? l.decision.endQuote).length,
    0
  );
  if (keptWords > scriptWords * 1.6 + 8)
    globalFlags.push(
      `total ${keptWords}w kept vs script ${scriptWords}w (${totalSec.toFixed(0)}s)`
    );
  // script order + merge adjacent (gap < 1.5s)
  const scriptOrder = [...spans].sort(
    (x, y) =>
      (orderOf[x.lineId] ?? 0) - (orderOf[y.lineId] ?? 0) ||
      x.startFrame - y.startFrame
  );
  const merged: any[] = [];
  for (const r of scriptOrder) {
    const p = merged[merged.length - 1];
    // Never re-weld the pieces an internalCut deliberately split apart —
    // their gap IS the excised restart.
    const rewelds =
      p &&
      splitLines.has(r.lineId) &&
      p.lineIds[p.lineIds.length - 1] === r.lineId;
    if (
      p &&
      !rewelds &&
      r.startFrame >= p.endFrame &&
      r.startFrame - p.endFrame < fps * 1.5
    ) {
      p.endFrame = r.endFrame;
      p.lineIds.push(r.lineId);
    } else merged.push({ ...r, lineIds: [r.lineId] });
  }
  const monotonic = merged.every(
    (r, i) => i === 0 || r.startFrame >= merged[i - 1].endFrame
  );
  // per-line audit table, one row per EXPECTED line — read THIS
  const perLine = expected.map((lineId) => {
    const l = byLine[lineId];
    const mine = spans.filter((s) => s.lineId === lineId);
    const flag = flags.find((f) => String(f).startsWith(`${lineId}:`));
    return {
      lineId,
      recoveredVia: recoveredVia[lineId] ?? null,
      status: flag
        ? "FLAGGED"
        : l.decision?.disposition === "omit_line"
          ? "omitted"
          : mine.length
            ? "resolved"
            : "dropped",
      startSec: mine.length ? +(mine[0].startFrame / fps).toFixed(1) : null,
      spanSec: +(
        mine.reduce((s, r) => s + r.endFrame - r.startFrame, 0) / fps
      ).toFixed(1),
      pieces: mine.length,
      flag: flag ?? null,
    };
  });
  const resolutionPlan = (lines as any[]).map((l: any) => {
    const anchors = recoveredAnchors[l.lineId] ?? l.decision;
    return {
      owner: { kind: "draft", draftId: ID },
      lineId: l.lineId,
      spokenLine: l.spokenLine,
      startQuote: anchors.startQuote,
      endQuote: anchors.endQuote,
      approxStartSec: l.decision.approxStartSec,
      approxEndSec: l.decision.approxEndSec,
      internalCuts: l.decision.internalCuts ?? [],
    };
  });
  return {
    resolutionPlan,
    edl: merged,
    flags: [...flags, ...globalFlags],
    lineFlags: flags,
    globalFlags,
    perLine,
    totalSec: +totalSec.toFixed(1),
    monotonic,
  };
  ```

  Treat the pipeline's numeric tolerances as legacy script-matching heuristics,
  not general edit policy. The executor owns build mode, source padding,
  pre-commit checks, seam review, and persistence.

## Trimming

- **Head/tail, plus same-phrase restarts** — a clip is one continuous take;
  do not skip words in the middle EXCEPT to excise an aborted same-phrase
  restart (below). Never drop content words mid-take.
- **Keep every reference word** — an extra boundary word is minor; losing a
  reference word is critical. Never trim the LAST kept word unless certain.
- **False starts** (`bec--`, `we ha--`) → trim them and the abandoned words
  before them; keep only the final complete attempt.
- **Same-phrase restart in the MIDDLE of a kept take** (abandoned words
  usually end in `--`) → cut from the first abandoned word through the `--`
  token, rejoin at the restart (`internalCuts` in the contract; the pipeline
  splits the span). Keep whole only when the aborted words are NOT a repeat
  of what follows.
- **STT errors** — phonetic/semantic match counts (`Seleks`→`Selects`).
- **Same-meaning improv** → keep the full utterance; no word-for-word forcing.
- **Boundary defaults (one-sentence decisions)**: short interjection inside
  the chosen take → keep; ≤ ~3s gap within the same continuous take → keep.
  Otherwise pick the simpler option and move on.

## Retakes on already-edited drafts (destruction guards)

- Only remove a retake when the SAME group has >1 current `placement`; remove
  only the unwanted `placement.spans`. The selection/alternative spans are
  evidence, not exact current placement footprints. To change a take, use
  generic `replace` with one exact Draft placement Span and the fully mapped
  source take `SourceSpan` or ordered `SourceSpan[]`. Pass those exact source
  spans unchanged; they already include take room.
- "Remove retakes" with no duplicates present = report, don't cut. A draft
  sitting on a non-selection take is usually deliberate.

## Run code, don't rehearse

Reads change nothing, and Draft edits stay in the working copy until `commitAll`
— write rough scripts and RUN them. Other calls that require
`allowCommit: true` (imports, analysis, folders, caption languages) take effect
at once; they are not rehearsal. Countable triggers, checked every response: wondering WHERE
something is → `occ()` probe now; every response ends in a tool call until the
EDL is ready; 2 probe→re-run rounds done → hand off the best clean EDL; the same
question examined twice without new tool output → act on the first answer.

## Selection success

1. No line loses its only take. 2. Lines with alternates select the intended
   take. 3. Only true duplicates are marked for removal. 4. Every kept line is
   grounded once in the EDL. 5. All omissions and assumptions reach the executor
   and final report.
