import { componentRegistry } from "./components/registry"

/**
 * Make same-named Obsidian Bases behave as Explorer folder notes.
 * Markdown folder notes win when both a matching .md and a matching .base exist.
 *
 * Explorer v1.0.3 supplies the client-side renderer as an inline script string.
 * The patch is applied to that string after the component has been registered.
 * Fail visibly on upstream source changes rather than silently losing routing.
 */
export function patchExplorerFolderNotes(): void {
  const linkAnchor = "const folderHref = simplifySlug(node.slug);"
  const setupAnchor = '    const contentUl = clone.querySelector(".content");'
  const renderAnchor =
    "      for (const child of node.children) {\n" +
    "        renderTree(child, contentUl, currentSlug, folderBehavior, savedState, currentPath);\n" +
    "      }"

  const matchingBaseSetup = `
    // Same-name Base folder notes map to "index.base" in Quartz.
    // Use source file paths to distinguish them from unrelated index.base files.
    const isSameNamedFolderNote = (filePath, ext) => {
      if (typeof filePath !== "string") return false;
      const segments = filePath.split("/");
      if (segments.length < 2) return false;
      const name = segments[segments.length - 1].toLowerCase();
      const folder = segments[segments.length - 2].toLowerCase();
      return name === folder + "." + ext;
    };
    const matchingBase = node.children.find((child) =>
      !child.isFolder &&
      child.slugSegment === "index.base" &&
      child.data?.slug === node.slug + ".base" &&
      isSameNamedFolderNote(child.data?.filePath, "base")
    );
    const matchingMarkdown = isSameNamedFolderNote(node.data?.filePath, "md");
`;

  const replaceOnce = (source: string, oldText: string, newText: string, label: string) => {
    const occurrences = source.split(oldText).length - 1
    if (occurrences !== 1) {
      throw new Error(`Explorer folder-note patch: expected one ${label}, found ${occurrences}`)
    }
    return source.replace(oldText, newText)
  }

  let patched = 0
  for (const component of componentRegistry.getAllComponents()) {
    const resources = component.afterDOMLoaded
    if (!resources) continue
    const scripts = Array.isArray(resources) ? resources : [resources]
    const scriptIndex = scripts.findIndex((script) => script.includes(linkAnchor))
    if (scriptIndex < 0) continue

    let script = scripts[scriptIndex]
    script = replaceOnce(script, setupAnchor, setupAnchor + matchingBaseSetup, "folder setup")
    script = replaceOnce(
      script,
      linkAnchor,
      "const folderHref = matchingBase && !matchingMarkdown ? matchingBase.data.slug : simplifySlug(node.slug);",
      "folder link",
    )
    script = replaceOnce(
      script,
      renderAnchor,
      "      for (const child of node.children) {\n" +
        "        if (child === matchingBase) continue; // Linked via the folder label.\n" +
        "        renderTree(child, contentUl, currentSlug, folderBehavior, savedState, currentPath);\n" +
        "      }",
      "child rendering",
    )

    scripts[scriptIndex] = script
    component.afterDOMLoaded = Array.isArray(resources) ? scripts : script
    patched++
  }

  if (patched !== 1) {
    throw new Error(`Explorer folder-note patch: expected one Explorer component, found ${patched}`)
  }
  console.log("[Explorer] Folder-note routing patched (Markdown > Base > folder listing).")
}
