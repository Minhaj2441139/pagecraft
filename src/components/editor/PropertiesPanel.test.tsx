import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { EditorStoreProvider } from "@/store/context";
import { createEditorStore, type EditorStore } from "@/store/editor";

import PropertiesPanel from "./PropertiesPanel";

function renderPanel(store: EditorStore) {
  render(
    <EditorStoreProvider store={store}>
      <PropertiesPanel />
    </EditorStoreProvider>,
  );
  return userEvent.setup();
}

const props = (store: EditorStore, id: string) => store.getState().blocks[id]!.props as Record<string, unknown>;

describe("PropertiesPanel", () => {
  it("shows page settings when nothing is selected and renames the page", async () => {
    const store = createEditorStore();
    const user = renderPanel(store);
    expect(screen.getByRole("heading", { name: "Page settings" })).toBeInTheDocument();
    const name = screen.getByLabelText("Page name");
    await user.clear(name);
    await user.type(name, "Launch");
    expect(store.getState().meta.name).toBe("Launch");
  });

  it("edits text props and undoes the whole typing burst in one step", async () => {
    const store = createEditorStore();
    const id = store.getState().addBlock("hero")!;
    const user = renderPanel(store);

    const title = screen.getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Hello");
    expect(props(store, id).title).toBe("Hello");

    store.getState().undo();
    expect(props(store, id).title).toBe("Build something people love");
  });

  it("edits numeric selects as numbers", async () => {
    const store = createEditorStore();
    const id = store.getState().addBlock("heading")!;
    const user = renderPanel(store);
    await user.selectOptions(screen.getByLabelText("Level"), "H1");
    expect(props(store, id).level).toBe(1);
  });

  it("edits style: padding, font size, alignment and colour reset", async () => {
    const store = createEditorStore();
    const id = store.getState().addBlock("text")!;
    store.getState().updateStyle(id, { textColor: "#ff0000" });
    const user = renderPanel(store);

    await user.type(screen.getByLabelText("Padding Y (px)"), "32");
    await user.type(screen.getByLabelText("Font size (px)"), "18");
    await user.click(screen.getByRole("radio", { name: "Center" }));
    await user.click(screen.getByRole("button", { name: "Reset text colour" }));

    expect(store.getState().blocks[id]!.style).toEqual({ paddingY: 32, fontSize: 18, align: "center" });

    await user.clear(screen.getByLabelText("Padding Y (px)"));
    expect(store.getState().blocks[id]!.style.paddingY).toBeUndefined();

    // Out-of-range values are clamped on blur, not mid-typing.
    const fontSize = screen.getByLabelText("Font size (px)");
    await user.clear(fontSize);
    await user.type(fontSize, "500");
    await user.tab();
    expect(store.getState().blocks[id]!.style.fontSize).toBe(48);
  });

  it("adds, edits, reorders and removes list items", async () => {
    const store = createEditorStore();
    const id = store.getState().addBlock("faq")!;
    const user = renderPanel(store);
    const items = () => props(store, id).items as Array<{ question: string }>;

    await user.click(screen.getByRole("button", { name: "+ Add question" }));
    expect(items()).toHaveLength(3);

    const third = screen.getByRole("group", { name: "Question 3" });
    const q = within(third).getByLabelText("Question");
    await user.clear(q);
    await user.type(q, "Third?");
    expect(items()[2]!.question).toBe("Third?");

    await user.click(screen.getByRole("button", { name: "Move Question 3 up" }));
    expect(items()[1]!.question).toBe("Third?");

    await user.click(screen.getByRole("button", { name: "Remove Question 1" }));
    expect(items().map((i) => i.question)).toEqual(["Third?", "Do you offer refunds?"]);
  });

  it("edits pricing features as one entry per line", async () => {
    const store = createEditorStore();
    const id = store.getState().addBlock("pricing")!;
    const user = renderPanel(store);
    const plan = screen.getByRole("group", { name: "Plan 1" });
    const features = within(plan).getByLabelText("Features (one per line)");
    await user.clear(features);
    await user.type(features, "A{Enter}B");
    expect((props(store, id).plans as Array<{ features: string[] }>)[0]!.features).toEqual(["A", "B"]);
  });

  it("changes the column count of a columns block", async () => {
    const store = createEditorStore();
    const id = store.getState().addBlock("columns")!;
    const user = renderPanel(store);
    await user.selectOptions(screen.getByLabelText("Number of columns"), "3");
    expect(store.getState().blocks[id]!.children).toHaveLength(3);
  });

  it("runs block actions from the toolbar", async () => {
    const store = createEditorStore();
    const a = store.getState().addBlock("heading", { parentId: null })!;
    const b = store.getState().addBlock("text", { parentId: null })!;
    const user = renderPanel(store);

    expect(screen.getByRole("button", { name: "Move down" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move up" }));
    expect(store.getState().rootIds).toEqual([b, a]);

    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(store.getState().rootIds).toHaveLength(3);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(store.getState().rootIds).toEqual([b, a]);
  });
});
