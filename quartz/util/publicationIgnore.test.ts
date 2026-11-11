import test, { describe } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { isPublicationIgnored, loadPublicationIgnore, parsePublicationIgnore } from "./publicationIgnore"

const fence = (rules: string) => "\x60\x60\x60txt\n" + rules + "\n\x60\x60\x60"

describe("Wiki publication ignore rules", () => {
  test("missing optional .ignore.md supplies no additional exclusions", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "wiki-ignore-"))
    try {
      const missing = loadPublicationIgnore(root)
      assert.deepEqual(missing, { rules: [] })
      assert.equal(isPublicationIgnored(missing, "_Views/Private.base"), false)
      assert.equal(isPublicationIgnored(missing, "Notes/Public.md"), false)

      // An existing .ignore.md continues to work, and invalid contents
      // must not silently disable intended exclusions.
      fs.mkdirSync(path.join(root, "_Build"))
      fs.writeFileSync(path.join(root, "_Build", ".ignore.md"), fence("_Views/"))
      const enabled = loadPublicationIgnore(root)
      assert.equal(isPublicationIgnored(enabled, "_Views/Private.base"), true)
      assert.equal(isPublicationIgnored(enabled, "Notes/Public.md"), false)

      fs.writeFileSync(path.join(root, "_Build", ".ignore.md"), "not a txt fence")
      assert.throws(() => loadPublicationIgnore(root), /fenced txt/)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test("parses only txt fences, not surrounding Markdown or comments", () => {
    const settings = parsePublicationIgnore(
      "# Do not treat this heading as an ignore rule\n" +
      fence("# comment\n*.base\nDraft?.md") +
      "\nOrdinary prose.md",
    )
    assert.equal(settings.rules.length, 2)
    assert.equal(isPublicationIgnored(settings, "views/item.base"), true)
    assert.equal(isPublicationIgnored(settings, "notes/Draft4.md"), true)
    assert.equal(isPublicationIgnored(settings, "notes/Draft44.md"), false)
    assert.equal(isPublicationIgnored(settings, "notes/Ordinary prose.md"), false)
  })

  test("matches bare filenames and directory names at any depth", () => {
    const settings = parsePublicationIgnore(fence("Private Notes.md\n_ViewData/\n*.canvas"))
    for (const pathname of [
      "Private Notes.md",
      "People/Private Notes.md",
      "_ViewData/table.base",
      "People/_ViewData/subdir/table.base",
      "Maps/board.canvas",
    ]) assert.equal(isPublicationIgnored(settings, pathname), true, pathname)
    assert.equal(isPublicationIgnored(settings, "People/ViewData/table.base"), false)
    assert.equal(isPublicationIgnored(settings, "People/table.base"), false)
  })

  test("supports root anchoring, path-specific rules, globs, and case sensitivity", () => {
    const settings = parsePublicationIgnore(
      fence("/Root.md\nPeople/Secret*.md\n**/Private/*.md"),
    )
    assert.equal(isPublicationIgnored(settings, "Root.md"), true)
    assert.equal(isPublicationIgnored(settings, "Nested/Root.md"), false)
    assert.equal(isPublicationIgnored(settings, "People/Secret 1.md"), true)
    assert.equal(isPublicationIgnored(settings, "Nested/People/Secret 1.md"), false)
    assert.equal(isPublicationIgnored(settings, "People/secret 1.md"), false)
    assert.equal(isPublicationIgnored(settings, "Nested/Private/draft.md"), true)
  })

  test("allows negation unless an ancestor directory remains ignored", () => {
    const settings = parsePublicationIgnore(
      fence("*.base\n!Allowed.base\n_Archive/\n!_Archive/Allowed.base"),
    )
    assert.equal(isPublicationIgnored(settings, "Nested/Other.base"), true)
    assert.equal(isPublicationIgnored(settings, "Nested/Allowed.base"), false)
    assert.equal(isPublicationIgnored(settings, "_Archive/Allowed.base"), true)

    const reopened = parsePublicationIgnore(
      fence("_Archive/\n!_Archive/\n_Archive/*.base\n!_Archive/Allowed.base"),
    )
    assert.equal(isPublicationIgnored(reopened, "_Archive/Allowed.base"), false)
    assert.equal(isPublicationIgnored(reopened, "_Archive/Other.base"), true)
  })

  test("can ignore directories with patterns that omit a trailing slash", () => {
    const settings = parsePublicationIgnore(fence("Private\n!Private/Safe.md"))
    assert.equal(isPublicationIgnored(settings, "a/Private/Safe.md"), true)
    assert.equal(isPublicationIgnored(settings, "a/Private/Draft.md"), true)
  })

  test("interprets escaped leading comment and negation markers literally", () => {
    const settings = parsePublicationIgnore(fence("\\#memo.md\n\\!critical.md"))
    assert.equal(isPublicationIgnored(settings, "a/#memo.md"), true)
    assert.equal(isPublicationIgnored(settings, "a/!critical.md"), true)
  })

  test("rejects a missing txt fence rather than silently publishing", () => {
    assert.throws(() => parsePublicationIgnore("*.base"), /fenced txt/)
    assert.throws(() => parsePublicationIgnore(fence("../unrelated")), /Invalid/)
  })
})
