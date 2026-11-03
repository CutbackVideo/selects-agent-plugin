---
name: import-media
description: Import user-selected local video, audio or still images into the Selects web editor through a temporary local helper. Use when a user attaches a local file or supplies a local path and asks to import or edit it.
---

Use this plugin's existing Selects connection and the `selects-connect` skill.
This workflow requires a host that can run Node.js and read the user's selected
local file. A filename attached to a cloud-only chat is not a readable local path.
If the host cannot run the helper, use the editor's file picker; do not pretend
that a remote MCP server can read `/Users/...` on the user's computer.

## Import the original

1. Discover `import_local_media` and `read_local_media_import` in the connected
   editor's current tools. If absent, report that the editor must be updated;
   do not substitute another gateway or edit plugin configuration.
2. Open/reuse the editor with `open_selects`, wait for `ready`, and use
   `read_editor_state` and the SDK to choose or create the requested project.
   Record its `libraryId`, `projectId`, and the actual editor origin (scheme,
   hostname and port only). Do not derive the origin from the API server URL.
3. Run the bundled helper from this skill's `scripts` directory. Pass only files
   selected by the user, with each absolute path as a separate argument. Keep
   the process alive while the web editor imports; the default lifetime is
   30 minutes. Start it as a background shell process so it keeps running while
   you call the tools. Use this skill's base directory, which Claude Code shows
   when the skill loads (`${CLAUDE_PLUGIN_ROOT}` is the plugin root), with `node`
   from PATH (Node 18 or newer; do not install Node without asking). For example:

   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/skills/import-media/scripts/serve-local-media.mjs" \
     --origin https://app.tryselects.com -- /absolute/path/interview.mp4
   ```

   The helper prints a JSON manifest. It serves only those files on loopback,
   checks the editor origin, and streams the unchanged originals. Do not dump
   file contents into scripts, chat, base64 arguments or the MCP gateway.
   Keep capability URLs private; never put them in persistent reports.
4. Pass each unchanged `files[]` object to `import_local_media`:

   ```json
   {"context":{"controlSessionId":"…","executionId":"new UUID"},
    "input":{"libraryId":"…","projectId":"…","file":{"file_id":"…",
      "download_url":"helper-issued URL","file_name":"interview.mp4","sizeBytes":532170076}}}
   ```

   Follow the live schema if it differs. The browser may ask permission to access
   apps/services on this device. Explain that Selects needs access to this
   temporary local helper and let the user grant the browser permission.
5. Poll `read_local_media_import` with libraryId, projectId and fileId, each as a
   read operation, until `completed` or a terminal failure. Limit submissions to
   a few files at a time (two execute concurrently; eight total are admitted).
   The initial response is acceptance, not completion. Import copies original
   bytes to browser storage (OPFS): a 5 GB original needs about 5 GB of storage
   plus metadata/preview overhead. It does not upload the original to a separate
   cloud service. Later requested AI analysis may upload data through Selects.
6. After completion, keep the returned resourceId and stop your helper process.
   Read footage through the SDK, place it in a Draft if requested, commit, and
   inspect preview. Import alone neither places a clip nor starts paid analysis.
   Follow the editing/analysis skills for the remainder of the user's request.

## Recovery

After a command timeout, use `get_execution` before retrying. Never replay an
unknown mutation with a new executionId. A confirmed failed/interrupted import
can be retried with a new executionId and fresh helper URL, retaining the helper's
file_id/name/size for the unchanged original. Completed imports reuse the same
resource. Do not invent file IDs or reuse an ID after editing the original.

`local_media_download_unavailable`: check helper process/lifetime and browser
local-network permission. `local_media_storage_full`: explain required browser
disk space. `local_media_unreadable`: the existing media probe cannot decode this
original; report the format/codec. Do not silently transcode or replace it.
A failure after downloading may retain the complete original for a safe retry.
A partial transfer is discarded. Preview after completion no longer needs the
helper, but clearing this origin's browser data removes its imported copy.

## File formats

The Selects web import boundary accepts the same extensions as its file picker:

- Video/container: MP4, MOV, AVI, MKV, LRV, INSV, M4V, MXF, WebM.
- Audio: MP3, FLAC, WAV, M4A, OGG, AAC, AIF, AIFF.
- Web still-image import: static PNG, JPG/JPEG, WebP and BMP.
- The shared picker also lists HEIC/HEIF, APNG, AVIF, TIF/TIFF and SVG, but
  the current web probe rejects those image formats. Do not advertise them as
  supported web imports or attempt them without a later probe update.

These are candidate extensions, **not a promise that every codec/container is
playable**. The normal web probe checks actual content and browser decoding.
H.264/AAC MP4 is the baseline example; HEVC depends on the browser/OS decoder.
Animated image variants can be rejected. Do not rename unsupported media to MP4
or advertise desktop-only decoder support. This helper has no fixed 2 GB input
cap; browser quota, decoder support and later operation-specific limits still
apply. Long transfers must finish before the helper and download's 30-minute
lifetime, or be explicitly restarted.
