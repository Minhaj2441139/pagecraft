"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { useStore } from "zustand";

import { createEditorStore, type EditorState, type EditorStore } from "./editor";

const EditorStoreContext = createContext<EditorStore | null>(null);

export function EditorStoreProvider({ store, children }: { store?: EditorStore; children: ReactNode }) {
  // Lazily create one store per provider unless a store is injected (tests).
  const [value] = useState<EditorStore>(() => store ?? createEditorStore());
  return <EditorStoreContext.Provider value={value}>{children}</EditorStoreContext.Provider>;
}

export function useEditorStore(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error("useEditorStore must be used inside <EditorStoreProvider>");
  return store;
}

/** Subscribe to a slice of editor state. Re-renders only when the slice changes (Object.is). */
export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useStore(useEditorStore(), selector);
}
