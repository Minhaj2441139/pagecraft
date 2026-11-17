import type { BlockType, PageTree } from "@pagecraft/export";

import { ROOT_DROP_ID } from "@/store/editor";
import { canInsert, getChildIds, indexInParent, isSelfOrDescendant } from "@/store/tree";

/** Payload attached to draggables (`useDraggable({ data })`). */
export type DragData = { kind: "palette"; type: BlockType } | { kind: "block"; id: string };

/** Payload attached to droppables (`useDroppable({ data })`). */
export type DropData = { kind: "block"; id: string } | { kind: "container"; parentId: string | null };

export interface DropTarget {
  parentId: string | null;
  /** Insertion index in the target list *before* the dragged block is removed. */
  index: number;
  overId: string;
  position: "before" | "after" | "inside";
}

export const PALETTE_PREFIX = "palette:";
export const CONTAINER_PREFIX = "container:";

export function draggedType(tree: PageTree, drag: DragData): BlockType | undefined {
  return drag.kind === "palette" ? drag.type : tree.blocks[drag.id]?.type;
}

/** Work out where a drop would land, or `null` if it is not allowed there. */
export function resolveDropTarget(
  tree: PageTree,
  drag: DragData,
  drop: DropData,
  pointerInLowerHalf: boolean,
): DropTarget | null {
  const type = draggedType(tree, drag);
  if (!type || type === "column") return null;

  let target: DropTarget;
  if (drop.kind === "container") {
    target = {
      parentId: drop.parentId,
      index: getChildIds(tree, drop.parentId).length,
      overId: drop.parentId ?? ROOT_DROP_ID,
      position: "inside",
    };
  } else {
    const over = tree.blocks[drop.id];
    if (!over) return null;
    if (drag.kind === "block" && drag.id === over.id) return null;
    target = {
      parentId: over.parentId,
      index: indexInParent(tree, over.id) + (pointerInLowerHalf ? 1 : 0),
      overId: over.id,
      position: pointerInLowerHalf ? "after" : "before",
    };
  }

  if (!canInsert(tree, type, target.parentId)) return null;
  if (drag.kind === "block" && target.parentId !== null && isSelfOrDescendant(tree, drag.id, target.parentId)) {
    return null;
  }
  return target;
}

/**
 * `moveBlock` expects the index in the list *after* removal. Dropping further
 * down the same list therefore shifts the target up by one.
 */
export function toMoveIndex(tree: PageTree, id: string, target: DropTarget): number {
  const block = tree.blocks[id];
  if (block && block.parentId === target.parentId) {
    const from = indexInParent(tree, id);
    if (from !== -1 && from < target.index) return target.index - 1;
  }
  return target.index;
}

/** True if the droppable belongs to the subtree being dragged (cannot drop into itself). */
export function isDropInsideDragged(tree: PageTree, drag: DragData, drop: DropData): boolean {
  if (drag.kind !== "block") return false;
  const targetId = drop.kind === "block" ? drop.id : drop.parentId;
  return targetId !== null && isSelfOrDescendant(tree, drag.id, targetId);
}
