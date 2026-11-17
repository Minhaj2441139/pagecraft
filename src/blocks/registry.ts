import type { Block, BlockPropsMap, BlockStyle, BlockType } from "@pagecraft/export";

import { createId } from "@/lib/id";

/* ------------------------------------------------------------------ fields */

export interface SelectOption {
  value: string;
  label: string;
}

/** Field kinds for one item inside a list prop (features, plans, FAQ, links). */
export type ItemField =
  | { kind: "text" | "textarea" | "url"; key: string; label: string }
  | { kind: "checkbox"; key: string; label: string }
  /** string[] edited as one entry per line. */
  | { kind: "lines"; key: string; label: string };

export type PropField =
  | { kind: "text" | "textarea" | "url"; key: string; label: string }
  | { kind: "select"; key: string; label: string; options: SelectOption[]; numeric?: boolean }
  | { kind: "number"; key: string; label: string; min: number; max: number; step?: number }
  | {
      kind: "list";
      key: string;
      label: string;
      itemLabel: string;
      itemFields: ItemField[];
      createItem: () => Record<string, unknown>;
    };

/* -------------------------------------------------------------- definitions */

export type PaletteCategory = "Layout" | "Content" | "Sections";

export interface BlockDefinition<T extends BlockType = BlockType> {
  type: T;
  label: string;
  description: string;
  /** Short glyph shown in the palette; decorative. */
  glyph: string;
  category: PaletteCategory;
  /** Hidden blocks (column) are created by their parent, never from the palette. */
  inPalette: boolean;
  createProps: () => BlockPropsMap[T];
  defaultStyle: () => BlockStyle;
  fields: PropField[];
}

type DefinitionMap = { [K in BlockType]: BlockDefinition<K> };

const linkItemFields: ItemField[] = [
  { kind: "text", key: "label", label: "Label" },
  { kind: "url", key: "href", label: "Link URL" },
];

