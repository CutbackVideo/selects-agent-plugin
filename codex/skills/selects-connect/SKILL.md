---
name: selects-connect
description: Connect to Selects through its remote MCP gateway, open the editor in the desktop app, and execute SDK editing scripts in the selected browser session.
---

Use this installed plugin's bundled `selects-gateway` MCP server at
https://selects-api.cutback.video/mcp-gateway/mcp. Authentication and
editor opening must use this connection. The local Electron Selects server,
other development connections, and a separately registered test server do not
verify this plugin.

1. Discover this plugin's available MCP tools and connection status. If the host
   reports that authentication is required, start the connection flow offered for
   this installed plugin and let the user sign in and authorize Selects. After
   authentication, resume with `open_selects` without requiring a second request.
   If no tool or authentication action is exposed, report that registration or
   connection setup is incomplete. Inspect this plugin's Manage screen; do not
   assume its server appears in the standalone MCP settings list. Do not create
   a duplicate connection, reset credentials, or substitute a command-local MCP
   configuration. Never copy credentials into chat or alter their storage policy.
2. Call `open_selects` once. Open its exact `browserHandoff.url` visibly in the
   desktop app internal browser. Reuse that tab; do not create additional sessions
   to retry a pending operation. Open immediately: the URL fragment carries a
   single-use login code valid for 60 seconds. Do not print the URL in chat or logs.
   If the editor reports an expired link, obtain a fresh open_selects handoff.
   When authentication finishes and tool access resumes, continue this step
   without asking the user to say "open the editor" again. The OAuth callback
   alone is not an editor session. The host controls whether a paused task resumes
   automatically; do not promise that a skill can force it. If the opener reports
   a queued tab, wait for that tab rather than issuing a second open for the same
   single-use URL.
3. The editor exchanges the launch code for Firebase sign-in when needed, or
   verifies its existing account without switching it. The handoff tab connects
   automatically after same-account verification; no project approval is needed.
   Keep the same session when switching projects or Drafts. Manual editing and
   preview stay available; only the internal agent pauses while connected.
4. Read `get_control_session`. Wait for `ready` before calling editor tools.
5. Read the SDK resources exposed by the connected editor before writing scripts.
   Use the exact current tool schema. Each logical operation has one fresh UUID
   executionId and the returned controlSessionId in context. To retry that same
   operation, retain its executionId; never replay an unknown outcome with a new ID.
6. Use `get_execution` after a timeout. If the result is unknown, stop mutations
   and explain recovery; do not assume the script failed without effects.
7. Verify both tool results and editor-visible state before claiming success.

The editor owns editing logic, tools, SDK, media and browser storage. The gateway
owns authentication, session routing and execution receipts. Desktop-only native
functions may be unavailable in the browser: inspect supported tools and report
unsupported requests rather than inventing a fallback.

Do not use a ChatGPT-web iframe widget for this desktop workflow. Do not put OAuth
or Firebase tokens, binding tickets, or local file contents into URLs or chat.

This package targets only https://selects-api.cutback.video/mcp-gateway/mcp. Do not use local Electron Selects-Staging or development tunnel connections for this workflow.
