import { readFile, writeFile, rename, rm, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "content/_Build/Theme.md");
const output = resolve(root, "quartz/generated-theme-settings.json");

const markdown = (await readFile(source, "utf8")).replace(/\r\n/g, "\n");
const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---\n/);
if (!frontmatter) throw new Error(`${source}: missing YAML frontmatter.`);
for (const [key, expected] of Object.entries({
  publish: "true",
  unlisted: "true",
  quartz_asset: "theme",
})) {
  const match = frontmatter[1].match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"));
  if (!match || match[1].trim().replace(/^["']|["']$/g, "") !== expected) {
    throw new Error(`${source}: expected ${key}: ${expected}.`);
  }
}

const fences = [...markdown.matchAll(/^(`{3,}|~{3,})json[ \t]*\n([\s\S]*?)^\1[ \t]*$/gm)];
if (fences.length !== 1) {
  throw new Error(`${source}: expected exactly one fenced JSON block, found ${fences.length}.`);
}

const settings = JSON.parse(fences[0][2]);
if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
  throw new Error(`${source}: the JSON block must be a settings object.`);
}
const entries = Object.entries(settings);
if (!entries.length) throw new Error(`${source}: empty Style Settings export.`);
for (const [key, value] of entries) {
  if (!key.startsWith("ITS@@") || key.length <= 5) {
    throw new Error(`${source}: unexpected ITS setting key ${JSON.stringify(key)}.`);
  }
  if (!(typeof value === "string" || typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value)))) {
    throw new Error(`${source}: invalid value for ${key}.`);
  }
}
const json = JSON.stringify(Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n";
await mkdir(dirname(output), { recursive: true });
const temporary = `${output}.${process.pid}.tmp`;
try {
  await writeFile(temporary, json, "utf8");
  await rename(temporary, output);
} finally {
  await rm(temporary, { force: true });
}
console.log(`Verified ${entries.length} ITS settings from ${source}; wrote ${output}.`);
