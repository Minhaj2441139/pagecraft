/**
 * Whole-document HTML export. Published as the `@pagecraft/export/html`
 * subpath so apps can load it on demand (the editor canvas only needs the
 * per-block renderer in `./render`).
 */
import { BASE_CSS, blockClassName, blockStyleToCss, blockWrapperTag } from "./css";
import { escapeHtml } from "./escape";
import { columnsGridStyle, renderBlockContent } from "./render";
import type { Block, PageDocument, PageTree } from "./schema";

function styleAttr(block: Block): string {
  const css = blockStyleToCss(block.style);
  return css ? ` style="${escapeHtml(css)}"` : "";
}

/** Render a block and its descendants. `seen` guards against malformed (cyclic) trees. */
export function renderBlock(tree: PageTree, id: string, seen: Set<string> = new Set()): string {
  const block = tree.blocks[id];
  if (!block || seen.has(id)) return "";
  seen.add(id);
  const children = () => block.children.map((childId) => renderBlock(tree, childId, seen)).join("");

  if (block.type === "columns") {
    return (
      `<div class="${blockClassName(block)}"${styleAttr(block)}>` +
      `<div class="pc-columns-grid" style="${columnsGridStyle(block.children.length, block.props.gap)}">` +
      children() +
      `</div></div>`
    );
  }
  if (block.type === "column") {
    return `<div class="${blockClassName(block)}"${styleAttr(block)}>${children()}</div>`;
  }
  const tag = blockWrapperTag(block.type);
  return `<${tag} class="${blockClassName(block)}"${styleAttr(block)}>${renderBlockContent(block)}</${tag}>`;
}

export function renderPageBody(tree: PageTree): string {
  const seen = new Set<string>();
  return tree.rootIds.map((id) => renderBlock(tree, id, seen)).join("\n");
}

export interface RenderPageOptions {
  /** Defaults to the document name. */
  title?: string;
  lang?: string;
}

export function renderPageToHtml(doc: PageDocument, options: RenderPageOptions = {}): string {
  const title = options.title ?? (doc.name || "Untitled page");
  const lang = options.lang ?? "en";
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="Pagecraft">
<title>${escapeHtml(title)}</title>
<style>
body{margin:0}
${BASE_CSS}
</style>
</head>
<body>
<main class="pc-page">
${renderPageBody(doc)}
</main>
</body>
</html>
`;
}
