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
  const hasMarkdownFolderNote = (entry, baseEntry) => {
    if (!entry?.filePath || !baseEntry?.filePath) return false;
    const baseSegments = parts(baseEntry.filePath);
    const mdSegments = parts(entry.filePath);
    if (baseSegments.length < 2 || mdSegments.length !== baseSegments.length) return false;
    const baseFolder = baseSegments.slice(0, -1).join("/").toLowerCase();
    const mdFolder = mdSegments.slice(0, -1).join("/").toLowerCase();
    if (baseFolder !== mdFolder) return false;
    const folderName = baseSegments[baseSegments.length - 2].toLowerCase();
    const mdName = mdSegments[mdSegments.length - 1].toLowerCase();
    return mdName === folderName + ".md" || mdName === "index.md" || mdName === "_index.md";
  };

  const rootPath = () => (document.body?.dataset?.basepath || "").replace(/\/$/, "");
  let index = null;
  let scheduled = false;
  const apply = () => {
    if (!index) return;
    const basePath = rootPath();
    for (const folder of document.querySelectorAll(".explorer .folder-container[data-folderpath]")) {
      const folderSlug = folder.dataset.folderpath;
      if (!folderSlug || !folderSlug.endsWith("/index")) continue;
      const baseSlug = folderSlug + ".base";
      const baseEntry = index[baseSlug];
      if (!isMatchingBase(baseEntry) || hasMarkdownFolderNote(index[folderSlug], baseEntry)) continue;

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
