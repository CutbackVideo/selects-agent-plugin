# Check Caption Spelling

Find and fix spelling mistakes in one Draft's captions, as the Captions panel
shows them. Fixes are applied directly to the caption words and are undoable;
the transcript is not changed.

These are the Draft's caption document lines (`captionDocumentLines()`), not
the transcript's caption rows (`captions()`).

## Resolve the request

Use the Draft the user mentioned (`@Name [draft:<id>]`). If no Draft is named
and more than one could be meant, ask which one and stop.

Read the deployed `sdk/caption-documents.d.ts` through `read_agent_resource` before using these methods. The parent edit-captions skill owns the connection, target selection and user-assisted Add captions / Apply steps.

## Workflow

1. **Read.** In a read-only `run_script`, call
   `draft.captionDocumentLines({ limit: 500 })` and follow `nextOffset` until
   every page is read. If `hasCaptions` is false, return to the parent skill's Add captions step; do not invent lines or invoke desktop-only tools.

2. **Find mistakes.** Read each line in context and look for misspelled words:
   typos, wrong homophones, and misspelled names that are spelled correctly
   elsewhere in the captions. Use each word's `spelling` (no punctuation).
   - Fix spelling only. Do not change wording, grammar, style, slang, letter
     case or punctuation, and do not "correct" speech that is intentionally
     informal.
   - A fix must stay one word. When the right fix would join or split words
     (for example "alot" → "a lot"), do not write it; list it for the user.
   - When unsure whether something is a mistake, leave it and list it.
3. **Write.** In a `run_script` with `allowCommit: true`, re-read the lines and
   call `draft.correctCaptionDocumentSpelling({ corrections })` with
   `{ line, word, corrected }`, passing `line` and `word` objects from that
   script's own read. At most 500 per call.
   - If a write fails because a word changed, re-read and redo only the fixes
     whose `spelling` still matches.
4. **Report.** List each fix as `before → after` with a little of the line for
   context, then any mistakes you left for the user. If nothing needed fixing,
   say so. Mention the fixes can be undone. Caption clips already on
   the timeline keep their old lines until Apply is pressed in the Captions panel; say so. Do not press
   Apply unless the user asked for the timeline to change: on a Draft with no
   applied captions it places new clips.
