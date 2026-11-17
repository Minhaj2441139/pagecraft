/**
 * Pagecraft document schema.
 *
 * A page is a normalized tree: every block lives in `blocks` keyed by id and
 * points at its parent; containers list their children in order. Only `root`
 * (via `rootIds`), `columns` and `column` blocks have children.
 */

export const SCHEMA_VERSION = 1;

export type Align = "left" | "center" | "right";

export interface BlockStyle {
  textColor?: string;
  background?: string;
  /** Vertical padding in px. */
  paddingY?: number;
  /** Horizontal padding in px. */
  paddingX?: number;
  /** Base font size in px. */
  fontSize?: number;
  align?: Align;
}

export interface FeatureItem {
  title: string;
  description: string;
}

export interface PricingPlan {
  name: string;
  price: string;
  period: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface LinkItem {
  label: string;
  href: string;
}

export interface BlockPropsMap {
  hero: { title: string; subtitle: string; ctaLabel: string; ctaHref: string };
  heading: { text: string; level: 1 | 2 | 3 };
  text: { text: string };
  image: { src: string; alt: string; caption: string };
  button: { label: string; href: string; variant: "solid" | "outline" };
  columns: { gap: number };
  column: Record<string, never>;
  features: { heading: string; items: FeatureItem[] };
  pricing: { heading: string; plans: PricingPlan[] };
  faq: { heading: string; items: FaqItem[] };
  footer: { text: string; links: LinkItem[] };
}

export type BlockType = keyof BlockPropsMap;

/** Discriminated union over every block type. */
export type Block<T extends BlockType = BlockType> = {
  [K in T]: {
    id: string;
    type: K;
    props: BlockPropsMap[K];
    style: BlockStyle;
    parentId: string | null;
    children: string[];
  };
}[T];

export type BlockMap = Record<string, Block>;

export interface PageTree {
  rootIds: string[];
  blocks: BlockMap;
}

export interface PageDocument extends PageTree {
  version: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export const CONTAINER_TYPES: ReadonlySet<BlockType> = new Set(["columns", "column"]);

export function isBlockOfType<T extends BlockType>(block: Block, type: T): block is Block<T> {
  return block.type === type;
}
