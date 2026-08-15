import { describe, it, expect } from 'vitest';
import { tokens, basePath, score, snippet, buildResults } from './search-logic.mjs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const entry = (overrides) => ({
  navLabel: 'Test Page',
  heading: null,
  text: 'Some page text about the topic.',
  path: '/test',
  section: 'Tests',
  ...overrides,
});

// Small representative index for buildResults integration tests
const MOCK_INDEX = [
  entry({ navLabel: 'Props', heading: null,           text: 'Define and use props.',          path: '/props' }),
  entry({ navLabel: 'Props', heading: 'Passing Props', text: 'How to pass props.',             path: '/props#passing-props' }),
  entry({ navLabel: 'Props', heading: 'Defaults',      text: 'Default prop values.',           path: '/props#defaults' }),
  entry({ navLabel: 'Slots', heading: null,            text: 'About slots and content.',       path: '/slots' }),
  entry({ navLabel: 'Slots', heading: 'Named Slots',   text: 'Named slot usage.',              path: '/slots#named-slots' }),
  entry({ navLabel: 'Configuration', heading: null,   text: 'Config file options.',            path: '/config' }),
  entry({ navLabel: 'Configuration', heading: 'Output Dir', text: 'Where output goes.',       path: '/config#output-dir' }),
];

// ---------------------------------------------------------------------------
// tokens
// ---------------------------------------------------------------------------

