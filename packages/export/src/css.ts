import { safeColor } from "./escape";
import type { Block, BlockStyle } from "./schema";

/**
 * Shared stylesheet for the editor canvas and exported pages. Responsive rules
 * use container queries on `.pc-page`, so the same CSS responds to the canvas
 * width in the editor and to the viewport width in an exported file.
 */
export const BASE_CSS = `
.pc-page{container-type:inline-size;margin:0;font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color:#111827;background:#fff;line-height:1.6;font-size:16px;-webkit-font-smoothing:antialiased}
.pc-page *,.pc-page *::before,.pc-page *::after{box-sizing:border-box}
:where(.pc-page) :where(h1,h2,h3,p,figure,ul){margin:0}
:where(.pc-page) a{color:inherit}
.pc-block{padding:24px}
.pc-block>*{max-width:1120px;margin-left:auto;margin-right:auto}
.pc-h1{font-size:2.75em;line-height:1.1;font-weight:800;letter-spacing:-.02em}
.pc-h2{font-size:2em;line-height:1.2;font-weight:700;letter-spacing:-.01em}
.pc-h3{font-size:1.4em;line-height:1.3;font-weight:600}
.pc-text p+p{margin-top:.75em}
.pc-hero{padding:40px 0}
.pc-hero>*+*{margin-top:20px}
.pc-hero-title{font-size:3.25em;line-height:1.05;font-weight:800;letter-spacing:-.03em}
.pc-hero-subtitle{font-size:1.25em;opacity:.8;max-width:40em}
.pc-align-center .pc-hero-subtitle{margin-left:auto;margin-right:auto}
.pc-align-right .pc-hero-subtitle{margin-left:auto}
.pc-btn{display:inline-block;padding:.7em 1.4em;border-radius:8px;font-weight:600;text-decoration:none;border:2px solid #4f46e5;line-height:1.2}
.pc-btn-solid{background:#4f46e5;color:#fff}
.pc-btn-outline{background:transparent;color:#4f46e5}
:where(.pc-page) a.pc-btn-solid{color:#fff}
.pc-figure img{display:block;width:100%;height:auto;border-radius:12px}
.pc-figure figcaption{margin-top:8px;font-size:.875em;opacity:.7}
.pc-img-placeholder{aspect-ratio:16/9;display:grid;place-items:center;background:#f3f4f6;border:2px dashed #d1d5db;border-radius:12px;color:#6b7280;font-size:.9em}
.pc-section-title{font-size:2em;font-weight:700;line-height:1.2;margin-bottom:32px}
.pc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.pc-card{padding:24px;border:1px solid rgba(17,24,39,.12);border-radius:12px;text-align:left}
.pc-card h3{font-size:1.15em;font-weight:600;margin-bottom:8px}
.pc-card p{opacity:.8}
.pc-plan{display:flex;flex-direction:column;gap:16px}
.pc-plan-highlight{border:2px solid #4f46e5;box-shadow:0 10px 30px rgba(79,70,229,.15)}
.pc-price{font-size:2.25em;font-weight:800;line-height:1.1}
.pc-period{font-size:.4em;font-weight:500;opacity:.7;margin-left:4px}
.pc-plan ul{list-style:none;padding:0;display:grid;gap:8px;flex:1}
.pc-plan li::before{content:"\\2713";color:#4f46e5;margin-right:8px;font-weight:700}
.pc-plan .pc-btn{text-align:center}
.pc-faq-item{border-bottom:1px solid rgba(17,24,39,.12);padding:16px 0;text-align:left}
.pc-faq-item summary{cursor:pointer;font-weight:600;font-size:1.1em}
.pc-faq-item p{margin-top:8px;opacity:.85}
.pc-footer-inner{display:flex;flex-wrap:wrap;justify-content:space-between;gap:16px;align-items:center}
.pc-footer-inner nav{display:flex;gap:16px;flex-wrap:wrap}
.pc-footer-inner a{text-decoration:none;opacity:.8}
.pc-columns-grid{display:grid;gap:24px}
.pc-column{padding:0;min-width:0}
.pc-column>*{max-width:none}
@container (max-width: 900px){.pc-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.pc-hero-title{font-size:2.6em}}
@container (max-width: 640px){.pc-grid,.pc-columns-grid{grid-template-columns:minmax(0,1fr)!important}.pc-hero-title{font-size:2.1em}.pc-h1{font-size:2.1em}.pc-section-title{font-size:1.6em}.pc-block{padding-left:16px;padding-right:16px}}
`.trim();

export type StyleDeclarations = Array<[cssProperty: string, value: string]>;

export function blockStyleDeclarations(style: BlockStyle): StyleDeclarations {
  const out: StyleDeclarations = [];
  const color = safeColor(style.textColor);
  const background = safeColor(style.background);
  if (color) out.push(["color", color]);
  if (background) out.push(["background", background]);
  if (isFiniteNumber(style.paddingY)) {
    out.push(["padding-top", `${style.paddingY}px`], ["padding-bottom", `${style.paddingY}px`]);
  }
  if (isFiniteNumber(style.paddingX)) {
    out.push(["padding-left", `${style.paddingX}px`], ["padding-right", `${style.paddingX}px`]);
  }
  if (isFiniteNumber(style.fontSize)) out.push(["font-size", `${style.fontSize}px`]);
  if (style.align) out.push(["text-align", style.align]);
  return out;
}

export function blockStyleToCss(style: BlockStyle): string {
  return blockStyleDeclarations(style)
    .map(([prop, value]) => `${prop}:${value}`)
    .join(";");
}

/** Same declarations keyed in camelCase, suitable for a React `style` prop. */
export function blockStyleToObject(style: BlockStyle): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [prop, value] of blockStyleDeclarations(style)) {
    out[prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = value;
  }
  return out;
}

export function blockClassName(block: Block): string {
  const classes = ["pc-block", `pc-${block.type}`];
  if (block.style.align) classes.push(`pc-align-${block.style.align}`);
  return classes.join(" ");
}

export type WrapperTag = "section" | "footer" | "div";

export function blockWrapperTag(type: Block["type"]): WrapperTag {
  switch (type) {
    case "hero":
    case "features":
    case "pricing":
    case "faq":
      return "section";
    case "footer":
      return "footer";
    default:
      return "div";
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
