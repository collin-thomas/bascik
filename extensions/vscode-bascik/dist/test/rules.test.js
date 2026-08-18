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
const rules_1 = require("../rules");
suite('Compatibility Rules Suite', () => {
    suite('CSS Rules', () => {
        test('detects standalone attribute selectors', () => {
            const css = '[data-state] { color: red; }';
            const matches = (0, rules_1.matchCompatibilityRules)(css, 'css');
            assert.ok(matches.some((r) => r.id === 'css-attribute-selector'));
        });
        test('detects element names inside :is, :where, or :has', () => {
            const css = ':is(div, span) { color: blue; }';
            const matches = (0, rules_1.matchCompatibilityRules)(css, 'css');
            assert.ok(matches.some((r) => r.id === 'css-is-element-names'));
        });
        test('detects @import statements', () => {
            const css = '@import "styles.css";';
            const matches = (0, rules_1.matchCompatibilityRules)(css, 'css');
            assert.ok(matches.some((r) => r.id === 'css-import'));
        });
        test('returns empty array for clean CSS', () => {
            const css = '.card { font-size: 16px; color: #333; }';
            const matches = (0, rules_1.matchCompatibilityRules)(css, 'css');
            assert.strictEqual(matches.length, 0);
        });
    });
    suite('JS Rules', () => {
        test('detects runtime .id assignment', () => {
            const js = 'element.id = "my-id";';
            const matches = (0, rules_1.matchCompatibilityRules)(js, 'js');
            assert.ok(matches.some((r) => r.id === 'js-id-setter'));
        });
        test('detects attribute selector querySelector', () => {
            const js = 'document.querySelector("[data-active]");';
            const matches = (0, rules_1.matchCompatibilityRules)(js, 'js');
            assert.ok(matches.some((r) => r.id === 'js-attribute-selector'));
        });
        test('detects template-literal class names', () => {
            const js = 'el.className = `btn ${active ? "active" : ""}`;';
            const matches = (0, rules_1.matchCompatibilityRules)(js, 'js');
            assert.ok(matches.some((r) => r.id === 'js-template-classname'));
        });
        test('detects runtime CSS custom property setProperty', () => {
            const js = 'el.style.setProperty("--theme-color", "red");';
            const matches = (0, rules_1.matchCompatibilityRules)(js, 'js');
            assert.ok(matches.some((r) => r.id === 'js-style-setproperty'));
        });
        test('returns empty array for clean JS', () => {
            const js = 'const btn = document.getElementById("submit"); btn.classList.add("active");';
            const matches = (0, rules_1.matchCompatibilityRules)(js, 'js');
            assert.strictEqual(matches.length, 0);
        });
    });
});