export const BLOCK_DEFINITIONS: DefinitionMap = {
  hero: {
    type: "hero",
    label: "Hero",
    description: "Big headline, subtitle and call to action",
    glyph: "★",
    category: "Sections",
    inPalette: true,
    createProps: () => ({
      title: "Build something people love",
      subtitle: "A short sentence that explains what you do and why it matters.",
      ctaLabel: "Get started",
      ctaHref: "#",
    }),
    defaultStyle: () => ({ paddingY: 64, align: "center", background: "#eef2ff" }),
    fields: [
      { kind: "text", key: "title", label: "Title" },
      { kind: "textarea", key: "subtitle", label: "Subtitle" },
      { kind: "text", key: "ctaLabel", label: "Button label" },
      { kind: "url", key: "ctaHref", label: "Button link" },
    ],
  },
  heading: {
    type: "heading",
    label: "Heading",
    description: "Section title (H1–H3)",
    glyph: "H",
    category: "Content",
    inPalette: true,
    createProps: () => ({ text: "Section heading", level: 2 }),
    defaultStyle: () => ({}),
    fields: [
      { kind: "text", key: "text", label: "Text" },
      {
        kind: "select",
        key: "level",
        label: "Level",
        numeric: true,
        options: [
          { value: "1", label: "H1" },
          { value: "2", label: "H2" },
          { value: "3", label: "H3" },
        ],
      },
    ],
  },
  text: {
    type: "text",
    label: "Text",
    description: "Paragraphs of body copy",
    glyph: "¶",
    category: "Content",
    inPalette: true,
    createProps: () => ({
      text: "Write a short paragraph here. Leave a blank line to start a new paragraph.",
    }),
    defaultStyle: () => ({}),
    fields: [{ kind: "textarea", key: "text", label: "Text" }],
  },
  image: {
    type: "image",
    label: "Image",
    description: "Picture with optional caption",
    glyph: "▣",
    category: "Content",
    inPalette: true,
    createProps: () => ({ src: "", alt: "", caption: "" }),
    defaultStyle: () => ({}),
    fields: [
      { kind: "url", key: "src", label: "Image URL" },
      { kind: "text", key: "alt", label: "Alt text" },
      { kind: "text", key: "caption", label: "Caption" },
    ],
  },
  button: {
    type: "button",
    label: "Button",
    description: "Link styled as a button",
    glyph: "⏺",
    category: "Content",
    inPalette: true,
    createProps: () => ({ label: "Click me", href: "#", variant: "solid" }),
    defaultStyle: () => ({}),
    fields: [
      { kind: "text", key: "label", label: "Label" },
      { kind: "url", key: "href", label: "Link URL" },
      {
        kind: "select",
        key: "variant",
        label: "Variant",
        options: [
          { value: "solid", label: "Solid" },
          { value: "outline", label: "Outline" },
        ],
      },
    ],
  },
  columns: {
    type: "columns",
    label: "Columns",
    description: "Side-by-side columns you can drop blocks into",
    glyph: "▥",
    category: "Layout",
    inPalette: true,
    createProps: () => ({ gap: 24 }),
    defaultStyle: () => ({}),
    fields: [{ kind: "number", key: "gap", label: "Gap (px)", min: 0, max: 96, step: 4 }],
  },
  column: {
    type: "column",
    label: "Column",
    description: "A single column",
    glyph: "▯",
    category: "Layout",
    inPalette: false,
    createProps: () => ({}),
    defaultStyle: () => ({}),
    fields: [],
  },
  features: {
    type: "features",
    label: "Features grid",
    description: "Grid of feature cards",
    glyph: "▦",
    category: "Sections",
    inPalette: true,
    createProps: () => ({
      heading: "Everything you need",
      items: [
        { title: "Fast", description: "Pages load in a blink on every device." },
        { title: "Flexible", description: "Drag, drop and rearrange blocks freely." },
        { title: "Portable", description: "Export clean static HTML anywhere." },
      ],
    }),
    defaultStyle: () => ({ paddingY: 56, align: "center" }),
    fields: [
      { kind: "text", key: "heading", label: "Heading" },
      {
        kind: "list",
        key: "items",
        label: "Features",
        itemLabel: "Feature",
        itemFields: [
          { kind: "text", key: "title", label: "Title" },
          { kind: "textarea", key: "description", label: "Description" },
        ],
        createItem: () => ({ title: "New feature", description: "Describe it." }),
      },
    ],
  },
  pricing: {
    type: "pricing",
    label: "Pricing",
    description: "Pricing plans side by side",
    glyph: "$",
    category: "Sections",
    inPalette: true,
    createProps: () => ({
      heading: "Simple pricing",
      plans: [
        { name: "Starter", price: "$0", period: "/mo", features: ["1 site", "Community support"], ctaLabel: "Start free", ctaHref: "#", highlighted: false },
        { name: "Pro", price: "$19", period: "/mo", features: ["10 sites", "Custom domains", "Priority support"], ctaLabel: "Go Pro", ctaHref: "#", highlighted: true },
        { name: "Team", price: "$49", period: "/mo", features: ["Unlimited sites", "Roles & permissions", "SLA"], ctaLabel: "Contact sales", ctaHref: "#", highlighted: false },
      ],
    }),
    defaultStyle: () => ({ paddingY: 56, align: "center" }),
    fields: [
      { kind: "text", key: "heading", label: "Heading" },
      {
        kind: "list",
        key: "plans",
        label: "Plans",
        itemLabel: "Plan",
        itemFields: [
          { kind: "text", key: "name", label: "Name" },
          { kind: "text", key: "price", label: "Price" },
          { kind: "text", key: "period", label: "Period" },
          { kind: "lines", key: "features", label: "Features (one per line)" },
          { kind: "text", key: "ctaLabel", label: "Button label" },
          { kind: "url", key: "ctaHref", label: "Button link" },
          { kind: "checkbox", key: "highlighted", label: "Highlight this plan" },
        ],
        createItem: () => ({ name: "Plan", price: "$0", period: "/mo", features: ["Feature"], ctaLabel: "Choose", ctaHref: "#", highlighted: false }),
      },
    ],
  },
  faq: {
    type: "faq",
    label: "FAQ",
    description: "Expandable questions and answers",
    glyph: "?",
    category: "Sections",
    inPalette: true,
    createProps: () => ({
      heading: "Frequently asked questions",
      items: [
        { question: "Can I cancel anytime?", answer: "Yes. There are no long-term contracts." },
        { question: "Do you offer refunds?", answer: "We refund within 30 days, no questions asked." },
      ],
    }),
    defaultStyle: () => ({ paddingY: 56 }),
    fields: [
      { kind: "text", key: "heading", label: "Heading" },
      {
        kind: "list",
        key: "items",
        label: "Questions",
        itemLabel: "Question",
        itemFields: [
          { kind: "text", key: "question", label: "Question" },
          { kind: "textarea", key: "answer", label: "Answer" },
        ],
        createItem: () => ({ question: "New question?", answer: "Answer." }),
      },
    ],
  },
  footer: {
    type: "footer",
    label: "Footer",
    description: "Copyright line and links",
    glyph: "▁",
    category: "Sections",
    inPalette: true,
    createProps: () => ({
      text: "© 2026 Your Company",
      links: [
        { label: "Privacy", href: "#" },
        { label: "Terms", href: "#" },
      ],
    }),
    defaultStyle: () => ({ background: "#111827", textColor: "#f9fafb", paddingY: 32 }),
    fields: [
      { kind: "text", key: "text", label: "Text" },
      { kind: "list", key: "links", label: "Links", itemLabel: "Link", itemFields: linkItemFields, createItem: () => ({ label: "Link", href: "#" }) },
    ],
  },
};

