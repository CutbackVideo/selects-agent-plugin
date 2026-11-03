# Selects agent plugins

Plugins that let AI coding agents edit videos in the
[Selects](https://www.tryselects.com) browser editor.

## Install in Claude Code

Paste this into Claude Code (terminal or the Claude desktop app's Code tab):

```text
/goal Read https://raw.githubusercontent.com/CutbackVideo/selects-agent-plugin/main/INSTALL-CLAUDE.md to install and use the Selects plugin
```

Claude installs the plugin, opens the Selects sign-in page and tells you when to
start a new session. To do it by hand, follow [INSTALL-CLAUDE.md](INSTALL-CLAUDE.md).

## Install in Codex / ChatGPT

The Codex plugin is published through the OpenAI plugin directory as **Selects**.
`codex/` mirrors that published package, and `.agents/plugins/marketplace.json`
exposes it as a Git marketplace. Install only one of the two copies.

## How it works

```text
Claude Code ──MCP over HTTPS + OAuth──▶ Selects MCP gateway ──WebSocket──▶ Selects editor tab
                                       (selects-api.cutback.video)        (app.tryselects.com)
```

The plugin declares the remote MCP server and bundles editing skills. After
OAuth sign-in, the `open_selects` tool returns a one-time link that opens the
Selects editor in a browser tab. That tab then runs the agent's SDK scripts, so
projects and media stay in the user's browser storage.

## Repository layout

| Path | Contents |
|---|---|
| `.claude-plugin/marketplace.json` | Claude Code marketplace `selects` |
| `claude/` | Claude Code plugin `selects` (MCP server + skills) |
| `.agents/plugins/marketplace.json` | Codex marketplace |
| `codex/` | Codex plugin `selects-editor`, mirror of the published package |
| `INSTALL-CLAUDE.md` | Install guide written for the installing agent |
| `tools/register-ory-client.mjs` | One-time OAuth client registration (maintainers) |

The skills in `claude/skills` and `codex/skills` are the same except for host
mechanics: `selects-connect` (sign-in and opening the editor) and the helper
path in `import-media`. Change editing guidance in both trees together.

## Maintainers: OAuth client

The gateway's Ory project does not allow dynamic client registration, so the
Claude Code plugin uses a pre-registered public PKCE client. Claude Code signs
in through `http://localhost:<callbackPort>/callback`; the client ID and port
in `claude/.claude-plugin/plugin.json` must match the registration.

```sh
# Prints the client definition without changing anything
node tools/register-ory-client.mjs

# Registers it (requires an Ory project API key)
ORY_API_KEY=... node tools/register-ory-client.mjs --apply
```

The script refuses to modify an existing client whose settings differ.
