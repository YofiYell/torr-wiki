import fs from "node:fs"
import path from "node:path"
import { minimatch } from "minimatch"

/**
 * Publishing rules from Wiki/_Build/.ignore.md. Input filenames are relative
 * to the Wiki root, not normalized website slugs.
 */
export interface PublicationIgnoreRule {
  pattern: string
  negated: boolean
  directoryOnly: boolean
  matchBase: boolean
}

export interface PublicationIgnore {
  rules: PublicationIgnoreRule[]
}

/** Parse only fenced txt content, not prose surrounding the fence. */
export function parsePublicationIgnore(markdown: string): PublicationIgnore {
  const fences = [...markdown.matchAll(/^[ \t]*\x60{3}txt[ \t]*\r?\n([\s\S]*?)^[ \t]*\x60{3}[ \t]*\r?$/gim)]
  if (fences.length === 0) {
    throw new Error("Wiki/_Build/.ignore.md requires a fenced txt block")
  }

  const rules: PublicationIgnoreRule[] = []
  for (const fence of fences) {
    for (const rawLine of fence[1].split(/\r?\n/)) {
      let line = rawLine
      // Gitignore discards unescaped trailing spaces.
      while (line.endsWith(" ") && !line.endsWith("\\ ")) {
        line = line.slice(0, -1)
      }
      if (!line || line.startsWith("#")) continue
      let negated = false
      if (line.startsWith("!")) {
        negated = true
        line = line.slice(1)
      } else if (line.startsWith("\\#") || line.startsWith("\\!")) {
        line = line.slice(1)
      }
      if (!line) continue

      const directoryOnly = line.endsWith("/")
      if (directoryOnly) line = line.slice(0, -1)
      const anchored = line.startsWith("/")
      if (anchored) line = line.slice(1)

      if (!line || line === ".." || line.startsWith("../")) {
        throw new Error("Invalid Wiki ignore rule: " + rawLine)
      }

      rules.push({
        pattern: line,
        negated,
        directoryOnly,
        matchBase: !anchored && !line.includes("/"),
      })
    }
  }
  return { rules }
}

/** Read rules once per build; a missing or malformed manifest must fail the build. */
export function loadPublicationIgnore(contentRoot: string): PublicationIgnore {
  const filename = path.join(contentRoot, "_Build", ".ignore.md")
  return parsePublicationIgnore(fs.readFileSync(filename, "utf8"))
}

/**
 * Matching follows Gitignore's ordered rules and parent-directory semantics:
 * excluding a folder excludes its contents until the folder is re-included.
 * Basename-only rules intentionally match anywhere below the Wiki root.
 */
export function isPublicationIgnored(
  settings: PublicationIgnore | undefined,
  sourcePath: string,
  isDirectory = false,
): boolean {
  if (!settings?.rules.length) return false
  const name = sourcePath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/$/, "")
  if (!name || name === "." || name.startsWith("../")) return false
  const parts = name.split("/")
  const options = { dot: true, nonegate: true, nocomment: true, nobrace: true, nocase: false }

  for (let i = 0; i < parts.length; i++) {
    const current = parts.slice(0, i + 1).join("/")
    const currentIsDirectory = i < parts.length - 1 || isDirectory
    let excluded = false

    for (const rule of settings.rules) {
      if (rule.directoryOnly && !currentIsDirectory) continue
      if (minimatch(current, rule.pattern, { ...options, matchBase: rule.matchBase })) {
        excluded = !rule.negated
      }
    }
    if (excluded) return true
  }

  return false
}
