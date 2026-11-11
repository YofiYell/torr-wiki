import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { visit } from "unist-util-visit"
import type { Element, ElementContent, Root } from "hast"
import type { VFile } from "vfile"
import type { BuildCtx } from "../../util/ctx"
import type { QuartzTransformerPlugin } from "../types"

/**
 * Static Basic 5e statblocks, based on Fantasy Statblocks' Basic 5e Layout
 * (Obsidian-TTRPG-Community/fantasy-statblocks, MIT, Jeremy Valentine 2023).
 * The upstream order, property labels and horizontal-rule hierarchy are
 * preserved; visuals use Quartz theme variables, never upstream parchment CSS.
 */

export type Creature = Record<string, unknown>
export interface ExportedBestiary {
  format: "quartz-fantasy-statblocks-bestiary"
  version: 1
  creatures: Record<string, Creature>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)

const string = (value: unknown): string => {
  if (value === null || value === undefined) return ""
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return String(value)
  if (Array.isArray(value)) return value.map(string).filter(Boolean).join(", ")
  return ""
}

const titleCase = (value: string): string =>
  value.replace(/(^|[\s_-])([a-z])/g, (_match, before: string, first: string) =>
    before.replace("_", " ") + first.toUpperCase(),
  )

export function loadExportedBestiary(contentRoot: string): ExportedBestiary {
  const filename = path.join(contentRoot, "_Build", "Bestiary.md")
  const source = fs.readFileSync(filename, "utf8")
  const match = /^\x60{3,}json[ \t]*\r?\n([\s\S]*?)^\x60{3,}[ \t]*\r?$/gm.exec(source)
  if (!match) throw new Error(filename + ": missing fenced json bestiary")
  let parsed: unknown
  try {
    parsed = JSON.parse(match[1])
  } catch (error) {
    throw new Error(filename + ": invalid JSON: " + String(error))
  }
  if (
    !isObject(parsed) ||
    parsed.format !== "quartz-fantasy-statblocks-bestiary" ||
    parsed.version !== 1 ||
    !isObject(parsed.creatures)
  ) {
    throw new Error(filename + ": unsupported Bestiary.md format or version")
  }
  for (const [name, creature] of Object.entries(parsed.creatures)) {
    if (!isObject(creature) || !name.trim() || creature.name !== name) {
      throw new Error(filename + ": invalid creature entry " + JSON.stringify(name))
    }
  }
  return parsed as unknown as ExportedBestiary
}

const definitionFields = [
  "ac", "hp", "hit_dice", "speed", "stats", "fage_stats", "type", "size",
  "alignment", "traits", "actions", "bonus_actions", "reactions",
  "legendary_actions", "mythic_actions", "lair_actions", "spells",
  "saves", "skillsaves", "cr", "senses", "languages",
] as const

function getCreature(name: string, bestiary: ExportedBestiary, location: string): Creature {
  const creature = bestiary.creatures[name]
  if (!creature) {
    throw new Error(location + ": Fantasy Statblocks creature " + JSON.stringify(name) +
      " was not found in _Build/Bestiary.md. Re-export Bestiary in Obsidian.")
  }
  return creature
}

export function resolveStatblock(
  yamlSource: string,
  bestiary: ExportedBestiary,
  location: string,
): Creature {
  let parsed: unknown
  try {
    parsed = YAML.parse(yamlSource, { uniqueKeys: true })
  } catch (error) {
    throw new Error(location + ": invalid statblock YAML: " + String(error))
  }
  if (!isObject(parsed)) throw new Error(location + ": statblock must be a YAML mapping")

  const explicitRef = string(parsed.creature ?? parsed.monster).trim()
  const name = string(parsed.name).trim()
  const inline = definitionFields.some((key) => parsed[key] !== undefined)
  const implicitRef = !explicitRef && !inline && name ? name : ""
  const namedReference = explicitRef || implicitRef
  if (!namedReference && !name) {
    throw new Error(location + ": statblock has neither a creature reference nor a name")
  }

  let resolved: Creature = {}
  if (namedReference) {
    resolved = { ...getCreature(namedReference, bestiary, location) }
  } else if (parsed.extends) {
    const parents = Array.isArray(parsed.extends) ? parsed.extends : [parsed.extends]
    for (const parent of parents) {
      const parentName = string(parent).trim()
      if (!parentName) continue
      resolved = { ...resolved, ...getCreature(parentName, bestiary, location) }
    }
  }
  const { creature: _creature, monster: _monster, extends: _extends, ...overrides } = parsed
  resolved = { ...resolved, ...overrides }
  if (!resolved.name) resolved.name = namedReference || name
  return resolved
}

