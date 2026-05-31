# md_highlight (Python)

The **highlight logic** of the [MD File Highlighter](../README.md) VS Code
extension, reimplemented in Python so your team can run and test it **without
VS Code** — for example in CI, scripts, or batch-processing `.md` files.

> **Note:** this is the *logic only*, not the editor. A VS Code extension runs
> on Node.js, so the live extension (buttons, in-editor highlight rendering,
> `Ctrl+Alt+H`) stays TypeScript. This package mirrors the same pure
> text-transformation behavior, byte-for-byte, so a file highlighted here is
> identical to one highlighted in the editor.

Standard library only — **no pip dependencies**.

## Usage

```python
from md_highlight import toggle, clear_all, find_marks

# Selections are (start, end) character offsets into the text.
toggle("highlight this line", [(0, 9)])
# -> "<mark>highlight</mark> this line"

# Highlighting a heading keeps the "## " prefix outside the marker, so the
# line still renders as a heading.
toggle("## Big-O Notation", [(0, 17)])
# -> "## <mark>Big-O Notation</mark>"

# Remove every highlight.
clear_all("a <mark>b</mark> c")
# -> "a b c"

# Parse existing highlights.
[m.inner for m in find_marks("x <mark>hi</mark> y")]
# -> ["hi"]
```

Lower-level pieces are also exported when you need the raw edits rather than the
final string: `HighlightService` (`compute_toggle_edits` / `compute_clear_all_edits`),
`apply_edits`, `MarkHtmlSyntax`, and the `MarkerMatch` / `TextEdit` /
`SelectionRange` dataclasses.

## Behavior (matches the extension)

- **Whitespace is hugged** — leading/trailing spaces stay outside the marker.
- **Paragraphs are highlighted individually** — a selection spanning a blank
  line produces one `<mark>` per paragraph (because `<mark>` is inline and
  can't cross a paragraph break), leaving the blank lines intact.
- **Block markers stay put** — headings (`#`), list bullets (`-` `*` `+`),
  ordered lists (`1.`), and blockquotes (`>`) keep their prefix at the line
  start, so the line keeps rendering correctly.
- **Tables are wrapped per cell** — a selection across a table highlights each
  cell separately, never crossing a `|` or a row, and never touches the
  `| --- |` delimiter row (pipes inside inline code are respected).
- **Fenced code blocks are skipped** — a `<mark>` is never written inside a
  ```` ``` ```` / `~~~` block, where it would show up as literal text.
- **Inline spans are never split** — a boundary inside an inline code span
  (`` `code` ``) expands to the whole span, and a `**`/`*`/`_`/`~` emphasis run
  is never broken into a stray delimiter.
- **Links, images, and inline tags stay whole** — a boundary inside a
  link/image (`[text](url)`, `![alt](url)`, `[text][ref]`) or an autolink /
  inline HTML tag (`<https://…>`, `<sub>`, `</b>`) expands to wrap the whole
  construct, so a `<mark>` never lands inside a `](` or splits a tag open.
- **CRLF and LF** blank lines are both recognised.
- Toggling a selection that already overlaps a `<mark>` **removes** it.

## Run the tests

```bash
cd python-library
PYTHONPATH=src python -m unittest discover -s tests -t .
```

The suite mirrors the TypeScript tests (`test/unit/highlight.test.ts`) so the
two implementations stay in lock-step, and includes integration tests that run
against the real [`examples/dsa-notes.md`](../examples/dsa-notes.md).

It also includes a **property test** (`test_invariants_dsa.py`) that highlights
thousands of word-blocks across the DSA file and asserts each result never
breaks the Markdown — content is preserved and fully clearable, marks are
balanced, and no `<mark>` ends up inside a code block/inline-code span, across a
table pipe, or splitting an emphasis run. For the fully exhaustive O(n²) sweep
over *every* contiguous block of words, run:

```bash
PYTHONPATH=src python tests/_fuzz_exhaustive.py
```

## Layout

```text
python-library/
  pyproject.toml
  src/md_highlight/
    __init__.py     High-level API: toggle / clear_all / find_marks
    types.py        MarkerMatch / TextEdit / SelectionRange
    syntax.py       MarkHtmlSyntax: wrap + match_all
    highlight.py    HighlightService (pure toggle/clear) + apply_edits
  tests/
    test_highlight.py
```
