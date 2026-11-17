import { beforeEach, describe, expect, it } from "vitest";

import { createEditorStore, type EditorStore, ROOT_DROP_ID } from "@/store/editor";

import { isDropInsideDragged, resolveDropTarget, toMoveIndex } from "./dnd";

let store: EditorStore;
let a: string;
let b: string;
let cols: string;
let col1: string;
let inner: string;

beforeEach(() => {
  store = createEditorStore();
  const s = store.getState();
  a = s.addBlock("heading", { parentId: null })!;
  b = s.addBlock("text", { parentId: null })!;
  cols = s.addBlock("columns", { parentId: null })!;
  col1 = store.getState().blocks[cols]!.children[0]!;
  inner = s.addBlock("button", { parentId: col1 })!;
});

const tree = () => store.getState();

describe("resolveDropTarget", () => {
  it("drops before or after a block depending on the pointer half", () => {
    const drag = { kind: "palette", type: "image" } as const;
    expect(resolveDropTarget(tree(), drag, { kind: "block", id: b }, false)).toEqual({
      parentId: null,
      index: 1,
      overId: b,
      position: "before",
    });
    expect(resolveDropTarget(tree(), drag, { kind: "block", id: b }, true)).toMatchObject({ index: 2, position: "after" });
  });

  it("appends when dropped on a container", () => {
    const drag = { kind: "palette", type: "image" } as const;
    expect(resolveDropTarget(tree(), drag, { kind: "container", parentId: col1 }, false)).toEqual({
      parentId: col1,
      index: 1,
      overId: col1,
      position: "inside",
    });
    expect(resolveDropTarget(tree(), drag, { kind: "container", parentId: null }, false)).toMatchObject({
      parentId: null,
      index: 3,
      overId: ROOT_DROP_ID,
    });
  });

  it("drops next to a nested block inside its column", () => {
    const drag = { kind: "block", id: a } as const;
    expect(resolveDropTarget(tree(), drag, { kind: "block", id: inner }, true)).toMatchObject({ parentId: col1, index: 1 });
  });

  it("rejects columns inside a column and dropping a block into itself", () => {
    expect(resolveDropTarget(tree(), { kind: "palette", type: "columns" }, { kind: "container", parentId: col1 }, false)).toBeNull();
    expect(resolveDropTarget(tree(), { kind: "block", id: cols }, { kind: "block", id: inner }, false)).toBeNull();
    expect(resolveDropTarget(tree(), { kind: "block", id: b }, { kind: "block", id: b }, false)).toBeNull();
  });

  it("flags droppables inside the dragged subtree", () => {
    expect(isDropInsideDragged(tree(), { kind: "block", id: cols }, { kind: "container", parentId: col1 })).toBe(true);
    expect(isDropInsideDragged(tree(), { kind: "block", id: a }, { kind: "container", parentId: col1 })).toBe(false);
    expect(isDropInsideDragged(tree(), { kind: "palette", type: "text" }, { kind: "block", id: a })).toBe(false);
  });
});

describe("toMoveIndex", () => {
  it("compensates for removal when moving down the same list", () => {
    const target = resolveDropTarget(tree(), { kind: "block", id: a }, { kind: "block", id: b }, true)!;
    expect(target.index).toBe(2);
    expect(toMoveIndex(tree(), a, target)).toBe(1);
    store.getState().moveBlock(a, target.parentId, toMoveIndex(tree(), a, target));
    expect(tree().rootIds).toEqual([b, a, cols]);
  });

  it("keeps the index when moving up or across lists", () => {
    const up = resolveDropTarget(tree(), { kind: "block", id: cols }, { kind: "block", id: a }, false)!;
    expect(toMoveIndex(tree(), cols, up)).toBe(0);
    const across = resolveDropTarget(tree(), { kind: "block", id: b }, { kind: "container", parentId: col1 }, false)!;
    expect(toMoveIndex(tree(), b, across)).toBe(1);
  });
});
