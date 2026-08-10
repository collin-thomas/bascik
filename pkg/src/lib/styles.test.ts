import { describe, expect, it, vi } from "vitest";
import {
  convertCssElementSelectorsToClasses,
  addElementClassesInHtml,
  getCssClasses,
  getKeyframeNames,
  prefixKeyframes,
  removeIdSelectors,
  removeCommentsFromCss,
  minifyCss,
  scopeCssCustomProperties,
  scopeLayerNames,
  scopeContainerNames,
  scopeInlineStyleTags,
  convertCssIdSelectorsToClasses,
  addIdClassesInHtml,
  deduplicateCss,
} from "./styles.js";

const css = `
.navigation ul {
  list-style-type: none;
  margin: unset;
  padding: unset;
}
.home.logo {
  background-color: #fff;
  color: #18191b;
  padding: 4px;
  user-select: none;
  animation: rotateLogo 2s infinite alternate;
}
@media only screen and (max-width: 600px) {
  .home.logo {
    background-color: #d3ff8d;
  }
}
@keyframes rotateLogo {
  from {
    transform: perspective(500px) rotateY(-40deg);
  }
  to {
    transform: perspective(500px) rotateY(40deg);
  }
}
`;
const elHtml = `
<h4>h4</h4>
<p>misspeled</p>
<p class="not-used">mispelled</p>
`;
const elHtmlRes = `
<h4>h4</h4>
<p class="bascik__my-comp__el__p">misspeled</p>
<p class="not-used bascik__my-comp__el__p">mispelled</p>
`;
const elCss = `
p {
  text-decoration: #d3ff8d wavy underline;
  display: block;
  /* This should not work if scoped keyframes are on */
  animation: rotateLogo 2s infinite alternate;
}
`;
const prefixKeyframesRes = `
.navigation ul {
  list-style-type: none;
  margin: unset;
  padding: unset;
}
.home.logo {
  background-color: #fff;
  color: #18191b;
  padding: 4px;
  user-select: none;
  animation: bascik__my-comp__keyframe__rotateLogo 2s infinite alternate;
}
@media only screen and (max-width: 600px) {
  .home.logo {
    background-color: #d3ff8d;
  }
}
@keyframes bascik__my-comp__keyframe__rotateLogo {
  from {
    transform: perspective(500px) rotateY(-40deg);
  }
  to {
    transform: perspective(500px) rotateY(40deg);
  }
}
`;
const idCss = `
.hr {
  border: 8px solid #d3ff8d;
  border-radius: 25px;
}
/* ID selectors will be removed */
[id] {
  color: #d3ff8d;
}
`;

vi.mock("./config.js", () => {
  return {
    BascikConfig: { obfuscateAttributeNames: false },
  };
});

vi.mock("node:crypto", () => {
  return {
    createHash: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn(() => "12345678"),
    })),
  };
});

vi.mock("node:fs/promises", () => {
  return {
    readFile: vi.fn(async () => css),
  };
});

describe("convertCssElementSelectorsToClasses", () => {
  it("test", () => {
    expect(convertCssElementSelectorsToClasses(elCss, "my-comp")).toStrictEqual(
      {
        css:
          "\n" +
          ".bascik__my-comp__el__p {\n" +
          "  text-decoration: #d3ff8d wavy underline;\n" +
          "  display: block;\n" +
          "  /* This should not work if scoped keyframes are on */\n" +
          "  animation: rotateLogo 2s infinite alternate;\n" +
          "}\n",
        elementsConvertedClasses: ["p"],
      },
    );
  });

  it("does not scope CSS unit keywords that appear at line start due to a syntax error", () => {
    // A CSS syntax error can place a unit keyword like `rem` at column 0,
    // e.g. accidentally breaking `0.7rem 1em` across two lines.
    // The scoping regex must leave it untouched.
    const brokenCss = `.mycomp {\n  margin: 0.7\nrem 1em;\n}`;
    const { css, elementsConvertedClasses } =
      convertCssElementSelectorsToClasses(brokenCss, "my-comp");
    expect(css).toContain("rem 1em");
    expect(css).not.toContain("bascik__my-comp__el__rem");
    expect(elementsConvertedClasses).not.toContain("rem");
  });
});

