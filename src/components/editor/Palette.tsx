"use client";

import { useDraggable } from "@dnd-kit/core";

import { type BlockDefinition, PALETTE_BLOCKS, PALETTE_CATEGORIES } from "@/blocks/registry";
import { trackRender } from "@/lib/renderStats";
import { useEditor } from "@/store/context";

import { type DragData, PALETTE_PREFIX } from "./dnd";

function PaletteItem({ def }: { def: BlockDefinition }) {
  trackRender("PaletteItem");
  const addBlock = useEditor((s) => s.addBlock);
  const data: DragData = { kind: "palette", type: def.type };
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `${PALETTE_PREFIX}${def.type}`, data });

  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        // Pointer drags only: Enter/Space trigger a plain click-to-add instead.
        onPointerDown={(event) => listeners?.onPointerDown?.(event)}
        onClick={() => addBlock(def.type)}
        aria-label={`Add ${def.label} block`}
        title={def.description}
        className={`group flex w-full cursor-grab items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition hover:border-indigo-400 hover:shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 active:cursor-grabbing ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-md bg-indigo-50 font-semibold text-indigo-600 group-hover:bg-indigo-100"
        >
          {def.glyph}
        </span>
        <span className="min-w-0">
          <span className="block font-medium text-slate-800">{def.label}</span>
          <span className="block truncate text-xs text-slate-500">{def.description}</span>
        </span>
      </button>
    </li>
  );
}

export default function Palette() {
  return (
    <nav aria-label="Block palette" className="flex flex-col gap-5 p-4">
      <p className="text-xs text-slate-500">Drag a block onto the page, or click to insert it after the selection.</p>
      {PALETTE_CATEGORIES.map((category) => (
        <section key={category} aria-labelledby={`palette-${category}`}>
          <h2 id={`palette-${category}`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {category}
          </h2>
          <ul className="flex flex-col gap-2">
            {PALETTE_BLOCKS.filter((d) => d.category === category).map((def) => (
              <PaletteItem key={def.type} def={def} />
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
