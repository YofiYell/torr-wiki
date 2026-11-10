---
publish: false
created: 2026-11-10T08:17:59.533Z
modified: 2026-11-10T08:17:59.462Z
published: 2026-11-10T08:17:59.462Z
unlisted: true
---

# ⚙️ Build Controls

## Compile CSS

Evaluation Error: eval@\[native code]
@
asyncEvalInContext@
render@
onload@
load@capacitor://localhost/app.js:205:11324
executeJs@
FP@
compile@
compilePatterns@
@
@
@
@
@
async generateMarkdownWithEvidence@\`css",
compiledCss.trimEnd(),
"\`\`\`\`",
""
].join("\n");

```
    if (!(await adapter.exists("Wiki"))) {
        throw new Error("Wiki folder not found.");
    }

    if (!(await adapter.exists(buildFolder))) {
        await adapter.mkdir(buildFolder);
    }

    // Write both outputs
    await adapter.write(cssPath, compiledCss);
    log("✅ Updated custom-styles.css");

    await adapter.write(transportPath, transportMd);
    log("✅ Updated Wiki/_Build/Styles.md");

    // Remove obsolete local stylesheets
    let deleted = 0;

    for (const oldPath of cssFiles) {
        if (oldPath === cssPath) continue;

        await adapter.remove(oldPath);
        deleted++;
        log(`🗑️ Removed: ${oldPath.split("/").pop()}`);
    }

    logDiv.createEl("hr");
    log(`✅ Compiled ${mdFiles.length} Markdown sources.`);
    log(`🗑️ Removed ${deleted} obsolete CSS files.`);

    if (mdFiles.length === 0) {
        log("⚠️ No sources found; generated an empty stylesheet.");
    }

} catch (error) {
    log(`❌ ${error.message ?? error}`);
} finally {
    btn.disabled = false;
}
```

});

````

## Export Theme

Evaluation Error: eval@[native code]
@
asyncEvalInContext@
render@
onload@
load@capacitor://localhost/app.js:205:11324
executeJs@
FP@
compile@
compilePatterns@
@
@json",
    json,
    "```",
    "",
  ].join("\n");

  const match = markdown.match(/\n```json\n([\s\S]*?)\n```\n$/);
  if (!match || JSON.stringify(JSON.parse(match[1])) !== JSON.stringify(snapshot)) {
    throw new Error("Generated JSON did not match the source Style Settings snapshot.");
  }
  return markdown;
}

async function exportTheme() {
  button.disabled = true;
  try {
    const snapshot = snapshotSettings();
    const markdown = createTransport(snapshot);
    const folder = OUTPUT.slice(0, OUTPUT.lastIndexOf("/"));
    if (!app.vault.getAbstractFileByPath(folder)) {
      throw new Error(`Missing build folder: ${folder}`);
    }

    let file = app.vault.getAbstractFileByPath(OUTPUT);
    if (file && file.extension !== "md") {
      throw new Error(`${OUTPUT} exists but is not a Markdown file.`);
    }
    const previous = file ? await app.vault.read(file) : null;
    if (previous === markdown) {
      report("info", `Theme unchanged; ${Object.keys(snapshot).length} saved settings verified.`);
      return;
    }

    let created = false;
    try {
      if (file) {
        await app.vault.modify(file, markdown);
      } else {
        file = await app.vault.create(OUTPUT, markdown);
        created = true;
      }
      if ((await app.vault.read(file)) !== markdown) {
        throw new Error("Theme.md readback failed verification.");
      }
    } catch (writeError) {
      if (previous !== null && file) {
        try { await app.vault.modify(file, previous); }
        catch (restoreError) { console.error(TAG, "Restore failed:", restoreError); }
      } else if (created && file) {
        try { await app.vault.delete(file); }
        catch (cleanupError) { console.error(TAG, "Cleanup failed:", cleanupError); }
      }
      throw writeError;
    }

    report("info", `Exported ${Object.keys(snapshot).length} saved Style Settings values to ${OUTPUT}.`);
  } catch (error) {
    report("error", `Export failed: ${error.message || String(error)}`);
  } finally {
    button.disabled = false;
  }
}

button.addEventListener("click", exportTheme);
````

## Export Bestiary

Not yet implemented (Stage 4).
