import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { matchCompatibilityRules } from './rules';

const BUILT_IN_HTML_ELEMENTS = new Set([
  'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map', 'mark', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'search', 'section', 'select', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr'
]);

function normalizeComponentName(name: string): string {
  return name.replace(/\\/g, '/').split('/').pop()?.replace(/\.html$/i, '').toLowerCase() ?? '';
}

function findComponentMap(workspaceRoot: string): Map<string, string> {
  const components = new Map<string, string>();
  const dir = path.join(workspaceRoot, 'src', 'components');

  if (!fs.existsSync(dir)) {
    return components;
  }

  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
        const name = normalizeComponentName(fullPath);
        if (name) {
          components.set(name, fullPath);
        }
      }
    }
  }

  return components;
}

function getWorkspaceRoot(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder?.uri.fsPath;
}

class ComponentDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.Definition> {
    const range = document.getWordRangeAtPosition(position, /[A-Za-z0-9-]+/);
    if (!range) {
      return undefined;
    }

    const word = document.getText(range);
    if (!word || BUILT_IN_HTML_ELEMENTS.has(word.toLowerCase())) {
      return undefined;
    }

    const root = getWorkspaceRoot();
    if (!root) {
      return undefined;
    }

    const componentMap = findComponentMap(root);
    const tagName = word.toLowerCase();
    const file = componentMap.get(tagName);
    if (!file || !fs.existsSync(file)) {
      return undefined;
    }

    return new vscode.Location(vscode.Uri.file(file), new vscode.Position(0, 0));
  }
}

function createDiagnosticsForDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
  const { languageId } = document;

  if (languageId !== 'css' && languageId !== 'javascript' && languageId !== 'typescript' && languageId !== 'html') {
    return [];
  }

  const text = document.getText();
  const kinds: Array<'css' | 'js'> = languageId === 'css' ? ['css'] : languageId === 'html' ? ['css', 'js'] : ['js'];
  const lines = text.split(/\r?\n/);

  const diagnostics: vscode.Diagnostic[] = [];

  for (const kind of kinds) {
    const matches = matchCompatibilityRules(text, kind);
    for (const rule of matches) {
      const lineIndex = lines.findIndex((lineText) => new RegExp(rule.regex.source, rule.regex.flags).test(lineText));
      if (lineIndex === -1) continue;
      const start = new vscode.Position(lineIndex, 0);
      const end = new vscode.Position(lineIndex, Math.min(lines[lineIndex]?.length ?? 0, 200));
      const diag = new vscode.Diagnostic(
        new vscode.Range(start, end),
        `${rule.message} ${rule.suggestion}`,
        vscode.DiagnosticSeverity.Warning,
      );
      diag.source = 'bascik';
      diagnostics.push(diag);
    }
  }

  // Flag <script> tags with both data-bascik-build and data-bascik-server.
  if (languageId === 'html') {
    // Lookaheads handle either attribute ordering without needing two passes.
    const conflictRe = /<script\b(?=[^>]*\bdata-bascik-build\b)(?=[^>]*\bdata-bascik-server\b)[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = conflictRe.exec(text)) !== null) {
      const before = text.slice(0, m.index);
      const lineNum = (before.match(/\n/g) ?? []).length;
      const colNum = m.index - before.lastIndexOf('\n') - 1;
      const lineText = lines[lineNum] ?? '';
      const diag = new vscode.Diagnostic(
        new vscode.Range(
          new vscode.Position(lineNum, colNum),
          new vscode.Position(lineNum, Math.min(colNum + m[0].length, lineText.length)),
        ),
        'data-bascik-build and data-bascik-server cannot both appear on the same <script> tag. Remove one — a script runs at build time or at request time, not both.',
        vscode.DiagnosticSeverity.Error,
      );
      diag.source = 'bascik';
      diagnostics.push(diag);
    }
  }

  return diagnostics;
}

export function activate(context: vscode.ExtensionContext): void {
  const definitionProvider = new ComponentDefinitionProvider();
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      [{ language: 'html' }, { language: 'javascript' }, { language: 'typescript' }, { language: 'css' }],
      definitionProvider,
    ),
  );

  const diagnostics = vscode.languages.createDiagnosticCollection('bascik');
  context.subscriptions.push(diagnostics);

  const refreshDiagnostics = (document: vscode.TextDocument | undefined) => {
    if (!document) return;
    const items = createDiagnosticsForDocument(document);
    diagnostics.set(document.uri, items);
  };

  for (const document of vscode.workspace.textDocuments) {
    refreshDiagnostics(document);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
    vscode.workspace.onDidChangeTextDocument((event) => refreshDiagnostics(event.document)),
  );
}

export function deactivate(): void {
  // no-op
}
