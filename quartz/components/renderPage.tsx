import { render } from "preact-render-to-string"
import { QuartzComponent, QuartzComponentProps } from "./types"
import BodyConstructor from "./Body"
import {
  CSSResource,
  JSResource,
  JSResourceToScriptElement,
  StaticResources,
} from "../util/resources"
import { FullSlug, RelativeURL, joinSegments, resolveRelative } from "../util/path"
import { clone } from "../util/clone"
import { Root, Element, ElementContent } from "hast"
import { GlobalConfiguration, SidebarModes } from "../cfg"
import { i18n } from "../i18n"
import { styleText } from "util"
import { resolveFrame } from "./frames"
import type { TreeTransform } from "../plugins/types"
import type { BuildCtx } from "../util/ctx"
import { isPublicationIgnored } from "../util/publicationIgnore"

interface RenderComponents {
  head: QuartzComponent
  header: QuartzComponent[]
  beforeBody: QuartzComponent[]
  pageBody: QuartzComponent
  afterBody: QuartzComponent[]
  left: QuartzComponent[]
  right: QuartzComponent[]
  footer: QuartzComponent[]
  frame?: string
  sidebars?: SidebarModes
}

const headerRegex = new RegExp(/h[1-6]/)

/**
 * Whether a heading answers to `id`: its own id, or the id of a `span.heading-alias` inside it.
 * GitHubFlavoredMarkdown adds that alias when the anchor Obsidian writes for a heading (`:`, `|`,
 * `^`, `#` and `\` become spaces) slugs differently, e.g. `![[note#Colon unspaced]]` for
 * `## Colon:unspaced`.
 */
function headingHasId(heading: Element, id: string): boolean {
  if (heading.properties?.id === id) return true
  const hasAlias = (el: Element): boolean =>
    el.children.some(
      (child) =>
        child.type === "element" &&
        ((child.properties?.id === id &&
          ([] as unknown[]).concat(child.properties?.className ?? []).includes("heading-alias")) ||
          hasAlias(child)),
    )
  return hasAlias(heading)
}
export function pageResources(
  baseDir: FullSlug | RelativeURL,
  staticResources: StaticResources,
  ctx?: BuildCtx,
): StaticResources {
  const hashedNames = ctx?.hashedResourceNames
  const cssFile = hashedNames?.["index.css"] ?? "index.css"
  const prescriptFile = hashedNames?.["prescript.js"] ?? "prescript.js"
  const postscriptFile = hashedNames?.["postscript.js"] ?? "postscript.js"

  const componentCssResources: CSSResource[] = []
  if (ctx?.componentCssMap) {
    const seen = new Set<string>()
    for (const filename of ctx.componentCssMap.values()) {
      if (seen.has(filename)) continue
      seen.add(filename)
      componentCssResources.push({ content: joinSegments(baseDir, filename) })
    }
  }

  const extracted = ctx?.extractedInlineResources
  const resolvedCss: CSSResource[] = staticResources.css.map((resource) => {
    if (!(resource.inline ?? false) || !extracted) return resource
    const filename = extracted.get(resource.content)
    if (!filename) return resource
    return { content: joinSegments(baseDir, filename) }
  })

  const resolvedJs: JSResource[] = staticResources.js.map((resource) => {
    if (resource.contentType !== "inline" || !extracted) return resource
    const filename = extracted.get(resource.script)
    if (!filename) return resource
    return {
      src: joinSegments(baseDir, filename),
      loadTime: resource.loadTime,
      contentType: "external" as const,
      moduleType: resource.moduleType,
      spaPreserve: resource.spaPreserve,
    }
  })

  const contentIndexPath = joinSegments(baseDir, "static/contentIndex.json")
  // static/contentIndex.json is emitted by the content-index plugin, which may be disabled.
  // Resolve to an empty index instead of rejecting so consumers (search, explorer, graph, …)
  // degrade gracefully rather than throwing uncaught errors on every page.
  const contentIndexScript =
    `const fetchData = fetch("${contentIndexPath}")` +
    `.then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json() })` +
    `.catch(e => { console.warn("[Quartz] Could not load ${contentIndexPath} (" + e.message + "); is configuration.contentIndex disabled?"); return {} });` +
    // Absolute URL of static/ (plugin assets live in static/plugins/<to>). Resolved once on the
    // first page, so it stays valid across SPA navigations.
    `window.quartzStaticUrl = new URL(${JSON.stringify(joinSegments(baseDir, "static") + "/")}, location.href).href`

  const resources: StaticResources = {
    css: [
      {
        content: joinSegments(baseDir, cssFile),
      },
      ...componentCssResources,
      ...resolvedCss,
    ],
    js: [
      {
        src: joinSegments(baseDir, prescriptFile),
        loadTime: "beforeDOMReady",
        contentType: "external",
      },
      {
        loadTime: "beforeDOMReady",
        contentType: "inline",
        spaPreserve: true,
        script: contentIndexScript,
      },
      ...resolvedJs,
    ],
    additionalHead: staticResources.additionalHead,
  }

  resources.js.push({
    src: joinSegments(baseDir, postscriptFile),
    loadTime: "afterDOMReady",
    moduleType: "module",
    contentType: "external",
  })

  return resources
}

