// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cache, cv, useApiQueryMock } = vi.hoisted(() => ({
  cache: {
    get: vi.fn<VitestMockProcedure>(),
    put: vi.fn<VitestMockProcedure>(),
  },
  cv: {
    validate: vi.fn<VitestMockProcedure>(),
    compareVersions: vi.fn<VitestMockProcedure>(),
  },
  useApiQueryMock: vi.fn<VitestMockProcedure>(),
}));

vi.mock("memory-cache", () => ({
  default: cache,
}));

vi.mock("compare-versions", () => ({
  validate: cv.validate,
  compareVersions: cv.compareVersions,
}));

vi.mock("utils/query/api-query", () => ({
  useApiQuery: useApiQueryMock,
}));

import Version from "./version";

describe("components/version", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VITE_VERSION = "dev";
    process.env.VITE_REVISION = "abcdef012345";
    process.env.VITE_BUILDTIME = "2020-01-01T00:00:00.000Z";
  });

  it("renders non-link version text for dev/main/nightly", () => {
    cv.validate.mockReturnValue(false);
    cache.get.mockReturnValue(null);
    useApiQueryMock.mockReturnValue({ data: undefined });

    render(<Version />);

    expect(screen.getByText(/dev \(abcdef0/)).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("renders tag link and shows update available when a newer release exists", () => {
    process.env.VITE_VERSION = "1.2.3";
    cv.validate.mockReturnValue(true);
    cache.get.mockReturnValue(null);
    useApiQueryMock.mockReturnValue({
      data: [{ tag_name: "1.2.4", html_url: "http://example.com/release" }],
    });
    cv.compareVersions.mockReturnValue(1);

    render(<Version />);

    const links = screen.getAllByRole("link");
    expect(links.find((a) => a.getAttribute("href")?.includes("/releases/tag/1.2.3"))).toBeTruthy();
    expect(links.find((a) => a.getAttribute("href") === "http://example.com/release")).toBeTruthy();
  });

  it("falls back build time to the current date when VITE_BUILDTIME is missing", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2021-01-02T12:00:00.000Z"));
      process.env.VITE_BUILDTIME = "";

      cv.validate.mockReturnValue(false);
      cache.get.mockReturnValue(null);
      useApiQueryMock.mockReturnValue({ data: undefined });

      render(<Version />);

      expect(screen.getByText(/2021/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