describe("addElementClassesInHtml", () => {
  it("test", () => {
    expect(addElementClassesInHtml(elHtml, "my-comp", ["p"])).toBe(elHtmlRes);
  });
});

describe("getCssClasses", () => {
  it("test", () => {
    expect(getCssClasses(css)).toStrictEqual([
      ".navigation ul {\n" +
      "  list-style-type: none;\n" +
      "  margin: unset;\n" +
      "  padding: unset;\n" +
      "}",
      ".home.logo {\n" +
      "  background-color: #fff;\n" +
      "  color: #18191b;\n" +
      "  padding: 4px;\n" +
      "  user-select: none;\n" +
      "  animation: rotateLogo 2s infinite alternate;\n" +
      "}",
      ".home.logo {\n    background-color: #d3ff8d;\n  }",
    ]);
  });
});

describe("getKeyframeNames", () => {
  it("test", () => {
    expect(getKeyframeNames(css)).toStrictEqual(["rotateLogo"]);
  });
});

describe("prefixKeyframes", () => {
  it("test", () => {
    expect(prefixKeyframes(css, "my-comp")).toBe(prefixKeyframesRes);
  });
});

describe("removeIdSelectors", () => {
  it("test", () => {
    expect(removeIdSelectors(idCss)).not.toContain("[id]");
  });
});

describe("removeCommentsFromCss", () => {
  it("test", () => {
    expect(removeCommentsFromCss(idCss)).not.toContain(
      "/* ID selectors will be removed */",
    );
  });
});

describe("scopeCssCustomProperties", () => {
  it("scopes a custom property declaration", () => {
    const css = ":root { --brand: #d3ff8d; }";
    const result = scopeCssCustomProperties(css, "my-comp__x1");
    expect(result).not.toContain("--brand:");
    expect(result).toContain("--bascik__my-comp__x1__brand:");
  });

  it("scopes a var() reference to match the scoped declaration", () => {
    const css = ":root { --brand: #d3ff8d; } .el { color: var(--brand); }";
    const result = scopeCssCustomProperties(css, "my-comp__x1");
    expect(result).toContain("var(--bascik__my-comp__x1__brand)");
    expect(result).not.toContain("var(--brand)");
  });

  it("scopes a var() reference that has a fallback value", () => {
    const css = ":root { --accent: red; } .el { color: var(--accent, gray); }";
    const result = scopeCssCustomProperties(css, "my-comp__x1");
    expect(result).toContain("var(--bascik__my-comp__x1__accent, gray)");
    expect(result).not.toContain("var(--accent,");
  });

  it("scopes multiple custom properties independently", () => {
    const css =
      ":root { --a: 1px; --b: red; } .el { padding: var(--a); color: var(--b); }";
    const result = scopeCssCustomProperties(css, "comp__x1");
    expect(result).toContain("--bascik__comp__x1__a:");
    expect(result).toContain("--bascik__comp__x1__b:");
    expect(result).toContain("var(--bascik__comp__x1__a)");
    expect(result).toContain("var(--bascik__comp__x1__b)");
  });

  it("returns css unchanged when there are no custom properties", () => {
    const css = ".el { color: red; }";
    expect(scopeCssCustomProperties(css, "my-comp__x1")).toBe(css);
  });

  it("does not affect properties from other components", () => {
    // A property defined elsewhere (not in this component's CSS) should not be touched
    const css = ".el { color: var(--external-var); }";
    expect(scopeCssCustomProperties(css, "my-comp__x1")).toBe(css);
  });
});

describe("deduplicateCss", () => {
  it("returns CSS for each unique component once", () => {
    const usedComponents = [
      { name: "my-btn", cssFileContent: ".btn{color:red}" },
      { name: "my-btn", cssFileContent: ".btn{color:red}" },
      { name: "my-nav", cssFileContent: ".nav{color:blue}" },
    ];
    const css = deduplicateCss(usedComponents);
    const btnMatches = css.match(/\.btn\{color:red\}/g);
    expect(btnMatches).toHaveLength(1);
    expect(css).toContain(".nav{color:blue}");
  });

  it("skips components with no CSS", () => {
    const usedComponents = [
      { name: "my-btn", cssFileContent: undefined },
      { name: "my-nav", cssFileContent: ".nav{}" },
    ];
    expect(deduplicateCss(usedComponents)).toBe(".nav{}");
  });

  it("returns empty string for no CSS", () => {
    expect(deduplicateCss([{ name: "x", cssFileContent: undefined }])).toBe("");
  });

  it("preserves ordering of first occurrence", () => {
    const usedComponents = [
      { name: "a", cssFileContent: ".a{}" },
      { name: "b", cssFileContent: ".b{}" },
      { name: "a", cssFileContent: ".a{}" },
    ];
    expect(deduplicateCss(usedComponents)).toBe(".a{} .b{}");
  });
});

