import { describe, it, expect, vi, beforeEach } from "vitest";
import { pagePathToUrlPath, buildSitemapXml, buildRobotsTxt } from "./sitemap.js";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("./config.js", () => ({
  BascikConfig: {
    generate: { sitemap: true, robots: true },
    siteUrl: "https://example.com",
    directory: { pages: "/project/src/pages", components: "/project/src/components" },
    isBuild: true,
    verboseLogging: false,
  },
}));

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn(async () => { }),
}));

vi.mock("./file-system.js", () => ({
  listPages: vi.fn(async () => []),
  getRelativePath: vi.fn((p: string) => `pages/${p.split("/").pop()}`),
}));

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pagePathToUrlPath", () => {
  it("maps root index.html to /", () => {
    expect(pagePathToUrlPath("pages/index.html")).toBe("/");
  });

  it("maps a top-level page to /slug", () => {
    expect(pagePathToUrlPath("pages/about.html")).toBe("/about");
  });

  it("maps a nested page to /section/slug", () => {
    expect(pagePathToUrlPath("pages/blog/post.html")).toBe("/blog/post");
  });

  it("maps a nested index to the parent path", () => {
    expect(pagePathToUrlPath("pages/blog/index.html")).toBe("/blog");
  });

  it("handles deeply nested paths", () => {
    expect(pagePathToUrlPath("pages/docs/api/reference.html")).toBe("/docs/api/reference");
  });
});

describe("buildSitemapXml", () => {
  it("produces valid XML sitemap structure", () => {
    const xml = buildSitemapXml("https://example.com", ["/", "/about"]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain("<loc>https://example.com/</loc>");
    expect(xml).toContain("<loc>https://example.com/about</loc>");
  });

  it("handles an empty URL list", () => {
    const xml = buildSitemapXml("https://example.com", []);
    expect(xml).toContain("<urlset");
    expect(xml).not.toContain("<url>");
  });

  it("does not double-slash when base URL has trailing slash stripped", () => {
    const xml = buildSitemapXml("https://example.com", ["/blog"]);
    expect(xml).toContain("<loc>https://example.com/blog</loc>");
    expect(xml).not.toContain("//blog");
  });
});

describe("buildRobotsTxt", () => {
  it("allows all user agents", () => {
    const txt = buildRobotsTxt("https://example.com");
    expect(txt).toContain("User-agent: *");
    expect(txt).toContain("Allow: /");
  });

  it("includes the sitemap URL", () => {
    const txt = buildRobotsTxt("https://example.com");
    expect(txt).toContain("Sitemap: https://example.com/sitemap.xml");
  });
});
