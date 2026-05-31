"""Pure highlight logic, mirroring ``services/HighlightService.ts``.

Given document text plus selection ranges, it computes the edits required to
toggle or clear ``<mark>`` highlights. It has no knowledge of any editor, which
makes every branch testable in milliseconds.

Wrapping is Markdown-structure-aware so a ``<mark>`` never corrupts the file:

* it is never placed inside a fenced code block (it would show literally);
* it never crosses a paragraph break (``<mark>`` is inline);
* inside a table it wraps each cell separately, never crossing a ``|`` or a
  row, and never touches the ``| --- |`` delimiter row;
* it never splits an inline construct — a code span, a link/image, or an
  autolink / inline HTML tag — expanding to wrap the whole thing instead;
* leading block markers (``#``, ``-``, ``>``, ``1.``) stay outside the marker.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence, Tuple, Union

from .syntax import MarkHtmlSyntax
from .types import MarkerMatch, SelectionRange, TextEdit

# A selection may be a SelectionRange or a plain (start, end) tuple.
Selection = Union[SelectionRange, Tuple[int, int], Sequence[int]]

# Block-level Markdown markers that must stay at the very start of a line.
_LEADING_BLOCK_MARKER = re.compile(r"^(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d+[.)][ \t]+)")
_FENCE_OPEN = re.compile(r"^(`{3,}|~{3,})")
_FENCE_CLOSE = re.compile(r"^(`{3,}|~{3,})\s*$")
_DELIM_CELL = re.compile(r"^\s*:?-+:?\s*$")
_WHITESPACE = re.compile(r"\s")


class HighlightService:
    def __init__(self, syntax: MarkHtmlSyntax = None) -> None:
        self._syntax = syntax or MarkHtmlSyntax()

    def compute_toggle_edits(
        self, text: str, selections: Iterable[Selection]
    ) -> List[TextEdit]:
        """Toggle semantics per selection:

        - if the selection touches existing marker(s), remove them (unwrap);
        - else if the selection is non-empty, wrap it (structure-aware);
        - else (empty selection, no marker) do nothing.
        """
        markers = self._syntax.match_all(text)
        edits: List[TextEdit] = []
        removed_marker_starts = set()

        for raw in selections:
            sel = _normalize(raw)
            overlapping = [mk for mk in markers if _overlaps(mk, sel)]

            if overlapping:
                for mk in overlapping:
                    if mk.start in removed_marker_starts:
                        continue
                    removed_marker_starts.add(mk.start)
                    edits.append(TextEdit(mk.start, mk.end, mk.inner))
            elif sel.end > sel.start:
                for block in _compute_wrap_ranges(text, sel):
                    selected = text[block.start:block.end]
                    edits.append(
                        TextEdit(block.start, block.end, self._syntax.wrap(selected))
                    )

        return sorted(edits, key=lambda e: e.start)

    def compute_clear_all_edits(self, text: str) -> List[TextEdit]:
        """Remove every marker in the document."""
        return [
            TextEdit(mk.start, mk.end, mk.inner)
            for mk in self._syntax.match_all(text)
        ]


def apply_edits(text: str, edits: Iterable[TextEdit]) -> str:
    """Apply offset edits to a string (right-to-left so offsets stay valid)."""
    out = text
    for e in sorted(edits, key=lambda e: e.start, reverse=True):
        out = out[: e.start] + e.new_text + out[e.end:]
    return out


# --- selection helpers -----------------------------------------------------


def _coerce(sel: Selection) -> SelectionRange:
    if isinstance(sel, SelectionRange):
        return sel
    start, end = sel  # type: ignore[misc]
    return SelectionRange(start, end)


def _normalize(sel: Selection) -> SelectionRange:
    s = _coerce(sel)
    return s if s.start <= s.end else SelectionRange(s.end, s.start)


def _trim_to_content(text: str, start: int, end: int) -> Tuple[int, int]:
    while start < end and _WHITESPACE.match(text[start]):
        start += 1
    while end > start and _WHITESPACE.match(text[end - 1]):
        end -= 1
    return start, end


def _skip_leading_block_marker(text: str, start: int, end: int) -> int:
    m = _LEADING_BLOCK_MARKER.match(text[start:end])
    if not m:
        return start
    skipped = start + m.end()
    return skipped if skipped < end else start


def _overlaps(mk: MarkerMatch, sel: SelectionRange) -> bool:
    intersects = sel.start < mk.end and sel.end > mk.start
    caret_on_span = sel.start == sel.end and mk.start <= sel.start <= mk.end
    return intersects or caret_on_span


# --- line classification ---------------------------------------------------


@dataclass
class _LineInfo:
    start: int
    end: int  # excludes the newline
    kind: str  # "blank" | "code" | "table-delim" | "table-row" | "normal"


def _split_lines(text: str) -> List[_LineInfo]:
    lines: List[_LineInfo] = []
    start = 0
    for i, ch in enumerate(text):
        if ch == "\n":
            lines.append(_LineInfo(start, i, "normal"))
            start = i + 1
    lines.append(_LineInfo(start, len(text), "normal"))
    return lines


def _top_level_pipes(text: str, start: int, end: int) -> List[int]:
    """Offsets of every ``|`` in [start, end) that acts as a table cell
    delimiter — not escaped and not inside an inline-code span."""
    positions: List[int] = []
    i = start
    in_code = False
    delim = 0
    while i < end:
        c = text[i]
        if c == "\\" and not in_code:
            i += 2
            continue
        if c == "`":
            j = i
            while j < end and text[j] == "`":
                j += 1
            run = j - i
            if not in_code:
                in_code = True
                delim = run
            elif run == delim:
                in_code = False
                delim = 0
            i = j
            continue
        if c == "|" and not in_code:
            positions.append(i)
        i += 1
    return positions


def _split_cells(start: int, end: int, pipes: List[int]) -> List[SelectionRange]:
    cells: List[SelectionRange] = []
    seg_start = start
    for p in pipes:
        cells.append(SelectionRange(seg_start, p))
        seg_start = p + 1
    cells.append(SelectionRange(seg_start, end))
    return cells


def _is_delimiter_row(text: str, line: _LineInfo) -> bool:
    pipes = _top_level_pipes(text, line.start, line.end)
    if not pipes:
        return False
    cells = [
        c
        for c in _split_cells(line.start, line.end, pipes)
        if text[c.start:c.end].strip() != ""
    ]
    if not cells:
        return False
    return all(_DELIM_CELL.match(text[c.start:c.end]) for c in cells)


def _classify_lines(text: str) -> List[_LineInfo]:
    infos = _split_lines(text)

    # Pass 1: fenced code blocks.
    in_code = False
    fence_char = ""
    fence_len = 0
    for info in infos:
        trimmed = text[info.start:info.end].strip()
        if not in_code:
            m = _FENCE_OPEN.match(trimmed)
            if m:
                in_code = True
                fence_char = m.group(1)[0]
                fence_len = len(m.group(1))
                info.kind = "code"
            else:
                info.kind = "blank" if trimmed == "" else "normal"
        else:
            info.kind = "code"
            m = _FENCE_CLOSE.match(trimmed)
            if m and m.group(1)[0] == fence_char and len(m.group(1)) >= fence_len:
                in_code = False

    # Pass 2: tables.
    for i in range(1, len(infos)):
        if infos[i].kind != "normal" or not _is_delimiter_row(text, infos[i]):
            continue
        header = infos[i - 1]
        if header.kind != "normal" or not _top_level_pipes(text, header.start, header.end):
            continue
        infos[i].kind = "table-delim"
        header.kind = "table-row"
        for j in range(i + 1, len(infos)):
            if infos[j].kind != "normal" or not _top_level_pipes(text, infos[j].start, infos[j].end):
                break
            infos[j].kind = "table-row"

    return infos


def _is_inline_delim(c: str) -> bool:
    """Inline-emphasis delimiter characters whose runs must not be split."""
    return c in ("*", "_", "~")


# Inline Markdown constructs (besides code spans) that a ``<mark>`` boundary must
# never land inside: links/images and their reference forms, plus angle-bracket
# autolinks and inline HTML tags. Each alternative is confined to a single line.
_LINK_OR_TAG = re.compile(
    r"!?\[[^\]\n]*\]\([^)\n]*\)"  # inline link / image: [t](u), ![a](u)
    r"|!?\[[^\]\n]*\]\[[^\]\n]*\]"  # reference link / image: [t][ref]
    r"|<\/?[A-Za-z][^>\n]*>"  # autolink / inline HTML tag: <https://x>, <sub>, </b>
)


def _code_spans(text: str, region_start: int, region_end: int) -> List[SelectionRange]:
    """Spans of matched inline-code (`` `..` ``) within [region_start, region_end)."""
    spans: List[SelectionRange] = []
    i = region_start
    while i < region_end:
        if text[i] != "`":
            i += 1
            continue
        j = i
        while j < region_end and text[j] == "`":
            j += 1
        run_len = j - i
        k = j
        close_end = -1
        while k < region_end:
            if text[k] == "`":
                m = k
                while m < region_end and text[m] == "`":
                    m += 1
                if m - k == run_len:
                    close_end = m
                    break
                k = m
            else:
                k += 1
        if close_end >= 0:
            spans.append(SelectionRange(i, close_end))
            i = close_end
        else:
            i = j  # no closing run — not a code span
    return spans


def _protected_spans(text: str, region_start: int, region_end: int) -> List[SelectionRange]:
    """Every atomic inline span within [region_start, region_end) a ``<mark>``
    boundary must not split: inline-code spans plus links/images/tags. Spans may
    overlap or nest, so callers expand to a fixpoint."""
    spans = _code_spans(text, region_start, region_end)
    for m in _LINK_OR_TAG.finditer(text, region_start, region_end):
        spans.append(SelectionRange(m.start(), m.end()))
    return spans


def _inline_safe(text: str, start: int, end: int) -> SelectionRange:
    """Move boundaries so they never split an inline construct — a code span, a
    link/image, an autolink / inline HTML tag, or a run of ``*``/``_``/``~``
    delimiters (which would render literally or break the construct). Boundaries
    are examined within their own source line(s); spans can nest, so we expand to
    a fixpoint."""
    rs = start
    while rs > 0 and text[rs - 1] != "\n":
        rs -= 1
    re_ = end
    while re_ < len(text) and text[re_] != "\n":
        re_ += 1

    spans = _protected_spans(text, rs, re_)
    changed = True
    while changed:
        changed = False
        for sp in spans:
            if sp.start < start < sp.end:
                start = sp.start
                changed = True
            if sp.start < end < sp.end:
                end = sp.end
                changed = True
    while start > rs and _is_inline_delim(text[start]) and text[start - 1] == text[start]:
        start -= 1
    while end < re_ and _is_inline_delim(text[end - 1]) and text[end] == text[end - 1]:
        end += 1
    return SelectionRange(start, end)


def _compute_wrap_ranges(text: str, sel: SelectionRange) -> List[SelectionRange]:
    ranges: List[SelectionRange] = []
    para: Optional[SelectionRange] = None

    def push_wrap(start: int, end: int, allow_skip_marker: bool) -> None:
        ts, te = _trim_to_content(text, start, end)
        if te <= ts:
            return
        s = ts
        if allow_skip_marker:
            s = _skip_leading_block_marker(text, ts, te)
            if te <= s:
                return
        ranges.append(_inline_safe(text, s, te))

    def flush_para() -> None:
        nonlocal para
        if para is not None:
            push_wrap(para.start, para.end, True)
            para = None

    for info in _classify_lines(text):
        if info.end < sel.start or info.start > sel.end:
            flush_para()
            continue
        a = max(info.start, sel.start)
        b = min(info.end, sel.end)

        if info.kind in ("blank", "code", "table-delim"):
            flush_para()
            continue

        if info.kind == "table-row":
            flush_para()
            if b > a:
                pipes = [p for p in _top_level_pipes(text, info.start, info.end) if a <= p < b]
                seg_start = a
                for p in pipes:
                    push_wrap(seg_start, p, False)
                    seg_start = p + 1
                push_wrap(seg_start, b, False)
            continue

        # normal prose: accumulate consecutive lines so soft line breaks stay
        # in one marker.
        if b > a:
            para = SelectionRange(para.start, b) if para else SelectionRange(a, b)

    flush_para()
    return ranges
