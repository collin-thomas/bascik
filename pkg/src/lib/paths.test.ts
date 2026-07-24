import { describe, it, expect } from "vitest";
import { getHttpPath } from "./paths.js";

describe("getHttpPath", () => {
  it("converts pages/index.html to /", () => {
    expect(getHttpPath("pages/index.html")).toBe("/");
  });

  it("converts pages/about.html to /about", () => {
    expect(getHttpPath("pages/about.html")).toBe("/about");
  });

  it("converts pages/blog/post.html to /blog/post", () => {
    expect(getHttpPath("pages/blog/post.html")).toBe("/blog/post");
  });

  it("converts pages/sub/index.html to /sub/", () => {
    expect(getHttpPath("pages/sub/index.html")).toBe("/sub/");
  });

  it("converts a deeply nested page", () => {
    expect(getHttpPath("pages/a/b/c.html")).toBe("/a/b/c");
  });

  it("converts a deeply nested index page", () => {
    expect(getHttpPath("pages/a/b/index.html")).toBe("/a/b/");
  });

  it("strips only the leading pages segment", () => {
    // path containing 'pages' elsewhere should not be affected
    expect(getHttpPath("pages/pages-about.html")).toBe("/pages-about");
  });
});
