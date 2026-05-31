"""Pure data contracts shared across the library.

Offsets are zero-based character indices into the document text. These mirror
the TypeScript `core/types.ts` so the Python logic and the VS Code extension
stay easy to cross-reference.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MarkerMatch:
    """A single ``<mark>`` highlight located in the document text."""

    start: int        # offset of the first char of the opening marker
    end: int          # offset just past the last char of the closing marker
    inner_start: int  # offset of the first char of the highlighted text
    inner_end: int    # offset just past the last char of the highlighted text
    inner: str        # the raw text between the markers


@dataclass(frozen=True)
class TextEdit:
    """An immutable text mutation expressed in document offsets."""

    start: int
    end: int
    new_text: str


@dataclass(frozen=True)
class SelectionRange:
    """A (possibly empty) selection range in document offsets."""

    start: int
    end: int
