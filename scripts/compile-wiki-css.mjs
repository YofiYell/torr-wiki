import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve paths from the repository root.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "content/_Build/Styles.md");
const output = resolve(root, "quartz/styles/generated-custom-styles.css");

let stylesheet = "/* No published CSS transport note found yet. */\n";

try {
  const markdown = await readFile(source, "utf8");
  // Accept the compiler output with either three or more matching backticks.
  const matches = [...markdown.matchAll(/^(`{3,})css[ \t]*\r?\n([\s\S]*?)^\1[ \t]*\r?$/gm)];
  if (matches.length !== 1) {
    throw new Error(
      `${source}: expected exactly one fenced css block; found ${matches.length}.`,
    );
  }
  stylesheet = matches[0][2].replace(/\r\n/g, "\n").trimEnd() + "\n";
  console.log(`Compiled ${source} into ${output} (${stylesheet.length} characters).`);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  console.warn(`CSS source not published yet: ${source}; using empty stylesheet.`);
}

await writeFile(output, stylesheet, "utf8");
