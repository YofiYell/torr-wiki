import test, { describe } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { toHtml } from "hast-util-to-html"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import type { Element, Root } from "hast"
import {
  loadExportedBestiary,
  resolveStatblock,
  renderStatblock,
  transformStatblocks,
  type ExportedBestiary,
} from "./statblocks"

const bestiary: ExportedBestiary = {
  format: "quartz-fantasy-statblocks-bestiary",
  version: 1,
  creatures: {
    "Sample Beast": {
      name: "Sample Beast", size: "Large", type: "Beast", alignment: "Unaligned",
      ac: 11, hp: 19, hit_dice: "3d10 + 3", speed: "50 ft.",
      stats: [15, 12, 13, 4, 13, 5], skillsaves: [{ perception: 5 }],
      cr: "1/4",
      traits: [{ name: "River Runner", desc: "*Melee Attack:* **swift** and accurate." }],
      actions: [{ name: "Kick", desc: "*Melee Weapon Attack:* +4 to hit." }],
    },
    "Other Beast": { name: "Other Beast", ac: 14, hp: 20, stats: [10, 10, 10, 10, 10, 10] },
  },
}

const pre = (code: string, className: unknown = ["language-statblock"]): Element => ({
  type: "element", tagName: "pre", properties: {}, children: [{
    type: "element", tagName: "code", properties: { className }, children: [
      { type: "text", value: code },
    ],
  }],
})

