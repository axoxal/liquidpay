// Generates out/sw.js with a precache list of every file in the static export.
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("out");
const SKIP = new Set(["sw.js"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])),
  );
  return files.flat();
}

const files = (await walk(OUT)).filter((f) => !SKIP.has(path.basename(f)) && !f.endsWith(".map"));
const hash = createHash("sha256");
const urls = new Set();

for (const f of files.sort()) {
  const rel = "/" + path.relative(OUT, f).split(path.sep).join("/");
  hash.update(rel).update(String((await stat(f)).size));
  if (rel.endsWith(".html")) {
    if (rel === "/404.html" || rel === "/_not-found.html") continue;
    urls.add(rel === "/index.html" ? "/" : rel.slice(0, -".html".length));
  } else {
    urls.add(rel);
  }
}

const version = hash.digest("hex").slice(0, 12);
const template = await readFile(path.resolve("scripts/sw-template.js"), "utf8");
const sw = template.replace("__VERSION__", version).replace("__PRECACHE__", JSON.stringify([...urls].sort(), null, 0));
await writeFile(path.join(OUT, "sw.js"), sw);
console.log(`sw.js: ${urls.size} URLs precached, version ${version}`);