describe("deduplicateCss – dedup: false (per-instance mode)", () => {
  it("emits CSS for every instance including duplicates", () => {
    const usedComponents = [
      { name: "my-btn", cssFileContent: ".bascik__my-btn__abc__btn{color:red}" },
      { name: "my-btn", cssFileContent: ".bascik__my-btn__def__btn{color:red}" },
    ];
    const css = deduplicateCss(usedComponents, false);
    expect(css).toContain(".bascik__my-btn__abc__btn");
    expect(css).toContain(".bascik__my-btn__def__btn");
  });

  it("skips components with no CSS even in per-instance mode", () => {
    const usedComponents = [
      { name: "my-btn", cssFileContent: undefined },
      { name: "my-nav", cssFileContent: ".nav{}" },
    ];
    expect(deduplicateCss(usedComponents, false)).toBe(".nav{}");
  });
});

// ─── convertCssElementSelectorsToClasses — pseudo-class / pseudo-element ─────

describe("convertCssElementSelectorsToClasses – pseudo-classes and pseudo-elements", () => {
  it("converts a bare element pseudo-class selector p:hover", () => {
    const { css, elementsConvertedClasses } =
      convertCssElementSelectorsToClasses("p:hover { color: red; }", "my-comp");
    expect(css).toContain(".bascik__my-comp__el__p:hover");
    expect(elementsConvertedClasses).toContain("p");
  });

  it("converts a pseudo-element selector p::before", () => {
    const { css, elementsConvertedClasses } =
      convertCssElementSelectorsToClasses(
        "p::before { content: ''; }",
        "my-comp",
      );
    expect(css).toContain(".bascik__my-comp__el__p::before");
    expect(elementsConvertedClasses).toContain("p");
  });

  it("converts first element in a comma-separated selector list", () => {
    const { css, elementsConvertedClasses } =
      convertCssElementSelectorsToClasses("p, h2 { margin: 0; }", "my-comp");
    // The first element at line start is converted
    expect(css).toContain(".bascik__my-comp__el__p");
    expect(elementsConvertedClasses).toContain("p");
  });

  it("converts second element in a same-line comma list: 'p, h2 { }'", () => {
    const { css, elementsConvertedClasses } =
      convertCssElementSelectorsToClasses("p, h2 { margin: 0; }", "my-comp");
    expect(css).toContain(".bascik__my-comp__el__h2");
    expect(elementsConvertedClasses).toContain("h2");
  });

  it("converts all elements in a multi-element same-line list: 'h1, h2, h3 { }'", () => {
    const { elementsConvertedClasses } = convertCssElementSelectorsToClasses(
      "h1, h2, h3 { font-weight: bold; }",
      "my-comp",
    );
    expect(elementsConvertedClasses).toEqual(
      expect.arrayContaining(["h1", "h2", "h3"]),
    );
  });

  it("does NOT convert elements inside :is() — `:is(p, h2) { }`", () => {
    // The `)` in the stop set prevents false positives inside pseudo-functions.
    const { elementsConvertedClasses } = convertCssElementSelectorsToClasses(
      "div:is(p, h2) { color: red; }",
      "my-comp",
    );
    // h2 appears after a comma inside :is() — it must NOT be converted
    expect(elementsConvertedClasses).not.toContain("h2");
  });

  it("does NOT convert property-value commas: 'transition: color 0.2s, opacity 0.3s'", () => {
    const { elementsConvertedClasses } = convertCssElementSelectorsToClasses(
      ".el { transition: color 0.2s, opacity 0.3s; }",
      "my-comp",
    );
    expect(elementsConvertedClasses).not.toContain("opacity");
  });

  it("does not convert elements that are not at line start", () => {
    // `.foo p { }` — `p` is a descendant, should NOT be converted
    const { elementsConvertedClasses } = convertCssElementSelectorsToClasses(
      ".foo p { color: red; }",
      "my-comp",
    );
    expect(elementsConvertedClasses).not.toContain("p");
  });

  it("deduplicates: same element at column-0 multiple times only injected once", () => {
    const { elementsConvertedClasses } = convertCssElementSelectorsToClasses(
      "p { color: red; }\np:hover { color: blue; }",
      "my-comp",
    );
    expect(elementsConvertedClasses.filter((e) => e === "p")).toHaveLength(1);
  });
});

