"use client";

import { useEditor } from "@/store/context";
import type { Device } from "@/store/editor";

const DEVICES: Array<{ id: Device; label: string; glyph: string }> = [
  { id: "desktop", label: "Desktop", glyph: "🖥" },
  { id: "tablet", label: "Tablet", glyph: "▭" },
  { id: "mobile", label: "Mobile", glyph: "▯" },
];

export default function DeviceToggle({ dark = false }: { dark?: boolean }) {
  const device = useEditor((s) => s.device);
  const setDevice = useEditor((s) => s.setDevice);
  return (
    <div role="group" aria-label="Preview device" className={`flex rounded-lg p-0.5 ${dark ? "bg-white/10" : "bg-slate-100"}`}>
      {DEVICES.map((d) => {
        const active = device === d.id;
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={active}
            onClick={() => setDevice(d.id)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-indigo-500 ${
              active ? (dark ? "bg-white text-slate-900" : "bg-white text-slate-900 shadow-sm") : dark ? "text-white/80 hover:text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span aria-hidden="true">{d.glyph}</span>
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
