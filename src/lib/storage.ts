import { type Block, type BlockMap, type BlockStyle, type PageDocument, SCHEMA_VERSION } from "@pagecraft/export";

import { BLOCK_DEFINITIONS, canContain } from "@/blocks/registry";

import { createId } from "./id";

export const INDEX_KEY = "pagecraft:pages";
export const PAGE_KEY_PREFIX = "pagecraft:page:";

export interface PageSummary {
  id: string;
  name: string;
  updatedAt: number;
  blockCount: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

let fallback: StorageLike | null = null;

/** `localStorage` when usable; an in-memory store otherwise (SSR, privacy mode). */
export function defaultStorage(): StorageLike {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch {
    // Accessing localStorage can throw when storage is blocked.
  }
  fallback ??= memoryStorage();
  return fallback;
}

/* ---------------------------------------------------------------- validation */

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

const STYLE_NUMBER_KEYS = ["paddingY", "paddingX", "fontSize"] as const;
const STYLE_STRING_KEYS = ["textColor", "background"] as const;

function normalizeStyle(raw: unknown): BlockStyle {
  if (!isObject(raw)) return {};
  const style: BlockStyle = {};
  for (const key of STYLE_NUMBER_KEYS) {
    const v = raw[key];
    if (typeof v === "number" && Number.isFinite(v)) style[key] = v;
  }
  for (const key of STYLE_STRING_KEYS) {
    const v = raw[key];
    if (typeof v === "string" && v) style[key] = v;
  }
  if (raw.align === "left" || raw.align === "center" || raw.align === "right") style.align = raw.align;
  return style;
}

/**
 * Fill missing props from the block's defaults and drop values whose type
 * does not match the default (e.g. a string where a list is expected), so the
 * renderer never sees malformed props from an imported file.
 */
function normalizeProps(type: Block["type"], raw: unknown): Record<string, unknown> {
  const defaults = BLOCK_DEFINITIONS[type].createProps() as Record<string, unknown>;
  if (!isObject(raw)) return defaults;
  const out: Record<string, unknown> = { ...defaults };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const value = raw[key];
    if (value === undefined) continue;
    if (Array.isArray(defaultValue)) {
      if (Array.isArray(value)) out[key] = value.filter(isObject).map((item) => normalizeItem(defaultValue[0], item));
    } else if (typeof value === typeof defaultValue) {
      out[key] = value;
    }
  }
  return out;
}

function normalizeItem(template: unknown, item: Record<string, unknown>): Record<string, unknown> {
  if (!isObject(template)) return item;
  const out: Record<string, unknown> = {};
  for (const [key, defaultValue] of Object.entries(template)) {
    const value = item[key];
    if (Array.isArray(defaultValue)) out[key] = isStringArray(value) ? value : [];
    else out[key] = typeof value === typeof defaultValue ? value : defaultValue;
  }
  return out;
}

