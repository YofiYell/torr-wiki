import test, { describe } from "node:test"
import assert from "node:assert/strict"
import type { Element, ElementContent, Root } from "hast"
import { toHtml } from "hast-util-to-html"
import { transformTableCellLists } from "./tableCellLists"

const text = (value: string): ElementContent => ({ type: "text", value })
const element = (tagName: string, children: ElementContent[]): Element => ({
  type: "element", tagName, properties: {}, children,
})
const link = (name: string): Element => ({
  type: "element", tagName: "a", properties: { href: "/" + name },
  children: [text(name)],
})
const table = (...cells: Element[]): Root => ({
  type: "root", children: [element("table", [
    element("tbody", [element("tr", cells)]),
  ])],
})

describe("ITS table list marker recovery", () => {
  test("converts linked - / br items to one real list per cell", () => {
    const root = table(
      element("td", [text("- "), link("Rowena"), element("br", []),
        text("- "), link("Padmina")]),
      element("td", [text("Ordinary cell")]),
      element("td", [text("- "), link("Wala"), element("br", []),
        text("- "), link("Garthri"), element("br", []),
        text("- "), link("Mila")]),
    )
    assert.equal(transformTableCellLists(root), 2)
    const html = toHtml(root)
    assert.equal((html.match(/qz-table-diamond-list/g) ?? []).length, 2)
    assert.equal((html.match(/<li>/g) ?? []).length, 5)
    assert.match(html, /<li><a href="\/Rowena">Rowena<\/a><\/li>/)
    assert.match(html, /<li><a href="\/Padmina">Padmina<\/a><\/li>/)
    assert.match(html, /<td>Ordinary cell<\/td>/)
    assert.doesNotMatch(html, /<br>/)
  })

  test("supports a single bullet and nested inline emphasis", () => {
    const root = table(element("td", [
      text("- "), element("strong", [text("Very Important")]),
      text(" "), link("Person"),
    ]))
    assert.equal(transformTableCellLists(root), 1)
    const html = toHtml(root)
    assert.match(html, /<li><strong>Very Important<\/strong> <a/)
  })

  test("leaves mixed text, ordinary hyphens, and column headers unchanged", () => {
    const root: Root = {
      type: "root", children: [element("table", [
        element("thead", [element("tr", [element("th", [text("- Heading")])])]),
        element("tbody", [element("tr", [
          element("td", [text("Average - low"), element("br", []), text("- Next")]),
          element("td", [text("-12")]),
          element("td", [text("First"), element("br", []), text("Second")]),
        ])]),
      ])],
    }
    const before = toHtml(root)
    assert.equal(transformTableCellLists(root), 0)
    assert.equal(toHtml(root), before)
  })

  test("handles * and + Markdown list markers only in table cells", () => {
    const root = table(element("td", [
      text("* Alternate"), element("br", []), text("+ Plus"),
    ]))
    assert.equal(transformTableCellLists(root), 1)
    const html = toHtml(root)
    assert.match(html, /<li>Alternate<\/li>/)
    assert.match(html, /<li>Plus<\/li>/)
  })

  test("never converts lists outside HTML table cells", () => {
    const root: Root = {
      type: "root",
      children: [element("p", [
        text("- Bullet"), element("br", []), text("- Another"),
      ])],
    }
    assert.equal(transformTableCellLists(root), 0)
  })
})
