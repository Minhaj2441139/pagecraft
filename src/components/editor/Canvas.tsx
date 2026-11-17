"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  BASE_CSS,
  type Block,
  type BlockMap,
  blockClassName,
  blockStyleToObject,
  blockWrapperTag,
  renderBlockContent,
} from "@pagecraft/export";
import { createElement, type CSSProperties, type FocusEvent, type MouseEvent, type ReactNode, useCallback } from "react";

import { getDefinition } from "@/blocks/registry";
import { blockAriaLabel } from "@/blocks/summary";
import { useEditor } from "@/store/context";
import { type Device, type DropIndicator, ROOT_DROP_ID } from "@/store/editor";

import { CONTAINER_PREFIX, type DragData, type DropData } from "./dnd";

export const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: "min(100%, 1280px)",
  tablet: "768px",
  mobile: "390px",
};

interface BlockNodeProps {
  block: Block;
  blocks: BlockMap;
  selectedId: string | null;
  indicator: DropIndicator | null;
  level: number;
}

/**
 * NAIVE implementation (intentional baseline for the performance case study):
 * the whole tree receives the full block map and selection as props and no
 * component is memoized, so every edit re-renders every block.
 */
function BlockNode({ block, blocks, selectedId, indicator, level }: BlockNodeProps) {
  const select = useEditor((s) => s.select);
  const isColumn = block.type === "column";

  const dragData: DragData = { kind: "block", id: block.id };
  const dropData: DropData = isColumn ? { kind: "container", parentId: block.id } : { kind: "block", id: block.id };
  const drag = useDraggable({ id: block.id, data: dragData, disabled: isColumn });
  const drop = useDroppable({ id: isColumn ? `${CONTAINER_PREFIX}${block.id}` : `drop:${block.id}`, data: dropData });
  const { setNodeRef: setDragRef } = drag;
  const { setNodeRef: setDropRef } = drop;
  const setRef = useCallback(
    (node: HTMLElement | null) => {
      setDragRef(node);
      setDropRef(node);
    },
    [setDragRef, setDropRef],
  );

  const selected = selectedId === block.id;
  // Roving tabindex: the canvas is a single tab stop (selected block, else the first block).
  const isFallbackFocus = useEditor((s) => s.selectedId === null && s.rootIds[0] === block.id);
  const position = indicator?.overId === block.id ? indicator.position : null;
  const def = getDefinition(block.type);

  const onSelect = (event: MouseEvent | FocusEvent) => {
    event.stopPropagation();
    select(block.id);
  };

  const className = [
    "pc-node",
    selected && "is-selected",
    position && `drop-${position}`,
    drag.isDragging && "is-dragging",
    isColumn && "pc-node-column",
  ]
    .filter(Boolean)
    .join(" ");

  const children = block.children.map((childId) => {
    const child = blocks[childId];
    return child ? (
      <BlockNode key={childId} block={child} blocks={blocks} selectedId={selectedId} indicator={indicator} level={level + 1} />
    ) : null;
  });

  let content: ReactNode;
  if (block.type === "columns") {
    const gridStyle: CSSProperties = {
      gridTemplateColumns: `repeat(${Math.max(1, block.children.length)}, minmax(0, 1fr))`,
      gap: `${block.props.gap}px`,
    };
    content = (
      <div className={blockClassName(block)} style={blockStyleToObject(block.style)} role="group">
        <div className="pc-columns-grid" style={gridStyle}>
          {children}
        </div>
      </div>
    );
  } else if (block.type === "column") {
    content = (
      <div className={blockClassName(block)} style={blockStyleToObject(block.style)} role="group">
        {children}
        {block.children.length === 0 && <div className="pc-empty-column">Drop blocks here</div>}
      </div>
    );
  } else {
    content = createElement(blockWrapperTag(block.type), {
      className: `${blockClassName(block)} pc-leaf`,
      style: blockStyleToObject(block.style),
      dangerouslySetInnerHTML: { __html: renderBlockContent(block) },
    });
  }

  return (
    <div
      ref={setRef}
      {...drag.attributes}
      {...drag.listeners}
      role="treeitem"
      aria-roledescription={isColumn ? "column" : "block"}
      aria-label={blockAriaLabel(block)}
      aria-selected={selected}
      aria-level={level}
      aria-expanded={block.children.length > 0 ? true : undefined}
      tabIndex={selected || isFallbackFocus ? 0 : -1}
      data-block-id={block.id}
      className={className}
      onClick={onSelect}
      onFocus={onSelect}
    >
      <span className="pc-node-label" aria-hidden="true">
        {def.label}
      </span>
      {content}
    </div>
  );
}

function EmptyCanvas() {
  return (
    <div className="pc-empty-page">
      <p className="text-base font-semibold text-slate-700">Your page is empty</p>
      <p className="text-sm text-slate-500">Drag a block here from the palette, or click one to add it.</p>
    </div>
  );
}

export default function Canvas() {
  const rootIds = useEditor((s) => s.rootIds);
  const blocks = useEditor((s) => s.blocks);
  const selectedId = useEditor((s) => s.selectedId);
  const indicator = useEditor((s) => s.dropIndicator);
  const device = useEditor((s) => s.device);
  const select = useEditor((s) => s.select);

  const rootDrop: DropData = { kind: "container", parentId: null };
  const { setNodeRef } = useDroppable({ id: `${CONTAINER_PREFIX}root`, data: rootDrop });
  const rootActive = indicator?.overId === ROOT_DROP_ID;

  return (
    <div className="pc-canvas-scroll" onClick={() => select(null)}>
      <style dangerouslySetInnerHTML={{ __html: BASE_CSS }} />
      <div className="pc-device-frame" style={{ width: DEVICE_WIDTHS[device] }} data-device={device}>
        <div
          ref={setNodeRef}
          className={`pc-page pc-canvas${rootActive ? " drop-inside" : ""}`}
          role="tree"
          aria-label="Page canvas"
        >
          {rootIds.length === 0 ? (
            <EmptyCanvas />
          ) : (
            rootIds.map((id) => {
              const block = blocks[id];
              return block ? (
                <BlockNode key={id} block={block} blocks={blocks} selectedId={selectedId} indicator={indicator} level={1} />
              ) : null;
            })
          )}
          <div className={`pc-root-drop${rootActive ? " is-active" : ""}`} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