// ─── convertCssElementSelectorsToClasses — CSS nesting ───────────────────────

describe("convertCssElementSelectorsToClasses – CSS nesting (& selector)", () => {
  it("converts element after '& ' (descendant nesting)", () => {
    const { css, elementsConvertedClasses } =
      convertCssElementSelectorsToClasses(
        ".parent { & p { color: red; } }",
        "my-comp",
      );
    expect(css).toContain("& .bascik__my-comp__el__p");
    expect(elementsConvertedClasses).toContain("p");
  });

  it("converts element after '& > ' (child combinator)", () => {
    const { css } = convertCssElementSelectorsToClasses(
      ".parent { & > h2 { font-size: 1.5rem; } }",
      "my-comp",
    );
    expect(css).toContain("& > .bascik__my-comp__el__h2");
  });

  it("converts element after '& + ' (adjacent sibling combinator)", () => {
    const { css } = convertCssElementSelectorsToClasses(
      ".card { & + li { margin-top: 8px; } }",
      "my-comp",
    );
    expect(css).toContain("& + .bascik__my-comp__el__li");
  });

  it("converts element after '& ~ ' (general sibling combinator)", () => {
    const { css } = convertCssElementSelectorsToClasses(
      ".item { & ~ span { opacity: 0.5; } }",
      "my-comp",
    );
    expect(css).toContain("& ~ .bascik__my-comp__el__span");
  });

  it("does NOT convert class selectors in nesting (they are handled separately)", () => {
    const { elementsConvertedClasses } = convertCssElementSelectorsToClasses(
      ".parent { & .child { color: blue; } }",
      "my-comp",
    );
    // .child is a class selector — not in elementsConvertedClasses
    expect(elementsConvertedClasses).not.toContain("child");
  });

  it("deduplicates: element at column-0 AND in nesting only injected once", () => {
    const { elementsConvertedClasses } = convertCssElementSelectorsToClasses(
      "p { color: red; }\n.parent { & p { font-weight: bold; } }",
      "my-comp",
    );
    expect(elementsConvertedClasses.filter((e) => e === "p")).toHaveLength(1);
  });
});

// ─── Pass 4: descendant element selectors after a scoped class ───────────────

