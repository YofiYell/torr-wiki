// @ts-nocheck - Client-side script bundled as text by Quartz.
// Folder/Folder.md takes precedence over Folder/Folder.base.
// Only the chosen .base folder note merges into the folder entry.
(function () {
  const toPath = (value) => typeof value === "string" ? value.replace(/\\/g, "/") : "";
  const parts = (path) => toPath(path).split("/").filter(Boolean);
  const isMatchingBase = (entry) => {
    const segments = parts(entry?.filePath);
    if (segments.length < 2) return false;
    const name = segments[segments.length - 1].toLowerCase();
    const folder = segments[segments.length - 2].toLowerCase();
    return name === folder + ".base";
  };
  // Injected by Quartz at build time from real source Markdown filenames.
  // Generated virtual folder-index pages must not count as Markdown folder notes.
  const realMarkdownFolderSlugs = new Set(__REAL_FOLDER_MD_SLUGS__);

  const rootPath = () => (document.body?.dataset?.basepath || "").replace(/\/$/, "");
  let index = null;
  let scheduled = false;
  // Sort files and folders in one alphabetic sequence at every Explorer level.
  // Reordering only when needed prevents the MutationObserver from looping.
  const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
  const sortExplorerList = (list) => {
    const entries = Array.from(list.children).filter((child) =>
      child.tagName === "LI" && !child.classList.contains("overflow-end")
    );
    const getName = (entry) => {
      const first = entry.firstElementChild;
      if (!first) return "";
      if (first.classList.contains("folder-container")) {
        return first.querySelector(".folder-title")?.textContent?.trim() || "";
      }
      if (first.matches("a.nav-file-title")) return first.textContent?.trim() || "";
      return "";
    };
    entries.sort((a, b) => nameCollator.compare(getName(a), getName(b)));

    // Preserve the overflow marker at the end of the list.
    let before = list.querySelector(":scope > li.overflow-end");
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.nextElementSibling !== before) list.insertBefore(entry, before);
      before = entry;
    }
  };
  const apply = () => {
    if (!index) return;
    const basePath = rootPath();
    for (const folder of document.querySelectorAll(".explorer .folder-container[data-folderpath]")) {
      const folderSlug = folder.dataset.folderpath;
      if (!folderSlug || !folderSlug.endsWith("/index")) continue;
      const baseSlug = folderSlug + ".base";
      const baseEntry = index[baseSlug];
      if (!isMatchingBase(baseEntry) || realMarkdownFolderSlugs.has(folderSlug)) continue;

      const folderLink = folder.querySelector("a.folder-button");
      if (!folderLink) continue;
      const baseUrl = new URL(basePath + "/" + baseSlug, location.origin);
      if (folderLink.href !== baseUrl.href) folderLink.href = baseUrl.href;

      // The .base is now represented by the folder label, not a duplicate tree row.
      const content = folder.nextElementSibling?.querySelector(":scope > ul.content");
      if (!content) continue;
      for (const child of Array.from(content.children)) {
        const fileLink = child.querySelector(":scope > a.nav-file-title");
        if (fileLink && fileLink.href === baseUrl.href) child.remove();
      }
    }
    for (const list of document.querySelectorAll(".explorer ul.explorer-ul, .explorer ul.content")) {
      sortExplorerList(list);
    }
  };
  const requestApply = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; apply(); });
  };
  new MutationObserver(requestApply).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("nav", requestApply);
  document.addEventListener("render", requestApply);
  const sourceUrl = rootPath() + "/static/contentIndex.json";
  fetch(sourceUrl).then((response) => {
    if (!response.ok) throw new Error("HTTP " + response.status);
    return response.json();
  }).then((data) => {
    index = data.content || data;
    requestApply();
  }).catch((error) => console.error("[Explorer folder notes] Unable to read content index:", error));
})();