describe("Basic 5e statblock renderer", () => {
  test("resolves creature: and monster: references, with local overrides", () => {
    const creature = resolveStatblock("creature: Sample Beast\nhp: 42", bestiary, "Notes/Beasts.md")
    assert.equal(creature.name, "Sample Beast")
    assert.equal(creature.hp, 42)
    assert.equal(creature.ac, 11)

    const monster = resolveStatblock("monster: Sample Beast", bestiary, "Notes/Beasts.md")
    assert.equal(monster.hp, 19)
  })

  test("resolves name-only references but does not override full inline definitions", () => {
    const named = resolveStatblock("name: Sample Beast", bestiary, "Notes/Beasts.md")
    assert.equal(named.hp, 19)
    const inline = resolveStatblock(
      "name: Sample Beast\nac: 18\nhp: 33\nstats: [10, 11, 12, 13, 14, 15]",
      bestiary,
      "Notes/Beasts.md",
    )
    assert.equal(inline.ac, 18)
    assert.equal(inline.hp, 33)
    assert.equal(inline.speed, undefined)
  })

  test("supports YAML maps, sequences, and inherited definitions", () => {
    const built = resolveStatblock(
      "name: Offspring\nextends: Sample Beast\nskillsaves:\n  - perception: 7",
      bestiary,
      "Notes/Beasts.md",
    )
    assert.equal(built.name, "Offspring")
    assert.equal(built.hp, 19)
    assert.deepEqual(built.skillsaves, [{ perception: 7 }])
    assert.match(toHtml(renderStatblock(built)), /Perception \+7/)
  })

  test("renders names, ability modifiers, descriptions, sections and theme class", () => {
    const html = toHtml(renderStatblock(bestiary.creatures["Sample Beast"]))
    assert.match(html, /qz-statblock-5e/)
    assert.match(html, /Sample Beast/)
    assert.match(html, /Armor Class/)
    assert.match(html, /19 \(3d10 \+ 3\)/)
    assert.match(html, /15 \(\+2\)/)
    assert.match(html, /4 \(-3\)/)
    assert.match(html, /Perception \+5/)
    assert.match(html, /1\/4 \(50 XP\)/)
    assert.match(html, /Proficiency Bonus/)
    assert.match(html, /River Runner/)
    assert.match(html, /<em>Melee Attack:<\/em>/)
    assert.match(html, /<strong>swift<\/strong>/)
    assert.match(html, /role="heading" aria-level="3">Sample Beast<\/div>/)
    assert.match(html, /role="heading" aria-level="4">Actions<\/div>/)
    assert.match(html, /qz-statblock-properties/)
    assert.match(html, /qz-statblock-details/)
    assert.match(html, /qz-statblock-entry-list/)
    assert.doesNotMatch(html, /<h[34][\s>]/, "avoid global heading decorations")
    assert.doesNotMatch(html, /fdf1dc|parchment|WotC/i)
  })

  test("component stylesheet follows ITS statblock variables with Quartz fallbacks", () => {
    const stylesheet = fs.readFileSync(path.join(process.cwd(), "quartz/styles/custom.scss"), "utf8")
    for (const property of [
      "--statblock-background-color",
      "--statblock-heading-font",
      "--statblock-heading-font-color",
      "--statblock-rule-color",
      "--statblock-bar-color",
      "--statblock-alt",
      "--statblock-content-font",
      "--statblock-section-heading-font-color",
    ]) assert.ok(stylesheet.includes(property), "missing theme variable " + property)
    assert.match(stylesheet, /max-width: 38rem/)
    assert.doesNotMatch(stylesheet, /#fdf1dc|parchment-paper|url\([^)]*parchment/i)
  })

  test("handles unrecognized creatures locally, without losing valid siblings", () => {
    const root: Root = { type: "root", children: [
      pre("creature: Sample Beast"),
      pre("creature: Missing Beast"),
      pre("creature: Other Beast"),
    ]}
    assert.equal(transformStatblocks(root, bestiary, "Notes/Beasts.md"), 3)
    const html = toHtml(root)
    assert.match(html, /Sample Beast/)
    assert.match(html, /Other Beast/)
    assert.match(html, /Statblock error/)
    assert.match(html, /Missing Beast/)
    assert.match(html, /Notes\/Beasts.md/)
    assert.doesNotMatch(html, /language-statblock/)
  })

  test("bad YAML becomes an in-page error without preventing other blocks", () => {
    const root: Root = { type: "root", children: [
      pre("name: Bad Beast\nstats: [12, 13"),
      pre("name: Inline Beast\nac: 13\nhp: 23"),
    ]}
    const count = transformStatblocks(root, bestiary, "World/Note.md")
    assert.equal(count, 2)
    const html = toHtml(root)
    assert.match(html, /Statblock error/)
    assert.match(html, /Inline Beast/)
    assert.match(html, /Armor Class/)
  })

  test("triple- and quadruple-backtick callout fences survive Markdown parsing", () => {
    const parser = unified().use(remarkParse).use(remarkRehype)
    for (const ticks of ["\x60\x60\x60", "\x60\x60\x60\x60"]) {
      const markdown = [
        "> [!stat]- Statblock",
        "> " + ticks + "statblock",
        "> creature: Sample Beast",
        "> " + ticks,
      ].join("\n")
      const htmlAst = parser.runSync(parser.parse(markdown)) as Root
      assert.equal(transformStatblocks(htmlAst, bestiary, "Notes/Callout.md"), 1)
      const html = toHtml(htmlAst)
      assert.match(html, /qz-statblock-5e/)
      assert.match(html, /Sample Beast/)
    }
  })

  test("nested callouts are transformed, while ordinary fenced code stays unchanged", () => {
    const root: Root = {
      type: "root",
      children: [{
        type: "element", tagName: "blockquote", properties: { className: ["callout"] },
        children: [
          { type: "element", tagName: "div", properties: { className: ["callout-content"] },
            children: [pre("creature: Sample Beast")] },
        ],
      }, pre("creature: Sample Beast", ["language-yaml"])],
    }
    assert.equal(transformStatblocks(root, bestiary, "Notes/Nested.md"), 1)
    const html = toHtml(root)
    assert.match(html, /qz-statblock-5e/)
    assert.match(html, /language-yaml/)
    assert.equal((html.match(/qz-statblock-5e/g) ?? []).length, 1)
  })

  test("missing or malformed Bestiary export becomes a localized error", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "quartz-bestiary-"))
    try {
      fs.mkdirSync(path.join(tmp, "_Build"))
      const location = path.join(tmp, "_Build", "Bestiary.md")
      fs.writeFileSync(location, "\x60\x60\x60json\n" + JSON.stringify(bestiary) + "\n\x60\x60\x60\n")
      const loaded = loadExportedBestiary(tmp)
      assert.equal(loaded.creatures["Sample Beast"].name, "Sample Beast")
      fs.writeFileSync(location, "\x60\x60\x60json\n{\"format\":\"wrong\",\"version\":1,\"creatures\":{}}\n\x60\x60\x60\n")
      assert.throws(() => loadExportedBestiary(tmp), /unsupported/)
      const root: Root = { type: "root", children: [pre("creature: Sample Beast")] }
      transformStatblocks(root, new Error("Bestiary was not exported"), "Notes/Test.md")
      assert.match(toHtml(root), /Statblock error/)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

})