describe("convertCssElementSelectorsToClasses – descendant after scoped class", () => {
  // NOTE: Pass 4 looks for the `bascik__` prefix which is written by the
  // earlier class-scoping step in javascript.ts / scopeInlineStyleTags.
  // These tests therefore pass pre-scoped CSS (as javascript.ts would produce).

  it("converts element after scoped class (descendant)", () => {
    const pre = ".bascik__my-comp__card p { color: red; }";
    const { css, elementsConvertedClasses } =
      convertCssElementSelectorsToClasses(pre, "my-comp");
    expect(css).toContain(".bascik__my-comp__card .bascik__my-comp__el__p");
    expect(elementsConvertedClasses).toContain("p");
  });

  it("converts element after scoped class with child combinator >", () => {
    const pre = ".bascik__my-comp__list > li { list-style: none; }";
    const { css } = convertCssElementSelectorsToClasses(pre, "my-comp");
    expect(css).toContain("> .bascik__my-comp__el__li");
  });

  it("converts element after scoped class with adjacent sibling +", () => {
    const pre = ".bascik__my-comp__title + p { margin-top: 0; }";
    const { css } = convertCssElementSelectorsToClasses(pre, "my-comp");
    expect(css).toContain("+ .bascik__my-comp__el__p");
  });

  it("converts element after scoped class with general sibling ~", () => {
    const pre = ".bascik__my-comp__header ~ section { color: blue; }";
    const { css } = convertCssElementSelectorsToClasses(pre, "my-comp");
    expect(css).toContain("~ .bascik__my-comp__el__section");
  });

  it("does NOT convert another scoped class name after a scoped class", () => {
    // The negative lookahead (?!__) must prevent bascik__ being treated as element
    const pre = ".bascik__my-comp__card .bascik__my-comp__title { color: blue; }";
    const { elementsConvertedClasses } = convertCssElementSelectorsToClasses(
      pre,
      "my-comp",
    );
    // 'bascik' starts with b (in [a-z1-6]) but is followed by 'ascik__',
    // so the negative lookahead should prevent matching it as an element
    expect(elementsConvertedClasses).not.toContain("bascik");
  });

  it("does NOT match in property value context", () => {
    // A property value will never have bascik__ as a prefix in normal CSS
    const pre = ".bascik__my-comp__box { transition: opacity 0.3s; }";
    const { elementsConvertedClasses } = convertCssElementSelectorsToClasses(
      pre,
      "my-comp",
    );
    expect(elementsConvertedClasses).not.toContain("opacity");
  });

  it("converts multi-level: .scoped .scoped p (element after second scoped class)", () => {
    const pre = ".bascik__my-comp__card .bascik__my-comp__body p { margin: 0; }";
    const { css, elementsConvertedClasses } = convertCssElementSelectorsToClasses(pre, "my-comp");
    expect(css).toContain(".bascik__my-comp__el__p");
    expect(elementsConvertedClasses).toContain("p");
  });
});

// ─── addElementClassesInHtml — multiline content ─────────────────────────────

describe("addElementClassesInHtml – multiline content", () => {
  it("injects the class into a multi-line element", () => {
    const html = "<p>\n  line one\n  line two\n</p>";
    const result = addElementClassesInHtml(html, "my-comp", ["p"]);
    expect(result).toContain('class="bascik__my-comp__el__p"');
  });
});

// ─── scopeLayerNames ─────────────────────────────────────────────────────────

describe("scopeLayerNames", () => {
  it("scopes a single @layer declaration block", () => {
    const css = "@layer base { .foo { color: red; } }";
    const result = scopeLayerNames(css, "my-comp");
    expect(result).not.toContain("@layer base");
    expect(result).toContain("@layer bascik__my-comp__layer__base");
  });

  it("scopes an @layer ordering statement", () => {
    const css = "@layer reset, base, utilities;";
    const result = scopeLayerNames(css, "my-comp");
    expect(result).toContain("bascik__my-comp__layer__reset");
    expect(result).toContain("bascik__my-comp__layer__base");
    expect(result).toContain("bascik__my-comp__layer__utilities");
    expect(result).not.toContain("@layer reset,");
  });

  it("returns css unchanged when there are no @layer names", () => {
    const css = ".foo { color: red; }";
    expect(scopeLayerNames(css, "my-comp")).toBe(css);
  });
});

// ─── scopeContainerNames ─────────────────────────────────────────────────────

describe("scopeContainerNames", () => {
  it("scopes container-name declaration and matching @container query", () => {
    const css =
      ".card { container-name: card; }\n@container card (min-width: 400px) { .inner { font-size: 1rem; } }";
    const result = scopeContainerNames(css, "my-comp");
    expect(result).toContain(
      "container-name: bascik__my-comp__container__card",
    );
    expect(result).toContain("@container bascik__my-comp__container__card");
    expect(result).not.toContain("container-name: card");
  });

  it("scopes the container shorthand declaration", () => {
    const css = ".wrap { container: sidebar / inline-size; }";
    const result = scopeContainerNames(css, "my-comp");
    expect(result).toContain("bascik__my-comp__container__sidebar");
  });

  it("does not scope unnamed @container queries", () => {
    const css = "@container (min-width: 400px) { .foo { color: red; } }";
    const result = scopeContainerNames(css, "my-comp");
    // No container-name declaration → no scoping
    expect(result).toBe(css);
  });

  it("returns css unchanged when there are no container names", () => {
    const css = ".foo { color: red; }";
    expect(scopeContainerNames(css, "my-comp")).toBe(css);
  });
});

