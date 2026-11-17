import { describe, expect, it } from "vitest";

import { blockStyleToCss, blockStyleToObject } from "./css";
import { safeColor, safeUrl } from "./escape";
import { renderBlock, renderPageToHtml, textToHtml } from "./render";
import type { Block, PageDocument } from "./schema";

function block<T extends Block["type"]>(
  id: string,
  type: T,
  props: Extract<Block, { type: T }>["props"],
  extra: Partial<Pick<Block, "children" | "parentId" | "style">> = {},
): Block {
  return { id, type, props, style: {}, parentId: null, children: [], ...extra } as Block;
}

function doc(blocks: Block[], rootIds: string[]): PageDocument {
  return {
    version: 1,
    id: "p1",
    name: "My <Page>",
    createdAt: 0,
    updatedAt: 0,
    rootIds,
    blocks: Object.fromEntries(blocks.map((b) => [b.id, b])),
  };
}

describe("escaping", () => {
  it("escapes text content and attributes", () => {
    const d = doc([block("h", "heading", { text: `<script>alert("x")</script>`, level: 2 })], ["h"]);
    const html = renderPageToHtml(d);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain("<title>My &lt;Page&gt;</title>");
  });

  it("neutralises javascript: URLs", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("  JaVaScRiPt:alert(1)")).toBe("#");
    expect(safeUrl("data:text/html,hi")).toBe("#");
    expect(safeUrl("https://example.com")).toBe("https://example.com");
    expect(safeUrl("/pricing")).toBe("/pricing");
    expect(safeUrl("pricing.html")).toBe("pricing.html");
    expect(safeUrl("#faq")).toBe("#faq");
    expect(safeUrl("")).toBe("#");
    expect(safeUrl("data:image/png;base64,AAAA", { allowDataImage: true })).toBe("data:image/png;base64,AAAA");
  });

  it("rejects colour values that could break out of a style attribute", () => {
    expect(safeColor("#fff")).toBe("#fff");
    expect(safeColor("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
    expect(safeColor("red;background:url(x)")).toBeUndefined();
    expect(safeColor(undefined)).toBeUndefined();
  });
});

describe("textToHtml", () => {
  it("splits paragraphs on blank lines and keeps single line breaks", () => {
    expect(textToHtml("a\nb\n\nc")).toBe("<p>a<br>b</p><p>c</p>");
  });
});

describe("styles", () => {
  it("maps block style to CSS and React style objects", () => {
    const style = { textColor: "#111", background: "#eee", paddingY: 10, paddingX: 4, fontSize: 18, align: "center" as const };
    expect(blockStyleToCss(style)).toBe(
      "color:#111;background:#eee;padding-top:10px;padding-bottom:10px;padding-left:4px;padding-right:4px;font-size:18px;text-align:center",
    );
    expect(blockStyleToObject(style)).toMatchObject({ paddingTop: "10px", textAlign: "center", fontSize: "18px" });
  });
});

describe("renderBlock", () => {
  it("renders nested columns with their children", () => {
    const d = doc(
      [
        block("cols", "columns", { gap: 16 }, { children: ["c1", "c2"] }),
        block("c1", "column", {}, { parentId: "cols", children: ["t"] }),
        block("c2", "column", {}, { parentId: "cols" }),
        block("t", "text", { text: "Inside" }, { parentId: "c1" }),
      ],
      ["cols"],
    );
    const html = renderBlock(d, "cols");
    expect(html).toContain("grid-template-columns:repeat(2,minmax(0,1fr));gap:16px");
    expect(html).toMatch(/pc-column[^>]*><div class="pc-block pc-text"><div class="pc-text"><p>Inside<\/p>/);
  });

  it("does not loop forever on a cyclic tree", () => {
    const d = doc([block("a", "column", {}, { children: ["a"] })], ["a"]);
    expect(renderBlock(d, "a")).toBe(`<div class="pc-block pc-column"></div>`);
  });

  it("renders every leaf block type", () => {
    const blocks: Block[] = [
      block("hero", "hero", { title: "T", subtitle: "S", ctaLabel: "Go", ctaHref: "/go" }),
      block("img", "image", { src: "", alt: "", caption: "Cap" }),
      block("btn", "button", { label: "B", href: "#", variant: "outline" }),
      block("feat", "features", { heading: "F", items: [{ title: "a", description: "b" }] }),
      block("price", "pricing", {
        heading: "P",
        plans: [{ name: "Pro", price: "$9", period: "/mo", features: ["x"], ctaLabel: "Buy", ctaHref: "#", highlighted: true }],
      }),
      block("faq", "faq", { heading: "Q", items: [{ question: "Why?", answer: "Because." }] }),
      block("foot", "footer", { text: "(c)", links: [{ label: "Home", href: "/" }] }),
    ];
    const html = renderPageToHtml(doc(blocks, blocks.map((b) => b.id)));
    expect(html).toContain(`<section class="pc-block pc-hero">`);
    expect(html).toContain(`<a class="pc-btn pc-btn-solid" href="/go">Go</a>`);
    expect(html).toContain("pc-img-placeholder");
    expect(html).toContain("pc-btn-outline");
    expect(html).toContain("pc-plan-highlight");
    expect(html).toContain("<summary>Why?</summary>");
    expect(html).toContain(`<footer class="pc-block pc-footer">`);
    expect(html).toContain(`<nav aria-label="Footer">`);
  });
});
