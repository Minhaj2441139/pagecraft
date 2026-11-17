"use client";

import type { Align, Block, BlockStyle } from "@pagecraft/export";
import { type ReactNode, useId, useState } from "react";

import { getDefinition, type ItemField, MAX_COLUMNS, MIN_COLUMNS, type PropField } from "@/blocks/registry";
import { announce } from "@/lib/announce";
import { trackRender } from "@/lib/renderStats";
import { useEditor } from "@/store/context";

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";
const smallButton =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-40";

/* ------------------------------------------------------------ primitives */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-slate-200 px-4 py-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: "text" | "url";
  placeholder?: string;
}

function TextInput({ label, value, onChange, multiline, type = "text", placeholder }: TextInputProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-700">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} className={`${inputClass} min-h-20 resize-y`} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} type={type} className={inputClass} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  step?: number;
  placeholder?: string;
}

/**
 * Commits in-range values while typing; out-of-range intermediate input
 * (typing "1" on the way to "18" with min 10) stays as a local draft and is
 * clamped on blur instead of being rewritten mid-keystroke.
 */
function NumberInput({ label, value, onChange, min, max, step = 1, placeholder = "Default" }: NumberInputProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className={inputClass}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        value={draft ?? value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            setDraft(null);
            return onChange(undefined);
          }
          const n = Number(raw);
          if (Number.isFinite(n) && n >= min && n <= max) {
            setDraft(null);
            onChange(n);
          } else {
            setDraft(raw);
          }
        }}
        onBlur={() => {
          if (draft === null) return;
          const n = Number(draft);
          setDraft(null);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </div>
  );
}

function ColorInput({ label, value, fallback, onChange }: { label: string; value: string | undefined; fallback: string; onChange: (v: string | undefined) => void }) {
  const id = useId();
  const hex = value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs font-medium text-slate-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-slate-500">{value ?? "default"}</span>
        <input id={id} type="color" className="h-8 w-10 cursor-pointer rounded border border-slate-300 bg-white p-0.5" value={hex} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className={smallButton} onClick={() => onChange(undefined)} disabled={!value} aria-label={`Reset ${label.toLowerCase()}`}>
          Reset
        </button>
      </div>
    </div>
  );
}

