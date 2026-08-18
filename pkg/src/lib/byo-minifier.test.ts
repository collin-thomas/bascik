import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { transform } from "esbuild";
import postcss from "postcss";
import autoprefixer from "autoprefixer";
import { BascikConfig } from "./config.js";
import { transpilePage } from "./processing.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(async () => { }),
  mkdir: vi.fn(async () => { }),
}));

vi.mock("./config.js", () => ({
  shouldLog: vi.fn(() => true),
  BascikConfig: {
    scopeScriptBlocks: true,
    inheritAttributes: true,
    scopeAttribute: { class: true, id: true, name: true },
    obfuscateAttributeNames: false,
    isBuild: true,
    minify: {
      html: false,
      css: false,
      js: false,
    },
    deduplicateCss: true,
    inlineStyles: false,
    directory: {
      pages: "src/pages",
      components: "src/components",
    },
  },
}));

describe("BYOMinifier (Bring Your Own Minifier) – real library integrations", () => {
  beforeEach(() => {
    (BascikConfig as Record<string, unknown>).isBuild = true;
    (BascikConfig as Record<string, unknown>).inlineStyles = false;
    (BascikConfig as Record<string, unknown>).scopeAttribute = { class: true, id: true, name: true };
  });

  afterEach(() => {
    (BascikConfig as Record<string, unknown>).minify = { html: false, css: false, js: false };
  });

  it("minifies JavaScript with esbuild via minify.js", async () => {
    (BascikConfig.minify as any).js = async (code: string) => {
      const result = await transform(code, { loader: "js", minify: true });
      return result.code.trim();
    };

    const pageHtml = `<!DOCTYPE html><html><head></head><body>
      <script>
        // Long verbose comment
        function calculateTotal(price, taxRate) {
          const totalAmount = price + (price * taxRate);
          return totalAmount;
        }
        console.log(calculateTotal(100, 0.08));
      </script>
    </body></html>`;
    vi.mocked(readFile).mockResolvedValue(pageHtml);

    const componentList = {};
    const result = await transpilePage("src/pages/index.html", componentList);
    expect(result).not.toBeNull();
    const html = result!.distHtml;

    expect(html).not.toContain("// Long verbose comment");
    expect(html).not.toContain("totalAmount");
    expect(html).toContain("console.log(");
  });

  it("minifies CSS with esbuild via minify.css", async () => {
    (BascikConfig.minify as any).css = async (code: string) => {
      const result = await transform(code, { loader: "css", minify: true });
      return result.code.trim();
    };

    const pageHtml = `<!DOCTYPE html><html><head></head><body><card-comp></card-comp></body></html>`;
    vi.mocked(readFile).mockResolvedValue(pageHtml);

    const componentList = {
      "card-comp": {
        fileName: "components/card-comp.html",
        fileContent: `<style>
          /* Card styles */
          .card {
            background-color: rgb(255, 255, 255);
            margin-top: 0px;
            margin-bottom: 0px;
          }
        </style><div class="card">Card</div>`,
      },
    };

    const result = await transpilePage("src/pages/index.html", componentList);
    expect(result).not.toBeNull();
    const html = result!.distHtml;

    expect(html).not.toContain("/* Card styles */");
    expect(html).toContain("margin-top:0");
  });

  it("adds vendor prefixes with PostCSS + Autoprefixer via minify.css", async () => {
    (BascikConfig.minify as any).css = async (code: string) => {
      const result = await postcss([autoprefixer]).process(code, { from: undefined });
      return result.css;
    };

    const pageHtml = `<!DOCTYPE html><html><head></head><body><no-select-comp></no-select-comp></body></html>`;
    vi.mocked(readFile).mockResolvedValue(pageHtml);
    const componentList = {
      "no-select-comp": {
        fileName: "components/no-select-comp.html",
        fileContent: `<style>
          .unselectable {
            user-select: none;
          }
        </style><div class="unselectable">Cannot select</div>`,
      },
    };

    const result = await transpilePage("src/pages/index.html", componentList);
    expect(result).not.toBeNull();
    const html = result!.distHtml;

    expect(html).toContain("-webkit-user-select: none");
    expect(html).toContain("user-select: none");
  });

  it("erases TypeScript type annotations using Node.js stripTypeScriptTypes via minify.js", async () => {
    (BascikConfig.minify as any).js = (code: string) => stripTypeScriptTypes(code);

    const pageHtml = `<!DOCTYPE html><html><head></head><body><ts-comp></ts-comp></body></html>`;
    vi.mocked(readFile).mockResolvedValue(pageHtml);

    const componentList = {
      "ts-comp": {
        fileName: "components/ts-comp.html",
        fileContent: `
          <div id="box">TS Component</div>
          <script>
            interface Config {
              count: number;
              label: string;
            }
            const cfg: Config = { count: 10, label: "test" };
            const count: number = cfg.count;
            const element = document.getElementById("box") as HTMLElement;
            element.textContent = \`Count: \${count}\`;
          </script>
        `,
      },
    };

    const result = await transpilePage("src/pages/index.html", componentList);
    expect(result).not.toBeNull();
    const html = result!.distHtml;

    expect(html).not.toContain("interface Config");
    expect(html).not.toContain(": Config");
    expect(html).not.toContain(": number");
    expect(html).not.toContain("as HTMLElement");
    expect(html).toContain("const cfg");
    expect(html).toContain("const count");
  });

  it("combines PostCSS + Autoprefixer (minify.css) and esbuild (minify.js) in the same pipeline", async () => {
    (BascikConfig.minify as any).css = async (code: string) => {
      const result = await postcss([autoprefixer]).process(code, { from: undefined });
      return result.css;
    };
    (BascikConfig.minify as any).js = async (code: string) => {
      const result = await transform(code, { loader: "js", minify: true });
      return result.code.trim();
    };

    const pageHtml = `<!DOCTYPE html><html><head>
      <style>.hero { user-select: none; }</style>
    </head><body>
      <full-comp></full-comp>
      <script>
        // Inline page script
        const greetingMessage = "Hello World";
        console.log(greetingMessage);
      </script>
    </body></html>`;
    vi.mocked(readFile).mockResolvedValue(pageHtml);

    const componentList = {
      "full-comp": {
        fileName: "components/full-comp.html",
        fileContent: `
          <style>.box { user-select: none; display: flex; }</style>
          <div class="box">Flex Box</div>
          <script>
            // Component script
            const componentSecret = "secret_value";
            console.log(componentSecret);
          </script>
        `,
      },
    };

    const result = await transpilePage("src/pages/index.html", componentList);
    expect(result).not.toBeNull();
    const html = result!.distHtml;

    // CSS prefixing verified
    expect(html).toContain("-webkit-user-select: none");

    // JS minification verified (comments removed, code minified)
    expect(html).not.toContain("// Inline page script");
    expect(html).not.toContain("// Component script");
    expect(html).not.toContain("componentSecret"); // dead variable inlined/mangled by esbuild
    expect(html).toContain('console.log("secret_value")');
  });
});
