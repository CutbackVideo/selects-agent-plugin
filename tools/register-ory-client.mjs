#!/usr/bin/env node
// Register the Claude Code plugin's OAuth client in the gateway's Ory project.
//
// The gateway's Ory project has no dynamic client registration, so Claude Code
// needs a pre-registered public (PKCE, no secret) client. The fields mirror the
// production Codex client (selects-production-desktop-20261101) except for the
// redirect URIs, which follow Claude Code's callback format. Like that client,
// the token format and lifespans are inherited from the project's global JWT
// configuration rather than set per client.
//
// The production client was created in Ory Console on 2026-11-03, which assigns
// its own client ID; plugin.json carries that ID. Use this script to check the
// registered client or to create the same client in another Ory project.
//
// Usage:
//   node tools/register-ory-client.mjs            # dry run: print the definition
//   ORY_API_KEY=... node tools/register-ory-client.mjs --apply
//
// Existing clients are never modified: a matching client is reported as done,
// a differing one stops the script for manual inspection.

import { readFileSync } from "node:fs";

const ORY_ISSUER =
  process.env.ORY_ISSUER ?? "https://silly-lumiere-7p4j599sww.projects.oryapis.com";

// Read client ID, callback port and MCP URL from the plugin manifest so the
// registration can never drift from what the plugin actually sends.
const manifestUrl = new URL("../claude/.claude-plugin/plugin.json", import.meta.url);
const server = JSON.parse(readFileSync(manifestUrl, "utf8")).mcpServers.selects;
const { clientId, callbackPort } = server.oauth;

const clientDefinition = {
  client_id: clientId,
  client_name: "Selects for Claude Code",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  scope: "selects:control offline_access openid",
  // The gateway's consent step requires its /mcp URL as the token audience.
  audience: [server.url],
  // Claude Code uses localhost; v2.1.229 briefly sent 127.0.0.1 instead.
  redirect_uris: [
    `http://localhost:${callbackPort}/callback`,
    `http://127.0.0.1:${callbackPort}/callback`,
  ],
  token_endpoint_auth_method: "none",
};

function differingFields(existing) {
  return Object.keys(clientDefinition).filter(
    (key) => JSON.stringify(existing[key]) !== JSON.stringify(clientDefinition[key]),
  );
}

async function main() {
  console.log(`Ory issuer: ${ORY_ISSUER}`);
  console.log(JSON.stringify(clientDefinition, null, 2));

  if (!process.argv.includes("--apply")) {
    console.log("\nDry run. Re-run with --apply and ORY_API_KEY to register.");
    return;
  }
  const apiKey = process.env.ORY_API_KEY;
  if (!apiKey) throw new Error("ORY_API_KEY is required with --apply");
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

  // Step 1: look for an existing client with this ID.
  const lookup = await fetch(`${ORY_ISSUER}/admin/clients/${encodeURIComponent(clientId)}`, {
    headers,
  });
  if (lookup.status === 200) {
    const changed = differingFields(await lookup.json());
    if (changed.length > 0) {
      throw new Error(`Existing client differs in: ${changed.join(", ")}. Inspect it first.`);
    }
    console.log("\nClient already registered with matching settings.");
    return;
  }
  if (lookup.status !== 404) throw new Error(`Client lookup failed (HTTP ${lookup.status})`);

  // Step 2: create it. Other clients in the project are untouched.
  const created = await fetch(`${ORY_ISSUER}/admin/clients`, {
    method: "POST",
    headers,
    body: JSON.stringify(clientDefinition),
  });
  if (created.status !== 200 && created.status !== 201) {
    throw new Error(`Client registration failed (HTTP ${created.status})`);
  }
  console.log("\nClient registered.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
