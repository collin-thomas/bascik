"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const vscode = __importStar(require("vscode"));
const rules_1 = require("./rules");
const BUILT_IN_HTML_ELEMENTS = new Set([
    'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio', 'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button', 'canvas', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt', 'em', 'embed', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'ins', 'kbd', 'label', 'legend', 'li', 'link', 'main', 'map', 'mark', 'meta', 'meter', 'nav', 'noscript', 'object', 'ol', 'optgroup', 'option', 'output', 'p', 'picture', 'pre', 'progress', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'script', 'search', 'section', 'select', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track', 'u', 'ul', 'var', 'video', 'wbr'
]);
function normalizeComponentName(name) {
    return name.replace(/\\/g, '/').split('/').pop()?.replace(/\.html$/i, '').toLowerCase() ?? '';
}
function findComponentMap(workspaceRoot) {
    const components = new Map();
    const dir = path.join(workspaceRoot, 'src', 'components');
    if (!fs.existsSync(dir)) {
        return components;
    }
    const stack = [dir];
    while (stack.length > 0) {
        const current = stack.pop();
        if (!current || !fs.existsSync(current))
            continue;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
            }
            else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
                const name = normalizeComponentName(fullPath);
                if (name) {
                    components.set(name, fullPath);
                }
            }
        }
    }
    return components;
}
function getWorkspaceRoot() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder?.uri.fsPath;
}
class ComponentDefinitionProvider {
    provideDefinition(document, position, _token) {
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
function createDiagnosticsForDocument(document) {
    const { languageId } = document;
    if (languageId !== 'css' && languageId !== 'javascript' && languageId !== 'typescript' && languageId !== 'html') {
        return [];
    }
    const text = document.getText();
    const kinds = languageId === 'css' ? ['css'] : languageId === 'html' ? ['css', 'js'] : ['js'];
    const lines = text.split(/\r?\n/);
    const diagnostics = [];
    for (const kind of kinds) {
        const matches = (0, rules_1.matchCompatibilityRules)(text, kind);
        for (const rule of matches) {
            const lineIndex = lines.findIndex((lineText) => new RegExp(rule.regex.source, rule.regex.flags).test(lineText));
            if (lineIndex === -1)
                continue;
            const start = new vscode.Position(lineIndex, 0);
            const end = new vscode.Position(lineIndex, Math.min(lines[lineIndex]?.length ?? 0, 200));
            const diag = new vscode.Diagnostic(new vscode.Range(start, end), `${rule.message} ${rule.suggestion}`, vscode.DiagnosticSeverity.Warning);
            diag.source = 'bascik';
            diagnostics.push(diag);
        }
    }
    return diagnostics;
}
function activate(context) {
    const definitionProvider = new ComponentDefinitionProvider();
    context.subscriptions.push(vscode.languages.registerDefinitionProvider([{ language: 'html' }, { language: 'javascript' }, { language: 'typescript' }, { language: 'css' }], definitionProvider));
    const diagnostics = vscode.languages.createDiagnosticCollection('bascik');
    context.subscriptions.push(diagnostics);
    const refreshDiagnostics = (document) => {
        if (!document)
            return;
        const items = createDiagnosticsForDocument(document);
        diagnostics.set(document.uri, items);
    };
    for (const document of vscode.workspace.textDocuments) {
        refreshDiagnostics(document);
    }
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(refreshDiagnostics), vscode.workspace.onDidChangeTextDocument((event) => refreshDiagnostics(event.document)));
}
function deactivate() {
    // no-op
}
