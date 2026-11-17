"use client";

import { Suspense } from "react";

import EditorRoute from "@/components/editor/EditorRoute";
import { EditorStoreProvider } from "@/store/context";

export default function EditorPage() {
  return (
    <EditorStoreProvider>
      <Suspense fallback={null}>
        <EditorRoute />
      </Suspense>
    </EditorStoreProvider>
  );
}
