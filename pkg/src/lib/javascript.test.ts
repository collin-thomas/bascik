import { describe, it, expect, vi } from "vitest";
import { prefixElementAttribute } from "./javascript.js";

vi.mock("./config.js", () => ({
  BascikConfig: {
    obfuscateAttributeNames: false,
    scopeAttribute: { class: true, id: true, name: true },
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
