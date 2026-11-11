import type { Element, ElementContent, Root } from "hast"
import { visit } from "unist-util-visit"
import type { QuartzTransformerPlugin } from "../types"

/**
 * Obsidian-style compact lists in Markdown table cells.
 *
 * Markdown such as:
 *   | - [[Rowena]]<br>- [[Padmina]] |
 * is emitted by GFM as literal text hyphens and <br> elements, not list
 * items. Convert only table cells whose *every* line starts with a Markdown
 * bullet marker. This keeps user-authored notes unchanged and avoids global
 * replacements of literal hyphens.
 */
export function transformTableCellLists(root: Root): number {
  let converted = 0

  visit(root, "element", (node) => {
    if (node.tagName !== "td") return
    if (!node.children.length) return

    const segments: ElementContent[][] = [[]]
    for (const child of node.children) {
      if (child.type === "element" && child.tagName === "br") {
        segments.push([])
      } else {
        segments[segments.length - 1].push(child)
      }
    }

    const items: Element[] = []
    for (const segment of segments) {
      const index = segment.findIndex(
        (part) => part.type !== "text" || part.value.trim().length > 0,
      )
      if (index === -1) return

      const first = segment[index]
      if (first.type !== "text") return
      const bullet = /^\s*[-*+]\s+/.exec(first.value)
      if (!bullet) return

      const content: ElementContent[] = [...segment.slice(index)]
      content[0] = { type: "text", value: first.value.slice(bullet[0].length) }
      if (content[0].type === "text" && !content[0].value) content.shift()
      if (!content.some((part) => part.type !== "text" || part.value.trim())) return

      items.push({
        type: "element",
        tagName: "li",
        properties: {},
        children: content,
      })
    }
    if (!items.length) return

    node.children = [{
      type: "element",
      tagName: "ul",
      properties: { className: ["qz-table-diamond-list"] },
      children: items,
    }]
    converted++
  })

  return converted
}

/** Runs after GFM + Obsidian HTML processing and doesn't touch Base views. */
export const TableCellLists: QuartzTransformerPlugin = () => ({
  name: "ITSMarkdownTableCellLists",
  htmlPlugins() {
    return [() => (tree: Root) => {
      transformTableCellLists(tree)
    }]
  },
})
