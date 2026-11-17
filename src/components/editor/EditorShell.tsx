"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import { ANNOUNCER_ID } from "@/lib/announce";
import { useEditorStore } from "@/store/context";

import Editor from "./Editor";
import PropertiesPanel from "./PropertiesPanel";
import Toolbar from "./Toolbar";
import { useAutosave } from "./useAutosave";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

// Code-split: the preview (and the full-document HTML renderer it pulls in) loads on first open.
const PreviewDialog = lazy(() => import("./PreviewDialog"));
const preloadPreview = () => void import("./PreviewDialog");

/**
 * The complete editor UI for whatever document is in the store: toolbar,
 * palette, canvas, properties panel, autosave, shortcuts and preview.
 * Independent of routing so tests and benchmarks can render the real thing.
 */
export default function EditorShell() {
  const store = useEditorStore();
  const [previewOpen, setPreviewOpen] = useState(false);
  const { saveNow } = useAutosave(store);
  useKeyboardShortcuts(store, { onSave: saveNow });

  const openPreview = useCallback(() => setPreviewOpen(true), []);
  const closePreview = useCallback(() => setPreviewOpen(false), []);

  return (
    <>
      <Editor
        toolbar={<Toolbar onSave={saveNow} onPreview={openPreview} onPreviewIntent={preloadPreview} />}
        panel={<PropertiesPanel />}
      />
      {previewOpen && (
        <Suspense fallback={null}>
          <PreviewDialog open onClose={closePreview} />
        </Suspense>
      )}
      <div id={ANNOUNCER_ID} role="status" aria-live="polite" className="sr-only" />
    </>
  );
}
