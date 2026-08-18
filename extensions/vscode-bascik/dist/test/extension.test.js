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
const assert = __importStar(require("node:assert"));
const path = __importStar(require("node:path"));
const vscode = __importStar(require("vscode"));
function getBascikExtension() {
    return (vscode.extensions.getExtension('bascik.bascik-vscode') ??
        vscode.extensions.all.find((ext) => ext.packageJSON?.name === 'bascik-vscode'));
}
suite('Extension Integration Suite', () => {
    suiteSetup(async () => {
        const ext = getBascikExtension();
        if (ext && !ext.isActive) {
            await ext.activate();
        }
    });
    test('Extension is registered and active', () => {
        const ext = getBascikExtension();
        assert.ok(ext, 'Extension bascik-vscode should be found');
        assert.strictEqual(ext.isActive, true, 'Extension should be active');
    });
    suite('ComponentDefinitionProvider', () => {
        test('provides definition for top-level component tag', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'html',
                content: '<div><my-button></my-button></div>',
            });
            const pos = new vscode.Position(0, 7); // position inside 'my-button'
            const locations = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', doc.uri, pos);
            assert.ok(locations && locations.length > 0, 'Definition should be found');
            const targetPath = locations[0].uri.fsPath.replace(/\\/g, '/');
            assert.ok(targetPath.endsWith('src/components/my-button.html'), `Expected location to end with src/components/my-button.html, got ${targetPath}`);
        });
        test('provides definition for nested component tag', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'html',
                content: '<my-card></my-card>',
            });
            const pos = new vscode.Position(0, 3); // position inside 'my-card'
            const locations = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', doc.uri, pos);
            assert.ok(locations && locations.length > 0, 'Definition for nested component should be found');
            const targetPath = locations[0].uri.fsPath.replace(/\\/g, '/');
            assert.ok(targetPath.endsWith('src/components/card/my-card.html'), `Expected location to end with src/components/card/my-card.html, got ${targetPath}`);
        });
        test('returns undefined for built-in HTML element', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'html',
                content: '<div><span>Hello</span></div>',
            });
            const pos = new vscode.Position(0, 2); // position inside 'div'
            const locations = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', doc.uri, pos);
            assert.ok(!locations || locations.length === 0, 'No definition should be provided for built-in element');
        });
        test('returns undefined for unknown component tag', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'html',
                content: '<unknown-widget></unknown-widget>',
            });
            const pos = new vscode.Position(0, 3); // position inside 'unknown-widget'
            const locations = await vscode.commands.executeCommand('vscode.executeDefinitionProvider', doc.uri, pos);
            assert.ok(!locations || locations.length === 0, 'No definition should be provided for unknown component');
        });
    });
    suite('Diagnostics', () => {
        test('reports error when script has both data-bascik-build and data-bascik-server', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'html',
                content: '<script data-bascik-build data-bascik-server>\nconsole.log(1);\n</script>',
            });
            const diagnostics = vscode.languages.getDiagnostics(doc.uri);
            const match = diagnostics.find((d) => d.message.includes('data-bascik-build and data-bascik-server cannot both appear'));
            assert.ok(match, 'Expected error diagnostic for conflicting script attributes');
            assert.strictEqual(match.severity, vscode.DiagnosticSeverity.Error);
        });
        test('reports JS compatibility warning in html script tag', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'html',
                content: '<script>\nelement.id = "custom";\n</script>',
            });
            const diagnostics = vscode.languages.getDiagnostics(doc.uri);
            const match = diagnostics.find((d) => d.message.includes('Runtime .id assignment'));
            assert.ok(match, 'Expected JS compatibility warning in script block');
            assert.strictEqual(match.severity, vscode.DiagnosticSeverity.Warning);
        });
        test('reports CSS compatibility warning in html style tag', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'html',
                content: '<style>\n@import "theme.css";\n</style>',
            });
            const diagnostics = vscode.languages.getDiagnostics(doc.uri);
            const match = diagnostics.find((d) => d.message.includes('CSS @import is not processed'));
            assert.ok(match, 'Expected CSS compatibility warning in style block');
            assert.strictEqual(match.severity, vscode.DiagnosticSeverity.Warning);
        });
        test('reports unclosed component tag warning', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'html',
                content: '<div>\n<my-button>\n</div>',
            });
            const diagnostics = vscode.languages.getDiagnostics(doc.uri);
            const match = diagnostics.find((d) => d.message.includes('Component tag <my-button> is unclosed'));
            assert.ok(match, 'Expected unclosed component tag warning');
            assert.strictEqual(match.severity, vscode.DiagnosticSeverity.Warning);
        });
        test('reports multiple style tags warning', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'html',
                content: '<style>.a { color: red; }</style>\n<style>.b { color: blue; }</style>',
            });
            const diagnostics = vscode.languages.getDiagnostics(doc.uri);
            const match = diagnostics.find((d) => d.message.includes('Component has multiple <style> tags'));
            assert.ok(match, 'Expected warning for multiple style tags');
            assert.strictEqual(match.severity, vscode.DiagnosticSeverity.Warning);
        });
        test('reports companion CSS file conflict when opening html file', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            assert.ok(workspaceFolder, 'Workspace folder should be open');
            const companionUri = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, 'src', 'components', 'companion.html'));
            const doc = await vscode.workspace.openTextDocument(companionUri);
            const diagnostics = vscode.languages.getDiagnostics(doc.uri);
            const match = diagnostics.find((d) => d.message.includes('Component has both a companion .css file and an inline <style> tag'));
            assert.ok(match, 'Expected warning for companion CSS file conflict');
            assert.strictEqual(match.severity, vscode.DiagnosticSeverity.Warning);
        });
        test('reports compatibility warning in standalone CSS file', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'css',
                content: '@import "base.css";',
            });
            const diagnostics = vscode.languages.getDiagnostics(doc.uri);
            const match = diagnostics.find((d) => d.message.includes('CSS @import is not processed'));
            assert.ok(match, 'Expected CSS warning in standalone CSS file');
            assert.strictEqual(match.severity, vscode.DiagnosticSeverity.Warning);
        });
        test('reports compatibility warning in standalone JS file', async () => {
            const doc = await vscode.workspace.openTextDocument({
                language: 'javascript',
                content: 'document.querySelector("[data-target]");',
            });
            const diagnostics = vscode.languages.getDiagnostics(doc.uri);
            const match = diagnostics.find((d) => d.message.includes('Attribute selectors are not rewritten'));
            assert.ok(match, 'Expected JS warning in standalone JS file');
            assert.strictEqual(match.severity, vscode.DiagnosticSeverity.Warning);
        });
    });
});
