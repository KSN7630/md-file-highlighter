"""Exhaustive O(n^2) fuzz: highlight every contiguous block of words in the DSA
notes file and assert the result never breaks the Markdown. Independent checker
that maps each produced <mark> back to clean-document coordinates and verifies
it against the clean structure (fences, inline code spans, table pipes,
emphasis runs). Run directly; not part of the fast unittest suite.
"""

import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from md_highlight import clear_all, toggle  # noqa: E402
from md_highlight.highlight import (  # noqa: E402
    _classify_lines,
    _code_spans,
    _top_level_pipes,
)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DSA = os.path.join(REPO_ROOT, "examples", "dsa-notes.md")
DELIMS = "*_~"


def precompute(clean):
    fence = set()
    inline_spans = []
    table_pipes = set()
    for info in _classify_lines(clean):
        if info.kind == "code":
            fence.update(range(info.start, info.end))
        for sp in _code_spans(clean, info.start, info.end):
            inline_spans.append((sp.start, sp.end))
        if info.kind in ("table-row", "table-delim"):
            table_pipes.update(_top_level_pipes(clean, info.start, info.end))
    return fence, inline_spans, table_pipes


def mark_ranges_in_clean(out):
    """Inner ranges of each <mark> expressed in clean-document offsets."""
    ranges = []
    ci = oi = 0
    n = len(out)
    while oi < n:
        if out.startswith("<mark>", oi):
            start = ci
            oi += 6
            while not out.startswith("</mark>", oi):
                ci += 1
                oi += 1
            ranges.append((start, ci))
            oi += 7
        else:
            ci += 1
            oi += 1
    return ranges


def violations(clean, out, fence, inline_spans, table_pipes):
    v = set()
    if out.replace("<mark>", "").replace("</mark>", "") != clean:
        v.add("content-changed")
    if clear_all(out) != clean:
        v.add("not-clearable")
    depth = 0
    for tok in re.findall(r"</?mark>", out):
        depth += 1 if tok == "<mark>" else -1
        if depth < 0 or depth > 1:
            v.add("marks-malformed")
    if depth != 0:
        v.add("marks-malformed")

    for cs, ce in mark_ranges_in_clean(out):
        if any(cs <= o < ce for o in range(cs, ce) if o in fence):
            v.add("mark-in-fence")
        for sp_s, sp_e in inline_spans:
            if sp_s < cs < sp_e or sp_s < ce < sp_e:
                v.add("mark-in-inline-code")
        if any(cs <= p < ce for p in table_pipes):
            v.add("mark-crosses-pipe")
        for b in (cs, ce):
            if 0 < b < len(clean) and clean[b - 1] == clean[b] and clean[b] in DELIMS:
                v.add("split-delim")
    return v


def main():
    clean = clear_all(open(DSA, encoding="utf-8").read())
    words = [(m.start(), m.end()) for m in re.finditer(r"\S+", clean)]
    fence, inline_spans, table_pipes = precompute(clean)

    fails = []
    n = 0
    for i in range(len(words)):
        for j in range(i, len(words)):
            sel = (words[i][0], words[j][1])
            n += 1
            out = toggle(clean, [sel])
            v = violations(clean, out, fence, inline_spans, table_pipes)
            if v:
                fails.append((sel, v, clean[sel[0]:sel[1]]))

    print(f"words={len(words)} selections={n} failures={len(fails)}")
    for sel, v, snippet in fails[:25]:
        print("  ", sel, v, "|", repr(snippet)[:70])
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
