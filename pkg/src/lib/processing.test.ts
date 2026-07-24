import { describe, it, expect, vi } from "vitest";
import { recursivelyTranspile } from "./processing.js";

// Disable all scoping so tests produce predictable, readable HTML
vi.mock("./config.js", () => ({
  BascikConfig: {
    scopeScriptBlocks: false,
    scopeAttribute: { class: false, id: false, name: false },
    obfuscateAttributeNames: false,
    isBuild: false,
    minifyStyles: false,
  },
}));

vi.mock("./names.js", () => ({
  getUniqueId: vi.fn(() => "test1234"),
  obfuscateAttributeName: vi.fn((name) => name),
  getAttributeNameHash: vi.fn((name) => name),
}));

// ─────────────────────────────────────────────────────────────────────────────
// A: Slot fallback content
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – slot fallback content", () => {
  const componentList = {
    "my-card": {
      fileName: "components/my-card.html",
      fileContent:
        "<div><slot-component>default content</slot-component></div>",
    },
  };

  it("renders fallback when no inner content is provided", () => {
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<my-card></my-card>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe("<div>default content</div>");
  });

  it("uses provided inner content over fallback", () => {
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<my-card><p>custom</p></my-card>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe("<div><p>custom</p></div>");
  });

  it("empty slot-component (no fallback) renders nothing", () => {
    const list = {
      "my-empty": {
        fileName: "components/my-empty.html",
        fileContent: "<div><slot-component></slot-component></div>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<my-empty></my-empty>",
      list,
    );
    expect(transpiledHtmlBody).toBe("<div></div>");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B: data-bascik-slot as default slot
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – data-bascik-slot default slot", () => {
  const componentList = {
    "my-section": {
      fileName: "components/my-section.html",
      fileContent:
        "<section><div data-bascik-slot>fallback text</div></section>",
    },
  };

  it("replaces data-bascik-slot element with provided inner content", () => {
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<my-section><p>custom content</p></my-section>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe("<section><p>custom content</p></section>");
  });

  it("renders fallback inner content when no inner content provided", () => {
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<my-section></my-section>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe("<section>fallback text</section>");
  });

  it('does not confuse data-bascik-slot with named data-bascik-slot="..."', () => {
    const list = {
      "my-layout": {
        fileName: "components/my-layout.html",
        fileContent:
          "<main><div data-bascik-slot>default</div>" +
          '<aside data-bascik-slot="sidebar"></aside></main>',
      },
    };
    const inner =
      '<p>body</p><div data-bascik-slot="sidebar"><nav>nav</nav></div>';
    const { transpiledHtmlBody } = recursivelyTranspile(
      `<my-layout>${inner}</my-layout>`,
      list,
    );
    // default slot = everything not in a named slot wrapper (just inner HTML)
    expect(transpiledHtmlBody).toContain("<nav>nav</nav>");
    expect(transpiledHtmlBody).not.toContain("data-bascik-slot");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// C: Integration — basic transpile pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – integration", () => {
  it("replaces a simple component with no slots", () => {
    const componentList = {
      "my-nav": {
        fileName: "components/my-nav.html",
        fileContent: "<nav><a href='/'>Home</a></nav>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<header><my-nav></my-nav></header>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe(
      "<header><nav><a href='/'>Home</a></nav></header>",
    );
  });

  it("handles nested components recursively", () => {
    const componentList = {
      outer: {
        fileName: "components/outer.html",
        fileContent:
          "<div class='outer'><slot-component></slot-component></div>",
      },
      inner: {
        fileName: "components/inner.html",
        fileContent: "<span>inner</span>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<outer><inner></inner></outer>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe(
      "<div class='outer'><span>inner</span></div>",
    );
  });

  it("tracks usedComponents", () => {
    const componentList = {
      "my-btn": {
        fileName: "components/my-btn.html",
        fileContent: "<button>Click</button>",
        cssFileContent: ".btn{}",
      },
    };
    const { usedComponents } = recursivelyTranspile(
      "<my-btn></my-btn>",
      componentList,
    );
    expect(usedComponents.map((c) => c.name)).toContain("my-btn");
  });

  it("handles self-closing components", () => {
    const componentList = {
      "my-hr": {
        fileName: "components/my-hr.html",
        fileContent: "<hr class='divider' />",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<div><my-hr /></div>",
      componentList,
    );
    expect(transpiledHtmlBody).toBe("<div><hr class='divider' /></div>");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Named slot fallback (integration)
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – named slot fallback content", () => {
  it("renders named slot fallback when slot is not provided at usage site", () => {
    const componentList = {
      "my-layout": {
        fileName: "components/my-layout.html",
        fileContent:
          '<main><aside data-bascik-slot="sidebar"><p>Default sidebar</p></aside>' +
          "<div data-bascik-slot></div></main>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      "<my-layout><p>body</p></my-layout>",
      componentList,
    );
    expect(transpiledHtmlBody).toContain("<p>Default sidebar</p>");
    expect(transpiledHtmlBody).toContain("<p>body</p>");
    expect(transpiledHtmlBody).not.toContain("data-bascik-slot");
  });

  it("overrides named slot fallback when content is provided", () => {
    const componentList = {
      "my-layout": {
        fileName: "components/my-layout.html",
        fileContent:
          '<aside data-bascik-slot="sidebar"><p>Fallback</p></aside>',
      },
    };
    const inner = '<div data-bascik-slot="sidebar"><nav>Custom</nav></div>';
    const { transpiledHtmlBody } = recursivelyTranspile(
      `<my-layout>${inner}</my-layout>`,
      componentList,
    );
    expect(transpiledHtmlBody).toContain("<nav>Custom</nav>");
    expect(transpiledHtmlBody).not.toContain("Fallback");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// B (integration): attribute inheritance in full pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("recursivelyTranspile – attribute inheritance", () => {
  it("merges class from usage tag onto component root element", () => {
    const componentList = {
      "site-nav": {
        fileName: "components/site-nav.html",
        fileContent: "<nav><a href='/'>Home</a></nav>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      '<site-nav class="sticky"></site-nav>',
      componentList,
    );
    expect(transpiledHtmlBody).toContain("sticky");
    expect(transpiledHtmlBody).toContain("<nav");
  });

  it("merges aria-label from usage tag", () => {
    const componentList = {
      "site-nav": {
        fileName: "components/site-nav.html",
        fileContent: "<nav><a href='/'>Home</a></nav>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      '<site-nav aria-label="main navigation"></site-nav>',
      componentList,
    );
    expect(transpiledHtmlBody).toContain('aria-label="main navigation"');
  });

  it("does not merge data-bascik-* attributes", () => {
    const componentList = {
      "my-comp": {
        fileName: "components/my-comp.html",
        fileContent: "<div></div>",
      },
    };
    const { transpiledHtmlBody } = recursivelyTranspile(
      '<my-comp data-bascik-prop-title="Hi"></my-comp>',
      componentList,
    );
    expect(transpiledHtmlBody).not.toContain("data-bascik-prop-title");
  });
});
