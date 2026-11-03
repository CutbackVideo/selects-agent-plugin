# Install the Selects plugin for Claude Code

This guide is written for the Claude Code agent that is installing the plugin.
Follow it as one continuous task: an installed but unauthenticated plugin is not
finished. Claude Code's CLI and the Claude desktop app's Code tab share
`~/.claude`, so one installation and one sign-in serve both.

## 1. Check Claude Code

```sh
claude --version
claude mcp login --help
```

Both must succeed. If `claude` is not on PATH, check `command -v claude` and
`~/.local/bin/claude` and call that executable directly. If `claude mcp login`
does not exist, run `claude update` with a generous timeout and check again.
Install Claude Code with Anthropic's official installer only when no CLI exists
at all (`curl -fsSL https://claude.ai/install.sh | bash`, or on Windows
PowerShell `irm https://claude.ai/install.ps1 | iex`).

## 2. Add the marketplace and install

Run these in order:

```sh
claude plugin marketplace add https://github.com/CutbackVideo/selects-agent-plugin.git#main
claude plugin install selects@selects
```

The repository is small, so the clone normally takes seconds. On a network error
retry with backoff, using the user's existing `HTTPS_PROXY` if they have one.
Do not run two marketplace additions at the same time.

## 3. Sign in to Selects

`claude mcp login` needs a terminal. Start it in the background inside a
pseudo-terminal, using the line for this computer:

```sh
# macOS
script -qF /tmp/selects-login.log claude mcp login plugin:selects:selects < /dev/null > /dev/null 2>&1 &

# Linux
script -qfc "claude mcp login plugin:selects:selects" /tmp/selects-login.log > /dev/null 2>&1 &
```

On Windows, start a throwaway console and capture its output:

```powershell
Start-Process cmd -ArgumentList '/c','claude mcp login plugin:selects:selects > %TEMP%\selects-login.log 2>&1'
```

Poll the log right away. Claude Code opens the Selects sign-in page in the
browser; if the browser does not open, give the user the authorization URL from
the log. The user signs in with their normal Selects account and approves
**Connect Selects**. Wait while they do this; it is part of the installation.

The only reliable success signal is the log line
`Authenticated with "plugin:selects:selects"`.

## 4. Verify

```sh
claude plugin list
claude mcp get plugin:selects:selects
```

`selects@selects` must be listed as enabled, and the server must no longer say
it needs authentication.

## 5. Hand over to the user

Tell the user what the plugin does: it opens their projects in the Selects
browser editor and edits Drafts from transcripts — cutting stories, tightening
pacing and pauses, adding captions and previewing the result. Plugin tools load
only when a session starts, so ask them to start a **new session** and make a
natural request that names Selects, such as "Use Selects to cut my interview
into a 3-minute draft". Do not call Selects tools in the installation session.

## Troubleshooting

**Login prints `Authentication timeout`.** Run
`claude mcp logout plugin:selects:selects`, start one fresh login as in step 3
and show the new authorization URL. Never run two logins at once.

**Login fails with HTTP 5xx.** A temporary service failure, not wrong
credentials. Wait for the current login process to exit and retry with backoff.
You can check that the gateway is reachable with
`curl -fsS https://selects-api.cutback.video/.well-known/oauth-protected-resource/mcp-gateway/mcp`;
that only proves reachability.

**The callback port is in use.** Sign-in returns to
`http://localhost:17528/callback`. If login reports that the port is busy,
identify the process holding port 17528 and ask the user before stopping it.

**The sign-in page reports `redirect_uri` mismatch or an unknown client.**
Report the exact message to the user and to Selects support. Do not edit the
plugin's OAuth settings or register a different server by hand.

**`Connected` but tools fail or time out.** Usually a slow backend. Retry
read-only discovery with backoff; do not log in again or reinstall. Treat it as
an authentication problem only if Selects tools repeatedly report missing
authentication.

**HTTP 403 from a Selects tool.** The account or connection lacks access. Stop
retrying and report the error with its approximate time.

## Updating

```sh
claude plugin marketplace update selects
claude plugin update selects@selects
```

Updated skills and tools load in a new session.