/** Validate unknown JSON as a page document. Structural problems are errors; prop drift is repaired. */
export function parseDocument(input: unknown): Result<PageDocument> {
  if (!isObject(input)) return { ok: false, error: "Not a Pagecraft page (expected a JSON object)." };
  if (input.version !== SCHEMA_VERSION) return { ok: false, error: `Unsupported page version: ${String(input.version)}.` };
  if (typeof input.id !== "string" || !input.id) return { ok: false, error: "Page is missing an id." };
  if (!isStringArray(input.rootIds)) return { ok: false, error: "Page rootIds must be a list of ids." };
  if (!isObject(input.blocks)) return { ok: false, error: "Page blocks must be an object." };

  const rawBlocks = input.blocks;
  const blocks: BlockMap = {};
  const seen = new Set<string>();

  const visit = (id: string, parentId: string | null, parentType: Block["type"] | null): string | null => {
    const raw = rawBlocks[id];
    if (!isObject(raw)) return `Block "${id}" is missing.`;
    if (seen.has(id)) return `Block "${id}" appears more than once.`;
    seen.add(id);
    const type = raw.type;
    if (typeof type !== "string" || !(type in BLOCK_DEFINITIONS)) return `Block "${id}" has unknown type "${String(type)}".`;
    const blockType = type as Block["type"];
    if (!canContain(parentType, blockType)) return `A ${blockType} block cannot be placed inside ${parentType ?? "the page"}.`;
    const children = isStringArray(raw.children) ? raw.children : [];
    blocks[id] = {
      id,
      type: blockType,
      props: normalizeProps(blockType, raw.props),
      style: normalizeStyle(raw.style),
      parentId,
      children,
    } as Block;
    for (const childId of children) {
      const error = visit(childId, id, blockType);
      if (error) return error;
    }
    return null;
  };

  for (const id of input.rootIds) {
    const error = visit(id, null, null);
    if (error) return { ok: false, error };
  }

  const now = Date.now();
  return {
    ok: true,
    value: {
      version: SCHEMA_VERSION,
      id: input.id,
      name: typeof input.name === "string" && input.name.trim() ? input.name : "Untitled page",
      createdAt: typeof input.createdAt === "number" ? input.createdAt : now,
      updatedAt: typeof input.updatedAt === "number" ? input.updatedAt : now,
      rootIds: [...input.rootIds],
      // Unreachable blocks in the input are dropped.
      blocks,
    },
  };
}

/* ------------------------------------------------------------------ storage */

function readIndex(storage: StorageLike): PageSummary[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(INDEX_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is PageSummary => isObject(p) && typeof p.id === "string" && typeof p.name === "string" && typeof p.updatedAt === "number",
    );
  } catch {
    return [];
  }
}

export function listPages(storage: StorageLike = defaultStorage()): PageSummary[] {
  return readIndex(storage).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadPage(id: string, storage: StorageLike = defaultStorage()): PageDocument | null {
  try {
    const raw = storage.getItem(PAGE_KEY_PREFIX + id);
    if (!raw) return null;
    const result = parseDocument(JSON.parse(raw));
    if (!result.ok) {
      console.error(`[pagecraft] Saved page "${id}" is invalid: ${result.error}`);
      return null;
    }
    return result.value;
  } catch (error) {
    console.error(`[pagecraft] Could not read saved page "${id}"`, error);
    return null;
  }
}

export function savePage(doc: PageDocument, storage: StorageLike = defaultStorage()): Result<void> {
  try {
    storage.setItem(PAGE_KEY_PREFIX + doc.id, JSON.stringify(doc));
    const summary: PageSummary = {
      id: doc.id,
      name: doc.name,
      updatedAt: doc.updatedAt,
      blockCount: Object.keys(doc.blocks).length,
    };
    const index = readIndex(storage).filter((p) => p.id !== doc.id);
    storage.setItem(INDEX_KEY, JSON.stringify([summary, ...index]));
    return { ok: true, value: undefined };
  } catch (error) {
    const quota = error instanceof DOMException && (error.name === "QuotaExceededError" || error.code === 22);
    return {
      ok: false,
      error: quota ? "Browser storage is full. Delete some pages or export this one as JSON." : "Could not save the page.",
    };
  }
}

export function deletePage(id: string, storage: StorageLike = defaultStorage()): void {
  try {
    storage.removeItem(PAGE_KEY_PREFIX + id);
    storage.setItem(INDEX_KEY, JSON.stringify(readIndex(storage).filter((p) => p.id !== id)));
  } catch (error) {
    console.error(`[pagecraft] Could not delete page "${id}"`, error);
  }
}

/** Parse an imported JSON file and give it a fresh id so it never overwrites an existing page. */
export function importDocument(json: string): Result<PageDocument> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "The file is not valid JSON." };
  }
  const result = parseDocument(parsed);
  if (!result.ok) return result;
  const now = Date.now();
  return { ok: true, value: { ...result.value, id: createId("p"), createdAt: now, updatedAt: now } };
}
