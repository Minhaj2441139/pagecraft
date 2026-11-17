import type { Block } from "@pagecraft/export";

import { getDefinition } from "./registry";

function truncate(text: string, max = 40): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Short human description of a block's content, used for ARIA labels and the layers UI. */
export function summarizeBlock(block: Block): string {
  switch (block.type) {
    case "hero":
      return truncate(block.props.title);
    case "heading":
      return truncate(block.props.text);
    case "text":
      return truncate(block.props.text);
    case "image":
      return truncate(block.props.alt || block.props.caption || "No image");
    case "button":
      return truncate(block.props.label);
    case "features":
    case "pricing":
    case "faq":
      return truncate(block.props.heading);
    case "footer":
      return truncate(block.props.text);
    case "columns":
      return `${block.children.length} columns`;
    case "column":
      return `${block.children.length} ${block.children.length === 1 ? "block" : "blocks"}`;
  }
}

export function blockAriaLabel(block: Block): string {
  const summary = summarizeBlock(block);
  const label = getDefinition(block.type).label;
  return summary ? `${label}: ${summary}` : label;
}