// ─── scopeInlineStyleTags ────────────────────────────────────────────────────

describe("scopeInlineStyleTags", () => {
  it("scopes class names inside a <style> tag", () => {
    const html = '<style>.foo { color: red; }</style><div class="foo"></div>';
    const { html: result } = scopeInlineStyleTags(html, "my-comp");
    expect(result).toContain(".bascik__my-comp__foo");
  });

  it("returns element classes to inject into HTML", () => {
    const html = "<style>p { color: red; }</style><p>hi</p>";
    const { elementsConvertedClasses } = scopeInlineStyleTags(html, "my-comp");
    expect(elementsConvertedClasses).toContain("p");
  });

  it("scopes @keyframes inside a <style> tag", () => {
    const html =
      "<style>@keyframes spin { to { transform: rotate(360deg); } } .icon { animation: spin 1s; }</style>";
    const { html: result } = scopeInlineStyleTags(html, "my-comp");
    expect(result).toContain("bascik__my-comp__keyframe__spin");
    expect(result).not.toContain("animation: spin");
  });

  it("scopes CSS custom properties inside a <style> tag", () => {
    const html =
      "<style>:root { --brand: #d3ff8d; } .title { color: var(--brand); }</style>";
    const { html: result } = scopeInlineStyleTags(html, "my-comp");
    expect(result).toContain("--bascik__my-comp__brand:");
    expect(result).toContain("var(--bascik__my-comp__brand)");
  });

  it("scopes @layer names inside a <style> tag", () => {
    const html = "<style>@layer base { .foo { color: red; } }</style>";
    const { html: result } = scopeInlineStyleTags(html, "my-comp");
    expect(result).toContain("bascik__my-comp__layer__base");
  });

  it("returns unchanged HTML when there are no <style> tags", () => {
    const html = '<div class="foo"></div>';
    const { html: result, elementsConvertedClasses } = scopeInlineStyleTags(
      html,
      "my-comp",
    );
    expect(result).toBe(html);
    expect(elementsConvertedClasses).toHaveLength(0);
  });

  it("strips ID selectors from inline <style> tags", () => {
    const html = "<style>[id] { color: red; } .foo { color: blue; }</style>";
    const { html: result } = scopeInlineStyleTags(html, "my-comp");
    expect(result).not.toContain("[id]");
    expect(result).toContain(".bascik__my-comp__foo");
  });

  it("does NOT mangle decimal values in CSS property values (0.9, 1.1rem, .15s)", () => {
    const html =
      "<style>.nav { background: rgba(0,0,0,0.9); font-size: 1.1rem; transition: all .15s; letter-spacing: -0.02em; }</style>";
    const { html: result } = scopeInlineStyleTags(html, "my-comp");
    expect(result).toContain("rgba(0,0,0,0.9)");
    expect(result).toContain("1.1rem");
    expect(result).toContain(".15s");
    expect(result).toContain("-0.02em");
  });

  it("does NOT mangle sub-1 decimal values (0.7rem, .06em, 0.025, 0.82rem)", () => {
    // Regression: the old regex [a-z0-9-_]+ had no leading-letter guard, so
    // after a decimal '.' it matched digit-starting tokens like '7rem', '06em',
    // '025', '82rem' and scoped them as if they were CSS class names.
    const html =
      "<style>.cblock-lang { font-size: 0.7rem; letter-spacing: .06em; background: rgba(255,255,255,0.025); } .cblock-body { font-size: 0.82rem; line-height: 1.7; }</style>";
    const { html: result } = scopeInlineStyleTags(html, "my-comp");
    expect(result).toContain("font-size: 0.7rem");
    expect(result).toContain("letter-spacing: .06em");
    expect(result).toContain("rgba(255,255,255,0.025)");
    expect(result).toContain("font-size: 0.82rem");
    expect(result).toContain("line-height: 1.7");
    // Class names must still be scoped
    expect(result).toContain(".bascik__my-comp__cblock-lang");
    expect(result).toContain(".bascik__my-comp__cblock-body");
  });

  it("still scopes class names when decimal values are present", () => {
    const html =
      "<style>.nav { opacity: 0.5; } .nav:hover { opacity: 1; }</style>";
    const { html: result } = scopeInlineStyleTags(html, "my-comp");
    expect(result).toContain(".bascik__my-comp__nav");
    expect(result).toContain("opacity: 0.5");
  });
});

