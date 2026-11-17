import { type Block, type BlockStyle, type BlockType, type PageDocument, type PageTree, SCHEMA_VERSION } from "@pagecraft/export";
import { createStore, type StoreApi } from "zustand/vanilla";

import { createBlockSubtree, MAX_COLUMNS, MIN_COLUMNS } from "@/blocks/registry";
import { createId } from "@/lib/id";

import * as tree from "./tree";

export type Device = "desktop" | "tablet" | "mobile";

export const HISTORY_LIMIT = 100;
/** Edits sharing a coalesce key within this window become one undo step. */
export const COALESCE_MS = 1000;

export interface PageMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface InsertTarget {
  parentId: string | null;
  index?: number;
}

export interface EditOptions {
  /**
   * Group rapid edits (e.g. typing into one field) into a single undo step.
   * Typically `${blockId}:${field}`.
   */
  coalesceKey?: string;
}

/** Where a drag would land; UI-only, never recorded in history. */
export interface DropIndicator {
  /** Block id, or ROOT_DROP_ID for the page itself. */
  overId: string;
  position: "before" | "after" | "inside";
}

export const ROOT_DROP_ID = "__root__";

export interface EditorState extends PageTree {
  meta: PageMeta;
  selectedId: string | null;
  dropIndicator: DropIndicator | null;
  past: PageTree[];
  future: PageTree[];
  /** Increments on every document change; drives autosave. */
  revision: number;
  device: Device;
  lastCommit: { key: string | null; at: number };

  loadDocument: (doc: PageDocument) => void;
  toDocument: () => PageDocument;
  renamePage: (name: string) => void;

  addBlock: (type: BlockType, target?: InsertTarget) => string | null;
  moveBlock: (id: string, parentId: string | null, index: number) => void;
  moveSelected: (delta: -1 | 1) => void;
  deleteBlock: (id: string) => void;
  duplicateBlock: (id: string) => string | null;
  updateProps: (id: string, patch: Record<string, unknown>, options?: EditOptions) => void;
  updateStyle: (id: string, patch: Partial<BlockStyle>, options?: EditOptions) => void;
  setColumnCount: (id: string, count: number) => void;

  select: (id: string | null) => void;
  selectAdjacent: (delta: -1 | 1) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  setDevice: (device: Device) => void;
  setDropIndicator: (indicator: DropIndicator | null) => void;
}

export type EditorStore = StoreApi<EditorState>;

export interface CreateEditorStoreOptions {
  /** Injectable clock for deterministic history-coalescing tests. */
  now?: () => number;
  initial?: PageDocument;
}

export function createEmptyDocument(name = "Untitled page", now = Date.now()): PageDocument {
  return { version: SCHEMA_VERSION, id: createId("p"), name, createdAt: now, updatedAt: now, rootIds: [], blocks: {} };
}

