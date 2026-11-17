import type { Block } from "@pagecraft/export";
import { beforeEach, describe, expect, it } from "vitest";

import { COALESCE_MS, createEditorStore, type EditorStore, HISTORY_LIMIT } from "./editor";

let clock = 0;
let store: EditorStore;
const s = () => store.getState();
const types = (ids: string[]) => ids.map((id) => s().blocks[id]?.type);

beforeEach(() => {
  clock = 1_000;
  store = createEditorStore({ now: () => clock });
});

describe("addBlock", () => {
  it("appends to the page root and selects the new block", () => {
    const a = s().addBlock("heading");
    const b = s().addBlock("text", { parentId: null });
    expect(s().rootIds).toEqual([a, b]);
    expect(s().selectedId).toBe(b);
    expect(s().blocks[a!]?.parentId).toBeNull();
  });

  it("inserts after the selected block when no target is given", () => {
    const a = s().addBlock("heading", { parentId: null });
    const b = s().addBlock("text", { parentId: null });
    s().select(a);
    const c = s().addBlock("image");
    expect(s().rootIds).toEqual([a, c, b]);
  });

  it("creates columns with two empty column children", () => {
    const cols = s().addBlock("columns")!;
    const block = s().blocks[cols]!;
    expect(block.children).toHaveLength(2);
    expect(types(block.children)).toEqual(["column", "column"]);
    expect(block.children.every((c) => s().blocks[c]?.parentId === cols)).toBe(true);
  });

  it("nests a block inside a column and refuses columns-in-column", () => {
    const cols = s().addBlock("columns")!;
    const col = s().blocks[cols]!.children[0]!;
    const text = s().addBlock("text", { parentId: col });
    expect(s().blocks[col]!.children).toEqual([text]);
    expect(s().blocks[text!]!.parentId).toBe(col);

    expect(s().addBlock("columns", { parentId: col })).toBeNull();
    expect(s().blocks[col]!.children).toEqual([text]);
  });

  it("adds inside a selected empty column", () => {
    const cols = s().addBlock("columns")!;
    const col = s().blocks[cols]!.children[1]!;
    s().select(col);
    const btn = s().addBlock("button");
    expect(s().blocks[col]!.children).toEqual([btn]);
  });
});

describe("moveBlock", () => {
  it("reorders within the root", () => {
    const [a, b, c] = ["heading", "text", "image"].map((t) => s().addBlock(t as Block["type"], { parentId: null }));
    s().moveBlock(a!, null, 2);
    expect(s().rootIds).toEqual([b, c, a]);
    s().moveBlock(a!, null, 0);
    expect(s().rootIds).toEqual([a, b, c]);
  });

  it("moves a block from the root into a column and back out", () => {
    const text = s().addBlock("text", { parentId: null })!;
    const cols = s().addBlock("columns", { parentId: null })!;
    const col = s().blocks[cols]!.children[1]!;

    s().moveBlock(text, col, 0);
    expect(s().rootIds).toEqual([cols]);
    expect(s().blocks[col]!.children).toEqual([text]);
    expect(s().blocks[text]!.parentId).toBe(col);

    s().moveBlock(text, null, 1);
    expect(s().rootIds).toEqual([cols, text]);
    expect(s().blocks[col]!.children).toEqual([]);
    expect(s().blocks[text]!.parentId).toBeNull();
  });

  it("ignores moves into the block's own subtree and of bare columns", () => {
    const cols = s().addBlock("columns")!;
    const col = s().blocks[cols]!.children[0]!;
    const before = s().blocks;
    s().moveBlock(cols, col, 0);
    s().moveBlock(col, null, 0);
    expect(s().blocks).toBe(before);
    expect(s().past).toHaveLength(1);
  });

  it("moveSelected shifts the selected block one step", () => {
    const a = s().addBlock("heading", { parentId: null });
    const b = s().addBlock("text", { parentId: null });
    s().select(b);
    s().moveSelected(-1);
    expect(s().rootIds).toEqual([b, a]);
    s().moveSelected(-1); // already first: no-op, no history entry
    expect(s().past).toHaveLength(3);
  });
});

describe("deleteBlock / duplicateBlock", () => {
  it("deletes a subtree and selects a neighbour", () => {
    const a = s().addBlock("heading", { parentId: null })!;
    const cols = s().addBlock("columns", { parentId: null })!;
    const col = s().blocks[cols]!.children[0]!;
    const inner = s().addBlock("text", { parentId: col })!;
    s().select(cols);
    s().deleteBlock(cols);
    expect(s().rootIds).toEqual([a]);
    expect(s().blocks[col]).toBeUndefined();
    expect(s().blocks[inner]).toBeUndefined();
    expect(s().selectedId).toBe(a);
  });

  it("does not delete a column on its own", () => {
    const cols = s().addBlock("columns")!;
    const col = s().blocks[cols]!.children[0]!;
    s().deleteBlock(col);
    expect(s().blocks[col]).toBeDefined();
  });

  it("duplicates a nested subtree with fresh ids right after the original", () => {
    const cols = s().addBlock("columns")!;
    const col = s().blocks[cols]!.children[0]!;
    const inner = s().addBlock("text", { parentId: col })!;
    s().updateProps(inner, { text: "hello" });

    const copy = s().duplicateBlock(cols)!;
    expect(s().rootIds).toEqual([cols, copy]);
    const copyCols = s().blocks[copy]!;
    const copyCol = s().blocks[copyCols.children[0]!]!;
    const copyInner = s().blocks[copyCol.children[0]!]!;
    expect(copyCol.id).not.toBe(col);
    expect(copyCol.parentId).toBe(copy);
    expect(copyInner.id).not.toBe(inner);
    expect(copyInner.parentId).toBe(copyCol.id);
    expect(copyInner.props).toEqual({ text: "hello" });
    expect(s().selectedId).toBe(copy);

    // Deep copy: editing the copy leaves the original alone.
    s().updateProps(copyInner.id, { text: "changed" });
    expect((s().blocks[inner]!.props as { text: string }).text).toBe("hello");
  });
});

