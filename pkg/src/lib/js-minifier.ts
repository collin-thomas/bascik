/**
 * @module js-minifier
 * Built-in lightweight, safe JavaScript minifier for Bascik.
 *
 * Strips comments, collapses redundant whitespace, removes safe operator spaces,
 * and handles statement boundaries (ASI) safely without modifying literal content
 * or breaking valid JS syntax.
 */

/** Segment representing either literal text (strings, regex) or minifiable code */
type Segment = { literal: boolean; text: string };

/** Keywords expecting an expression where a following `/` starts a regex literal */
const REGEX_PRECEDING_KEYWORDS = new Set([
  "return",
  "case",
  "throw",
  "yield",
  "await",
  "delete",
  "typeof",
  "void",
  "default",
  "in",
  "of",
  "instanceof",
  "new",
  "do",
]);

/**
 * Strip block/line comments and collapse whitespace from a JS string.
 * String literals, template literals, and regex literals are preserved verbatim
 * so their content is never altered.
 */
export const minifyJs = (js: string): string => {
  if (!js) return "";

  const segments: Segment[] = [];
  let codeAccum = "";
  let i = 0;
  const len = js.length;

  const flushCode = (): void => {
    if (codeAccum) {
      segments.push({ literal: false, text: codeAccum });
      codeAccum = "";
    }
  };

  while (i < len) {
    const ch = js[i];

    // Quoted string literals ("...", '...') — preserve verbatim
    if (ch === '"' || ch === "'") {
      flushCode();
      const quote = ch;
      let lit = ch;
      i++;
      while (i < len) {
        const c = js[i];
        if (c === "\\" && i + 1 < len) {
          lit += c + js[i + 1];
          i += 2;
          continue;
        }
        lit += c;
        i++;
        if (c === quote) break;
      }
      segments.push({ literal: true, text: lit });
      continue;
    }

    // Template literals (`...`) — preserve verbatim
    if (ch === "`") {
      flushCode();
      let lit = "`";
      i++;
      while (i < len) {
        const c = js[i];
        if (c === "\\" && i + 1 < len) {
          lit += c + js[i + 1];
          i += 2;
          continue;
        }
        lit += c;
        i++;
        if (c === "`") break;
      }
      segments.push({ literal: true, text: lit });
      continue;
    }

    // Potential comment, division, or regex literal — all start with "/".
    if (ch === "/") {
      const next = js[i + 1];

      // Disambiguate regex literal vs division operator:
      // A regex literal can only appear where an expression is expected.
      // Examine the last non-whitespace token in codeAccum or previous segments.
      const trimmedAccum = codeAccum.replace(/\s+$/, "");
      const lastChar = trimmedAccum.slice(-1);

      let couldBeRegex = false;
      if (next !== "/" && next !== "*") {
        if (!lastChar) {
          // At start of code accum — check previous segment if any
          const lastSeg = segments[segments.length - 1];
          if (!lastSeg || !lastSeg.literal) {
            couldBeRegex = true;
          }
        } else if (/[a-zA-Z0-9_$]/.test(lastChar)) {
          // Preceded by a word token — regex only if word is an expression keyword (e.g. return /a/)
          const lastWordMatch = trimmedAccum.match(/\b([a-zA-Z_$][a-zA-Z0-9_$]*)$/);
          if (lastWordMatch && REGEX_PRECEDING_KEYWORDS.has(lastWordMatch[1])) {
            couldBeRegex = true;
          }
        } else if (!/[)\\]}'"`]/.test(lastChar)) {
          // Preceded by operators/punctuation like '=', '(', '[', ':', ',', '!', '?', '&', '|', '+', '-', '*', ';'
          couldBeRegex = true;
        }
      }

      if (couldBeRegex) {
        let j = i + 1;
        let inClass = false;
        let closed = false;
        while (j < len) {
          const c = js[j];
          if (c === "\\") {
            j += 2;
            continue;
          }
          if (c === "[") inClass = true;
          else if (c === "]") inClass = false;
          else if (c === "/" && !inClass) {
            closed = true;
            j++;
            break;
          } else if (c === "\n") break; // Unterminated — not a regex
          j++;
        }
        if (closed) {
          // Consume regex flags (e.g., /abc/gi)
          while (j < len && /[a-z]/i.test(js[j])) j++;
          flushCode();
          segments.push({ literal: true, text: js.slice(i, j) });
          i = j;
          continue;
        }
      }

      if (next === "*") {
        // Block comment: skip to */
        i += 2;
        while (i + 1 < len && !(js[i] === "*" && js[i + 1] === "/")) i++;
        i += 2;
        // If stripping a block comment between two word characters (e.g., return/*x*/v),
        // preserve a space so token boundaries aren't lost.
        const prevChar = codeAccum.slice(-1);
        const nextChar = js[i];
        if (
          prevChar &&
          /[a-zA-Z0-9_$]/.test(prevChar) &&
          nextChar &&
          /[a-zA-Z0-9_$]/.test(nextChar)
        ) {
          codeAccum += " ";
        }
        continue;
      }

      if (next === "/") {
        // Line comment: skip to end of line (preserve newline for statement separation)
        i += 2;
        while (i < len && js[i] !== "\n") i++;
        continue;
      }
    }

    codeAccum += ch;
    i++;
  }
  flushCode();

  // Process code segments and assemble minified JS
  let result = "";
  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx];
    if (seg.literal) {
      // Ensure space between preceding keyword/identifier and literal if needed
      if (
        result &&
        /[a-zA-Z0-9_$]/.test(result.slice(-1)) &&
        /[a-zA-Z0-9_$]/.test(seg.text[0])
      ) {
        result += " ";
      }
      result += seg.text;
      continue;
    }

    let text = seg.text;

    // 1. Process line breaks: convert newlines to semicolons or spaces for ASI safety
    const lines = text.split("\n");
    let processedText = "";

    for (let lIdx = 0; lIdx < lines.length; lIdx++) {
      const line = lines[lIdx].trim();
      if (!line) continue;

      if (!processedText) {
        processedText = line;
        continue;
      }

      const prevLine = processedText.trimEnd();
      const lastChar = prevLine.slice(-1);
      const firstChar = line[0];

      // Check if semicolon is required between prevLine and current line
      let needsSemicolon = false;

      // Statements ending in value tokens or return/break/continue/throw require ; before next statement
      if (/[a-zA-Z0-9_\)$\]'"`]/.test(lastChar)) {
        // Do NOT insert semicolon if line ends with an open control flow / operator
        const endsWithOpenControl =
          /\b(if|while|for|switch)\s*\([^)]*\)\s*$/.test(prevLine) ||
          /\b(else|do|try|finally)\s*$/.test(prevLine) ||
          /(=|,|\+|\-|\*|\/|%|\?|:|=>|\.|\&\&|\|\||\?\?)\s*$/.test(prevLine);

        // Do NOT insert semicolon if next line starts with closing/continuation structures
        const startsWithContinuation =
          /^(else|catch|finally|while|instanceof|in|of|,|;|:|\)|\}|\]|\.)/.test(line);

        if (!endsWithOpenControl && !startsWithContinuation && !/[;{}:,]\s*$/.test(prevLine)) {
          needsSemicolon = true;
        }
      } else if (lastChar === "}") {
        // After }, insert semicolon unless followed by control continuation (else, catch, finally, while, etc.)
        if (!/^(else|catch|finally|while|,|;|:|\)|\}|\]|\.)/.test(line)) {
          needsSemicolon = true;
        }
      }

      if (needsSemicolon) {
        processedText += ";" + line;
      } else {
        // Ensure space between word tokens when joining without semicolon
        const prevLastChar = prevLine.slice(-1);
        if (/[a-zA-Z0-9_$]/.test(prevLastChar) && /[a-zA-Z0-9_$]/.test(firstChar)) {
          processedText += " " + line;
        } else {
          processedText += line;
        }
      }
    }

    // 2. Collapse remaining multi-space runs into a single space
    let code = processedText.replace(/\s+/g, " ");

    // 3. Strip spaces around safe structural punctuation
    code = code.replace(/\s*([{}();,:=?*!^~%])\s*/g, "$1");

    // 4. Strip spaces around < and >
    code = code.replace(/\s*(<|>|<=|>=|==|===|!=|!==|<<|>>|>>>|\&\&|\|\||\?\?|\+=|-=|\*=|\/=|%=)\s*/g, "$1");

    // 5. Strip spaces around + and - safely (avoid turning + + into ++ or - - into --)
    code = code.replace(/([^\s+-])\s*\+/g, "$1+");
    code = code.replace(/\+\s*([^\s+-])/g, "+$1");
    code = code.replace(/([^\s+-])\s*-/g, "$1-");
    code = code.replace(/-\s*([^\s+-])/g, "-$1");

    // 6. Strip spaces around . except when preceded by an integer literal (e.g. 1 .toString())
    code = code.replace(/([^\d\s])\s*\.\s*/g, "$1.");
    code = code.replace(/([^\d])\s*\.\s*([^\d\s])/g, "$1.$2");

    // Ensure boundary spacing with previous segment if both end/start with word chars
    if (
      result &&
      /[a-zA-Z0-9_$]/.test(result.slice(-1)) &&
      /[a-zA-Z0-9_$]/.test(code[0])
    ) {
      result += " ";
    }

    result += code;
  }

  return result.trim();
};
