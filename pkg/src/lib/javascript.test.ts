import { describe, it, expect, vi } from "vitest";
import { prefixElementAttribute, minifyJs } from "./javascript.js";

vi.mock("./config.js", () => ({
  BascikConfig: {
    obfuscateAttributeNames: false,
    scopeAttribute: { class: true, id: true, name: true },
    deduplicateCss: true,
  },
}));

// ─── helpers ────────────────────────────────────────────────────────────────

const makeComponent = (
  fileContent: string,
  cssFileContent: string | undefined = undefined,
) => ({
  name: "my-comp",
  fileContent,
  cssFileContent,
});

// IDs and names include the instanceId for DOM uniqueness.
const scope = (attr: string, id = "test1234"): string =>
  `bascik__my-comp__${id}__${attr}`;

// Classes use component name only (no instanceId) so CSS can be deduplicated.
const scopeClass = (attr: string): string => `bascik__my-comp__${attr}`;

// With deduplicateCss:false classes use instanceId just like id/name attributes.
const scopeClassPerInstance = (attr: string, id = "test1234"): string =>
  `bascik__my-comp__${id}__${attr}`;

// ─────────────────────────────────────────────────────────────────────────────
// Existing getElementById / getElementsByClassName coverage (regression)
// ─────────────────────────────────────────────────────────────────────────────

describe("prefixElementAttribute – id (existing patterns)", () => {
  it("scopes getElementById", () => {
    const c = makeComponent(
      '<div id="btn"></div><script>document.getElementById("btn")</script>',
    );
    const result = prefixElementAttribute(c, "id", "test1234");
    expect(result.fileContent).toContain(`getElementById("${scope("btn")}")`);
  });
});

