#!/usr/bin/env node
import { createServer } from "node:http";
import { open } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { pathToFileURL } from "node:url";

/** Read-only, temporary access to explicitly selected files; no directory serving. */
export async function serveLocalMedia({ paths, origin, ttlSeconds = 1800 }) {
  const editor = new URL(origin);
  if (
    editor.origin !== origin ||
    editor.username ||
    editor.password ||
    !(
      editor.protocol === "https:" ||
      (editor.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(editor.hostname))
    )
  )
    throw new Error(
      "Use the exact HTTPS editor origin, or a loopback development origin."
    );
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 7200)
    throw new Error("TTL must be 1–7200 seconds.");
  if (!paths.length) throw new Error("Specify at least one media file.");

  const files = new Map();
  try {
    for (const input of paths) {
      const path = resolve(input);
      const handle = await open(path, "r");
      try {
        const stat = await handle.stat();
        const name = basename(path);
        if (
          !stat.isFile() ||
          !Number.isSafeInteger(stat.size) ||
          stat.size <= 0
        )
          throw new Error("Every input must be a nonempty regular file.");
        if (name.length > 255 || /[\\/\x00-\x1f\x7f]/.test(name))
          throw new Error("File name is not supported.");
        // Same original keeps its identity across helper restarts. Changed bytes
        // (size/mtime) get a new identity, rather than reusing a completed import.
        const id = createHash("sha256")
          .update(
            JSON.stringify([
              path,
              stat.dev,
              stat.ino,
              stat.size,
              stat.mtimeMs,
              stat.ctimeMs,
            ])
          )
          .digest("hex");
        if (files.has(id)) {
          await handle.close();
          continue;
        }
        files.set(id, { handle, stat, name });
      } catch (error) {
        await handle.close();
        throw error;
      }
    }
  } catch (error) {
    await Promise.all([...files.values()].map(({ handle }) => handle.close()));
    throw error;
  }

  const token = randomBytes(24).toString("base64url");
  const route = `/selects-local-media/${token}/`;
  let port;
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    // Checking Host also rejects DNS-rebinding requests to this loopback port.
    if (
      request.headers.host !== `127.0.0.1:${port}` ||
      request.headers.origin !== origin
    ) {
      response.writeHead(403).end();
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    if (!request.url?.startsWith(route)) {
      response.writeHead(404).end();
      return;
    }
    const entry = files.get(request.url.slice(route.length));
    if (!entry) {
      response.writeHead(404).end();
      return;
    }
    if (request.method === "OPTIONS") {
      response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      response.setHeader("Access-Control-Allow-Private-Network", "true");
      response.writeHead(204).end();
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405).end();
      return;
    }
    try {
      const current = await entry.handle.stat();
      if (
        current.size !== entry.stat.size ||
        current.mtimeMs !== entry.stat.mtimeMs ||
        current.ctimeMs !== entry.stat.ctimeMs
      ) {
        response.writeHead(409).end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": current.size,
      });
      // Read by position so concurrent requests do not share a file offset.
      // Withhold the last chunk until re-stat confirms an unchanged original.
      async function* unchangedOriginal() {
        let offset = 0;
        while (offset < entry.stat.size) {
          const buffer = Buffer.allocUnsafe(
            Math.min(1024 * 1024, entry.stat.size - offset)
          );
          const { bytesRead } = await entry.handle.read(
            buffer,
            0,
            buffer.length,
            offset
          );
          if (!bytesRead) throw new Error("Selected media was truncated");
          offset += bytesRead;
          if (offset === entry.stat.size) {
            const final = await entry.handle.stat();
            if (
              final.size !== entry.stat.size ||
              final.mtimeMs !== entry.stat.mtimeMs ||
              final.ctimeMs !== entry.stat.ctimeMs
            )
              throw new Error("Selected media changed during transfer");
          }
          yield buffer.subarray(0, bytesRead);
        }
      }
      await pipeline(unchangedOriginal(), response);
    } catch {
      response.destroy();
    }
  });
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
  } catch (error) {
    await Promise.all([...files.values()].map(({ handle }) => handle.close()));
    throw error;
  }
  port = server.address().port;
  let closed;
  const close = () =>
    (closed ??= (async () => {
      clearTimeout(timer);
      const stopped = new Promise((resolve) => server.close(resolve));
      server.closeAllConnections();
      await stopped;
      await Promise.all(
        [...files.values()].map(({ handle }) => handle.close())
      );
    })());
  const timer = setTimeout(close, ttlSeconds * 1000);
  timer.unref();
  return {
    close,
    manifest: {
      origin,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      files: [...files].map(([id, entry]) => ({
        file_id: id,
        download_url: `http://127.0.0.1:${port}${route}${id}`,
        file_name: entry.name,
        sizeBytes: entry.stat.size,
      })),
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  let origin;
  let ttlSeconds = 1800;
  const paths = [];
  while (args.length) {
    const argument = args.shift();
    if (argument === "--origin") origin = args.shift();
    else if (argument === "--ttl") ttlSeconds = Number(args.shift());
    else if (argument === "--") {
      paths.push(...args);
      break;
    } else if (argument.startsWith("--"))
      throw new Error(`Unknown option: ${argument}`);
    else paths.push(argument);
  }
  if (!origin)
    throw new Error(
      "Usage: node serve-local-media.mjs --origin https://app.tryselects.com -- /absolute/media.mp4"
    );
  const helper = await serveLocalMedia({ paths, origin, ttlSeconds });
  process.once("SIGINT", () => void helper.close());
  process.once("SIGTERM", () => void helper.close());
  // Capability URLs are short-lived. Do not write this output into persistent logs.
  console.log(JSON.stringify(helper.manifest));
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
