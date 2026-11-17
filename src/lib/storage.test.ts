import { beforeEach, describe, expect, it } from "vitest";

import { buildStressDocument, TEMPLATES } from "@/blocks/templates";
import { createEditorStore } from "@/store/editor";

import { deletePage, importDocument, INDEX_KEY, listPages, loadPage, parseDocument, savePage, type StorageLike } from "./storage";

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

let storage: ReturnType<typeof memory>;
beforeEach(() => {
  storage = memory();
});

function sampleDoc() {
  const store = createEditorStore();
  const s = store.getState();
  s.addBlock("hero");
  const cols = s.addBlock("columns", { parentId: null })!;
  s.addBlock("text", { parentId: store.getState().blocks[cols]!.children[0]! });
  s.renamePage("Sample");
  return store.getState().toDocument();
}

describe("save / load / list / delete", () => {
  it("round-trips a document", () => {
    const doc = sampleDoc();
    expect(savePage(doc, storage)).toEqual({ ok: true, value: undefined });
    expect(loadPage(doc.id, storage)).toEqual(doc);
    expect(listPages(storage)).toEqual([{ id: doc.id, name: "Sample", updatedAt: doc.updatedAt, blockCount: 5 }]);
  });

  it("lists most recently updated first and updates in place", () => {
    const a = { ...sampleDoc(), updatedAt: 1 };
    const b = { ...sampleDoc(), updatedAt: 2 };
    savePage(a, storage);
    savePage(b, storage);
    savePage({ ...a, name: "Renamed", updatedAt: 3 }, storage);
    expect(listPages(storage).map((p) => p.name)).toEqual(["Renamed", "Sample"]);
  });

  it("deletes a page and its index entry", () => {
    const doc = sampleDoc();
    savePage(doc, storage);
    deletePage(doc.id, storage);
    expect(loadPage(doc.id, storage)).toBeNull();
    expect(listPages(storage)).toEqual([]);
  });

  it("returns null for corrupt saved JSON and an empty list for a corrupt index", () => {
    storage.setItem("pagecraft:page:x", "{nope");
    storage.setItem(INDEX_KEY, "42");
    expect(loadPage("x", storage)).toBeNull();
    expect(listPages(storage)).toEqual([]);
  });

  it("reports a friendly error when storage is full", () => {
    const full: StorageLike = {
      ...storage,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    };
    const result = savePage(sampleDoc(), full);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/storage is full/);
  });
});

describe("parseDocument", () => {
  it("rejects structurally invalid input", () => {
    expect(parseDocument(null).ok).toBe(false);
    expect(parseDocument({ version: 2 }).ok).toBe(false);
    const doc = sampleDoc();
    expect(parseDocument({ ...doc, rootIds: ["missing"] }).ok).toBe(false);
    const hero = doc.rootIds[0]!;
    expect(parseDocument({ ...doc, blocks: { ...doc.blocks, [hero]: { ...doc.blocks[hero], type: "marquee" } } }).ok).toBe(false);
    // A block referenced twice (would render twice / create cycles).
    expect(parseDocument({ ...doc, rootIds: [hero, hero] }).ok).toBe(false);
  });

  it("rejects illegal nesting", () => {
    const doc = sampleDoc();
    const [, cols] = doc.rootIds;
    const col = doc.blocks[cols!]!.children[0]!;
    const result = parseDocument({ ...doc, rootIds: [col] });
    expect(result.ok).toBe(false);
  });

  it("repairs missing or mistyped props from defaults and drops unknown style", () => {
    const doc = sampleDoc();
    const hero = doc.rootIds[0]!;
    const result = parseDocument({
      ...doc,
      blocks: {
        ...doc.blocks,
        [hero]: { ...doc.blocks[hero], props: { title: 42 }, style: { paddingY: "big", align: "middle", textColor: "#fff" } },
      },
    });
    expect(result.ok).toBe(true);
    const block = result.ok ? result.value.blocks[hero] : undefined;
    expect(block?.props).toMatchObject({ title: "Build something people love", ctaLabel: "Get started" });
    expect(block?.style).toEqual({ textColor: "#fff" });
  });

  it("accepts every template and the stress document", () => {
    for (const t of TEMPLATES) expect(parseDocument(t.build()).ok).toBe(true);
    const stress = buildStressDocument();
    expect(Object.keys(stress.blocks).length).toBeGreaterThanOrEqual(200);
    expect(parseDocument(stress).ok).toBe(true);
  });
});

describe("importDocument", () => {
  it("assigns a fresh id so imports never overwrite existing pages", () => {
    const doc = sampleDoc();
    const result = importDocument(JSON.stringify(doc));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).not.toBe(doc.id);
      expect(result.value.rootIds).toEqual(doc.rootIds);
    }
  });

  it("reports invalid JSON", () => {
    expect(importDocument("not json")).toEqual({ ok: false, error: "The file is not valid JSON." });
  });
});
