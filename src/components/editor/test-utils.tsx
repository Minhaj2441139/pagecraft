import { render } from "@testing-library/react";
import type { ReactNode } from "react";

import { EditorStoreProvider } from "@/store/context";
import { createEditorStore, type EditorStore } from "@/store/editor";

import Editor from "./Editor";
import PropertiesPanel from "./PropertiesPanel";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

function Harness({ store, children }: { store: EditorStore; children: ReactNode }) {
  useKeyboardShortcuts(store);
  return <>{children}</>;
}

/** Render the full editor (palette, canvas, panel, shortcuts) against an isolated store. */
export function renderEditor(store: EditorStore = createEditorStore()) {
  const utils = render(
    <EditorStoreProvider store={store}>
      <Harness store={store}>
        <Editor panel={<PropertiesPanel />} />
      </Harness>
    </EditorStoreProvider>,
  );
  return { ...utils, store };
}