function element(
  tagName: string,
  properties: Record<string, unknown> = {},
  children: ElementContent[] = [],
): Element {
  return { type: "element", tagName, properties, children }
}

const txt = (value: unknown): ElementContent => ({ type: "text", value: string(value) })
const cls = (name: string) => ({ className: [name] })
const line = (size: "major" | "section" = "major") =>
  element("div", { className: ["qz-statblock-rule", "qz-statblock-rule-" + size], "aria-hidden": "true" })

const markdown = unified().use(remarkParse).use(remarkRehype)
function description(text: unknown): ElementContent[] {
  const raw = string(text)
  if (!raw.trim()) return []
  const parsed = markdown.runSync(markdown.parse(raw)) as Root
  return parsed.children.filter((node): node is ElementContent => node.type !== "doctype")
}

function labeled(label: string, value: unknown): Element | undefined {
  const v = string(value)
  if (!v) return undefined
  return element("p", cls("qz-statblock-property"), [
    element("strong", cls("qz-statblock-property-name"), [txt(label + " ")]),
    txt(v),
  ])
}

function trait(item: unknown): Element {
  if (typeof item === "string") {
    return element("div", cls("qz-statblock-entry"), description(item))
  }
  if (!isObject(item)) return element("div", cls("qz-statblock-entry"), [txt(item)])
  const heading = string(item.name)
  const body = description(item.desc ?? item.description ?? item.text)
  const first = body[0]
  const nameNode = heading
    ? element("strong", cls("qz-statblock-entry-name"), [txt(heading + ". ")])
    : null

  if (first && first.type === "element" && first.tagName === "p") {
    first.children = [...(nameNode ? [nameNode] : []), ...first.children]
    return element("div", cls("qz-statblock-entry"), body)
  }
  return element("div", cls("qz-statblock-entry"), [
    ...(nameNode ? [element("p", {}, [nameNode])] : []),
    ...body,
  ])
}

function section(heading: string, entries: unknown): Element[] {
  const items = Array.isArray(entries) ? entries : entries ? [entries] : []
  if (items.length === 0) return []
  return [
    element("section", cls("qz-statblock-section"), [
      element("div", { ...cls("qz-statblock-section-title"), role: "heading", "aria-level": 4 }, [txt(heading)]),
      line("section"),
      element("div", cls("qz-statblock-entry-list"), items.map(trait)),
    ]),
  ]
}

function saveEntries(value: unknown): string {
  if (typeof value === "string") return value
  const pairs: Array<[string, unknown]> = []
  if (Array.isArray(value)) {
    for (const item of value) {
      if (isObject(item)) pairs.push(...Object.entries(item))
      else if (typeof item === "string") pairs.push([item, null])
    }
  } else if (isObject(value)) {
    pairs.push(...Object.entries(value))
  }
  return pairs.map(([name, bonus]) => {
    const num = typeof bonus === "number" ? bonus : Number(bonus)
    const signed = bonus === null || bonus === "" ? "" : Number.isFinite(num)
      ? " " + (num >= 0 ? "+" : "") + num
      : " " + string(bonus)
    return titleCase(name) + signed
  }).join(", ")
}

