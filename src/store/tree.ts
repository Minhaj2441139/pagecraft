import type { Block, BlockMap, BlockStyle, PageTree } from "@pagecraft/export";

import { canContain, createBlock } from "@/blocks/registry";
import { createId } from "@/lib/id";

/**
 * Pure, immutable operations on the normalized block tree. Every function
 * returns the *same* tree object when nothing changes, so callers can detect
 * no-ops by reference and untouched blocks keep their identity (which is what
 * lets memoized block components skip re-rendering).
 */

export function getChildIds(tree: PageTree, parentId: string | null): string[] {
  if (parentId === null) return tree.rootIds;
  return tree.blocks[parentId]?.children ?? [];
}

function withChildIds(tree: PageTree, parentId: string | null, ids: string[], blocks: BlockMap): PageTree {
  if (parentId === null) return { rootIds: ids, blocks };
  const parent = blocks[parentId];
  if (!parent) return { rootIds: tree.rootIds, blocks };
  return { rootIds: tree.rootIds, blocks: { ...blocks, [parentId]: { ...parent, children: ids } } };
}

export function indexInParent(tree: PageTree, id: string): number {
  const block = tree.blocks[id];
  if (!block) return -1;
  return getChildIds(tree, block.parentId).indexOf(id);
}

/** True when `maybeDescendant` is `ancestorId` or sits anywhere below it. */
export function isSelfOrDescendant(tree: PageTree, ancestorId: string, maybeDescendant: string | null): boolean {
  let cursor = maybeDescendant;
  const guard = new Set<string>();
  while (cursor !== null && !guard.has(cursor)) {
    if (cursor === ancestorId) return true;
    guard.add(cursor);
    cursor = tree.blocks[cursor]?.parentId ?? null;
  }
  return false;
}

export function collectSubtreeIds(tree: PageTree, id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop() as string;
    const block = tree.blocks[current];
    if (!block || seen.has(current)) continue;
    seen.add(current);
    out.push(current);
    stack.push(...block.children);
  }
  return out;
}

function clampIndex(index: number | undefined, length: number): number {
  if (index === undefined || !Number.isFinite(index)) return length;
  return Math.min(Math.max(0, Math.trunc(index)), length);
}

export function canInsert(tree: PageTree, childType: Block["type"], parentId: string | null): boolean {
  if (parentId === null) return canContain(null, childType);
  const parent = tree.blocks[parentId];
  return parent ? canContain(parent.type, childType) : false;
}

/**
 * Insert a subtree. `blocks[0]` is the subtree root; the rest are its
 * descendants with parent links already set.
 */
export function insertSubtree(tree: PageTree, blocks: Block[], parentId: string | null, index?: number): PageTree {
  const [root] = blocks;
  if (!root || !canInsert(tree, root.type, parentId)) return tree;
  if (tree.blocks[root.id]) return tree;
  const nextBlocks: BlockMap = { ...tree.blocks };
  for (const b of blocks) nextBlocks[b.id] = b;
  nextBlocks[root.id] = { ...root, parentId };
  const siblings = [...getChildIds(tree, parentId)];
  siblings.splice(clampIndex(index, siblings.length), 0, root.id);
  return withChildIds(tree, parentId, siblings, nextBlocks);
}

export function removeSubtree(tree: PageTree, id: string): PageTree {
  const block = tree.blocks[id];
  if (!block) return tree;
  const nextBlocks: BlockMap = { ...tree.blocks };
  for (const removed of collectSubtreeIds(tree, id)) delete nextBlocks[removed];
  const siblings = getChildIds(tree, block.parentId).filter((x) => x !== id);
  return withChildIds(tree, block.parentId, siblings, nextBlocks);
}

/**
 * Move a block to `toParentId` at `toIndex`. The index refers to the target
 * list *after* the block has been taken out of its old position.
 */
export function moveBlock(tree: PageTree, id: string, toParentId: string | null, toIndex: number): PageTree {
  const block = tree.blocks[id];
  if (!block) return tree;
  if (block.type === "column") return tree;
  if (toParentId !== null && isSelfOrDescendant(tree, id, toParentId)) return tree;
  if (!canInsert(tree, block.type, toParentId)) return tree;

  const fromParentId = block.parentId;
  const fromSiblings = getChildIds(tree, fromParentId);
  const fromIndex = fromSiblings.indexOf(id);

  if (fromParentId === toParentId) {
    const without = fromSiblings.filter((x) => x !== id);
    const target = clampIndex(toIndex, without.length);
    if (target === fromIndex) return tree;
    without.splice(target, 0, id);
    return withChildIds(tree, toParentId, without, tree.blocks);
  }

  const detached = withChildIds(
    tree,
    fromParentId,
    fromSiblings.filter((x) => x !== id),
    { ...tree.blocks, [id]: { ...block, parentId: toParentId } },
  );
  const toSiblings = [...getChildIds(detached, toParentId)];
  toSiblings.splice(clampIndex(toIndex, toSiblings.length), 0, id);
  return withChildIds(detached, toParentId, toSiblings, detached.blocks);
}

