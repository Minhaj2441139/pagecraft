"use client";

import { renderPageToHtml } from "@pagecraft/export";
import { useEffect, useMemo, useRef } from "react";

import { useEditor, useEditorStore } from "@/store/context";

import DeviceToggle from "./DeviceToggle";

const PREVIEW_WIDTHS = { desktop: "100%", tablet: "768px", mobile: "390px" } as const;

/**
 * Full-screen preview of the *exported* HTML inside a sandboxed iframe, so
 * media and container queries respond to a real viewport of the device width.
 */
export default function PreviewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const store = useEditorStore();
  const device = useEditor((s) => s.device);
  const blocks = useEditor((s) => s.blocks);
  const rootIds = useEditor((s) => s.rootIds);
  const name = useEditor((s) => s.meta.name);
  // Re-render the HTML only when the document changes while open.
  const html = useMemo(
    () => (open ? renderPageToHtml({ ...store.getState().toDocument(), blocks, rootIds, name }) : ""),
    [open, blocks, rootIds, name, store],
  );

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="pc-preview-title"
      onClose={onClose}
      onCancel={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-slate-800 p-0 backdrop:bg-slate-900/70"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 bg-slate-900 px-4 py-2 text-white">
            <h2 id="pc-preview-title" className="text-sm font-semibold">
              Preview
            </h2>
            <DeviceToggle dark />
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
            >
              Close preview
            </button>
          </div>
          <div className="flex flex-1 justify-center overflow-auto p-4">
            <iframe
              title={`Page preview (${device})`}
              srcDoc={html}
              sandbox=""
              className="h-full rounded bg-white shadow-xl transition-[width] duration-200"
              style={{ width: PREVIEW_WIDTHS[device], maxWidth: "100%" }}
            />
          </div>
        </div>
      )}
    </dialog>
  );
}
