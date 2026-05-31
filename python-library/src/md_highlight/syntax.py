"""The marker convention: the standard HTML ``<mark>`` element.

Mirrors ``core/syntax/MarkHtmlSyntax.ts``. ``<mark>`` is valid Markdown *and* a
real HTML element, so every renderer (the VS Code preview, GitHub, a browser)
paints it highlighted natively.
"""

from __future__ import annotations

import re
from typing import List

from .types import MarkerMatch

OPEN = "<mark>"
CLOSE = "</mark>"

# Non-greedy, dot-matches-newline (re.DOTALL) so a highlight can span the soft
# line breaks inside a single paragraph.
_PATTERN = re.compile(r"<mark>(.*?)</mark>", re.DOTALL)


class MarkHtmlSyntax:
    """Wrap text in ``<mark>`` markers and find existing ones."""

    id = "markHtml"

    def wrap(self, text: str) -> str:
        return f"{OPEN}{text}{CLOSE}"

    def match_all(self, text: str) -> List[MarkerMatch]:
        """Find every marker in the text, in document order."""
        matches: List[MarkerMatch] = []
        for m in _PATTERN.finditer(text):
            start, end = m.start(), m.end()
            matches.append(
                MarkerMatch(
                    start=start,
                    end=end,
                    inner_start=start + len(OPEN),
                    inner_end=end - len(CLOSE),
                    inner=m.group(1),
                )
            )
        return matches
