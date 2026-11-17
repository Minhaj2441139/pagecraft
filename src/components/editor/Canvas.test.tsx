import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createEditorStore } from "@/store/editor";

import { renderEditor } from "./test-utils";

const canvas = () => screen.getByRole("tree", { name: "Page canvas" });
const items = () => within(canvas()).queryAllByRole("treeitem");

describe("Canvas", () => {
  it("shows an empty state, then renders blocks added from the palette", async () => {
    const user = userEvent.setup();
    renderEditor();
    expect(within(canvas()).getByText("Your page is empty")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Hero block" }));
    await user.click(screen.getByRole("button", { name: "Add Heading block" }));

    expect(items().map((el) => el.getAttribute("aria-label"))).toEqual([
      "Hero: Build something people love",
      "Heading: Section heading",
    ]);
    // Rendered through the shared export renderer.
    expect(within(canvas()).getByRole("heading", { level: 1, name: "Build something people love" })).toBeInTheDocument();
  });

  it("supports keyboard-only adding via the palette (Enter)", async () => {
    const user = userEvent.setup();
    const { store } = renderEditor();
    screen.getByRole("button", { name: "Add Text block" }).focus();
    await user.keyboard("{Enter}");
    expect(store.getState().rootIds).toHaveLength(1);
  });

  it("selects a block on click and exposes selection to assistive tech", async () => {
    const user = userEvent.setup();
    const store = createEditorStore();
    const a = store.getState().addBlock("heading")!;
    store.getState().addBlock("text");
    renderEditor(store);

    const heading = items()[0]!;
    await user.click(heading);
    expect(store.getState().selectedId).toBe(a);
    expect(heading).toHaveAttribute("aria-selected", "true");
    expect(heading).toHaveAttribute("tabindex", "0");
    expect(items()[1]).toHaveAttribute("tabindex", "-1");
  });

  it("renders nested columns at the correct tree level", () => {
    const store = createEditorStore();
    const cols = store.getState().addBlock("columns")!;
    const col = store.getState().blocks[cols]!.children[0]!;
    store.getState().addBlock("button", { parentId: col });
    renderEditor(store);

    const levels = items().map((el) => [el.getAttribute("aria-roledescription"), el.getAttribute("aria-level")]);
    expect(levels).toEqual([
      ["block", "1"],
      ["column", "2"],
      ["block", "3"],
      ["column", "2"],
    ]);
    expect(within(canvas()).getByText("Drop blocks here")).toBeInTheDocument();
  });

  it("re-renders when the store changes outside React", () => {
    const store = createEditorStore();
    const a = store.getState().addBlock("heading")!;
    renderEditor(store);
    act(() => store.getState().updateProps(a, { text: "Changed" }));
    expect(within(canvas()).getByRole("heading", { name: "Changed" })).toBeInTheDocument();
  });
});

describe("keyboard shortcuts", () => {
  function setup() {
    const store = createEditorStore();
    const s = store.getState();
    const ids = [s.addBlock("heading")!, s.addBlock("text")!, s.addBlock("button")!];
    s.select(ids[0]!);
    const utils = renderEditor(store);
    items()[0]!.focus();
    return { ...utils, ids, user: userEvent.setup() };
  }

  it("navigates with arrows and moves with Alt+arrows", async () => {
    const { store, ids, user } = setup();
    await user.keyboard("{ArrowDown}");
    expect(store.getState().selectedId).toBe(ids[1]);
    await user.keyboard("{Alt>}{ArrowUp}{/Alt}");
    expect(store.getState().rootIds).toEqual([ids[1], ids[0], ids[2]]);
  });

  it("duplicates, deletes, undoes and redoes", async () => {
    const { store, ids, user } = setup();
    await user.keyboard("{Control>}d{/Control}");
    expect(store.getState().rootIds).toHaveLength(4);
    const copy = store.getState().selectedId;
    expect(copy).not.toBe(ids[0]);

    await user.keyboard("{Delete}");
    expect(store.getState().rootIds).toEqual(ids);

    await user.keyboard("{Control>}z{/Control}");
    expect(store.getState().rootIds).toHaveLength(4);
    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(store.getState().rootIds).toEqual(ids);
  });

  it("does not delete blocks while typing in a field", async () => {
    const { store, user } = setup();
    const field = screen.getByLabelText("Text");
    await user.click(field);
    await user.keyboard("{Backspace}");
    expect(store.getState().rootIds).toHaveLength(3);
    expect((store.getState().blocks[store.getState().selectedId!]!.props as { text: string }).text).toBe("Section headin");
  });

  it("clears selection with Escape", async () => {
    const { store, user } = setup();
    await user.keyboard("{Escape}");
    expect(store.getState().selectedId).toBeNull();
  });
});
