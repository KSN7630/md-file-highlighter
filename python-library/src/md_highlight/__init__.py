"""md_highlight — the highlight logic of the MD File Highlighter extension,
reimplemented in Python so it can be run and tested without VS Code.

It mirrors the extension's pure core: wrap text in ``<mark>`` markers, toggle a
highlight on a selection, clear all highlights, and parse existing markers.

High-level helpers
------------------
>>> from md_highlight import toggle, clear_all, find_marks
>>> toggle("highlight this", [(0, 9)])
'<mark>highlight</mark> this'
>>> clear_all("a <mark>b</mark> c")
'a b c'
>>> [m.inner for m in find_marks("x <mark>hi</mark> y")]
['hi']
"""

from __future__ import annotations

from typing import Iterable, List

from .highlight import HighlightService, Selection, apply_edits
from .syntax import MarkHtmlSyntax
from .types import MarkerMatch, SelectionRange, TextEdit

__all__ = [
    "HighlightService",
    "MarkHtmlSyntax",
    "MarkerMatch",
    "TextEdit",
    "SelectionRange",
    "apply_edits",
    "toggle",
    "clear_all",
    "find_marks",
]


def toggle(text: str, selections: Iterable[Selection]) -> str:
    """Return ``text`` with the highlight toggled on the given selection(s).

    Each selection is a :class:`SelectionRange` or a ``(start, end)`` tuple of
    zero-based character offsets.
    """
    service = HighlightService()
    return apply_edits(text, service.compute_toggle_edits(text, selections))


def clear_all(text: str) -> str:
    """Return ``text`` with every ``<mark>`` highlight removed."""
    service = HighlightService()
    return apply_edits(text, service.compute_clear_all_edits(text))


def find_marks(text: str) -> List[MarkerMatch]:
    """Return every ``<mark>`` highlight found in ``text``, in document order."""
    return MarkHtmlSyntax().match_all(text)
