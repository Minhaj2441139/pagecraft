import type { Block, BlockMap, BlockStyle, BlockType, PageDocument } from "@pagecraft/export";

import { createEmptyDocument } from "@/store/editor";

import { createBlock } from "./registry";

/** Declarative description of a block for building templates. */
export interface BlockSpec {
  type: Exclude<BlockType, "column">;
  props?: Record<string, unknown>;
  style?: BlockStyle;
  /** For `columns`: one list of child specs per column. */
  columns?: BlockSpec[][];
}

export function buildDocument(name: string, specs: BlockSpec[]): PageDocument {
  const doc = createEmptyDocument(name);
  const blocks: BlockMap = {};

  const make = (spec: BlockSpec, parentId: string | null): string => {
    const base = createBlock(spec.type, parentId);
    const block = {
      ...base,
      props: { ...base.props, ...spec.props },
      style: { ...base.style, ...spec.style },
    } as Block;
    blocks[block.id] = block;
    if (spec.type === "columns") {
      const columnSpecs = spec.columns ?? [[], []];
      block.children = columnSpecs.map((childSpecs) => {
        const column = createBlock("column", block.id);
        blocks[column.id] = column;
        column.children = childSpecs.map((child) => make(child, column.id));
        return column.id;
      });
    }
    return block.id;
  };

  doc.rootIds = specs.map((spec) => make(spec, null));
  doc.blocks = blocks;
  return doc;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  /** Hidden templates (e.g. the stress test) are reachable by URL only. */
  hidden?: boolean;
  build: () => PageDocument;
}

const saas = (): PageDocument =>
  buildDocument("SaaS launch", [
    {
      type: "hero",
      props: {
        title: "Ship landing pages in minutes, not sprints",
        subtitle: "Pagecraft lets your marketing team build, preview and export pages without waiting on engineering.",
        ctaLabel: "Start free trial",
      },
      style: { paddingY: 96, align: "center", background: "#eef2ff" },
    },
    {
      type: "features",
      props: {
        heading: "Why teams switch",
        items: [
          { title: "Drag and drop", description: "Compose pages from tested blocks. No CSS required." },
          { title: "Responsive by default", description: "Every block adapts to desktop, tablet and phone." },
          { title: "Own your HTML", description: "Export a single static file and host it anywhere." },
        ],
      },
    },
    {
      type: "columns",
      style: { paddingY: 48 },
      columns: [
        [
          { type: "heading", props: { text: "Built for speed", level: 2 } },
          {
            type: "text",
            props: { text: "Exported pages are plain HTML and CSS: no framework, no runtime, nothing to hydrate.\n\nThey score well on Core Web Vitals out of the box." },
          },
          { type: "button", props: { label: "See the docs", variant: "outline" } },
        ],
        [{ type: "image", props: { src: "", alt: "Product screenshot", caption: "Replace with your product screenshot" } }],
      ],
    },
    { type: "pricing" },
    { type: "faq" },
    { type: "footer", props: { text: "© 2026 Pagecraft Inc." } },
  ]);

const event = (): PageDocument =>
  buildDocument("Conference", [
    {
      type: "hero",
      props: {
        title: "FrontConf 2027",
        subtitle: "Two days of talks on the web platform. 14–15 May, Melbourne.",
        ctaLabel: "Get your ticket",
      },
      style: { paddingY: 112, align: "center", background: "#0f172a", textColor: "#f8fafc" },
    },
    {
      type: "columns",
      style: { paddingY: 56 },
      columns: [
        [
          { type: "heading", props: { text: "Day one", level: 3 } },
          { type: "text", props: { text: "Performance, rendering and the future of CSS." } },
        ],
        [
          { type: "heading", props: { text: "Day two", level: 3 } },
          { type: "text", props: { text: "Accessibility, design systems and tooling." } },
        ],
        [
          { type: "heading", props: { text: "Workshops", level: 3 } },
          { type: "text", props: { text: "Hands-on sessions in small groups, limited seats." } },
        ],
      ],
    },
    {
      type: "pricing",
      props: {
        heading: "Tickets",
        plans: [
          { name: "Early bird", price: "$299", period: "", features: ["Both days", "Lunch included"], ctaLabel: "Buy", ctaHref: "#", highlighted: false },
          { name: "Full pass", price: "$449", period: "", features: ["Both days", "Workshops", "Speaker dinner"], ctaLabel: "Buy", ctaHref: "#", highlighted: true },
        ],
      },
    },
    {
      type: "faq",
      props: {
        heading: "Good to know",
        items: [
          { question: "Is there a code of conduct?", answer: "Yes, and it is enforced. Read it before you come." },
          { question: "Will talks be recorded?", answer: "All main-stage talks are published within a week." },
        ],
      },
    },
    { type: "footer", props: { text: "FrontConf · Melbourne" } },
  ]);

const app = (): PageDocument =>
  buildDocument("Mobile app", [
    {
      type: "hero",
      props: { title: "Your habits, finally on track", subtitle: "Tiny daily check-ins. Big long-term change.", ctaLabel: "Download for iOS" },
      style: { paddingY: 88, align: "left", background: "#ecfdf5" },
    },
    {
      type: "features",
      props: {
        heading: "",
        items: [
          { title: "Streaks", description: "See your progress at a glance." },
          { title: "Reminders", description: "Nudges at the time that suits you." },
          { title: "Private", description: "Your data stays on your phone." },
        ],
      },
      style: { paddingY: 40 },
    },
    { type: "heading", props: { text: "Loved by 40,000 people", level: 2 }, style: { align: "center", paddingY: 32 } },
    { type: "text", props: { text: "“The only habit app I have kept using past the first week.”" }, style: { align: "center", fontSize: 20 } },
    { type: "button", props: { label: "Get the app", href: "#" }, style: { align: "center", paddingY: 40 } },
    { type: "footer", props: { text: "© 2026 Habitly" } },
  ]);

/** 200+ blocks for performance profiling. Sizes are deterministic. */
export function buildStressDocument(sections = 30): PageDocument {
  const specs: BlockSpec[] = [];
  for (let i = 0; i < sections; i++) {
    specs.push({ type: "heading", props: { text: `Section ${i + 1}`, level: 2 } });
    specs.push({ type: "text", props: { text: `Paragraph for section ${i + 1}. `.repeat(6) } });
    specs.push({
      type: "columns",
      columns: [
        [{ type: "text", props: { text: `Left column ${i + 1}` } }],
        [{ type: "button", props: { label: `Action ${i + 1}` } }],
      ],
    });
  }
  // 30 sections x (heading + text + columns + 2 columns + 2 leaves) = 210 blocks.
  return buildDocument("Stress test (200+ blocks)", specs);
}

export const TEMPLATES: Template[] = [
  { id: "blank", name: "Blank page", description: "Start from nothing.", build: () => createEmptyDocument("Untitled page") },
  { id: "saas", name: "SaaS launch", description: "Hero, features, pricing and FAQ.", build: saas },
  { id: "event", name: "Conference", description: "Dark hero, schedule columns and tickets.", build: event },
  { id: "app", name: "Mobile app", description: "Short, punchy app promo page.", build: app },
  { id: "stress", name: "Stress test", description: "210 blocks for profiling.", hidden: true, build: () => buildStressDocument() },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