export function createEditorStore(options: CreateEditorStoreOptions = {}): EditorStore {
  const now = options.now ?? Date.now;
  const initial = options.initial ?? createEmptyDocument("Untitled page", now());

  return createStore<EditorState>()((set, get) => {
    const snapshot = (): PageTree => {
      const { rootIds, blocks } = get();
      return { rootIds, blocks };
    };

    /** Apply a new tree and record the previous one in history. */
    const commit = (next: PageTree, extra: Partial<EditorState> = {}, coalesceKey?: string): boolean => {
      const state = get();
      if (next.rootIds === state.rootIds && next.blocks === state.blocks) {
        if (Object.keys(extra).length) set(extra);
        return false;
      }
      const at = now();
      const coalesce =
        coalesceKey !== undefined && state.lastCommit.key === coalesceKey && at - state.lastCommit.at < COALESCE_MS;
      set({
        rootIds: next.rootIds,
        blocks: next.blocks,
        past: coalesce ? state.past : [...state.past, snapshot()].slice(-HISTORY_LIMIT),
        future: [],
        revision: state.revision + 1,
        lastCommit: { key: coalesceKey ?? null, at },
        meta: { ...state.meta, updatedAt: at },
        ...extra,
      });
      return true;
    };

    /** Default drop location for click-to-add: after the selection, else at the end of the page. */
    const defaultTarget = (type: BlockType): InsertTarget => {
      const state = get();
      const selected = state.selectedId ? state.blocks[state.selectedId] : undefined;
      if (selected) {
        // Selected an empty-able container column: add inside it.
        if (selected.type === "column" && tree.canInsert(state, type, selected.id)) {
          return { parentId: selected.id };
        }
        if (tree.canInsert(state, type, selected.parentId)) {
          return { parentId: selected.parentId, index: tree.indexInParent(state, selected.id) + 1 };
        }
      }
      return { parentId: null };
    };

    const restore = (from: "past" | "future") => {
      const state = get();
      const stack = state[from];
      const target = stack[stack.length - 1];
      if (!target) return;
      const current = snapshot();
      const selectedId = state.selectedId && target.blocks[state.selectedId] ? state.selectedId : null;
      set({
        rootIds: target.rootIds,
        blocks: target.blocks,
        [from]: stack.slice(0, -1),
        ...(from === "past"
          ? { future: [...state.future, current] }
          : { past: [...state.past, current].slice(-HISTORY_LIMIT) }),
        selectedId,
        revision: state.revision + 1,
        lastCommit: { key: null, at: 0 },
        meta: { ...state.meta, updatedAt: now() },
      } as Partial<EditorState>);
    };

    return {
      rootIds: initial.rootIds,
      blocks: initial.blocks,
      meta: { id: initial.id, name: initial.name, createdAt: initial.createdAt, updatedAt: initial.updatedAt },
      selectedId: null,
      dropIndicator: null,
      past: [],
      future: [],
      revision: 0,
      device: "desktop",
      lastCommit: { key: null, at: 0 },

      loadDocument: (doc) =>
        set({
          rootIds: doc.rootIds,
          blocks: doc.blocks,
          meta: { id: doc.id, name: doc.name, createdAt: doc.createdAt, updatedAt: doc.updatedAt },
          selectedId: null,
          past: [],
          future: [],
          revision: 0,
          lastCommit: { key: null, at: 0 },
        }),

      toDocument: () => {
        const { meta, rootIds, blocks } = get();
        return { version: SCHEMA_VERSION, ...meta, rootIds, blocks };
      },

      renamePage: (name) => {
        const state = get();
        if (name === state.meta.name) return;
        set({ meta: { ...state.meta, name, updatedAt: now() }, revision: state.revision + 1 });
      },

      addBlock: (type, target) => {
        const { parentId, index } = target ?? defaultTarget(type);
        const subtree = createBlockSubtree(type, parentId);
        const root = subtree[0] as Block;
        const changed = commit(tree.insertSubtree(snapshot(), subtree, parentId, index), { selectedId: root.id });
        return changed ? root.id : null;
      },

      moveBlock: (id, parentId, index) => {
        commit(tree.moveBlock(snapshot(), id, parentId, index));
      },

      moveSelected: (delta) => {
        const { selectedId } = get();
        if (selectedId) commit(tree.shiftBlock(snapshot(), selectedId, delta));
      },

      deleteBlock: (id) => {
        const state = get();
        const block = state.blocks[id];
        if (!block || block.type === "column") return;
        const siblings = tree.getChildIds(state, block.parentId);
        const index = siblings.indexOf(id);
        const neighbour = siblings[index + 1] ?? siblings[index - 1] ?? block.parentId ?? null;
        const selectionGone = state.selectedId !== null && tree.isSelfOrDescendant(state, id, state.selectedId);
        commit(tree.removeSubtree(snapshot(), id), selectionGone ? { selectedId: neighbour } : {});
      },

      duplicateBlock: (id) => {
        const { tree: next, newId } = tree.duplicateSubtree(snapshot(), id);
        if (newId) commit(next, { selectedId: newId });
        return newId;
      },

      updateProps: (id, patch, options) => {
        commit(tree.updateProps(snapshot(), id, patch), {}, options?.coalesceKey);
      },

      updateStyle: (id, patch, options) => {
        commit(tree.updateStyle(snapshot(), id, patch), {}, options?.coalesceKey);
      },

      setColumnCount: (id, count) => {
        const clamped = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, count));
        const state = get();
        const next = tree.setColumnCount(snapshot(), id, clamped);
        const selectionGone = state.selectedId !== null && !next.blocks[state.selectedId];
        commit(next, selectionGone ? { selectedId: id } : {});
      },

      select: (id) => {
        if (get().selectedId !== id) set({ selectedId: id });
      },

      selectAdjacent: (delta) => {
        const state = get();
        const order = tree.flattenIds(state);
        if (!order.length) return;
        const current = state.selectedId ? order.indexOf(state.selectedId) : -1;
        const nextIndex =
          current === -1 ? (delta === 1 ? 0 : order.length - 1) : Math.min(order.length - 1, Math.max(0, current + delta));
        set({ selectedId: order[nextIndex] ?? null });
      },

      undo: () => restore("past"),
      redo: () => restore("future"),
      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,

      setDevice: (device) => set({ device }),

      setDropIndicator: (indicator) => {
        const current = get().dropIndicator;
        if (current?.overId === indicator?.overId && current?.position === indicator?.position) return;
        set({ dropIndicator: indicator });
      },
    };
  });
}