/**
 * Links in parsed Markdown are relative to the source file's URL (including
 * the "index" filename of folder notes), not to its simplified public slug.
 * Resolve against that source file first, then make the result relative to the
 * page receiving the transclusion. This also handles nested embeddings: each
 * transclusion reuses its immediate source context.
 */
function rebaseEmbeddedElement<T extends Element>(
  sourceElement: T,
  destination: FullSlug,
  source: FullSlug,
): T {
  const element = clone(sourceElement) as T
  const sourceUrl = new URL(source, "https://quartz.invalid/")

  function rewrite(node: Element) {
    for (const attr of ["href", "src"] as const) {
      const value = node.properties?.[attr]
      if (typeof value !== "string" || !/^\.\.?($|\/)/.test(value)) continue

      const target = new URL(value, sourceUrl)
      const targetSlug = decodeURI(target.pathname.slice(1)) as FullSlug
      node.properties[attr] =
        resolveRelative(destination, targetSlug) + target.search + target.hash
    }
    for (const child of node.children ?? []) {
      if (child.type === "element") rewrite(child)
    }
  }

  rewrite(element)
  return element
}

/** @internal Exported for testing only. */
export function renderTranscludes(
  root: Root,
  cfg: GlobalConfiguration,
  slug: FullSlug,
  componentData: QuartzComponentProps,
  visited: Set<FullSlug>,
  treeTransforms?: TreeTransform[],
) {
  // Work on cloned source fragments before moving them into the destination.
  // Render-time plugins (including Bases) need the source file's metadata:
  // placeholders alone do not carry their definitions into a parent note.
  function renderSource(
    nodes: ElementContent[],
    source: QuartzComponentProps["fileData"],
    sourceSlug: FullSlug,
  ): ElementContent[] {
    const fragment: Root = { type: "root", children: nodes.map((node) => clone(node)) }
    const sourceData: QuartzComponentProps = {
      ...componentData,
      fileData: source,
      tree: fragment,
    }

    // Nested embeds are rendered with their own source context first.
    renderTranscludes(fragment, cfg, sourceSlug, sourceData, visited, treeTransforms)
    for (const transform of treeTransforms ?? []) {
      transform(fragment, sourceSlug, sourceData)
    }

    return fragment.children.map((node) =>
      node.type === "element"
        ? rebaseEmbeddedElement(node, slug, sourceSlug)
        : node,
    ) as ElementContent[]
  }

  // Walk manually so circularity tracks the active ancestor chain rather than
  // blocking independent sibling embeds of the same note.
  function walk(node: Element | Root) {
    const children = node.children ?? []
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child?.type !== "element") continue
      const el = child as Element

      if (el.tagName !== "blockquote") {
        walk(el)
        continue
      }

      const classNames = (el.properties?.className ?? []) as string[]
      if (!classNames.includes("transclude")) {
        walk(el)
        continue
      }

      const inner = el.children[0] as Element
      const transcludeTarget = (inner.properties["data-slug"] ?? slug) as FullSlug
      if (visited.has(transcludeTarget)) {
        console.warn(
          styleText(
            "yellow",
            `Warning: Skipping circular transclusion: ${slug} -> ${transcludeTarget}`,
          ),
        )
        el.children = [
          {
            type: "element",
            tagName: "p",
            properties: { style: "color: var(--secondary);" },
            children: [
              {
                type: "text",
                value: `Circular transclusion detected: ${transcludeTarget}`,
              },
            ],
          },
        ]
        continue
      }

      visited.add(transcludeTarget)
      try {
        let page = componentData.allFiles.find((f) => f.slug === transcludeTarget)
        if (!page) {
          const dotIdx = transcludeTarget.lastIndexOf(".")
          const slashIdx = transcludeTarget.lastIndexOf("/")
          if (dotIdx > slashIdx + 1) {
            const stripped = transcludeTarget.slice(0, dotIdx) as FullSlug
            page = componentData.allFiles.findLast((f) => f.slug === stripped)
          }
        }
        if (!page) continue

        const sourceSlug = page.slug ?? transcludeTarget
        let content: ElementContent[] | undefined
        let blockRef = el.properties.dataBlock as string | undefined
        if (blockRef?.startsWith("#^")) {
          blockRef = blockRef.slice("#^".length)
          const block = page.blocks?.[blockRef]
          if (block) {
            content = block.tagName === "li"
              ? [{ type: "element", tagName: "ul", properties: {}, children: [block] }]
              : [block]
          }
        } else if (blockRef?.startsWith("#") && page.htmlAst) {
          blockRef = blockRef.slice(1)
          let startIdx: number | undefined
          let startDepth: number | undefined
          let endIdx: number | undefined
          for (const [i, htmlEl] of page.htmlAst.children.entries()) {
            if (!(htmlEl.type === "element" && htmlEl.tagName.match(headerRegex))) continue
            const depth = Number(htmlEl.tagName.substring(1))
            if (startIdx === undefined || startDepth === undefined) {
              if (headingHasId(htmlEl, blockRef)) {
                startIdx = i
                startDepth = depth
              }
            } else if (depth <= startDepth) {
              endIdx = i
              break
            }
          }
          if (startIdx !== undefined) {
            content = page.htmlAst.children.slice(startIdx, endIdx) as ElementContent[]
          }
        } else if (page.htmlAst) {
          content = [
            {
              type: "element",
              tagName: "h1",
              properties: {},
              children: [
                {
                  type: "text",
                  value:
                    page.frontmatter?.title ??
                    i18n(cfg.locale).components.transcludes.transcludeOf({
                      targetSlug: sourceSlug,
                    }),
                },
              ],
            },
            ...(page.htmlAst.children as ElementContent[]),
          ]
        }

        if (!content) continue
        el.children = [
          ...renderSource(content, page, sourceSlug),
          // A hidden Base may render inside a published note, but must not
          // advertise a standalone URL that the publisher deliberately omits.
          ...(
            isPublicationIgnored(componentData.ctx?.publicationIgnore, page.relativePath ?? "")
              ? []
              : [{
                  type: "element" as const,
                  tagName: "a",
                  properties: {
                    href: inner.properties?.href,
                    class: ["internal", "internal-link", "transclude-src"],
                  },
                  children: [{
                    type: "text" as const,
                    value: i18n(cfg.locale).components.transcludes.linkToOriginal,
                  }],
                }]
          ),
        ]
      } finally {
        visited.delete(transcludeTarget)
      }
    }
  }

  walk(root)
}