describe("prefixElementAttribute – class with deduplicateCss: false", () => {
  it("uses per-instance scoped class names in HTML", () => {
    const c = makeComponent('<div class="card"></div>');
    const result = prefixElementAttribute(c, "class", "test1234", false);
    expect(result.fileContent).toContain(scopeClassPerInstance("card"));
    expect(result.fileContent).not.toContain(scopeClass("card"));
  });

  it("rewrites querySelector with per-instance class", () => {
    const c = makeComponent(
      '<div class="card"></div><script>document.querySelector(".card")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234", false);
    expect(result.fileContent).toContain(
      `querySelector(".${scopeClassPerInstance("card")}")`,
    );
    expect(result.fileContent).not.toContain(
      `querySelector(".${scopeClass("card")}")`,
    );
  });

  it("rewrites CSS class selectors with per-instance key", () => {
    const c = makeComponent('<div class="card"></div>', ".card { color: red; }");
    const result = prefixElementAttribute(c, "class", "test1234", false);
    expect(result.cssFileContent).toContain(
      `.${scopeClassPerInstance("card")}`,
    );
  });
});

describe("prefixElementAttribute – class (existing patterns)", () => {
  it("scopes getElementsByClassName", () => {
    const c = makeComponent(
      '<div class="card"></div><script>document.getElementsByClassName("card")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `getElementsByClassName("${scopeClass("card")}")`,
    );
  });

  it("handles empty fileContent gracefully", () => {
    const c = { name: "my-comp", fileContent: undefined as unknown as string };
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toBeUndefined();
  });

  it("scopes querySelector('.class')", () => {
    const c = makeComponent(
      '<div class="card"></div><script>document.querySelector(".card")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `querySelector(".${scopeClass("card")}")`,
    );
  });

  it("scopes querySelectorAll('.class')", () => {
    const c = makeComponent(
      '<div class="card"></div><script>document.querySelectorAll(".card")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `querySelectorAll(".${scopeClass("card")}")`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// E: querySelector / querySelectorAll with # id selector (new)
// ─────────────────────────────────────────────────────────────────────────────

describe("prefixElementAttribute – id querySelector/querySelectorAll (new)", () => {
  it("scopes querySelector('#id')", () => {
    const c = makeComponent(
      '<div id="btn"></div><script>document.querySelector("#btn")</script>',
    );
    const result = prefixElementAttribute(c, "id", "test1234");
    expect(result.fileContent).toContain(`querySelector("#${scope("btn")}")`);
  });

  it("scopes querySelectorAll('#id')", () => {
    const c = makeComponent(
      '<div id="btn"></div><script>document.querySelectorAll("#btn")</script>',
    );
    const result = prefixElementAttribute(c, "id", "test1234");
    expect(result.fileContent).toContain(
      `querySelectorAll("#${scope("btn")}")`,
    );
  });

  it("scopes multiple querySelector and getElementById for the same id", () => {
    const c = makeComponent(
      '<button id="btn"></button>' +
      "<script>" +
      'document.getElementById("btn");' +
      'document.querySelector("#btn");' +
      "</script>",
    );
    const result = prefixElementAttribute(c, "id", "test1234");
    const scopedId = scope("btn");
    expect(result.fileContent).toContain(`getElementById("${scopedId}")`);
    expect(result.fileContent).toContain(`querySelector("#${scopedId}")`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// F: closest() and matches() — id
// ─────────────────────────────────────────────────────────────────────────────

describe("prefixElementAttribute – id closest/matches", () => {
  it("scopes closest('#id')", () => {
    const c = makeComponent(
      '<div id="panel"></div><script>el.closest("#panel")</script>',
    );
    const result = prefixElementAttribute(c, "id", "test1234");
    expect(result.fileContent).toContain(`closest("#${scope("panel")}")`);
  });

  it("scopes matches('#id')", () => {
    const c = makeComponent(
      '<div id="panel"></div><script>el.matches("#panel")</script>',
    );
    const result = prefixElementAttribute(c, "id", "test1234");
    expect(result.fileContent).toContain(`matches("#${scope("panel")}")`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// G: closest() and matches() — class
// ─────────────────────────────────────────────────────────────────────────────

describe("prefixElementAttribute – class closest/matches", () => {
  it("scopes closest('.class')", () => {
    const c = makeComponent(
      '<div class="card"></div><script>el.closest(".card")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(`closest(".${scopeClass("card")}")`);
  });

  it("scopes matches('.class')", () => {
    const c = makeComponent(
      '<div class="card"></div><script>el.matches(".card")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(`matches(".${scopeClass("card")}")`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// H: classList methods — class
// ─────────────────────────────────────────────────────────────────────────────

describe("prefixElementAttribute – class classList methods", () => {
  it("scopes classList.add", () => {
    const c = makeComponent(
      '<div class="active"></div><script>el.classList.add("active")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `classList.add("${scopeClass("active")}")`,
    );
  });

  it("scopes classList.remove", () => {
    const c = makeComponent(
      '<div class="active"></div><script>el.classList.remove("active")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `classList.remove("${scopeClass("active")}")`,
    );
  });

  it("scopes classList.toggle", () => {
    const c = makeComponent(
      '<div class="open"></div><script>el.classList.toggle("open")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `classList.toggle("${scopeClass("open")}")`,
    );
  });

  it("scopes classList.contains", () => {
    const c = makeComponent(
      '<div class="open"></div><script>el.classList.contains("open")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `classList.contains("${scopeClass("open")}")`,
    );
  });

  it("scopes classList.add with multiple arguments", () => {
    const c = makeComponent(
      '<div class="active open"></div><script>el.classList.add("active", "open")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `classList.add("${scopeClass("active")}", "${scopeClass("open")}")`,
    );
  });

  it("scopes classList.remove with multiple arguments", () => {
    const c = makeComponent(
      '<div class="active open"></div><script>el.classList.remove("active", "open")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `classList.remove("${scopeClass("active")}", "${scopeClass("open")}")`,
    );
  });

  it("scopes classList.toggle with boolean second argument", () => {
    const c = makeComponent(
      '<div class="open"></div><script>el.classList.toggle("open", condition)</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `classList.toggle("${scopeClass("open")}", condition)`,
    );
  });

  it("scopes classList.replace — rewrites both old and new token args", () => {
    const c = makeComponent(
      '<div class="active open"></div><script>el.classList.replace("active", "open")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `classList.replace("${scopeClass("active")}", "${scopeClass("open")}")`,
    );
  });

  it("scopes classList.replace — only scoped names are rewritten", () => {
    const c = makeComponent(
      '<div class="active"></div><script>el.classList.replace("active", "other")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    // "active" is a known scoped class; "other" is not in the component HTML so not rewritten
    expect(result.fileContent).toContain(
      `classList.replace("${scopeClass("active")}", "other")`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// H2: setAttribute("name", …) — name attribute
// ─────────────────────────────────────────────────────────────────────────────

describe("prefixElementAttribute – name setAttribute", () => {
  it("scopes setAttribute('name', value)", () => {
    const c = makeComponent(
      '<input name="email"><script>el.setAttribute("name", "email")</script>',
    );
    const result = prefixElementAttribute(c, "name", "test1234");
    expect(result.fileContent).toContain(
      `setAttribute("name", "${scope("email")}")`,
    );
  });

  it("does not rewrite setAttribute for unrelated name values", () => {
    const c = makeComponent(
      '<input name="email"><script>el.setAttribute("name", "phone")</script>',
    );
    const result = prefixElementAttribute(c, "name", "test1234");
    // "phone" is not in the component HTML so it should not be rewritten
    expect(result.fileContent).toContain(`setAttribute("name", "phone")`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// I: class scope uses component name only (no instanceId)
// ─────────────────────────────────────────────────────────────────────────────

describe("prefixElementAttribute – class scope key", () => {
  it("class HTML attribute does not contain instanceId", () => {
    const c = makeComponent('<div class="btn"></div>');
    const result = prefixElementAttribute(c, "class", "test1234");
    // Should contain component-name-only scope, not componentInstanceName
    expect(result.fileContent).toContain("bascik__my-comp__btn");
    expect(result.fileContent).not.toContain("bascik__my-comp__test1234__btn");
  });

  it("id HTML attribute still contains instanceId", () => {
    const c = makeComponent('<div id="box"></div>');
    const result = prefixElementAttribute(c, "id", "test1234");
    expect(result.fileContent).toContain("bascik__my-comp__test1234__box");
  });

  it("two instances of same component get identical class scoped names", () => {
    const c1 = makeComponent('<div class="btn"></div>');
    const c2 = makeComponent('<div class="btn"></div>');
    const r1 = prefixElementAttribute(c1, "class", "aaa11111");
    const r2 = prefixElementAttribute(c2, "class", "bbb22222");
    // Both instances should have the same scoped class name regardless of instanceId
    expect(r1.fileContent).toContain("bascik__my-comp__btn");
    expect(r2.fileContent).toContain("bascik__my-comp__btn");
    expect(r1.fileContent).toBe(r2.fileContent);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// J: inline <style> tag scoping via prefixElementAttribute
// ─────────────────────────────────────────────────────────────────────────────

describe("prefixElementAttribute – inline <style> tag scoping", () => {
  it("scopes class names in an inline <style> tag", () => {
    const c = makeComponent(
      '<style>.btn { color: red; }</style><button class="btn">Click</button>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(`.${scopeClass("btn")}`);
  });

  it("scopes element selectors in an inline <style> tag and injects class", () => {
    const c = makeComponent("<style>p { color: red; }</style><p>hello</p>");
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain("bascik__my-comp__el__p");
    // Class should be injected into the <p> element
    expect(result.fileContent).toMatch(
      /<p\s[^>]*class="[^"]*bascik__my-comp__el__p/,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// J-ext: CSS #id selector scoping via prefixElementAttribute
// ─────────────────────────────────────────────────────────────────────────────

describe("prefixElementAttribute – CSS #id selector scoping", () => {
  it("converts #id in cssFileContent to a class selector", () => {
    const c = makeComponent(
      '<button id="btn">Click</button>',
      "#btn { color: red; }",
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.cssFileContent).toContain(".bascik__my-comp__id__btn");
    expect(result.cssFileContent).not.toContain("#btn");
  });

  it("injects the id-derived class onto the HTML element", () => {
    const c = makeComponent(
      '<button id="btn">Click</button>',
      "#btn { color: red; }",
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain("bascik__my-comp__id__btn");
  });

  it("does NOT mangle hex colour values: color: #abc;", () => {
    const c = makeComponent(
      '<div class="card"></div>',
      ".card { color: #abc; }",
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    // The hex colour should pass through untouched
    expect(result.cssFileContent).toContain("color: #abc");
  });

  it("does NOT mangle hex colour in gradient: linear-gradient(#abc, #def)", () => {
    const c = makeComponent(
      '<div class="card"></div>',
      ".card { background: linear-gradient(#abc, #def); }",
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.cssFileContent).toContain("linear-gradient(#abc, #def)");
  });

  it("does NOT mangle decimal values in CSS property values", () => {
    const c = makeComponent(
      '<div class="nav"></div>',
      ".nav { background: rgba(0,0,0,0.9); font-size: 1.1rem; transition: all .15s; letter-spacing: -0.02em; border: 1px solid rgba(255,255,255,0.2); }",
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.cssFileContent).toContain("rgba(0,0,0,0.9)");
    expect(result.cssFileContent).toContain("1.1rem");
    expect(result.cssFileContent).toContain(".15s");
    expect(result.cssFileContent).toContain("-0.02em");
    expect(result.cssFileContent).toContain("rgba(255,255,255,0.2)");
  });

  it("does NOT mangle sub-1 decimal font-size values (e.g. 0.7rem, 0.82rem)", () => {
    // Regression: the old regex [a-z0-9-_]+ had no leading-letter guard, so
    // after a decimal '.' it matched digit-starting tokens like '7rem', '82rem',
    // '025', '06em' and hashed them as CSS class names.
    const c = makeComponent(
      '<div class="cblock-lang"></div>',
      ".cblock-lang { font-size: 0.7rem; letter-spacing: .06em; background: rgba(255,255,255,0.025); line-height: 1.7; } .cblock-body { font-size: 0.82rem; }",
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.cssFileContent).toContain("font-size: 0.7rem");
    expect(result.cssFileContent).toContain("letter-spacing: .06em");
    expect(result.cssFileContent).toContain("rgba(255,255,255,0.025)");
    expect(result.cssFileContent).toContain("line-height: 1.7");
    expect(result.cssFileContent).toContain("font-size: 0.82rem");
    // Verify class names are still scoped
    expect(result.cssFileContent).toContain("bascik__my-comp__cblock-lang");
    expect(result.cssFileContent).toContain("bascik__my-comp__cblock-body");
  });

  it("converts #id in an inline <style> tag and injects class", () => {
    const c = makeComponent(
      '<style>#panel { display: none; }</style><div id="panel"></div>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(".bascik__my-comp__id__panel");
    expect(result.fileContent).toContain("bascik__my-comp__id__panel");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// K: Compound querySelector — space-separated and combinator selectors
// ─────────────────────────────────────────────────────────────────────────────

describe("prefixElementAttribute – compound querySelector (class)", () => {
  it("scopes both tokens in querySelector('.foo .bar')", () => {
    const c = makeComponent(
      '<div class="foo"><span class="bar"></span></div>' +
      '<script>document.querySelector(".foo .bar")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `querySelector(".${scopeClass("foo")} .${scopeClass("bar")}")`,
    );
  });

  it("scopes both tokens in querySelectorAll('.foo > .bar')", () => {
    const c = makeComponent(
      '<div class="foo"><span class="bar"></span></div>' +
      '<script>document.querySelectorAll(".foo > .bar")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `querySelectorAll(".${scopeClass("foo")} > .${scopeClass("bar")}")`,
    );
  });

  it("scopes the class token in querySelector('#id .cls')", () => {
    const c = makeComponent(
      '<div id="panel" class="card"></div>' +
      '<script>document.querySelector("#panel .card")</script>',
    );
    // class pass rewrites .card token in the compound selector
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(`.${scopeClass("card")}`);
  });
});

describe("prefixElementAttribute – compound querySelector (id)", () => {
  it("scopes #id token in querySelector('#id .child')", () => {
    const c = makeComponent(
      '<div id="panel"><span class="icon"></span></div>' +
      '<script>document.querySelector("#panel .icon")</script>',
    );
    // id pass rewrites #panel token in the compound selector
    const result = prefixElementAttribute(c, "id", "test1234");
    expect(result.fileContent).toContain(`#${scope("panel")}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// L: setAttribute("class" / "id", …)
// ─────────────────────────────────────────────────────────────────────────────

describe("prefixElementAttribute – setAttribute", () => {
  it("scopes setAttribute('class', 'value')", () => {
    const c = makeComponent(
      '<div class="card"></div>' +
      '<script>el.setAttribute("class", "card")</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `setAttribute("class", "${scopeClass("card")}")`,
    );
  });

  it("scopes setAttribute('id', 'value')", () => {
    const c = makeComponent(
      '<div id="panel"></div>' +
      '<script>el.setAttribute("id", "panel")</script>',
    );
    const result = prefixElementAttribute(c, "id", "test1234");
    expect(result.fileContent).toContain(
      `setAttribute("id", "${scope("panel")}")`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// M: element.className setter
// ─────────────────────────────────────────────────────────────────────────────

describe("prefixElementAttribute – element.className setter", () => {
  it("scopes single-class assignment", () => {
    const c = makeComponent(
      '<div class="card"></div><script>el.className = "card"</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(`className = "${scopeClass("card")}"`);
  });

  it("scopes both tokens in a space-separated assignment", () => {
    const c = makeComponent(
      '<div class="card active"></div>' +
      '<script>el.className = "card active"</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `className = "${scopeClass("card")} ${scopeClass("active")}"`,
    );
  });

  it("scopes className += append form", () => {
    const c = makeComponent(
      '<div class="open"></div><script>el.className += " open"</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    expect(result.fileContent).toContain(
      `className += " ${scopeClass("open")}"`,
    );
  });

  it("does not re-scope an already-scoped class name", () => {
    // Once a class is scoped (e.g. bascik__my-comp__card), a subsequent
    // iteration for a different class should not touch it.
    const c = makeComponent(
      '<div class="card btn"></div>' +
      '<script>el.className = "card btn"</script>',
    );
    const result = prefixElementAttribute(c, "class", "test1234");
    const content = result.fileContent;
    // Each scoped name should appear exactly once (no double-scoping)
    const cardCount = (content.match(new RegExp(scopeClass("card"), "g")) || [])
      .length;
    const btnCount = (content.match(new RegExp(scopeClass("btn"), "g")) || [])
      .length;
    // HTML attr + script = 2 occurrences each at most; key thing is no triple+
    expect(cardCount).toBeGreaterThanOrEqual(1);
    expect(btnCount).toBeGreaterThanOrEqual(1);
    expect(content).not.toContain(`${scopeClass("card")}${scopeClass("card")}`);
  });
});

// ─── skipElementContents ────────────────────────────────────────────────────────

describe("prefixElementAttribute – skipElementContents", () => {
  it("still scopes attributes on the skip element's own opening tag", () => {
    // class="cblock-body" on <code> itself is a template attribute and SHOULD be scoped
    const c = makeComponent('<code class="cblock-body">literal</code>');
    const result = prefixElementAttribute(c, "class", "test1234", true, ["code"]);
    expect(result.fileContent).toContain(scopeClass("cblock-body"));
  });

  it("does not rewrite class attributes on elements inside a skipped tag", () => {
    // Inner HTML of <code> (e.g. display code) must be left untouched
    const c = makeComponent(
      '<div class="outer"><code class="cblock-body"><div class="inner">literal</div></code></div>',
    );
    const result = prefixElementAttribute(c, "class", "test1234", true, ["code"]);
    expect(result.fileContent).toContain(scopeClass("outer"));
    expect(result.fileContent).toContain(scopeClass("cblock-body"));
    // <div class="inner"> is inside <code> — must not be scoped
    expect(result.fileContent).toContain('class="inner"');
    expect(result.fileContent).not.toContain(scopeClass("inner"));
  });

  it("does not rewrite id attributes on elements inside a skipped tag", () => {
    const c = makeComponent(
      '<section id="real"><pre><div id="example">code</div></pre></section>',
    );
    const result = prefixElementAttribute(c, "id", "test1234", true, ["pre"]);
    expect(result.fileContent).toContain(scope("real"));
    // id="example" is inside <pre> content — must not be scoped
    expect(result.fileContent).toContain('id="example"');
    expect(result.fileContent).not.toContain(scope("example"));
  });

  it("does not inject element classes onto elements inside a skipped tag", () => {
    const c = makeComponent(
      '<div class="outer"><code class="cblock-body"><p>paragraph in code</p></code></div>',
      "p { color: red; }",
    );
    const result = prefixElementAttribute(c, "class", "test1234", true, ["code"]);
    // The <p> inside <code> should NOT receive an element class
    expect(result.fileContent).toContain("<p>paragraph in code</p>");
  });

  it("restores the original inner content of skipped tags intact", () => {
    const inner = '<span class="highlight">example <strong>code</strong></span>';
    const c = makeComponent(`<div class="wrap"><code class="cblock-body">${inner}</code></div>`);
    const result = prefixElementAttribute(c, "class", "test1234", true, ["code"]);
    expect(result.fileContent).toContain(inner);
  });

  it("handles nested skip tags (pre > code)", () => {
    const inner = '<code class="language-html"><div class="inner">content</div></code>';
    const c = makeComponent(`<pre>${inner}</pre><div class="outside"></div>`);
    const result = prefixElementAttribute(c, "class", "test1234", true, ["pre", "code"]);
    // Outer class is scoped
    expect(result.fileContent).toContain(scopeClass("outside"));
    // Inner content is preserved verbatim (not scoped)
    expect(result.fileContent).toContain('<div class="inner">content</div>');
  });

  it("leaves no sentinel placeholders in output when both code and pre are skipped", () => {
    // Regression: nested sentinel restoration (pre > code) was single-pass, leaving
    // \x00BSKIP0\x00 unresolved in the output when <pre> swallowed the already-sentinel-
    // ised <code> inner content.
    const inner = '<span class="slot-marker"></span>';
    const c = makeComponent(
      `<div class="wrapper"><pre><code class="cblock-body">${inner}</code></pre></div>`,
    );
    const result = prefixElementAttribute(c, "class", "test1234", true, ["code", "pre"]);
    // No sentinel may survive in the output
    expect(result.fileContent).not.toContain("\x00");
    expect(result.fileContent).not.toContain("BSKIP");
    // The slot marker inside <code> must be fully restored
    expect(result.fileContent).toContain(inner);
    // Note: class="cblock-body" is NOT scoped here because it sits inside <pre>'s
    // preserved zone — a known trade-off when "pre" is in the skip list.
    // This is why the default is ["code"] only, not ["code", "pre"].
    expect(result.fileContent).toContain('class="cblock-body"');
  });

  it("restores slot markers inside pre>code so slot injection can proceed", () => {
    // Mirrors the real code-block component template: slot marker inside <code> inside <pre>
    const c = makeComponent(
      '<pre><code class="cblock-body"><span data-bascik-slot></span></code></pre>',
    );
    const result = prefixElementAttribute(c, "class", "test1234", true, ["code", "pre"]);
    // Slot marker must survive intact for the slot-injection step
    expect(result.fileContent).toContain('<span data-bascik-slot></span>');
    expect(result.fileContent).not.toContain("BSKIP");
  });
});

describe("prefixElementAttribute – name attribute: meta element shielding", () => {
  it("does not scope the name attribute on <meta> tags", () => {
    const c = makeComponent(
      `<meta name="viewport" content="width=device-width, initial-scale=1.0" /><input name="email" />`,
    );
    const result = prefixElementAttribute(c, "name", "test1234");
    // <meta name="viewport"> must be left unchanged
    expect(result.fileContent).toContain('name="viewport"');
    // <input name="email"> must still be scoped
    expect(result.fileContent).not.toContain('name="email"');
  });

  it("does not scope any standard meta name values", () => {
    const c = makeComponent(
      `<meta charset="UTF-8" /><meta name="description" content="My site." /><meta name="robots" content="noindex" />`,
    );
    const result = prefixElementAttribute(c, "name", "test1234");
    expect(result.fileContent).toContain('name="description"');
    expect(result.fileContent).toContain('name="robots"');
    // charset meta has no name attr so it should pass through untouched
    expect(result.fileContent).toContain('<meta charset="UTF-8" />');
  });

  it("leaves no sentinel tokens in the output", () => {
    const c = makeComponent(
      `<meta name="viewport" content="width=device-width" /><input name="field" />`,
    );
    const result = prefixElementAttribute(c, "name", "test1234");
    expect(result.fileContent).not.toContain("\x00");
    expect(result.fileContent).not.toContain("BMETATAG");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("minifyJs", () => {
  it("removes block comments", () => {
    expect(minifyJs("/* hello */var x = 1;")).toBe("var x = 1;");
  });

  it("removes line comments", () => {
    expect(minifyJs("var x = 1; // comment\nvar y = 2;")).toBe(
      "var x = 1;\nvar y = 2;",
    );
  });

  it("collapses multiple spaces and tabs to a single space", () => {
    expect(minifyJs("var  x  =  1;")).toBe("var x = 1;");
  });

  it("collapses multiple blank lines to one", () => {
    expect(minifyJs("var x = 1;\n\n\nvar y = 2;")).toBe(
      "var x = 1;\nvar y = 2;",
    );
  });

  it("preserves double-quoted strings verbatim", () => {
    expect(minifyJs('var s = "hello  world"; // end')).toBe(
      'var s = "hello  world";',
    );
  });

  it("preserves single-quoted strings verbatim", () => {
    expect(minifyJs("var s = 'hello  world';")).toBe("var s = 'hello  world';");
  });

  it("preserves strings that look like comments", () => {
    expect(minifyJs('var url = "https://example.com";')).toBe(
      'var url = "https://example.com";',
    );
  });

  it("preserves template literals verbatim", () => {
    expect(minifyJs("var s = `hello  world`;")).toBe("var s = `hello  world`;");
  });

  it("handles escape sequences in strings", () => {
    expect(minifyJs('var s = "he said \\"hi\\"";')).toBe(
      'var s = "he said \\"hi\\"";',
    );
  });

  it("adds a space after a block comment that abuts a token", () => {
    const result = minifyJs("return/*x*/value;");
    expect(result).toBe("return value;");
  });

  it("trims leading and trailing whitespace", () => {
    expect(minifyJs("\n  var x = 1;  \n")).toBe("var x = 1;");
  });

  it("handles empty input", () => {
    expect(minifyJs("")).toBe("");
  });
});
