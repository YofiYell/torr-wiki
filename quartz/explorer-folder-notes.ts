import type { QuartzLayout } from "./plugins/loader/config-loader"
import type { QuartzComponent } from "./components/types"

/**
 * Make an Obsidian .base file act as a folder note in Quartz Explorer.
 * If Folder/Folder.md exists, that Markdown page wins and the .base remains visible.
 * A .base is merged into the folder entry only when it is the selected folder note.
 * No Base contents, slugs, folder paths, or expand/collapse behavior are modified.
 */
export function patchExplorerFolderNotes(layout: QuartzLayout): void {
  const linkAnchor = "const folderHref = simplifySlug(node.slug);"
  const setupAnchor = '    const contentUl = clone.querySelector(".content");'
  const renderAnchor =
    "      for (const child of node.children) {\n" +
    "        renderTree(child, contentUl, currentSlug, folderBehavior, savedState, currentPath);\n" +
    "      }"

  const folderNoteSetup = `
    // Only original same-named files qualify. A generated folder listing does not.
    const isSameNamedFolderNote = (filePath, ext) => {
      if (typeof filePath !== "string") return false;
      const parts = filePath.split("/");
      if (parts.length < 2) return false;
      return parts[parts.length - 1].toLowerCase() ===
        parts[parts.length - 2].toLowerCase() + "." + ext;
    };
    const matchingMarkdown = isSameNamedFolderNote(node.data?.filePath, "md");
    const matchingBase = node.children.find((child) =>
      !child.isFolder &&
      child.slugSegment === "index.base" &&
      child.data?.slug === node.slug + ".base" &&
      isSameNamedFolderNote(child.data?.filePath, "base")
    );
    const baseIsFolderNote = !!matchingBase && !matchingMarkdown;
`;

  const replaceOnce = (source: string, oldText: string, newText: string, label: string) => {
    const occurrences = source.split(oldText).length - 1
    if (occurrences !== 1) {
      throw new Error(`Explorer folder-note patch: expected one ${label}, found ${occurrences}`)
    }
    return source.replace(oldText, newText)
  }

  // Patch the actual components used by the active layout, rather than a
  // registry module that may have a different instance in Quartz 5 builds.
  const components = new Set<QuartzComponent>()
  for (const group of [layout.defaults, ...Object.values(layout.byPageType)]) {
    for (const slot of Object.values(group)) {
      if (!Array.isArray(slot)) continue
      for (const candidate of slot) {
        if (typeof candidate === "function") components.add(candidate as QuartzComponent)
      }
    }
  }

  let patched = 0
  for (const component of components) {
    const resources = component.afterDOMLoaded
    if (!resources) continue
    const scripts = Array.isArray(resources) ? resources : [resources]
    const scriptIndex = scripts.findIndex((script) => script.includes(linkAnchor))
    if (scriptIndex < 0) continue
    let script = scripts[scriptIndex]
    script = replaceOnce(script, setupAnchor, setupAnchor + folderNoteSetup, "folder setup")
    script = replaceOnce(
      script,
      linkAnchor,
      "const folderHref = baseIsFolderNote ? matchingBase.data.slug : simplifySlug(node.slug);",
      "folder link",
    )
    script = replaceOnce(
      script,
      renderAnchor,
      "      for (const child of node.children) {\n" +
        "        if (baseIsFolderNote && child === matchingBase) continue; // Merged into folder entry.\n" +
        "        renderTree(child, contentUl, currentSlug, folderBehavior, savedState, currentPath);\n" +
        "      }",
      "child rendering",
    )
    scripts[scriptIndex] = script
    component.afterDOMLoaded = Array.isArray(resources) ? scripts : script
    patched++
  }
  if (patched !== 1) {
    const slots = [layout.defaults, ...Object.values(layout.byPageType)].map((group) =>
      Object.fromEntries(
        Object.entries(group).filter(([, slot]) => Array.isArray(slot)).map(([key, slot]) => [
          key,
          (slot as QuartzComponent[]).map((component) => ({
            name: component.displayName ?? component.name,
            js: typeof component.afterDOMLoaded === "string"
              ? component.afterDOMLoaded.length
              : Array.isArray(component.afterDOMLoaded)
                ? component.afterDOMLoaded.map((s) => s.length)
                : "none",
            hasAnchor: typeof component.afterDOMLoaded === "string"
              ? component.afterDOMLoaded.includes(linkAnchor)
              : Array.isArray(component.afterDOMLoaded)
                ? component.afterDOMLoaded.some((s) => s.includes(linkAnchor))
                : false,
          })),
        ]),
      ),
    )
    console.error("[Explorer folder-note debug]", JSON.stringify(slots).slice(0, 9000))
    const explorer = [...components].find((c) => c.name === "ExplorerComponent")
    if (explorer && typeof explorer.afterDOMLoaded === "string") {
      console.error("[Explorer runtime JS]", explorer.afterDOMLoaded.slice(0, 9000))
    }
    throw new Error(`Explorer folder-note patch: expected one Explorer component, found ${patched}`)
  }
  console.log("[Explorer] Folder-note routing patched (Markdown > Base > folder listing).")
}
