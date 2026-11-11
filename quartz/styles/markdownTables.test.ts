import test, { describe } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

describe("ITS Markdown table parity", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "quartz/styles/custom.scss"), "utf8")
  const tableCss = css.split("Markdown table parity with ITS")[1] ?? ""

  test("targets ordinary Markdown table containers without changing Base grids", () => {
    assert.match(tableCss, /#quartz-body article \.table-container/)
    assert.doesNotMatch(tableCss, /(?:\.bases-table|\.bases-view)/)
    assert.match(tableCss, /overflow-x:\s*auto/)
    assert.match(tableCss, /width:\s*max-content/)
  })

  test("uses ITS and Style Settings variables without hard-coded table colors", () => {
    for (const variable of [
      "--embed-bg",
      "--table-header-background",
      "--table-header-text-color",
      "--font",
      "--table-cell-padding-y",
      "--table-row-alt-background",
      "--table-border-color",
    ]) {
      assert.ok(tableCss.includes(variable), "Missing theme variable: " + variable)
    }
    assert.doesNotMatch(tableCss, /#[a-fA-F\d]{3,8}\b/)
  })

  test("does not add bold styles to header or first-column cells", () => {
    assert.match(tableCss, /font-weight:\s*normal/)
    assert.doesNotMatch(tableCss, /font-weight:\s*(?:bold|[5-9]00)\b/)
    assert.doesNotMatch(tableCss, /(?:th|td):nth-child\(1\)[^{}]*\{[^}]*font-weight/)
    assert.match(tableCss, /font-weight:\s*inherit/)
  })

  test("Cinzel reaches <strong> and linked headers instead of being reset to body font", () => {
    assert.match(tableCss, /font-family:\s*var\(--font,\s*var\(--headerFont\)\)/)
    assert.match(tableCss, /thead > tr > th :is\(strong, a\.internal, a\.internal-link\)/)
    assert.match(tableCss, /font-family:\s*inherit/)
  })

  test("combines row and column shading, with alternating header cells", () => {
    assert.match(tableCss, /--table-column-alt-background/)
    assert.match(tableCss, /--table-row-alt-background/)
    assert.match(tableCss, /thead > tr > th:nth-child\(even\)/)
    assert.match(tableCss, /tbody > tr:nth-child\(even\)/)
    assert.match(tableCss, /tbody > tr > td:nth-child\(odd\)/)
    assert.match(tableCss, /color-mix\(\s*in srgb/)
  })

  test("themed diamonds preserve ITS's alternating bullet marker colors", () => {
    assert.match(tableCss, /ul\.qz-table-diamond-list > li::before/)
    assert.match(tableCss, /--list-bullet-size/)
    assert.match(tableCss, /--list-bullet-transform/)
    assert.match(tableCss, /--list-marker-color/)
    assert.match(tableCss, /--list-marker-color-alt/)
    assert.match(tableCss, /li:nth-child\(even\)::before/)
  })

  test("compact cells and table-local link styles do not invent emphasis", () => {
    assert.match(tableCss, /--table-cell-padding-y/)
    assert.match(tableCss, /--table-header-padding-x/)
    assert.match(tableCss, /nth-child\(even\)/)
    assert.match(tableCss, /a\.internal-link/)
    assert.match(tableCss, /background:\s*transparent/)
    assert.match(tableCss, /font-weight:\s*inherit/)
  })
})