export function renderPage(
  cfg: GlobalConfiguration,
  slug: FullSlug,
  componentData: QuartzComponentProps,
  components: RenderComponents,
  pageResources: StaticResources,
  treeTransforms?: TreeTransform[],
): string {
  // make a deep copy of the tree so we don't remove the transclusion references
  // for the file cached in contentMap in build.ts
  const root = clone(componentData.tree) as Root
  const visited = new Set<FullSlug>([slug])
  renderTranscludes(root, cfg, slug, componentData, visited, treeTransforms)

  // Run plugin-provided tree transforms (e.g. resolving inline bases codeblocks)
  if (treeTransforms) {
    for (const transform of treeTransforms) {
      transform(root, slug, componentData)
    }
  }

  // set componentData.tree to the edited html that has transclusions rendered
  componentData.tree = root

  const {
    head: Head,
    header,
    beforeBody,
    pageBody: Content,
    afterBody,
    left,
    right,
    footer,
    frame: frameName,
    sidebars,
  } = components
  const Body = BodyConstructor()
  const frame = resolveFrame(frameName)

  const lang = componentData.fileData.frontmatter?.lang ?? cfg.locale?.split("-")[0] ?? "en"
  const direction = i18n(cfg.locale).direction ?? "ltr"
  // During local dev (--serve), the dev server serves from root without the
  // baseUrl subpath, so basePath must be empty to avoid broken links.
  const basePath =
    componentData.ctx.argv.serve || !cfg.baseUrl
      ? ""
      : new URL(`https://${cfg.baseUrl}`).pathname.replace(/\/$/, "")
  const doc = (
    <html lang={lang} dir={direction}>
      <Head {...componentData} />
      <body data-slug={slug} data-basepath={basePath}>
        {frame.css && <style dangerouslySetInnerHTML={{ __html: frame.css }} />}
        <div id="quartz-root" class="page" data-frame={frame.name}>
          <Body {...componentData}>
            {[
              frame.render({
                componentData,
                head: Head,
                header,
                beforeBody,
                pageBody: Content,
                afterBody,
                left,
                right,
                footer,
                sidebars: { left: sidebars?.left ?? "fit", right: sidebars?.right ?? "fit" },
              }),
            ]}
          </Body>
        </div>
      </body>
      {pageResources.js
        .filter((resource) => resource.loadTime === "afterDOMReady")
        .map((res) => JSResourceToScriptElement(res, true))}
    </html>
  )

  return "<!DOCTYPE html>\n" + render(doc)
}
