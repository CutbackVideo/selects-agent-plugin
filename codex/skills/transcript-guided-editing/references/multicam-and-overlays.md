# Multicam and overlay settings

Read only the sections whose settings are in scope. Settle editorial choices
with the user rather than silently choosing them.

## Multicam

Only offer switching when `camera_count > 1`. A synced timeline is multicam;
its member status is not a camera-readiness signal.

When a broader edit brief has not settled camera switching, include it and
say so in the report; the user can turn it off. Do not decide how to switch
cameras here.

After the content cut and any speech-flow pass, load `multicam-cutting` and
follow it against the committed Draft. That Skill owns camera inspection, the
switching-policy interview, scoped or whole-Draft writes, and verification. If
the user directly requested camera switching on an existing Draft, the request
already establishes inclusion; route straight to `multicam-cutting`.

## B-roll, cutaways, and overlays

Use these only when requested. Read `overlayResource` and its referenced types from the connected
web editor through `read_agent_resource`. If the required document is unavailable,
stop that operation and report it; do not guess the API. If the method itself is absent, say the app needs an update
and stop.

Choose existing media from `project.resources()`, then open the owner-checked
handle with `project.resource(resourceId)`. Apply it to the Draft working copy
with `draft.overlayResource({ resource, over })`; it persists only through
`commitAll`.

Importing a local Video or Audio file with `project.importFiles({ paths })` is
an immediate project write and requires `allowCommit: true`, so run that
import in its own call, separately from the later Draft commit. Re-read
`project.resources()` before opening the imported Resource handle.