function abilityScores(stats: unknown): Element | undefined {
  if (!Array.isArray(stats) || stats.length === 0) return undefined
  const headings = ["Str", "Dex", "Con", "Int", "Wis", "Cha"]
  const scoreCells = stats.slice(0, headings.length).map((score, index) => {
    const n = Number(score)
    const modifier = Number.isFinite(n) ? Math.floor((n - 10) / 2) : null
    const shown = modifier === null ? string(score)
      : string(score) + " (" + (modifier >= 0 ? "+" : "") + modifier + ")"
    return element("div", cls("qz-statblock-ability"), [
      element("strong", cls("qz-statblock-ability-name"), [txt(headings[index])]),
      element("span", cls("qz-statblock-ability-score"), [txt(shown)]),
    ])
  })
  return element("div", cls("qz-statblock-abilities"), scoreCells)
}

const xpValues: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
  "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900,
  "11": 7200, "12": 8400, "13": 10000, "14": 11500,
  "15": 13000, "16": 15000, "17": 18000, "18": 20000,
  "19": 22000, "20": 25000, "21": 33000, "22": 41000,
  "23": 50000, "24": 62000, "25": 75000, "26": 90000,
  "27": 105000, "28": 120000, "29": 135000, "30": 155000,
}
function crDisplay(cr: unknown): { challenge: string; bonus: string } {
  const value = string(cr)
  if (!value) return { challenge: "", bonus: "" }
  const numeric = value.includes("/") ? value.split("/").map(Number).reduce((a, b) => a / b) : Number(value)
  const xp = xpValues[value]
  const bonus = Number.isFinite(numeric) ? Math.max(2, 2 + Math.floor((numeric - 1) / 4)) : null
  return {
    challenge: value + (xp === undefined ? "" : " (" + xp.toLocaleString("en-US") + " XP)"),
    bonus: bonus === null ? "" : "+" + bonus,
  }
}

function readable(value: unknown): string {
  if (isObject(value)) return Object.entries(value).map(([key, item]) =>
    titleCase(key) + ": " + string(item)).join(", ")
  return string(value)
}

export function renderStatblock(creature: Creature): Element {
  const name = string(creature.name) || "Unnamed Creature"
  const category = [
    string(creature.size),
    string(creature.type) + (creature.subtype ? " (" + string(creature.subtype) + ")" : ""),
    string(creature.alignment),
  ].filter(Boolean).join(", ")
  const hp = string(creature.hp) +
    (creature.hit_dice ? " (" + string(creature.hit_dice) + ")" : "")
  const ac = string(creature.ac) +
    (creature.ac_class ? " (" + string(creature.ac_class) + ")" : "")
  const challenge = crDisplay(creature.cr)
  const stats = abilityScores(creature.stats)
  const primary = [
    labeled("Armor Class", ac), labeled("Hit Points", hp),
    labeled("Speed", readable(creature.speed)),
  ].filter((node): node is Element => !!node)
  const details = [
    labeled("Saving Throws", saveEntries(creature.saves)),
    labeled("Skills", saveEntries(creature.skillsaves)),
    labeled("Damage Resistances", readable(creature.damage_resistances)),
    labeled("Damage Immunities", readable(creature.damage_immunities)),
    labeled("Condition Immunities", readable(creature.condition_immunities)),
    labeled("Damage Vulnerabilities", readable(creature.damage_vulnerabilities)),
    labeled("Senses", readable(creature.senses)),
    labeled("Languages", readable(creature.languages) || "-"),
  ].filter((node): node is Element => !!node)

  const challengeRow = creature.cr !== undefined
    ? [element("div", cls("qz-statblock-challenge"), [
      labeled("Challenge", challenge.challenge)!,
      ...(challenge.bonus ? [labeled("Proficiency Bonus",
        creature.proficiency_bonus ?? challenge.bonus)!] : []),
    ])]
    : []

  const spells = [
    ...section("Spellcasting", creature.spells),
    ...(creature.spellsNotes ? [element("div", cls("qz-statblock-entry"), description(creature.spellsNotes))] : []),
  ]

  return element("section", {
    className: ["qz-statblock", "qz-statblock-5e"],
    "aria-label": name + " statblock",
  }, [
    element("header", cls("qz-statblock-heading"), [
      element("div", { ...cls("qz-statblock-name"), role: "heading", "aria-level": 3 }, [txt(name)]),
      ...(category ? [element("p", cls("qz-statblock-type"), [txt(category)])] : []),
    ]),
    line(),
    ...(primary.length ? [element("div", cls("qz-statblock-properties"), primary), line()] : []),
    ...(stats ? [stats, line()] : []),
    ...(details.length ? [element("div", cls("qz-statblock-details"), details)] : []),
    ...challengeRow,
    ...(details.length || challengeRow.length ? [line()] : []),
    ...(Array.isArray(creature.traits) && creature.traits.length
      ? [element("div", cls("qz-statblock-entry-list"), creature.traits.map(trait))]
      : []),
    ...spells,
    ...section("Actions", creature.actions),
    ...section("Bonus Actions", creature.bonus_actions),
    ...section("Legendary Actions", creature.legendary_actions
      ? [creature.legendary_description, ...(Array.isArray(creature.legendary_actions)
        ? creature.legendary_actions : [creature.legendary_actions])].filter(Boolean)
      : []),
    ...section("Mythic Actions", creature.mythic_actions),
    ...section("Reactions", creature.reactions),
    ...section("Lair Actions", creature.lair_actions),
  ])
}

