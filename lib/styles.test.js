import { describe, expect, it, vi } from "vitest";
import {
  getClassNameHash,
  obfuscateClassName,
  prefixClassesInCss,
  prefixClassesInHtml,
  convertCssElementSelectorsToClasses,
  addElementClassesInHtml,
  getCssClasses,
  getKeyframeNames,
  prefixKeyframes,
  removeIdSelectors,
  removeCommentsFromCss,
  getComponentCss,
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
const prefixClassesInCssRes = `
.bascik__my-comp__navigation ul {
  list-style-type: none;
  margin: unset;
  padding: unset;
}
.bascik__my-comp__home.bascik__my-comp__logo {
  background-color: #fff;
  color: #18191b;
  padding: 4px;
  user-select: none;
  animation: rotateLogo 2s infinite alternate;
}
@media only screen and (max-width: 600px) {
  .bascik__my-comp__home.bascik__my-comp__logo {
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
const html = `
<nav class="navigation">
  <ul>
    <li class="home logo">Bascik</li>
    <li><a href="/">index</a></li>
    <li><a href="/about">about</a></li>
    <li><a href="/new">new</a></li>
    <li><a href="/sub/">sub page</a></li>
    <li><a href="/x/">not found</a></li>
  </ul>
</nav>
`;
const prefixClassesInHtmlRes = `
<nav class="bascik__my-comp__navigation">
  <ul>
    <li class="bascik__my-comp__home bascik__my-comp__logo">Bascik</li>
    <li><a href="/">index</a></li>
    <li><a href="/about">about</a></li>
    <li><a href="/new">new</a></li>
    <li><a href="/sub/">sub page</a></li>
    <li><a href="/x/">not found</a></li>
  </ul>
</nav>
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
    BascikConfig: { obfuscateClassNames: false },
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

describe("getClassNameHash", () => {
  it("returns hash", () => {
    expect(getClassNameHash("my-class")).toBe("b12345678");
  });
});

describe("obfuscateClassName", () => {
  it("off", () => {
    expect(obfuscateClassName("my-class")).toBe("my-class");
  });
});

describe("prefixClassesInCss", () => {
  it("test", () => {
    expect(prefixClassesInCss(css, "my-comp")).toBe(prefixClassesInCssRes);
  });
});

describe("prefixClassesInHtml", () => {
  it("test", () => {
    expect(prefixClassesInHtml(html, "my-comp")).toBe(prefixClassesInHtmlRes);
  });
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
      }
    );
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
      "/* ID selectors will be removed */"
    );
  });
});

describe("getComponentCss", () => {
  it("test", async () => {
    expect(
      await getComponentCss("my-comp", "my-comp.html", ["my-comp.css"])
    ).toStrictEqual({
      css:
        "\n" +
        ".bascik__my-comp__navigation ul {\n" +
        "  list-style-type: none;\n" +
        "  margin: unset;\n" +
        "  padding: unset;\n" +
        "}\n" +
        ".bascik__my-comp__home.bascik__my-comp__logo {\n" +
        "  background-color: #fff;\n" +
        "  color: #18191b;\n" +
        "  padding: 4px;\n" +
        "  user-select: none;\n" +
        "  animation: bascik__my-comp__keyframe__rotateLogo 2s infinite alternate;\n" +
        "}\n" +
        "@media only screen and (max-width: 600px) {\n" +
        "  .bascik__my-comp__home.bascik__my-comp__logo {\n" +
        "    background-color: #d3ff8d;\n" +
        "  }\n" +
        "}\n" +
        "@keyframes bascik__my-comp__keyframe__rotateLogo {\n" +
        "  from {\n" +
        "    transform: perspective(500px) rotateY(-40deg);\n" +
        "  }\n" +
        "  to {\n" +
        "    transform: perspective(500px) rotateY(40deg);\n" +
        "  }\n" +
        "}\n",
      elementsConvertedClasses: [],
    });
  });
});