// ─── removeIdSelectors — only strips [id] attribute selectors ────────────────

describe("removeIdSelectors – only strips [id] attribute selector form", () => {
  it("strips [id] selector", () => {
    const css = "[id] { color: red; } .foo { color: blue; }";
    expect(removeIdSelectors(css)).not.toContain("[id]");
    expect(removeIdSelectors(css)).toContain(".foo");
  });

  it("passes through #id hash selectors — they are handled by convertCssIdSelectorsToClasses", () => {
    const css = "#btn { color: red; }";
    expect(removeIdSelectors(css)).toContain("#btn");
  });
});

// ─── convertCssIdSelectorsToClasses ──────────────────────────────────────────

describe("convertCssIdSelectorsToClasses – selector vs value context", () => {
  // ── Selector position — SHOULD be converted ────────────────────────────

  it("converts a bare #id rule", () => {
    const { css, idsConverted } = convertCssIdSelectorsToClasses(
      "#btn { color: red; }",
      "my-comp",
    );
    expect(css).toContain(".bascik__my-comp__id__btn");
    expect(css).not.toContain("#btn");
    expect(idsConverted[0].idName).toBe("btn");
  });

  it("preserves pseudo-class on #id", () => {
    const { css } = convertCssIdSelectorsToClasses(
      "#btn:hover { color: blue; }",
      "my-comp",
    );
    expect(css).toContain(".bascik__my-comp__id__btn:hover");
  });

  it("converts #id in a compound descendant selector", () => {
    const { css } = convertCssIdSelectorsToClasses(
      ".parent #btn { font-weight: bold; }",
      "my-comp",
    );
    expect(css).toContain(".parent .bascik__my-comp__id__btn");
  });

  it("converts multiple different IDs", () => {
    const { idsConverted } = convertCssIdSelectorsToClasses(
      "#header { } #footer { }",
      "my-comp",
    );
    expect(idsConverted.map((e) => e.idName)).toEqual(
      expect.arrayContaining(["header", "footer"]),
    );
    expect(idsConverted).toHaveLength(2);
  });

  it("deduplicates repeated ID references", () => {
    const { idsConverted } = convertCssIdSelectorsToClasses(
      "#btn { color: red; } #btn:hover { color: blue; }",
      "my-comp",
    );
    expect(idsConverted).toHaveLength(1);
  });

  it("converts #id inside an @media block", () => {
    const { css } = convertCssIdSelectorsToClasses(
      "@media (max-width: 600px) { #btn { font-size: 0.9rem; } }",
      "my-comp",
    );
    expect(css).toContain(".bascik__my-comp__id__btn");
  });

  // ── Value position — must NOT be converted ──────────────────────────────

  it("does NOT convert hex colour terminated by semicolon: color: #abc;", () => {
    const { idsConverted } = convertCssIdSelectorsToClasses(
      ".el { color: #abc; }",
      "my-comp",
    );
    expect(idsConverted).toHaveLength(0);
  });

  it("does NOT convert hex colour in linear-gradient function: #abc,", () => {
    const { idsConverted } = convertCssIdSelectorsToClasses(
      ".el { background: linear-gradient(#abc, #def); }",
      "my-comp",
    );
    expect(idsConverted).toHaveLength(0);
  });

  it("does NOT convert hex colour followed by closing brace: color: #abc\\n}", () => {
    const css = ".el {\n  color: #abc\n}";
    const { idsConverted } = convertCssIdSelectorsToClasses(css, "my-comp");
    expect(idsConverted).toHaveLength(0);
  });

  it("does NOT convert hex colour followed by whitespace value: background: #abc url(…)", () => {
    const { idsConverted } = convertCssIdSelectorsToClasses(
      ".el { background: #abc url('./img.png'); }",
      "my-comp",
    );
    expect(idsConverted).toHaveLength(0);
  });

  it("returns css unchanged when there are no #id selectors", () => {
    const css = ".foo { color: red; }";
    const { css: result, idsConverted } = convertCssIdSelectorsToClasses(
      css,
      "my-comp",
    );
    expect(result).toBe(css);
    expect(idsConverted).toHaveLength(0);
  });
});

