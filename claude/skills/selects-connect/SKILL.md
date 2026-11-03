---
name: selects-connect
description: Connect Claude Code to Selects through the plugin's remote MCP gateway, open the Selects browser editor, and execute SDK editing scripts in that browser session. Use before the first Selects tool call, and whenever Selects tools are missing, unauthenticated or disconnected.
---

This is the Claude Code edition. It uses this plugin's bundled MCP server
`plugin:selects:selects` at https://selects-api.cutback.video/mcp-gateway/mcp.
Its tools appear as `mcp__plugin_selects_selects__<tool>` (for example
`open_selects`). Authentication and editor opening must use this connection.
The local Electron Selects MCP server, development tunnels and separately
registered test servers do not verify this plugin.

## 1. Check the connection

If Selects tools such as `open_selects` are in your tool list, continue with
step 2. Otherwise check the server state:

```sh
claude mcp get plugin:selects:selects
```

- **Needs authentication**: ask the user to type `/mcp`, select
  `plugin:selects:selects` and choose **Authenticate**. Signing in inside this
  session reconnects the server here. Alternatively start the CLI login in a
  pseudo-terminal and open the authorization URL it writes to the log for the
  user (macOS shown; Linux uses `script -qfc "<command>" <log>`):

  ```sh
  script -qF /tmp/selects-login.log claude mcp login plugin:selects:selects < /dev/null > /dev/null 2>&1 &
  ```

  The success signal is `Authenticated with "plugin:selects:selects"` in that log.
  A login from a separate process does not reload this session's tools; tell the
  user to start a **new session** afterward.
- **No such server**: the plugin is not installed or enabled. Run
  `claude plugin list`; if `selects@selects` is missing, follow the install guide
  in this plugin's repository instead of registering a duplicate server by hand.
- **Connected but tools fetch failed / timed out**: usually a slow or offline
  gateway. Retry discovery with backoff; do not log in again or reinstall.

Sign-in happens on the Selects login page in the browser. Never ask for, print or
copy passwords, OAuth tokens or credential files, and never change how Claude Code
stores credentials.

## 2. Open the editor

Call `open_selects` once and open its exact `browserHandoff.url` immediately.
The URL fragment carries a single-use login code valid for 60 seconds, so do
not repeat the URL in chat, notes or reports.

- **Claude desktop app** with the built-in browser tools: open it in the
  Browser pane (`navigate` or `preview_start` with the URL) so the user can watch.
- **Terminal CLI**: open it in the user's default browser (`open "<url>"` on
  macOS, `xdg-open` on Linux, `start "" "<url>"` on Windows).

Reuse that tab for the whole task; do not create extra sessions to retry an
operation. If opening was delayed (for example the user first had to allow the
site) and the editor reports an expired link, request a fresh handoff. When the
live `open_selects` schema accepts `controlSessionId`, renew the same session and
navigate the existing tab to the new URL; if the result says
`browserHandoff.required: false`, the tab is already bound, so keep using it.
Otherwise call `open_selects` again. Never reuse an expired URL.

The editor exchanges the launch code for its own Firebase sign-in when needed,
or verifies its existing account without switching it. The Browser pane and the
user's own browser keep separate logins; the handoff covers both. No project
approval is needed, and the same session stays valid while switching projects
or Drafts. Manual editing and preview stay available; only the editor's internal
agent pauses while connected.

## 3. Wait until ready

Read `get_control_session` and wait for `ready` before calling editor tools.
Then call `read_editor_state` once to confirm the tab executes commands. Do not
tell the user the editor is connected on the strength of an opened tab alone.

## 4. Edit through the SDK

1. Read the SDK resources exposed by the connected editor
   (`read_agent_resource`) before writing scripts, and use the exact current tool
   schemas.
2. Give each logical operation one fresh UUID `executionId`, together with the
   returned `controlSessionId`, in its context. To retry that same operation,
   keep its `executionId`; never replay an unknown outcome with a new ID.
3. After a timeout call `get_execution`. If the result is unknown, stop mutating
   and explain the recovery; do not assume the script failed without effects.
4. Verify both the tool result and the editor-visible state before claiming
   success.

The editor owns editing logic, tools, SDK, media and browser storage. The gateway
owns authentication, session routing and execution receipts. Desktop-only native
Selects features may be unavailable in the browser: inspect the supported tools
and report unsupported requests rather than inventing a fallback.

Do not put OAuth or Firebase tokens, binding tickets or local file contents into
URLs or chat. This package targets only
https://selects-api.cutback.video/mcp-gateway/mcp.
