"use client";

import Editor from "@/components/editor/Editor";
import { EditorStoreProvider } from "@/store/context";

export default function EditorPage() {
  return (
    <EditorStoreProvider>
      <Editor />
    </EditorStoreProvider>
  );
}