// ─── addIdClassesInHtml ───────────────────────────────────────────────────────

describe("addIdClassesInHtml", () => {
  it("injects class onto element with unscoped id", () => {
    const html = '<button id="btn">Click</button>';
    const result = addIdClassesInHtml(html, [
      { idName: "btn", className: "bascik__my-comp__id__btn" },
    ]);
    expect(result).toContain('class="bascik__my-comp__id__btn"');
  });

  it("injects class onto element with already-scoped id", () => {
    const html = '<button id="bascik__my-comp__a1b2c3d4__btn">Click</button>';
    const result = addIdClassesInHtml(html, [
      { idName: "btn", className: "bascik__my-comp__id__btn" },
    ]);
    expect(result).toContain('class="bascik__my-comp__id__btn"');
  });

  it("appends to existing class attribute", () => {
    const html = '<button id="btn" class="primary">Click</button>';
    const result = addIdClassesInHtml(html, [
      { idName: "btn", className: "bascik__my-comp__id__btn" },
    ]);
    expect(result).toContain('class="primary bascik__my-comp__id__btn"');
  });

  it("does not match data-id or other attributes", () => {
    const html = '<div data-id="btn"></div>';
    const result = addIdClassesInHtml(html, [
      { idName: "btn", className: "bascik__my-comp__id__btn" },
    ]);
    expect(result).not.toContain("bascik__my-comp__id__btn");
  });

  it("returns html unchanged when idsConverted is empty", () => {
    const html = '<div id="btn"></div>';
    expect(addIdClassesInHtml(html, [])).toBe(html);
  });
});

// ─── scopeInlineStyleTags — now also returns idsConverted ────────────────────

describe("scopeInlineStyleTags – #id in inline styles", () => {
  it("converts #id selector and returns idsConverted", () => {
    const html =
      '<style>#btn { color: red; }</style><button id="btn">Click</button>';
    const { html: result, idsConverted } = scopeInlineStyleTags(
      html,
      "my-comp",
    );
    expect(result).toContain(".bascik__my-comp__id__btn");
    expect(idsConverted).toHaveLength(1);
    expect(idsConverted[0].idName).toBe("btn");
  });

  it("does NOT convert hex colour inside inline <style>", () => {
    const html = "<style>.el { color: #abc; }</style>";
    const { idsConverted } = scopeInlineStyleTags(html, "my-comp");
    expect(idsConverted).toHaveLength(0);
  });
});

describe("minifyCss", () => {
  it("strips block comments", () => {
    expect(minifyCss("/* a comment */\n.foo { color: red; }")).not.toContain("/* a comment */");
  });

  it("strips multi-line block comments", () => {
    const input = "/* line 1\n   line 2 */\n.foo { color: red; }";
    const result = minifyCss(input);
    expect(result).not.toContain("line 1");
    expect(result).not.toContain("line 2");
  });

  it("removes newlines", () => {
    expect(minifyCss(".foo {\n  color: red;\n}")).not.toContain("\n");
  });

  it("removes spaces around structural characters", () => {
    expect(minifyCss(".foo { color: red; }")).toBe(".foo{color:red;}");
  });

  it("collapses multiple spaces to one", () => {
    expect(minifyCss(".foo   .bar { color: red; }")).toContain(".foo .bar");
  });

  it("preserves meaningful spaces within property values", () => {
    // shorthand values like '96px 0 80px' have meaningful spaces that must not be removed
    const result = minifyCss(".a { padding: 96px 0 80px; }");
    expect(result).toContain("96px 0 80px");
  });

  it("handles a realistic stylesheet snippet", () => {
    const input = "/* Hero */\n.hero {\n  padding: 96px 0 80px;\n  color: red;\n}";
    expect(minifyCss(input)).toBe(".hero{padding:96px 0 80px;color:red;}");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(minifyCss("   \n   ")).toBe("");
  });

  it("handles media queries without mangling values", () => {
    const input = "@media (max-width: 768px) { .a { display: none; } }";
    const result = minifyCss(input);
    expect(result).toBe("@media (max-width:768px){.a{display:none;}}");
  });
});