/** Move a block one step within its parent. */
export function shiftBlock(tree: PageTree, id: string, delta: -1 | 1): PageTree {
  const block = tree.blocks[id];
  if (!block || block.type === "column") return tree;
  const index = indexInParent(tree, id);
  const target = index + delta;
  if (target < 0 || target >= getChildIds(tree, block.parentId).length) return tree;
  return moveBlock(tree, id, block.parentId, target);
}

/** Deep-clone a subtree with fresh ids and insert the copy right after the original. */
export function duplicateSubtree(tree: PageTree, id: string): { tree: PageTree; newId: string | null } {
  const original = tree.blocks[id];
  if (!original || original.type === "column") return { tree, newId: null };
  const idMap = new Map<string, string>();
  for (const oldId of collectSubtreeIds(tree, id)) idMap.set(oldId, createId());

  const clones: Block[] = [];
  const visit = (oldId: string) => {
    const b = tree.blocks[oldId];
    if (!b) return;
    const newParent = oldId === id ? original.parentId : (idMap.get(b.parentId ?? "") ?? null);
    clones.push({
      ...b,
      id: idMap.get(oldId) as string,
      parentId: newParent,
      props: structuredClone(b.props),
      style: { ...b.style },
      children: b.children.map((c) => idMap.get(c) as string),
    } as Block);
    b.children.forEach(visit);
  };
  visit(id);

  const newId = idMap.get(id) as string;
  const next = insertSubtree(tree, clones, original.parentId, indexInParent(tree, id) + 1);
  return { tree: next, newId: next === tree ? null : newId };
}

export function updateProps(tree: PageTree, id: string, patch: Record<string, unknown>): PageTree {
  const block = tree.blocks[id];
  if (!block) return tree;
  const changed = Object.keys(patch).some((k) => !Object.is((block.props as Record<string, unknown>)[k], patch[k]));
  if (!changed) return tree;
  return {
    rootIds: tree.rootIds,
    blocks: { ...tree.blocks, [id]: { ...block, props: { ...block.props, ...patch } } as Block },
  };
}

export function updateStyle(tree: PageTree, id: string, patch: Partial<BlockStyle>): PageTree {
  const block = tree.blocks[id];
  if (!block) return tree;
  const nextStyle: BlockStyle = { ...block.style };
  let changed = false;
  for (const [key, value] of Object.entries(patch) as Array<[keyof BlockStyle, BlockStyle[keyof BlockStyle]]>) {
    if (Object.is(nextStyle[key], value)) continue;
    changed = true;
    if (value === undefined || value === "") delete nextStyle[key];
    else (nextStyle as Record<string, unknown>)[key] = value;
  }
  if (!changed) return tree;
  return { rootIds: tree.rootIds, blocks: { ...tree.blocks, [id]: { ...block, style: nextStyle } } };
}

/**
 * Change how many columns a columns block has. Extra columns are appended
 * empty; when shrinking, children of removed columns move into the last
 * remaining column so no content is lost.
 */
export function setColumnCount(tree: PageTree, columnsId: string, count: number): PageTree {
  const block = tree.blocks[columnsId];
  if (!block || block.type !== "columns") return tree;
  const target = Math.max(1, Math.trunc(count));
  const current = block.children;
  if (target === current.length) return tree;

  if (target > current.length) {
    const added = Array.from({ length: target - current.length }, () => createBlock("column", columnsId));
    const blocks: BlockMap = { ...tree.blocks };
    for (const c of added) blocks[c.id] = c;
    blocks[columnsId] = { ...block, children: [...current, ...added.map((c) => c.id)] };
    return { rootIds: tree.rootIds, blocks };
  }

  const kept = current.slice(0, target);
  const removed = current.slice(target);
  const lastKeptId = kept[kept.length - 1] as string;
  const lastKept = tree.blocks[lastKeptId];
  if (!lastKept) return tree;
  const blocks: BlockMap = { ...tree.blocks };
  const orphans = removed.flatMap((cid) => tree.blocks[cid]?.children ?? []);
  for (const orphanId of orphans) {
    const orphan = blocks[orphanId];
    if (orphan) blocks[orphanId] = { ...orphan, parentId: lastKeptId };
  }
  for (const cid of removed) delete blocks[cid];
  blocks[lastKeptId] = { ...lastKept, children: [...lastKept.children, ...orphans] };
  blocks[columnsId] = { ...block, children: kept };
  return { rootIds: tree.rootIds, blocks };
}

/** Pre-order list of all block ids, matching on-screen order. */
export function flattenIds(tree: PageTree): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    const b = tree.blocks[id];
    if (!b || seen.has(id)) return;
    seen.add(id);
    out.push(id);
    b.children.forEach(visit);
  };
  tree.rootIds.forEach(visit);
  return out;
}