function AlignInput({ value, onChange }: { value: Align | undefined; onChange: (v: Align | undefined) => void }) {
  const name = useId();
  const options: Array<{ value: Align | undefined; label: string }> = [
    { value: undefined, label: "Auto" },
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "right", label: "Right" },
  ];
  return (
    <fieldset>
      <legend className="mb-1 text-xs font-medium text-slate-700">Alignment</legend>
      <div className="grid grid-cols-4 overflow-hidden rounded-md border border-slate-300">
        {options.map((opt) => (
          <label
            key={opt.label}
            className="cursor-pointer border-r border-slate-300 py-1.5 text-center text-xs font-medium text-slate-700 last:border-r-0 has-checked:bg-indigo-600 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-indigo-500 has-focus-visible:ring-inset"
          >
            <input type="radio" className="sr-only" name={name} checked={value === opt.value} onChange={() => onChange(opt.value)} />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/* ------------------------------------------------------------ prop fields */

type Props = Record<string, unknown>;

function asString(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

function ItemFieldInput({ field, item, onChange }: { field: ItemField; item: Props; onChange: (value: unknown) => void }) {
  const value = item[field.key];
  if (field.kind === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
        <input type="checkbox" className="size-4 accent-indigo-600" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  }
  if (field.kind === "lines") {
    const lines = Array.isArray(value) ? (value as unknown[]).map(asString) : [];
    return <TextInput label={field.label} multiline value={lines.join("\n")} onChange={(v) => onChange(v.split("\n"))} />;
  }
  return (
    <TextInput
      label={field.label}
      value={asString(value)}
      multiline={field.kind === "textarea"}
      type={field.kind === "url" ? "url" : "text"}
      onChange={onChange}
    />
  );
}

function ListField({ block, field }: { block: Block; field: Extract<PropField, { kind: "list" }> }) {
  const updateProps = useEditor((s) => s.updateProps);
  const raw = (block.props as Props)[field.key];
  const items = Array.isArray(raw) ? (raw as Props[]) : [];
  const set = (next: Props[], coalesceKey?: string) => updateProps(block.id, { [field.key]: next }, { coalesceKey });

  const move = (from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    set(next);
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-xs font-medium text-slate-700">{field.label}</legend>
      {items.map((item, index) => (
        <div key={index} role="group" aria-label={`${field.itemLabel} ${index + 1}`} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              {field.itemLabel} {index + 1}
            </span>
            <div className="flex gap-1">
              <button type="button" className={smallButton} disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Move ${field.itemLabel} ${index + 1} up`}>
                ↑
              </button>
              <button type="button" className={smallButton} disabled={index === items.length - 1} onClick={() => move(index, index + 1)} aria-label={`Move ${field.itemLabel} ${index + 1} down`}>
                ↓
              </button>
              <button type="button" className={smallButton} onClick={() => set(items.filter((_, i) => i !== index))} aria-label={`Remove ${field.itemLabel} ${index + 1}`}>
                ✕
              </button>
            </div>
          </div>
          {field.itemFields.map((itemField) => (
            <ItemFieldInput
              key={itemField.key}
              field={itemField}
              item={item}
              onChange={(value) =>
                set(
                  items.map((it, i) => (i === index ? { ...it, [itemField.key]: value } : it)),
                  `${block.id}:${field.key}:${index}:${itemField.key}`,
                )
              }
            />
          ))}
        </div>
      ))}
      <button type="button" className={`${smallButton} self-start`} onClick={() => set([...items, field.createItem()])}>
        + Add {field.itemLabel.toLowerCase()}
      </button>
    </fieldset>
  );
}

function PropFieldInput({ block, field }: { block: Block; field: PropField }) {
  const updateProps = useEditor((s) => s.updateProps);
  const props = block.props as Props;
  const set = (value: unknown) => updateProps(block.id, { [field.key]: value }, { coalesceKey: `${block.id}:${field.key}` });

  switch (field.kind) {
    case "text":
    case "url":
    case "textarea":
      return (
        <TextInput
          label={field.label}
          value={asString(props[field.key])}
          multiline={field.kind === "textarea"}
          type={field.kind === "url" ? "url" : "text"}
          placeholder={field.kind === "url" ? "https://" : undefined}
          onChange={set}
        />
      );
    case "number": {
      const v = props[field.key];
      return (
        <NumberInput
          label={field.label}
          value={typeof v === "number" ? v : undefined}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(n) => set(n ?? field.min)}
        />
      );
    }
    case "select":
      return <SelectInput field={field} value={asString(props[field.key])} onChange={(v) => set(field.numeric ? Number(v) : v)} />;
    case "list":
      return <ListField block={block} field={field} />;
  }
}

function SelectInput({ field, value, onChange }: { field: Extract<PropField, { kind: "select" }>; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-700">
        {field.label}
      </label>
      <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ---------------------------------------------------------------- sections */

function StyleSection({ block }: { block: Block }) {
  const updateStyle = useEditor((s) => s.updateStyle);
  const set = <K extends keyof BlockStyle>(key: K, value: BlockStyle[K]) =>
    updateStyle(block.id, { [key]: value }, { coalesceKey: `${block.id}:style:${key}` });

  return (
    <Section title="Style">
      <ColorInput label="Text colour" value={block.style.textColor} fallback="#111827" onChange={(v) => set("textColor", v)} />
      <ColorInput label="Background" value={block.style.background} fallback="#ffffff" onChange={(v) => set("background", v)} />
      <div className="grid grid-cols-2 gap-3">
        <NumberInput label="Padding Y (px)" value={block.style.paddingY} min={0} max={240} step={4} onChange={(v) => set("paddingY", v)} />
        <NumberInput label="Padding X (px)" value={block.style.paddingX} min={0} max={240} step={4} onChange={(v) => set("paddingX", v)} />
      </div>
      <NumberInput label="Font size (px)" value={block.style.fontSize} min={10} max={48} onChange={(v) => set("fontSize", v)} />
      <AlignInput value={block.style.align} onChange={(v) => set("align", v)} />
    </Section>
  );
}

function ColumnsSection({ block }: { block: Block }) {
  const setColumnCount = useEditor((s) => s.setColumnCount);
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-slate-700">
        Number of columns
      </label>
      <select id={id} className={inputClass} value={block.children.length} onChange={(e) => setColumnCount(block.id, Number(e.target.value))}>
        {Array.from({ length: MAX_COLUMNS - MIN_COLUMNS + 1 }, (_, i) => i + MIN_COLUMNS).map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500">Removing columns moves their blocks into the last column.</p>
    </div>
  );
}

function BlockActions({ block }: { block: Block }) {
  const moveSelected = useEditor((s) => s.moveSelected);
  const duplicateBlock = useEditor((s) => s.duplicateBlock);
  const deleteBlock = useEditor((s) => s.deleteBlock);
  // Primitive selectors: returning a fresh object here would re-render forever.
  const siblings = useEditor((s) => (block.parentId === null ? s.rootIds : s.blocks[block.parentId]?.children));
  const position = { index: siblings?.indexOf(block.id) ?? -1, count: siblings?.length ?? 0 };
  const label = getDefinition(block.type).label;
  if (block.type === "column") return null;

  return (
    <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label={`${label} actions`}>
      <button type="button" className={smallButton} disabled={position.index <= 0} onClick={() => moveSelected(-1)} title="Alt+↑">
        Move up
      </button>
      <button type="button" className={smallButton} disabled={position.index >= position.count - 1} onClick={() => moveSelected(1)} title="Alt+↓">
        Move down
      </button>
      <button
        type="button"
        className={smallButton}
        onClick={() => {
          const copy = duplicateBlock(block.id);
          if (copy) announce(`Duplicated ${label}`);
        }}
        title="Ctrl+D"
      >
        Duplicate
      </button>
      <button
        type="button"
        className={`${smallButton} border-red-200 text-red-700 hover:bg-red-50`}
        onClick={() => {
          deleteBlock(block.id);
          announce(`Deleted ${label}`);
        }}
        title="Delete"
      >
        Delete
      </button>
    </div>
  );
}

function PageSettings() {
  const name = useEditor((s) => s.meta.name);
  const renamePage = useEditor((s) => s.renamePage);
  const blockCount = useEditor((s) => Object.keys(s.blocks).length);
  return (
    <>
      <Section title="Page">
        <TextInput label="Page name" value={name} onChange={renamePage} />
        <p className="text-xs text-slate-500">{blockCount} blocks on this page.</p>
      </Section>
      <Section title="Keyboard shortcuts">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs text-slate-600">
          {[
            ["↑ / ↓", "Select previous / next block"],
            ["Alt + ↑ / ↓", "Move block"],
            ["Ctrl + D", "Duplicate"],
            ["Delete", "Delete block"],
            ["Ctrl + Z", "Undo"],
            ["Ctrl + Shift + Z", "Redo"],
            ["Ctrl + S", "Save now"],
            ["Esc", "Deselect"],
          ].map(([keys, action]) => (
            <div key={keys} className="contents">
              <dt>
                <kbd className="rounded border border-slate-300 bg-slate-50 px-1 font-mono">{keys}</kbd>
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}

export default function PropertiesPanel() {
  trackRender("PropertiesPanel");
  const block = useEditor((s) => (s.selectedId ? s.blocks[s.selectedId] : undefined));

  if (!block) {
    return (
      <div aria-labelledby="pc-props-title">
        <h2 id="pc-props-title" className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">
          Page settings
        </h2>
        <PageSettings />
      </div>
    );
  }

  const def = getDefinition(block.type);
  return (
    <div aria-labelledby="pc-props-title">
      <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3">
        <h2 id="pc-props-title" className="text-sm font-semibold">
          {def.label} <span className="font-normal text-slate-500">properties</span>
        </h2>
        <BlockActions block={block} />
      </div>
      {(def.fields.length > 0 || block.type === "columns") && (
        <Section title="Content">
          {block.type === "columns" && <ColumnsSection block={block} />}
          {def.fields.map((field) => (
            <PropFieldInput key={field.key} block={block} field={field} />
          ))}
        </Section>
      )}
      <StyleSection block={block} />
    </div>
  );
}
