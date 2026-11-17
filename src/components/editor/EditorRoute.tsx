"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getTemplate } from "@/blocks/templates";
import { loadPage, savePage } from "@/lib/storage";
import { useEditorStore } from "@/store/context";

import EditorShell from "./EditorShell";

type LoadState = { state: "loading" } | { state: "ready" } | { state: "missing"; id: string };

/**
 * `/editor?id=<pageId>` opens a saved page.
 * `/editor?template=<templateId>` creates a page from a template, saves it and redirects to its id.
 */
export default function EditorRoute() {
  const store = useEditorStore();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const templateId = params.get("template");
  const [load, setLoad] = useState<LoadState>({ state: "loading" });

  // Syncs from localStorage (an external system), which is only readable after mount.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (id) {
      const doc = loadPage(id);
      if (doc) {
        if (store.getState().meta.id !== doc.id) store.getState().loadDocument(doc);
        setLoad({ state: "ready" });
      } else {
        setLoad({ state: "missing", id });
      }
      return;
    }
    const template = getTemplate(templateId ?? "blank") ?? getTemplate("blank");
    if (!template) return;
    const doc = template.build();
    store.getState().loadDocument(doc);
    const saved = savePage(doc);
    if (!saved.ok) console.error(`[pagecraft] Could not save new page: ${saved.error}`);
    router.replace(`/editor?id=${encodeURIComponent(doc.id)}`);
  }, [id, templateId, router, store]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (load.state === "missing") {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="mt-2 text-slate-600">No saved page with id “{load.id}” exists in this browser.</p>
          <Link href="/" className="mt-4 inline-block font-medium text-indigo-600 hover:underline">
            Back to your pages
          </Link>
        </div>
      </main>
    );
  }

  if (load.state === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50" aria-busy="true">
        <p className="text-slate-500">Loading editor…</p>
      </main>
    );
  }

  return <EditorShell />;
}