describe("updateProps / updateStyle", () => {
  it("keeps untouched blocks referentially equal", () => {
    const a = s().addBlock("heading", { parentId: null })!;
    const b = s().addBlock("text", { parentId: null })!;
    const before = s().blocks[b];
    s().updateProps(a, { text: "New" });
    expect(s().blocks[b]).toBe(before);
    expect((s().blocks[a]!.props as { text: string }).text).toBe("New");
  });

  it("treats identical values as a no-op", () => {
    const a = s().addBlock("heading")!;
    const rev = s().revision;
    s().updateProps(a, { text: "Section heading" });
    s().updateStyle(a, {});
    expect(s().revision).toBe(rev);
  });

  it("removes a style key when it is cleared", () => {
    const a = s().addBlock("heading")!;
    s().updateStyle(a, { textColor: "#ff0000", paddingY: 12 });
    expect(s().blocks[a]!.style).toEqual({ textColor: "#ff0000", paddingY: 12 });
    s().updateStyle(a, { textColor: "" });
    expect(s().blocks[a]!.style).toEqual({ paddingY: 12 });
  });
});

describe("undo / redo", () => {
  it("undoes and redoes add, move and delete", () => {
    const a = s().addBlock("heading", { parentId: null })!;
    const b = s().addBlock("text", { parentId: null })!;
    s().moveBlock(b, null, 0);
    s().deleteBlock(a);
    expect(s().rootIds).toEqual([b]);

    s().undo();
    expect(s().rootIds).toEqual([b, a]);
    s().undo();
    expect(s().rootIds).toEqual([a, b]);
    s().undo();
    expect(s().rootIds).toEqual([a]);
    s().undo();
    expect(s().rootIds).toEqual([]);
    expect(s().canUndo()).toBe(false);

    s().redo();
    s().redo();
    expect(s().rootIds).toEqual([a, b]);
    expect(s().canRedo()).toBe(true);
  });

  it("clears the redo stack on a new edit", () => {
    s().addBlock("heading");
    s().undo();
    expect(s().canRedo()).toBe(true);
    s().addBlock("text");
    expect(s().canRedo()).toBe(false);
  });

  it("clears the selection when undo removes the selected block", () => {
    const a = s().addBlock("heading")!;
    expect(s().selectedId).toBe(a);
    s().undo();
    expect(s().selectedId).toBeNull();
  });

  it("coalesces rapid edits with the same key into one undo step", () => {
    const a = s().addBlock("heading")!;
    for (const text of ["H", "He", "Hel", "Hell", "Hello"]) {
      clock += 100;
      s().updateProps(a, { text }, { coalesceKey: `${a}:text` });
    }
    expect(s().past).toHaveLength(2);
    s().undo();
    expect((s().blocks[a]!.props as { text: string }).text).toBe("Section heading");
  });

  it("starts a new undo step after the coalesce window or with a different key", () => {
    const a = s().addBlock("heading")!;
    s().updateProps(a, { text: "One" }, { coalesceKey: "k" });
    clock += COALESCE_MS + 1;
    s().updateProps(a, { text: "Two" }, { coalesceKey: "k" });
    s().updateStyle(a, { paddingY: 4 }, { coalesceKey: "other" });
    expect(s().past).toHaveLength(4);
  });

  it(`caps history at ${HISTORY_LIMIT} entries`, () => {
    const a = s().addBlock("heading")!;
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) s().updateProps(a, { text: `v${i}` });
    expect(s().past).toHaveLength(HISTORY_LIMIT);
  });
});

describe("columns", () => {
  it("grows and shrinks columns without losing content", () => {
    const cols = s().addBlock("columns")!;
    s().setColumnCount(cols, 3);
    const [c1, c2, c3] = s().blocks[cols]!.children;
    expect(s().blocks[cols]!.children).toHaveLength(3);
    const t = s().addBlock("text", { parentId: c3! })!;

    s().setColumnCount(cols, 2);
    expect(s().blocks[cols]!.children).toEqual([c1, c2]);
    expect(s().blocks[c3!]).toBeUndefined();
    expect(s().blocks[c2!]!.children).toEqual([t]);
    expect(s().blocks[t]!.parentId).toBe(c2);

    s().setColumnCount(cols, 99);
    expect(s().blocks[cols]!.children).toHaveLength(4);
  });
});

describe("selection and documents", () => {
  it("walks blocks in visual order", () => {
    const a = s().addBlock("heading", { parentId: null })!;
    const cols = s().addBlock("columns", { parentId: null })!;
    const [c1] = s().blocks[cols]!.children;
    s().select(null);
    s().selectAdjacent(1);
    expect(s().selectedId).toBe(a);
    s().selectAdjacent(1);
    expect(s().selectedId).toBe(cols);
    s().selectAdjacent(1);
    expect(s().selectedId).toBe(c1);
    s().selectAdjacent(-1);
    s().selectAdjacent(-1);
    s().selectAdjacent(-1);
    expect(s().selectedId).toBe(a);
  });

  it("round-trips through toDocument / loadDocument and resets history", () => {
    s().addBlock("hero");
    s().renamePage("Launch");
    const doc = s().toDocument();
    expect(doc.name).toBe("Launch");

    const other = createEditorStore();
    other.getState().loadDocument(doc);
    expect(other.getState().toDocument()).toEqual(doc);
    expect(other.getState().canUndo()).toBe(false);
  });
});
