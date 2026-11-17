import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTemplate } from "@/blocks/templates";
import { loadPage, savePage } from "@/lib/storage";
import { EditorStoreProvider } from "@/store/context";
import { createEditorStore } from "@/store/editor";

import EditorRoute from "./EditorRoute";

const router = { replace: vi.fn(), push: vi.fn() };
let params = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => params,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

beforeEach(() => {
  router.replace.mockClear();
});

function renderRoute() {
  const store = createEditorStore();
  render(
    <EditorStoreProvider store={store}>
      <EditorRoute />
    </EditorStoreProvider>,
  );
  return store;
}

describe("EditorRoute", () => {
  it("opens a saved page by id", async () => {
    const doc = getTemplate("app")!.build();
    savePage(doc);
    params = new URLSearchParams({ id: doc.id });
    const store = renderRoute();
    expect(await screen.findByRole("tree", { name: "Page canvas" })).toBeInTheDocument();
    expect(store.getState().meta.name).toBe("Mobile app");
  });

  it("shows a not-found screen for an unknown id", async () => {
    params = new URLSearchParams({ id: "nope" });
    renderRoute();
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to your pages" })).toHaveAttribute("href", "/");
  });

  it("creates a page from a template, saves it and redirects to its id", () => {
    params = new URLSearchParams({ template: "saas" });
    const store = renderRoute();
    const id = store.getState().meta.id;
    expect(store.getState().meta.name).toBe("SaaS launch");
    expect(loadPage(id)).not.toBeNull();
    expect(router.replace).toHaveBeenCalledWith(`/editor?id=${id}`);
  });

  it("falls back to a blank page for an unknown template", () => {
    params = new URLSearchParams({ template: "does-not-exist" });
    const store = renderRoute();
    expect(store.getState().rootIds).toEqual([]);
    expect(router.replace).toHaveBeenCalledTimes(1);
  });
});