function rawText(node: ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type === "element") return node.children.map(rawText).join("")
  return ""
}

function statblockCode(node: Element): string | undefined {
  if (node.tagName !== "pre") return undefined
  const code = node.children.find((child) => child.type === "element" && child.tagName === "code")
  if (!code || code.type !== "element") return undefined
  const classes = code.properties.className ?? []
  if (!Array.isArray(classes) || !classes.some((name) => name === "language-statblock"))
    return undefined
  return code.children.map(rawText).join("")
}

export function renderStatblockError(error: unknown, location: string): Element {
  const message = error instanceof Error ? error.message : String(error)
  return element("aside", {
    className: ["qz-statblock-error"],
    role: "alert",
    "aria-label": "Statblock error",
  }, [
    element("strong", cls("qz-statblock-error-title"), [txt("Statblock error")]),
    element("p", cls("qz-statblock-error-message"), [txt(message)]),
    element("small", cls("qz-statblock-error-source"), [txt(location)]),
  ])
}

export function transformStatblocks(
  root: Root,
  bestiary: ExportedBestiary | Error,
  location: string,
): number {
  let transformed = 0
  visit(root, "element", (node, index, parent) => {
    if (index === undefined || !parent) return
    const source = statblockCode(node)
    if (source === undefined) return
    try {
      if (bestiary instanceof Error) throw bestiary
      parent.children[index] = renderStatblock(resolveStatblock(source, bestiary, location))
    } catch (error) {
      // Content mistakes are local to their fence; never suppress the page
      // or fail the site build because a creature has bad YAML or a typo.
      parent.children[index] = renderStatblockError(error, location)
    }
    transformed++
  })
  return transformed
}

export const Statblocks: QuartzTransformerPlugin = () => ({
  name: "FantasyStatblocksBasic5e",
  htmlPlugins(ctx: BuildCtx) {
    let bestiary: ExportedBestiary | Error
    try {
      bestiary = loadExportedBestiary(ctx.argv.directory)
    } catch (error) {
      // A broken Bestiary export should display localized errors rather than
      // prevent unrelated pages from deploying.
      bestiary = error instanceof Error ? error : new Error(String(error))
    }
    return [() => (tree: Root, file: VFile) => {
      transformStatblocks(tree, bestiary, string(file.data.relativePath || file.path))
    }]
  },
})
