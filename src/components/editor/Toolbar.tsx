"use client";

import { renderPageToHtml } from "@pagecraft/export";
import Link from "next/link";

import { announce } from "@/lib/announce";
import { downloadFile, slugify } from "@/lib/download";
import { useEditor, useEditorStore } from "@/store/context";

import DeviceToggle from "./DeviceToggle";
import type { SaveStatus } from "./useAutosave";

const button =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-40";

function statusText(status: SaveStatus): string {
  switch (status.state) {
    case "saved":
      return "All changes saved";
    case "pending":
      return "Saving…";
    case "error":
      return status.message;
  }
}

export interface ToolbarProps {
  status: SaveStatus;
  onSave: () => void;
  onPreview: () => void;
}

export default function Toolbar({ status, onSave, onPreview }: ToolbarProps) {
  const store = useEditorStore();
  const name = useEditor((s) => s.meta.name);
  const renamePage = useEditor((s) => s.renamePage);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);

  const exportHtml = () => {
    const doc = store.getState().toDocument();
    downloadFile(`${slugify(doc.name)}.html`, renderPageToHtml(doc), "text/html;charset=utf-8");
    announce("HTML file downloaded");
  };

  const exportJson = () => {
    const doc = store.getState().toDocument();
    downloadFile(`${slugify(doc.name)}.pagecraft.json`, JSON.stringify(doc, null, 2), "application/json");
    announce("JSON file downloaded");
  };

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
      <Link href="/" className="text-sm font-bold text-indigo-600 hover:text-indigo-800" aria-label="Pagecraft, back to all pages">
        ◆ Pagecraft
      </Link>
      <input
        aria-label="Page name"
        value={name}
        onChange={(e) => renamePage(e.target.value)}
        className="w-56 rounded-md border border-transparent px-2 py-1 text-sm font-medium hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
      />
      <div className="flex gap-1" role="group" aria-label="History">
        <button type="button" className={button} onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
          ↶
        </button>
        <button type="button" className={button} onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)">
          ↷
        </button>
      </div>
      <DeviceToggle />
      <div className="ml-auto flex items-center gap-2">
        <span role="status" className={`text-xs ${status.state === "error" ? "text-red-600" : "text-slate-500"}`}>
          {statusText(status)}
        </span>
        <button type="button" className={button} onClick={onSave} title="Save (Ctrl+S)">
          Save
        </button>
        <button type="button" className={button} onClick={exportJson}>
          JSON
        </button>
        <button type="button" className={button} onClick={onPreview}>
          Preview
        </button>
        <button
          type="button"
          onClick={exportHtml}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          Export HTML
        </button>
      </div>
    </header>
  );
}
