/**
 * Pure search logic — no DOM dependencies, importable in Node for testing.
 *
 * The docs-search component inlines these functions at build time (via a
 * <script data-bascik-build> that strips the export keywords). Any change
 * here is automatically reflected in the browser bundle on the next build.
 */

export function tokens(q) {
  return q.split(/\s+/).filter(function (w) { return w.length >= 2; });
}

export function basePath(path) {
  return path.split('#')[0];
}

export function score(e, q, toks) {
  var nl = (e.navLabel || '').toLowerCase();
  var h = (e.heading || '').toLowerCase();
  var t = (e.text || '').toLowerCase();
  var nlHits = toks.reduce(function (n, tok) { return n + (nl.includes(tok) ? 1 : 0); }, 0);

  // Tier 1 (≥1000): navLabel match — always outranks heading/text matches
  if (nl === q)                                    return 1600;
  if (nl.startsWith(q))                            return 1400 + nlHits;
  if (nl.includes(q))                              return 1200 + nlHits;
  if (toks.length > 0 && nlHits === toks.length)   return 1100 + nlHits;
  if (nlHits > 0)                                  return 1000 + nlHits * 10;

  // Tier 2 (100–999): heading match — always outranks text-only matches
  if (h) {
    var hHits = toks.reduce(function (n, tok) { return n + (h.includes(tok) ? 1 : 0); }, 0);
    if (h === q)                                   return 600;
    if (h.startsWith(q))                           return 500 + hHits;
    if (h.includes(q))                             return 400 + hHits;
    if (toks.length > 0 && hHits === toks.length)  return 300 + hHits;
    if (hHits > 0)                                 return 100 + hHits * 10;
  }

  // Tier 3 (1–99): text/content match only
  var tHits = toks.reduce(function (n, tok) { return n + (t.includes(tok) ? 1 : 0); }, 0);
  if (t.includes(q))                               return 80 + tHits;
  if (toks.length > 0 && tHits === toks.length)    return 50 + tHits;
  if (tHits > 0)                                   return tHits * 10;

  return 0;
}

/** Returns ~120 chars centred on the first query/token match in text. */
export function snippet(text, q, toks) {
  if (!text) return '';
  var lo = text.toLowerCase();
  var idx = q ? lo.indexOf(q) : -1;
  if (idx < 0) {
    for (var i = 0; i < toks.length; i++) {
      idx = lo.indexOf(toks[i]);
      if (idx >= 0) break;
    }
  }
  var start = Math.max(0, idx > 40 ? idx - 40 : 0);
  return (start > 0 ? '\u2026' : '') + text.slice(start, start + 120) + (start + 120 < text.length ? '\u2026' : '');
}

/**
 * Returns an ordered array of up to `limit` result entries.
 * When the query unambiguously identifies one page (its navLabel scores ≥1100
 * and no other page ties it), that page's entries are grouped first in document
 * order (page entry, then h2s). Remaining slots fill from score-ordered results.
 */
export function buildResults(index, q, toks, limit) {
  var scored = index
    .map(function (e) { return { e: e, s: score(e, q, toks) }; })
    .filter(function (x) { return x.s > 0; })
    .sort(function (a, b) { return b.s - a.s; });

  var pageMatches = scored.filter(function (x) { return x.e.heading === null && x.s >= 1100; });
  var bestPage = pageMatches.length === 1 ? pageMatches[0]
    : (pageMatches.length > 1 && pageMatches[0].s > pageMatches[1].s) ? pageMatches[0]
    : null;

  var seen = {};
  var top = [];

  if (bestPage) {
    var dominantBase = bestPage.e.path;
    index
      .filter(function (e) { return basePath(e.path) === dominantBase; })
      .forEach(function (e) {
        if (!seen[e.path]) { seen[e.path] = true; top.push(e); }
      });
  }

  for (var i = 0; i < scored.length && top.length < limit; i++) {
    var p = scored[i].e.path;
    if (!seen[p]) { seen[p] = true; top.push(scored[i].e); }
  }

  return top.slice(0, limit);
}
