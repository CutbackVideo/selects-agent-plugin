---
name: edit-captions
description: "Add and refine on-screen captions for a completed Selects web Draft, including natural line breaks and spelling fixes. Uses the Captions panel with user-assisted generation and application; does not change the source transcript."
---

# Edit captions in the Selects web editor

Use the packaged selects-connect skill and this plugin's existing production
connection. Read current editor state and resolve the requested Project and
Draft. Keep the same session; do not switch to Electron or a test connection.

Read current SDK declarations through read_agent_resource: list document keys,
then read sdk/caption-documents.d.ts and the relevant editor/Draft declarations.
Do not assume the deployed editor has every method in a newer skill. If a
required method is absent, report it without attempting an undocumented call.
Use the session/execution IDs and uncertain-write recovery in selects-connect.

These are the styled Captions-panel document lines, not draft.captions()
transcript rows. A document write saves immediately with allowCommit:true;
it is not a staged Draft edit. Applied timeline clips are a separate result.

## Prepare or reuse captions

Finish and save the requested video edit before generating captions. Inspect
whether the retained speaking resources on Main have transcription. Do not
start paid analysis merely to satisfy this skill; use prepare-editing when
analysis is actually needed and authorized. A silent imported picture clip
needs no invented speech or captions.

Read draft.captionDocumentLines(). Reuse an existing document for a correction
request; do not regenerate it and erase the user's caption edits. If the Draft
was edited after its captions were generated, inspect the document against the
current edit and explain any regeneration needed before claiming it is current.

When the user asks to add captions and no document exists, open the saved Draft
and the Captions app using the documented editor methods:

```ts
await selects.editor.openDraft(draftId);
await selects.editor.openApp({ projectId, appId: "builtin:captions" });
```

The current web SDK does not expose caption creation, style selection or Apply.
Tell the user to press **Add captions** and wait for generation to finish. If
the panel is not visible, guide them through **Apps → Captions**. Wait for their
response using the host's question mechanism or conversation, then read the
document again. If it is still absent, explain that generation has not completed;
do not repeatedly trigger it or claim success. The user may skip captions.
Do not invoke internal ask_options, app_repl, filesystem or DOM backdoors.

## Refine only what was requested

- For natural phrase boundaries or a requested line length, read
  [references/break-caption-lines.md](references/break-caption-lines.md).
- For spelling corrections, read
  [references/check-caption-spelling.md](references/check-caption-spelling.md).

Preserve wording, timing, speaker ownership and visibility except for explicitly
requested spelling fixes. Never manufacture mistakes to demonstrate a change.
Use fresh line/word identities within each writing call; re-read and recompute
after a conflicting manual change. After an unknown execution outcome, inspect
the execution receipt and current document before retrying a mutation.

## Apply and verify

For a request to put captions on the video, tell the user to choose the desired
available style in the panel and press **Apply**. If a replacement confirmation
appears, explain that existing applied caption clips will be replaced and let
the user confirm it. For a document-only correction, report that timeline
captions retain the old content until Apply; do not expand the request.

After application, read the document and inspect the current timeline using
documented SDK methods. Observe the web preview at a speaking segment and across
a caption boundary to verify the text actually appears and advances. Document
rows alone do not prove applied captions or playback. If visual observation is
unavailable, state what was saved and what remains unverified. Report any
clipping, unreadable text or timing mismatch instead of claiming completion.
