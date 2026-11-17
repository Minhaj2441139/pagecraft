import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadFile } from "@/lib/download";
import { listPages, loadPage } from "@/lib/storage";
import { EditorStoreProvider } from "@/store/context";
import { createEditorStore, type EditorStore } from "@/store/editor";

import EditorShell from "./EditorShell";
import { AUTOSAVE_DELAY_MS } from "./useAutosave";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/download")>()),
  downloadFile: vi.fn(),
}));

let store: EditorStore;

function renderShell() {
  render(
    <EditorStoreProvider store={store}>
      <EditorShell />
    </EditorStoreProvider>,
  );
}

beforeEach(() => {
  store = createEditorStore();
  store.getState().addBlock("hero");
  store.getState().renamePage("Launch page");
  vi.mocked(downloadFile).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EditorShell", () => {
  it("autosaves after a pause and reports status", async () => {
    vi.useFakeTimers();
    renderShell();
    const id = store.getState().selectedId!;
    act(() => store.getState().updateProps(id, { title: "Autosaved" }));
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    expect(loadPage(store.getState().meta.id)).toBeNull();

    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 10));
    expect(screen.getByText("All changes saved")).toBeInTheDocument();
    const saved = loadPage(store.getState().meta.id);
    expect((saved?.blocks[id]?.props as { title: string }).title).toBe("Autosaved");
    expect(listPages()[0]?.name).toBe("Launch page");
  });

  it("saves immediately with the Save button and Ctrl+S", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(loadPage(store.getState().meta.id)).not.toBeNull();

    window.localStorage.clear();
    await user.keyboard("{Control>}s{/Control}");
    expect(loadPage(store.getState().meta.id)).not.toBeNull();
  });

  it("undoes and redoes from the toolbar and disables buttons at the ends", async () => {
    const user = userEvent.setup();
    renderShell();
    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });
    expect(redo).toBeDisabled();
    await user.click(undo);
    expect(store.getState().rootIds).toHaveLength(0);
    expect(undo).toBeDisabled();
    await user.click(redo);
    expect(store.getState().rootIds).toHaveLength(1);
  });

  it("renames the page from the toolbar and switches device", async () => {
    const user = userEvent.setup();
    renderShell();
    const name = screen.getByRole("textbox", { name: "Page name" });
    await user.clear(name);
    await user.type(name, "Renamed");
    expect(store.getState().meta.name).toBe("Renamed");

    const devices = screen.getAllByRole("group", { name: "Preview device" })[0]!;
    await user.click(within(devices).getByRole("button", { name: /Mobile/ }));
    expect(store.getState().device).toBe("mobile");
    expect(within(devices).getByRole("button", { name: /Mobile/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("exports HTML (lazy renderer) and JSON downloads", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: "Export HTML" }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalledTimes(1));
    const [htmlName, html, htmlType] = vi.mocked(downloadFile).mock.calls[0]!;
    expect(htmlName).toBe("launch-page.html");
    expect(htmlType).toContain("text/html");
    expect(html).toContain("<title>Launch page</title>");
    expect(html).toContain("Build something people love");

    await user.click(screen.getByRole("button", { name: "JSON" }));
    const [jsonName, json] = vi.mocked(downloadFile).mock.calls[1]!;
    expect(jsonName).toBe("launch-page.pagecraft.json");
    expect(JSON.parse(json)).toMatchObject({ version: 1, name: "Launch page" });
  });

  it("opens a sandboxed preview of the exported HTML and closes it", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole("button", { name: "Preview" }));
    const dialog = await screen.findByRole("dialog", { name: "Preview" }, { timeout: 5000 });
    const frame = within(dialog).getByTitle(/Page preview/) as HTMLIFrameElement;
    expect(frame).toHaveAttribute("sandbox", "");
    expect(frame.getAttribute("srcdoc")).toContain("Build something people love");

    await user.click(within(dialog).getByRole("button", { name: "Close preview" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
