import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadFile, slugify } from "./download";

describe("slugify", () => {
  it("makes safe file names", () => {
    expect(slugify("SaaS Launch – v2!")).toBe("saas-launch-v2");
    expect(slugify("  Ünïcode   page ")).toBe("unicode-page");
    expect(slugify("***")).toBe("page");
  });
});

describe("downloadFile", () => {
  afterEach(() => vi.restoreAllMocks());

  it("clicks a temporary object-URL link and revokes it", async () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:test");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    downloadFile("page.html", "<p>hi</p>", "text/html");

    expect(create).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe("page.html");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:test");
    vi.useRealTimers();
  });
});
