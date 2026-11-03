---
name: prepare-editing
description: "Prepare footage for editing in the Selects web editor: inspect source and transcript readiness, handle supported sync or analysis, and continue the requested edit. Not upload-only or a repeated gate before small edits."
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

# Prepare the requested edit

Check readiness when editing starts or sources change. Uploading alone is not
an editing request. Do not repeat preparation before each small adjustment.
Keep the outcome, source scope/order, target Draft and prior decisions intact.

## Inspect, then decide

Read `sdk/project.d.ts` and the relevant `sdk/source.d.ts` or
`sdk/synced-timelines.d.ts`. Inspect Project meta, resources and workflows;
use sourceFiles for names and media metadata. Return a bounded inventory:

```ts
const project = selects.project(projectId);
return {
  resources: (await project.resources()).map(r => ({
    resourceId: r.resourceId, name: r.name, type: r.type,
    durationSeconds: r.durationSeconds,
    hasAnalysis: r.hasAnalysis, hasTranscription: r.hasTranscription,
  })),
  workflows: await project.workflows(),
};
```

An empty Project needs real media before a footage-based edit. Explain that
the user can add it in this web editor or name another intended Project.
Do not create fake transcript/analysis rows, pretend generated graphics are the
requested source, or claim the edit succeeded. A host attachment is not yet a
Selects Resource: verify import through the web-supported path first.

Separate these facts:

- `hasTranscription` permits transcript-dependent work through the documented
  transcript paths even while full analysis continues.
- `hasAnalysis` is evidence availability, not universal editing readiness.
  A merged timeline can have partial member coverage. Verify the intended range.
- Whole-source assembly and explicit source-time windows can use supported
  `insertResource` placement without semantic analysis. Do not bypass guards on
  analysis-dependent SourceSpan reads.
- Successful sync is not proof of perceptual alignment. Honor content locks,
  `canEditContent` and `editBlockedReason`; never rebuild to evade them.

## Source preparation

Reuse suitable existing Synced Timelines. For recordings that belong together,
the requested edit can include useful grouping while leaving originals intact;
explain the grouping. Do not group unrelated footage, duplicate existing work,
restart an active sync, or override a prior refusal. A single suitable source
needs no new synced timeline. An explicit analysis request does not wait for a
sync proposal; a sync-only request does not imply analysis or editing.

When sync is necessary, read the connected editor's source-sync resource and
current SDK contract first. Apply only its supported SDK operations, not its
internal chat/scheduler/shell instructions. Keep exact workflow IDs, inspect
saved layouts after completion, and report unsynced or partially failed parts.
Do not describe dispatch as completion. If that SDK operation is unavailable,
continue independent supported work and explain the missing step.

## Analysis and long-running work

For missing evidence, explain which sources need analysis and why. Follow the
connected `estimateAnalysis` / `startAnalysis` contract and the user's explicit
analysis choices; an editing request is not blanket consent to spend credits.
Retain Selects' in-app credit confirmation. Respect a scoped refusal without
re-offering it for every edit. Quotes are not balance checks, approval or an ETA.

Use the quote's eligible IDs and skipped reasons. Do not analyze a Synced
Timeline Sequence Resource or silently expand the requested scope. Start at
most one analysis batch per script, separately from sync writes. Save each
returned resource/workflow pair and report started and skipped results.
Canceled or expired confirmation is not permission to reopen it automatically.

Wait only for evidence needed by the next step: transcription for spoken cuts,
full analysis for methods that require it. Re-read resources/workflows in later
bounded calls. Keep the pending edit and IDs in conversation; reconcile partial
results, failure and cancellation before continuing. Do not resubmit a job to
recover its result. Cancellation acknowledgement is not confirmed termination.
When automatic continuation is unavailable, state what is still pending rather
than promising a callback from the internal agent (which is paused in MCP mode).

After a refusal, continue supported explicit-time placement or manual work when
it fits the request. Never fabricate speech, source handles or analysis state;
never switch to native/local transcription or another paid provider as a fallback.

## Continue the same request

Once evidence is ready, use the packaged `transcript-guided-editing` for Draft
assembly/content selection, or `speech-flow-editor` for pacing-only requests.
Preparation is not the final result when the user asked for an edit. Preserve
their source scope and do not introduce an extra plan-approval checkpoint.
Read back the saved target, open it through the editor SDK and inspect its
preview using capabilities the web editor actually exposes.
