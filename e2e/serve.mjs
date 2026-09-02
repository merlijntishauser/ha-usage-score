/**
 * A static file server for the layout tests, rooted at the repo.
 *
 * The cards are ES modules, so they cannot be loaded over file:// - Chromium
 * refuses cross-origin module imports from it. Twenty lines here is cheaper
 * than a dependency whose only job is to serve four files.
 */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.PORT ?? 8123);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

const server = createServer(async (request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  // normalize collapses any ".." before it is joined to the root.
  const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));

  try {
    const info = await stat(file);
    if (!info.isFile()) {
      throw new Error("not a file");
    }
  } catch {
    response.writeHead(404).end("not found");
    return;
  }

  response.writeHead(200, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
  });
  createReadStream(file).pipe(response);
});

server.listen(PORT, () => {
  console.log(`serving ${ROOT} on http://localhost:${PORT}`);
});
