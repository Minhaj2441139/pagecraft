"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useState } from "react";

import { TEMPLATES } from "@/blocks/templates";
import { deletePage, importDocument, listPages, type PageSummary, savePage } from "@/lib/storage";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function PagesHome() {
  const router = useRouter();
  const [pages, setPages] = useState<PageSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // localStorage is only available after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off sync from an external store on mount
    setPages(listPages());
  }, []);

  const onDelete = (page: PageSummary) => {
    if (!window.confirm(`Delete “${page.name}”? This cannot be undone.`)) return;
    deletePage(page.id);
    setPages(listPages());
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const result = importDocument(await file.text());
      if (!result.ok) return setError(result.error);
      const saved = savePage(result.value);
      if (!saved.ok) return setError(saved.error);
      router.push(`/editor?id=${encodeURIComponent(result.value.id)}`);
    } catch (e) {
      console.error("[pagecraft] Import failed", e);
      setError("Could not read that file.");
    }
  };

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-bold text-indigo-600">◆ Pagecraft</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Your landing pages</h1>
        <p className="mt-2 text-slate-600">Drag blocks, preview on any device, export static HTML. Pages are saved in this browser.</p>
      </header>

      <section aria-labelledby="new-heading" className="mb-12">
        <h2 id="new-heading" className="mb-4 text-lg font-semibold">
          Start a new page
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.filter((t) => !t.hidden).map((t) => (
            <li key={t.id}>
              <Link
                href={`/editor?template=${t.id}`}
                className="block h-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-400 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              >
                <span className="block font-medium text-slate-900">{t.name}</span>
                <span className="mt-1 block text-sm text-slate-500">{t.description}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-3">
          <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 has-focus-visible:outline-2 has-focus-visible:outline-indigo-500">
            Import JSON…
            <input type="file" accept="application/json,.json" className="sr-only" onChange={onImport} />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="saved-heading">
        <h2 id="saved-heading" className="mb-4 text-lg font-semibold">
          Saved pages
        </h2>
        {pages === null ? (
          <p className="text-slate-500">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">No pages yet. Pick a template above.</p>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
            {pages.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <Link href={`/editor?id=${encodeURIComponent(p.id)}`} className="font-medium text-slate-900 hover:text-indigo-600 hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {p.blockCount} blocks · edited {dateFormat.format(p.updatedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  aria-label={`Delete ${p.name}`}
                  className="rounded-md px-2 py-1 text-sm text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-500"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
