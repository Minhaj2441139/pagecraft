import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getTemplate } from "@/blocks/templates";
import { listPages, savePage } from "@/lib/storage";

import PagesHome from "./PagesHome";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  router.push.mockClear();
});

describe("PagesHome", () => {
  it("shows templates (not the hidden stress test) and an empty list", async () => {
    render(<PagesHome />);
    expect(await screen.findByText("No pages yet. Pick a template above.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /SaaS launch/ })).toHaveAttribute("href", "/editor?template=saas");
    expect(screen.queryByText(/Stress test/)).not.toBeInTheDocument();
  });

  it("lists saved pages and deletes one after confirmation", async () => {
    const doc = getTemplate("event")!.build();
    savePage(doc);
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PagesHome />);

    expect(await screen.findByRole("link", { name: "Conference" })).toHaveAttribute("href", `/editor?id=${doc.id}`);
    expect(screen.getByText(/blocks · edited/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Conference" }));
    expect(confirm).toHaveBeenCalled();
    expect(listPages()).toEqual([]);
    expect(screen.getByText("No pages yet. Pick a template above.")).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("keeps the page when deletion is cancelled", async () => {
    savePage(getTemplate("event")!.build());
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PagesHome />);
    await user.click(await screen.findByRole("button", { name: "Delete Conference" }));
    expect(listPages()).toHaveLength(1);
    confirm.mockRestore();
  });

  it("imports a valid JSON page and opens it", async () => {
    const user = userEvent.setup();
    render(<PagesHome />);
    const doc = getTemplate("app")!.build();
    const file = new File([JSON.stringify(doc)], "page.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Import JSON…"), file);
    const [imported] = listPages();
    expect(imported?.name).toBe("Mobile app");
    expect(imported?.id).not.toBe(doc.id);
    expect(router.push).toHaveBeenCalledWith(`/editor?id=${imported!.id}`);
  });

  it("reports an invalid import", async () => {
    const user = userEvent.setup();
    render(<PagesHome />);
    const file = new File(["{ nope"], "bad.json", { type: "application/json" });
    await user.upload(screen.getByLabelText("Import JSON…"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent("The file is not valid JSON.");
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe("saved pages section", () => {
  it("is labelled for assistive tech", async () => {
    render(<PagesHome />);
    const region = await screen.findByRole("region", { name: "Saved pages" });
    expect(within(region).getByRole("heading", { name: "Saved pages" })).toBeInTheDocument();
  });
});
