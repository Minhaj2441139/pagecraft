"use client";

import { useEffect } from "react";

import { getDefinition } from "@/blocks/registry";
import { announce } from "@/lib/announce";
import type { EditorStore } from "@/store/editor";

export function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !["button", "checkbox", "radio", "range", "color", "submit", "reset", "file"].includes(target.type);
  }
  return false;
}

function inCanvas(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[role="tree"]') !== null;
}

/** Move focus to a block on the canvas (after keyboard navigation, delete, duplicate). */
export function focusBlock(id: string | null): void {
  if (!id) return;
  requestAnimationFrame(() => {
    const escaped = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(id) : id.replace(/["\\]/g, "\\$&");
    const el = document.querySelector<HTMLElement>(`[data-block-id="${escaped}"]`);
    el?.focus({ preventScroll: false });
    el?.scrollIntoView?.({ block: "nearest" });
  });
}

export interface ShortcutHandlers {
  onSave?: () => void;
}

/**
 * Editor shortcuts:
 * - Ctrl/⌘+Z undo, Ctrl/⌘+Shift+Z or Ctrl+Y redo (work everywhere, also in fields)
 * - Ctrl/⌘+D duplicate, Ctrl/⌘+S save
 * - Delete/Backspace delete, Alt+↑/↓ move, ↑/↓ select previous/next, Esc deselect
 *   (ignored while typing in a field)
 */
export function useKeyboardShortcuts(store: EditorStore, { onSave }: ShortcutHandlers = {}): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = store.getState();
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const typing = isTextInput(event.target);
      const selected = state.selectedId ? state.blocks[state.selectedId] : undefined;
      const label = selected ? getDefinition(selected.type).label : "";

      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          if (state.canRedo()) {
            state.redo();
            announce("Redone");
          }
        } else if (state.canUndo()) {
          state.undo();
          announce("Undone");
        }
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        if (state.canRedo()) {
          state.redo();
          announce("Redone");
        }
        return;
      }
      if (mod && key === "s") {
        event.preventDefault();
        onSave?.();
        return;
      }
      if (mod && key === "d") {
        event.preventDefault();
        if (!selected) return;
        const copy = state.duplicateBlock(selected.id);
        if (copy) {
          announce(`Duplicated ${label}`);
          if (!typing) focusBlock(copy);
        }
        return;
      }

      if (typing || mod) return;

      if ((event.key === "Delete" || event.key === "Backspace") && selected) {
        event.preventDefault();
        if (selected.type === "column") {
          announce("Columns cannot be deleted individually. Change the column count instead.");
          return;
        }
        state.deleteBlock(selected.id);
        announce(`Deleted ${label}`);
        focusBlock(store.getState().selectedId);
        return;
      }

      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && event.altKey && selected) {
        event.preventDefault();
        state.moveSelected(event.key === "ArrowUp" ? -1 : 1);
        const moved = store.getState().revision !== state.revision;
        announce(moved ? `Moved ${label} ${event.key === "ArrowUp" ? "up" : "down"}` : `${label} cannot move further`);
        focusBlock(selected.id);
        return;
      }

      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && !event.altKey && inCanvas(event.target)) {
        event.preventDefault();
        state.selectAdjacent(event.key === "ArrowUp" ? -1 : 1);
        focusBlock(store.getState().selectedId);
        return;
      }

      if (event.key === "Escape" && state.selectedId && !document.querySelector("dialog[open]")) {
        state.select(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store, onSave]);
}
