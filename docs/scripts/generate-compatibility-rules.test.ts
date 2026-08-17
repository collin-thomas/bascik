import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('generate-compatibility-rules', () => {
  it('parses compatibility.md and generates extension compatibility rules JSON', async () => {
    // Dynamically import the generator module so it executes its top-level script logic
    await import('./generate-compatibility-rules.js');

    const rulesFile = path.resolve(import.meta.dirname, '../../extensions/vscode-bascik/src/compatibility-rules.json');
    const content = await fs.readFile(rulesFile, 'utf8');
    const rules = JSON.parse(content);

    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.id).toBeTruthy();
      expect(['css', 'js']).toContain(rule.kind);
      expect(rule.pattern).toBeTruthy();
      expect(rule.message).toBeTruthy();
      expect(rule.suggestion).toBeTruthy();
      // Verify valid regex pattern
      expect(() => new RegExp(rule.pattern, rule.flags ?? '')).not.toThrow();
    }
  });
});