export const BLOCK_TYPES = Object.keys(BLOCK_DEFINITIONS) as BlockType[];

export function getDefinition<T extends BlockType>(type: T): BlockDefinition<T> {
  return BLOCK_DEFINITIONS[type] as BlockDefinition<T>;
}

export const PALETTE_CATEGORIES: PaletteCategory[] = ["Layout", "Content", "Sections"];

export const PALETTE_BLOCKS: BlockDefinition[] = BLOCK_TYPES.map((t) => BLOCK_DEFINITIONS[t] as BlockDefinition).filter(
  (d) => d.inPalette,
);

/* ---------------------------------------------------------------- factories */

export const DEFAULT_COLUMN_COUNT = 2;
export const MIN_COLUMNS = 1;
export const MAX_COLUMNS = 4;

export function createBlock<T extends BlockType>(type: T, parentId: string | null = null): Block<T> {
  const def = getDefinition(type);
  return {
    id: createId(),
    type,
    props: def.createProps(),
    style: def.defaultStyle(),
    parentId,
    children: [],
  } as Block<T>;
}

/**
 * Create a block plus any children it needs to be valid. The first element is
 * the subtree root; a `columns` block comes with its empty `column` children.
 */
export function createBlockSubtree(type: BlockType, parentId: string | null = null): Block[] {
  const root = createBlock(type, parentId);
  if (root.type !== "columns") return [root];
  const columns = Array.from({ length: DEFAULT_COLUMN_COUNT }, () => createBlock("column", root.id));
  return [{ ...root, children: columns.map((c) => c.id) }, ...columns];
}

/* ------------------------------------------------------------------ nesting */

/**
 * Which block types may sit directly inside a parent. `null` is the page root.
 * Columns cannot nest inside a column (keeps layouts sane); columns only hold
 * column blocks, and a column is only ever created by its columns block.
 */
export function canContain(parentType: BlockType | null, childType: BlockType): boolean {
  if (childType === "column") return parentType === "columns";
  if (parentType === null) return true;
  if (parentType === "column") return childType !== "columns";
  return false;
}

export function isContainerType(type: BlockType): boolean {
  return type === "columns" || type === "column";
}
