"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { savePage } from "@/lib/storage";
import type { EditorStore } from "@/store/editor";

export type SaveStatus = { state: "saved" } | { state: "pending" } | { state: "error"; message: string };

export const AUTOSAVE_DELAY_MS = 600;

/** Debounced save to localStorage whenever the document revision changes. */
export function useAutosave(store: EditorStore, enabled: boolean): { status: SaveStatus; saveNow: () => void } {
  const [status, setStatus] = useState<SaveStatus>({ state: "saved" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRevision = useRef(store.getState().revision);

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const state = store.getState();
    const result = savePage(state.toDocument());
    if (result.ok) {
      savedRevision.current = state.revision;
      setStatus({ state: "saved" });
    } else {
      console.error(`[pagecraft] Autosave failed: ${result.error}`);
      setStatus({ state: "error", message: result.error });
    }
  }, [store]);

  useEffect(() => {
    if (!enabled) return;
    savedRevision.current = store.getState().revision;
    const unsubscribe = store.subscribe((state, prev) => {
      if (state.revision === prev.revision || state.revision === savedRevision.current) return;
      setStatus({ state: "pending" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(saveNow, AUTOSAVE_DELAY_MS);
    });
    const flush = () => {
      if (timer.current) saveNow();
    };
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unsubscribe();
      flush();
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, saveNow, store]);

  return { status, saveNow };
}
