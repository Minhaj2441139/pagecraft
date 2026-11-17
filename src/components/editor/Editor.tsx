"use client";

import {
  type Announcements,
  type ClientRect,
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import { getDefinition } from "@/blocks/registry";
import { useEditorStore } from "@/store/context";

import Canvas from "./Canvas";
import { type DragData, draggedType, type DropData, type DropTarget, isDropInsideDragged, resolveDropTarget, toMoveIndex } from "./dnd";
import Palette from "./Palette";

function area(rect: ClientRect | undefined): number {
  return rect ? rect.width * rect.height : Number.POSITIVE_INFINITY;
}

function DragChip({ label }: { label: string }) {
  return (
    <div className="pointer-events-none rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-lg">
      {label}
    </div>
  );
}

export interface EditorProps {
  toolbar?: ReactNode;
  panel?: ReactNode;
}

export default function Editor({ toolbar, panel }: EditorProps) {
  const store = useEditorStore();
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /**
   * Nested droppables overlap (a block inside a column inside a columns block).
   * Pick the smallest droppable under the pointer, i.e. the most specific one,
   * and never the dragged block's own subtree.
   */
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const drag = args.active.data.current as DragData | undefined;
      const tree = store.getState();
      const droppableContainers = args.droppableContainers.filter((container) => {
        const drop = container.data.current as DropData | undefined;
        return drop !== undefined && (drag === undefined || !isDropInsideDragged(tree, drag, drop));
      });
      return pointerWithin({ ...args, droppableContainers })
        .sort((a, b) => area(args.droppableRects.get(a.id)) - area(args.droppableRects.get(b.id)))
        .slice(0, 1);
    },
    [store],
  );

  const computeTarget = useCallback(
    (event: DragMoveEvent | DragEndEvent): DropTarget | null => {
      const { active, over, activatorEvent, delta } = event;
      if (!over) return null;
      const drag = active.data.current as DragData | undefined;
      const drop = over.data.current as DropData | undefined;
      if (!drag || !drop) return null;
      const startY = activatorEvent instanceof PointerEvent || activatorEvent instanceof MouseEvent ? activatorEvent.clientY : 0;
      const pointerY = startY + delta.y;
      const lowerHalf = pointerY > over.rect.top + over.rect.height / 2;
      return resolveDropTarget(store.getState(), drag, drop, lowerHalf);
    },
    [store],
  );

  const labelFor = useCallback(
    (data: DragData | undefined): string => {
      if (!data) return "block";
      const type = draggedType(store.getState(), data);
      return type ? `${getDefinition(type).label} block` : "block";
    },
    [store],
  );

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveDrag((event.active.data.current as DragData | undefined) ?? null);
  }, []);

  const onDragMove = useCallback(
    (event: DragMoveEvent) => {
      const target = computeTarget(event);
      store.getState().setDropIndicator(target ? { overId: target.overId, position: target.position } : null);
    },
    [computeTarget, store],
  );

  const finish = useCallback(() => {
    setActiveDrag(null);
    store.getState().setDropIndicator(null);
  }, [store]);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const target = computeTarget(event);
      const drag = event.active.data.current as DragData | undefined;
      finish();
      if (!target || !drag) return;
      const state = store.getState();
      if (drag.kind === "palette") {
        state.addBlock(drag.type, { parentId: target.parentId, index: target.index });
      } else {
        state.moveBlock(drag.id, target.parentId, toMoveIndex(state, drag.id, target));
        state.select(drag.id);
      }
    },
    [computeTarget, finish, store],
  );

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) => `Picked up ${labelFor(active.data.current as DragData)}.`,
      onDragOver: ({ active, over }) =>
        over ? `${labelFor(active.data.current as DragData)} is over a drop target.` : "Not over a drop target.",
      onDragEnd: ({ active, over }) =>
        over ? `Dropped ${labelFor(active.data.current as DragData)}.` : `${labelFor(active.data.current as DragData)} was not dropped.`,
      onDragCancel: ({ active }) => `Cancelled dragging ${labelFor(active.data.current as DragData)}.`,
    }),
    [labelFor],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
      accessibility={{ announcements }}
    >
      <div className="flex h-dvh flex-col bg-slate-50 text-slate-900">
        {toolbar}
        <div className="flex min-h-0 flex-1">
          <aside className="w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50" aria-label="Blocks">
            <Palette />
          </aside>
          <main className="flex min-w-0 flex-1 flex-col" aria-label="Editor canvas">
            <Canvas />
          </main>
          {panel && (
            <aside className="w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white" aria-label="Properties">
              {panel}
            </aside>
          )}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>{activeDrag ? <DragChip label={labelFor(activeDrag)} /> : null}</DragOverlay>
    </DndContext>
  );
}
