import { BASE_CSS, blockClassName, blockStyleToCss, blockWrapperTag } from "./css";
import { escapeHtml, safeUrl } from "./escape";
import type { Block, PageDocument, PageTree } from "./schema";

/** Escape text and turn blank-line-separated paragraphs / single newlines into HTML. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function link(label: string, href: string, className: string): string {
  return `<a class="${className}" href="${escapeHtml(safeUrl(href))}">${escapeHtml(label)}</a>`;
}

function sectionTitle(text: string): string {
  return text ? `<h2 class="pc-section-title">${escapeHtml(text)}</h2>` : "";
}

/**
 * Inner HTML for a leaf block (everything inside its wrapper element).
 * Container blocks (`columns`, `column`) return an empty string; their
 * children are rendered by `renderBlock`.
 */
export function renderBlockContent(block: Block): string {
  switch (block.type) {
    case "hero": {
      const { title, subtitle, ctaLabel, ctaHref } = block.props;
      return (
        `<div class="pc-hero">` +
        `<h1 class="pc-hero-title">${escapeHtml(title)}</h1>` +
        (subtitle ? `<p class="pc-hero-subtitle">${escapeHtml(subtitle)}</p>` : "") +
        (ctaLabel ? `<div>${link(ctaLabel, ctaHref, "pc-btn pc-btn-solid")}</div>` : "") +
        `</div>`
      );
    }
    case "heading": {
      const level = [1, 2, 3].includes(block.props.level) ? block.props.level : 2;
      return `<h${level} class="pc-heading pc-h${level}">${escapeHtml(block.props.text)}</h${level}>`;
    }
    case "text":
      return `<div class="pc-text">${textToHtml(block.props.text)}</div>`;
    case "image": {
      const { src, alt, caption } = block.props;
      const media = src.trim()
        ? `<img src="${escapeHtml(safeUrl(src, { allowDataImage: true }))}" alt="${escapeHtml(alt)}" loading="lazy">`
        : `<div class="pc-img-placeholder" role="img" aria-label="${escapeHtml(alt || "Image placeholder")}">Add an image URL</div>`;
      return (
        `<figure class="pc-figure">${media}` +
        (caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : "") +
        `</figure>`
      );
    }
    case "button": {
      const variant = block.props.variant === "outline" ? "outline" : "solid";
      return `<div>${link(block.props.label, block.props.href, `pc-btn pc-btn-${variant}`)}</div>`;
    }
    case "features":
      return (
        `<div class="pc-features">${sectionTitle(block.props.heading)}<div class="pc-grid">` +
        block.props.items
          .map(
            (item) =>
              `<div class="pc-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p></div>`,
          )
          .join("") +
        `</div></div>`
      );
    case "pricing":
      return (
        `<div class="pc-pricing">${sectionTitle(block.props.heading)}<div class="pc-grid">` +
        block.props.plans
          .map(
            (plan) =>
              `<div class="pc-card pc-plan${plan.highlighted ? " pc-plan-highlight" : ""}">` +
              `<h3>${escapeHtml(plan.name)}</h3>` +
              `<p class="pc-price">${escapeHtml(plan.price)}` +
              (plan.period ? `<span class="pc-period">${escapeHtml(plan.period)}</span>` : "") +
              `</p>` +
              `<ul>${plan.features
                .filter((f) => f.trim())
                .map((f) => `<li>${escapeHtml(f)}</li>`)
                .join("")}</ul>` +
              (plan.ctaLabel
                ? link(plan.ctaLabel, plan.ctaHref, `pc-btn pc-btn-${plan.highlighted ? "solid" : "outline"}`)
                : "") +
              `</div>`,
          )
          .join("") +
        `</div></div>`
      );
    case "faq":
      return (
        `<div class="pc-faq">${sectionTitle(block.props.heading)}` +
        block.props.items
          .map(
            (item) =>
              `<details class="pc-faq-item"><summary>${escapeHtml(item.question)}</summary><p>${escapeHtml(item.answer)}</p></details>`,
          )
          .join("") +
        `</div>`
      );
    case "footer":
      return (
        `<div class="pc-footer-inner"><p>${escapeHtml(block.props.text)}</p>` +
        (block.props.links.length
          ? `<nav aria-label="Footer">${block.props.links.map((l) => link(l.label, l.href, "pc-footer-link")).join("")}</nav>`
          : "") +
        `</div>`
      );
    case "columns":
    case "column":
      return "";
  }
}

function styleAttr(block: Block): string {
  const css = blockStyleToCss(block.style);
  return css ? ` style="${escapeHtml(css)}"` : "";
}

/** Inline style for the grid inside a `columns` block. */
export function columnsGridStyle(columnCount: number, gap: number): string {
  const safeGap = Number.isFinite(gap) ? Math.max(0, gap) : 24;
  return `grid-template-columns:repeat(${Math.max(1, columnCount)},minmax(0,1fr));gap:${safeGap}px`;
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
