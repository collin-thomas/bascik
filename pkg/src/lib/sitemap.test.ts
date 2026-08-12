import { describe, it, expect, vi, beforeEach } from "vitest";
import { pagePathToUrlPath, buildSitemapXml, buildRobotsTxt, escapeXml, is404Page, generateSitemapFiles } from "./sitemap.js";
import { listPages } from "./file-system.js";
import { writeFile } from "node:fs/promises";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("./config.js", () => ({
  BascikConfig: {
    generate: { sitemap: true, robots: true },
    siteUrl: "https://example.com",
    directory: { pages: "/project/src/pages", components: "/project/src/components" },
    isBuild: true,
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

  it("XML-escapes the base URL", () => {
    const xml = buildSitemapXml("https://example.com/?a=1&b=2", ["/x"]);
    expect(xml).toContain("<loc>https://example.com/?a=1&amp;b=2/x</loc>");
    expect(xml).not.toContain("a=1&b=2");
  });

  it("XML-escapes angle brackets and quotes in the base URL", () => {
    const xml = buildSitemapXml('https://example.com/<script>"x"', ["/"]);
    expect(xml).toContain(
      "<loc>https://example.com/&lt;script&gt;&quot;x&quot;/</loc>",
    );
    expect(xml).not.toContain("<script>");
  });

  it("XML-escapes apostrophes in the base URL", () => {
    const xml = buildSitemapXml("https://example.com/it's", ["/"]);
    expect(xml).toContain("<loc>https://example.com/it&apos;s/</loc>");
  });

  it("XML-escapes URL paths", () => {
    const xml = buildSitemapXml("https://example.com", ["/a&b"]);
    expect(xml).toContain("<loc>https://example.com/a&amp;b</loc>");
  });
});

describe("escapeXml", () => {
  it("escapes all five XML metacharacters", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
  });

  it("escapes ampersands first so entities are not double-escaped", () => {
    expect(escapeXml("&amp;")).toBe("&amp;amp;");
  });

  it("leaves safe strings unchanged", () => {
    expect(escapeXml("https://example.com/path?q=1")).toBe(
      "https://example.com/path?q=1",
    );
  });
});

describe("is404Page", () => {
  it("matches pages/404.html", () => {
    expect(is404Page("pages/404.html")).toBe(true);
  });

  it("does not match a nested 404 page", () => {
    expect(is404Page("pages/blog/404.html")).toBe(false);
  });

  it("does not match a regular page", () => {
    expect(is404Page("pages/about.html")).toBe(false);
  });

  it("does not match the root index", () => {
    expect(is404Page("pages/index.html")).toBe(false);
  });
});

describe("generateSitemapFiles", () => {
  it("excludes the 404 page from sitemap.xml", async () => {
    vi.mocked(listPages).mockResolvedValue([
      "/project/src/pages/index.html",
      "/project/src/pages/about.html",
      "/project/src/pages/404.html",
    ]);
    await generateSitemapFiles();
    const sitemapCall = vi
      .mocked(writeFile)
      .mock.calls.find(([file]) => String(file).endsWith("sitemap.xml"));
    expect(sitemapCall).toBeDefined();
    const xml = String(sitemapCall?.[1]);
    expect(xml).toContain("<loc>https://example.com/</loc>");
    expect(xml).toContain("<loc>https://example.com/about</loc>");
    expect(xml).not.toContain("/404");
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