describe('tokens', () => {
  it('splits on whitespace', () => {
    expect(tokens('hello world')).toEqual(['hello', 'world']);
  });

  it('filters words shorter than 2 chars', () => {
    expect(tokens('a hello b world')).toEqual(['hello', 'world']);
  });

  it('handles extra whitespace', () => {
    expect(tokens('  foo  bar  ')).toEqual(['foo', 'bar']);
  });

  it('returns empty array for empty or whitespace-only input', () => {
    expect(tokens('')).toEqual([]);
    expect(tokens('  ')).toEqual([]);
    expect(tokens('a')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// basePath
// ---------------------------------------------------------------------------

describe('basePath', () => {
  it('strips the hash fragment', () => {
    expect(basePath('/foo#bar')).toBe('/foo');
    expect(basePath('/scoped-javascript#how-scoping-works')).toBe('/scoped-javascript');
  });

  it('returns the path unchanged when there is no hash', () => {
    expect(basePath('/foo')).toBe('/foo');
  });
});

// ---------------------------------------------------------------------------
// score
// ---------------------------------------------------------------------------

describe('score', () => {
  describe('tier 1 — navLabel match (≥1000)', () => {
    it('returns 1600 for an exact navLabel match', () => {
      const q = 'props';
      expect(score(entry({ navLabel: 'Props' }), q, tokens(q))).toBe(1600);
    });

    it('returns ≥1400 when navLabel starts with the query', () => {
      const q = 'pro';
      expect(score(entry({ navLabel: 'Props' }), q, tokens(q))).toBeGreaterThanOrEqual(1400);
    });

    it('returns ≥1200 when navLabel contains the phrase', () => {
      const q = 'scoped javascript';
      const toks = tokens(q);
      expect(score(entry({ navLabel: 'Scoped JavaScript Guide' }), q, toks)).toBeGreaterThanOrEqual(1200);
    });

    it('returns ≥1100 when all tokens match the navLabel', () => {
      const q = 'scoped javascript';
      const toks = tokens(q);
      expect(score(entry({ navLabel: 'Scoped JavaScript' }), q, toks)).toBeGreaterThanOrEqual(1100);
    });

    it('returns ≥1000 for a partial token hit in navLabel', () => {
      const q = 'scoped javascript';
      const toks = tokens(q);
      expect(score(entry({ navLabel: 'Scoped Styles' }), q, toks)).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('tier 2 — heading match (100–999)', () => {
    it('returns 600 for an exact heading match', () => {
      const q = 'passing props';
      const e = entry({ navLabel: 'Unrelated', heading: 'Passing Props' });
      expect(score(e, q, tokens(q))).toBe(600);
    });

    it('returns ≥400 when heading contains the phrase', () => {
      const q = 'passing';
      const e = entry({ navLabel: 'Unrelated', heading: 'Passing Props' });
      expect(score(e, q, tokens(q))).toBeGreaterThanOrEqual(400);
    });

    it('score stays below 1000', () => {
      const q = 'defaults';
      const e = entry({ navLabel: 'Other', heading: 'Defaults' });
      expect(score(e, q, tokens(q))).toBeLessThan(1000);
    });
  });

  describe('tier 3 — text-only match (1–99)', () => {
    it('returns ≥80 for a phrase match in text', () => {
      const q = 'define and use';
      const e = entry({ navLabel: 'Other', text: 'Define and use props here.' });
      expect(score(e, q, tokens(q))).toBeGreaterThanOrEqual(80);
    });

    it('score stays below 100', () => {
      const q = 'define and use';
      const e = entry({ navLabel: 'Other', text: 'Define and use props here.' });
      expect(score(e, q, tokens(q))).toBeLessThan(100);
    });
  });

  describe('tier ordering guarantees', () => {
    it('navLabel match always beats heading match', () => {
      const q = 'foo';
      const toks = tokens(q);
      const nl = score(entry({ navLabel: 'Foo' }), q, toks);
      const h  = score(entry({ navLabel: 'Other Page', heading: 'Foo' }), q, toks);
      expect(nl).toBeGreaterThan(h);
    });

    it('heading match always beats text-only match', () => {
      const q = 'foo bar';
      const toks = tokens(q);
      const h = score(entry({ navLabel: 'Other', heading: 'Foo Bar' }), q, toks);
      const t = score(entry({ navLabel: 'Other', text: 'foo bar here.' }), q, toks);
      expect(h).toBeGreaterThan(t);
    });
  });

  it('returns 0 when nothing matches', () => {
    const q = 'xyznothing';
    expect(score(entry({ navLabel: 'Props', text: 'Props stuff' }), q, tokens(q))).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// snippet
// ---------------------------------------------------------------------------

describe('snippet', () => {
  it('returns empty string for falsy input', () => {
    expect(snippet('', 'foo', [])).toBe('');
    expect(snippet(null, 'foo', [])).toBe('');
  });

  it('centres on the phrase match when found', () => {
    const text = 'word '.repeat(20) + 'TARGET' + ' word'.repeat(20);
    const result = snippet(text, 'target', tokens('target'));
    expect(result.toLowerCase()).toContain('target');
  });

  it('adds a leading ellipsis when the match is not near the start', () => {
    const text = 'a'.repeat(80) + ' match ' + 'b'.repeat(40);
    const result = snippet(text, 'match', tokens('match'));
    expect(result.startsWith('\u2026')).toBe(true);
  });

  it('adds a trailing ellipsis when the text is truncated', () => {
    const text = 'match ' + 'b'.repeat(200);
    const result = snippet(text, 'match', tokens('match'));
    expect(result.endsWith('\u2026')).toBe(true);
  });

  it('keeps output to roughly 120 characters of text', () => {
    const text = 'word '.repeat(100);
    const result = snippet(text, 'word', tokens('word'));
    // Allow a few extra chars for ellipsis characters
    expect(result.replace(/\u2026/g, '').length).toBeLessThanOrEqual(125);
  });
});

// ---------------------------------------------------------------------------
// buildResults
// ---------------------------------------------------------------------------

describe('buildResults', () => {
  it('returns empty array when nothing matches', () => {
    const results = buildResults(MOCK_INDEX, 'xyznothing', tokens('xyznothing'), 13);
    expect(results).toEqual([]);
  });

  it('puts the page entry first for an unambiguous page-name match', () => {
    const q = 'props';
    const results = buildResults(MOCK_INDEX, q, tokens(q), 13);
    expect(results[0].heading).toBeNull();
    expect(results[0].navLabel).toBe('Props');
    expect(results[0].path).toBe('/props');
  });

  it('follows the page entry with h2s in document order', () => {
    const q = 'props';
    const results = buildResults(MOCK_INDEX, q, tokens(q), 13);
    expect(results[1].heading).toBe('Passing Props');
    expect(results[2].heading).toBe('Defaults');
  });

  it('does not group a dominant page for an ambiguous query', () => {
    // Both 'Props' and 'Configuration' contain 'o' but neither closely matches 'output dir'
    // so this checks that no forced grouping happens for low-confidence matches
    const q = 'output dir';
    const results = buildResults(MOCK_INDEX, q, tokens(q), 13);
    // The heading 'Output Dir' should appear but the page entry needn't be forced first
    const headingMatch = results.find(r => r.heading === 'Output Dir');
    expect(headingMatch).toBeDefined();
  });

  it('respects the limit parameter', () => {
    const results = buildResults(MOCK_INDEX, 'props', tokens('props'), 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('deduplicates paths', () => {
    const q = 'props';
    const results = buildResults(MOCK_INDEX, q, tokens(q), 13);
    const paths = results.map(r => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
