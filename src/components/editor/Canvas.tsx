"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { BASE_CSS, type Block, blockClassName, blockStyleToObject, blockWrapperTag, renderBlockContent } from "@pagecraft/export";
import { createElement, type CSSProperties, type FocusEvent, memo, type MouseEvent, useCallback, useMemo } from "react";

import { getDefinition } from "@/blocks/registry";
import { blockAriaLabel } from "@/blocks/summary";
import { trackRender } from "@/lib/renderStats";
import { useEditor } from "@/store/context";
import { type Device, ROOT_DROP_ID } from "@/store/editor";

import { CONTAINER_PREFIX, type DragData, type DropData } from "./dnd";

export const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: "min(100%, 1280px)",
  tablet: "768px",
  mobile: "390px",
};

/**
 * Rendering strategy (see README → Performance):
 *
 * - `BlockNode` is memoized on `{ id, level }` and subscribes to *its own*
 *   block, selection flag and drop-indicator position with Zustand selectors.
 *   Because store updates are structurally shared, editing one block changes
 *   only that block's object, so only that node re-renders.
 * - dnd-kit re-renders every `useDraggable` / `useDroppable` consumer when the
 *   drag target changes. Those hooks live in `BlockNode`, while the expensive
 *   part (markup and children) lives in the memoized `BlockBody`, which bails
 *   out unless the block object itself changed.
 */

const BlockBody = memo(function BlockBody({ block, level }: { block: Block; level: number }) {
  trackRender("BlockBody");
  const style = useMemo(() => blockStyleToObject(block.style), [block.style]);
  // Containers render their children as React nodes; renderBlockContent returns "" for them.
  const html = useMemo(() => renderBlockContent(block), [block]);

  if (block.type === "columns") {
    const gridStyle: CSSProperties = {
      gridTemplateColumns: `repeat(${Math.max(1, block.children.length)}, minmax(0, 1fr))`,
      gap: `${block.props.gap}px`,
    };
    return (
      <div className={blockClassName(block)} style={style} role="group">
        <div className="pc-columns-grid" style={gridStyle}>
          {block.children.map((childId) => (
            <BlockNode key={childId} id={childId} level={level + 1} />
          ))}
        </div>
      </div>
    );
  }
  if (block.type === "column") {
    return (
      <div className={blockClassName(block)} style={style} role="group">
        {block.children.map((childId) => (
          <BlockNode key={childId} id={childId} level={level + 1} />
        ))}
        {block.children.length === 0 && <div className="pc-empty-column">Drop blocks here</div>}
      </div>
    );
  }
  return createElement(blockWrapperTag(block.type), {
    className: `${blockClassName(block)} pc-leaf`,
    style,
    dangerouslySetInnerHTML: { __html: html },
  });
});

const BlockNode = memo(function BlockNode({ id, level }: { id: string; level: number }) {
  trackRender("BlockNode");
  const block = useEditor((s) => s.blocks[id]);
  const selected = useEditor((s) => s.selectedId === id);
  // Roving tabindex: the canvas is a single tab stop (selected block, else the first block).
  const isFallbackFocus = useEditor((s) => s.selectedId === null && s.rootIds[0] === id);
  const position = useEditor((s) => (s.dropIndicator?.overId === id ? s.dropIndicator.position : null));
  const select = useEditor((s) => s.select);

  const isColumn = block?.type === "column";
  const dragData = useMemo<DragData>(() => ({ kind: "block", id }), [id]);
  const dropData = useMemo<DropData>(() => (isColumn ? { kind: "container", parentId: id } : { kind: "block", id }), [id, isColumn]);
  const drag = useDraggable({ id, data: dragData, disabled: isColumn });
  const drop = useDroppable({ id: isColumn ? `${CONTAINER_PREFIX}${id}` : `drop:${id}`, data: dropData });
  const { setNodeRef: setDragRef } = drag;
  const { setNodeRef: setDropRef } = drop;
  const setRef = useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef],
  );
  const onSelect = useCallback(
    (event: MouseEvent | FocusEvent) => {
      event.stopPropagation();
      select(id);
    },
    [id, select],
  );
  const ariaLabel = useMemo(() => (block ? blockAriaLabel(block) : ""), [block]);

  if (!block) return null;

  const className = ["pc-node", selected && "is-selected", position && `drop-${position}`, drag.isDragging && "is-dragging", isColumn && "pc-node-column"]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={setRef}
      {...drag.attributes}
      {...drag.listeners}
      role="treeitem"
      aria-roledescription={isColumn ? "column" : "block"}
      aria-label={ariaLabel}
      aria-selected={selected}
      aria-level={level}
      aria-expanded={block.children.length > 0 ? true : undefined}
      tabIndex={selected || isFallbackFocus ? 0 : -1}
      data-block-id={id}
      className={className}
      onClick={onSelect}
      onFocus={onSelect}
    >
      <span className="pc-node-label" aria-hidden="true">
        {getDefinition(block.type).label}
      </span>
      <BlockBody block={block} level={level} />
    </div>
  );
});

function EmptyCanvas() {
  return (
    <div className="pc-empty-page">
      <p className="text-base font-semibold text-slate-700">Your page is empty</p>
      <p className="text-sm text-slate-500">Drag a block here from the palette, or click one to add it.</p>
    </div>
  );
}

const ROOT_DROP: DropData = { kind: "container", parentId: null };

export default function Canvas() {
  trackRender("Canvas");
  const rootIds = useEditor((s) => s.rootIds);
  const rootActive = useEditor((s) => s.dropIndicator?.overId === ROOT_DROP_ID);
  const device = useEditor((s) => s.device);
  const select = useEditor((s) => s.select);
  const { setNodeRef } = useDroppable({ id: `${CONTAINER_PREFIX}root`, data: ROOT_DROP });
  const deselect = useCallback(() => select(null), [select]);

  return (
    <div className="pc-canvas-scroll" onClick={deselect}>
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
      <div className="pc-device-frame" style={{ width: DEVICE_WIDTHS[device] }} data-device={device}>
        <div ref={setNodeRef} className={`pc-page pc-canvas${rootActive ? " drop-inside" : ""}`} role="tree" aria-label="Page canvas">
          {rootIds.length === 0 ? <EmptyCanvas /> : rootIds.map((id) => <BlockNode key={id} id={id} level={1} />)}
          <div className={`pc-root-drop${rootActive ? " is-active" : ""}`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
