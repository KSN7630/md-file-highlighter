"""Property tests: highlight a large, varied set of word-blocks across the real
DSA notes file and assert each result never breaks the Markdown.

For each selection, ``toggle`` must satisfy six invariants:

1. content preserved (only ``<mark>`` tags are inserted);
2. fully clearable back to the original;
3. marks balanced and never nested;
4. no ``<mark>`` inside a fenced code block;
5. no ``<mark>`` inside an inline code span, and none crossing a table pipe;
6. no ``*``/``_``/``~`` emphasis run split into a stray delimiter.

The selection set covers every block of up to 16 consecutive words, plus every
whole line, every paragraph, and the entire document — i.e. every realistic
drag-select, including ones that span tables, code blocks, and emphasis. The
fully exhaustive O(n^2) sweep lives in ``_fuzz_exhaustive.py``.
"""

from __future__ import annotations

import os
import re
import unittest

from md_highlight import clear_all, toggle
from md_highlight.highlight import (
    _classify_lines,
    _code_spans,
    _split_cells,
    _top_level_pipes,
)

_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_DSA_NOTES = os.path.join(_REPO_ROOT, "examples", "dsa-notes.md")
_MAX_BLOCK_WORDS = 16


def _strip(s: str) -> str:
    return s.replace("<mark>", "").replace("</mark>", "")


def _marks_wellformed(s: str) -> bool:
    depth = 0
    for tok in re.findall(r"</?mark>", s):
        depth += 1 if tok == "<mark>" else -1
        if depth < 0 or depth > 1:
            return False
    return depth == 0


def _invariant_violations(clean: str, out: str) -> set:
    v = set()
    if _strip(out) != clean:
        v.add("content-changed")
    if clear_all(out) != clean:
        v.add("not-clearable")
    if not _marks_wellformed(out):
        v.add("marks-malformed")
    for info in _classify_lines(out):
        seg = out[info.start:info.end]
        if info.kind == "code" and "mark>" in seg:
            v.add("mark-in-fence")
        for sp in _code_spans(out, info.start, info.end):
            if "mark>" in out[sp.start:sp.end]:
                v.add("mark-in-inline-code")
        if info.kind in ("table-row", "table-delim"):
            pipes = _top_level_pipes(out, info.start, info.end)
            for c in _split_cells(info.start, info.end, pipes):
                cell = out[c.start:c.end]
                if cell.count("<mark>") != cell.count("</mark>"):
                    v.add("mark-crosses-pipe")
    for d in "*_~":
        if d + "<mark>" + d in out or d + "</mark>" + d in out:
            v.add("split-delim:" + d)
    return v


def _selection_set(clean: str):
    words = [(m.start(), m.end()) for m in re.finditer(r"\S+", clean)]
    sels = set()
    for i in range(len(words)):
        for j in range(i, min(i + _MAX_BLOCK_WORDS, len(words))):
            sels.add((words[i][0], words[j][1]))
    for info in _classify_lines(clean):
        if info.end > info.start:
            sels.add((info.start, info.end))
    for para in re.finditer(r"[^\n]+(?:\n[^\n]+)*", clean):
        sels.add((para.start(), para.end()))
    sels.add((0, len(clean)))
    return sels


class DsaWordBlockInvariantTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(_DSA_NOTES, encoding="utf-8") as fh:
            cls.clean = clear_all(fh.read())
        cls.selections = _selection_set(cls.clean)

    def test_every_word_block_keeps_markdown_valid(self):
        self.assertGreater(len(self.selections), 1000)  # sanity: real coverage
        offenders = []
        for sel in self.selections:
            v = _invariant_violations(self.clean, toggle(self.clean, [sel]))
            if v:
                offenders.append((sel, v, self.clean[sel[0]:sel[1]][:60]))
        self.assertEqual(
            offenders, [], f"{len(offenders)} selection(s) broke an invariant: {offenders[:10]}"
        )


if __name__ == "__main__":
    unittest.main()
