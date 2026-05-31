"""Unit tests for md_highlight — mirrors the TypeScript suite in
``test/unit/highlight.test.ts`` so both implementations stay in lock-step,
plus an integration test against the real DSA notes example file.

Run with the standard library only (no pytest needed):

    PYTHONPATH=src python -m unittest discover -s tests -t .
"""

from __future__ import annotations

import os
import unittest

from md_highlight import clear_all, find_marks, toggle

# Path to examples/dsa-notes.md at the repo root (two levels up from this file).
_REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
_DSA_NOTES = os.path.join(_REPO_ROOT, "examples", "dsa-notes.md")


class ToggleTests(unittest.TestCase):
    def test_wraps_a_plain_selection(self):
        self.assertEqual(
            toggle("highlight this line", [(0, 9)]),
            "<mark>highlight</mark> this line",
        )

    def test_toggles_off_inside_existing_marker(self):
        # Select the inner "b".
        self.assertEqual(toggle("a <mark>b</mark> c", [(8, 9)]), "a b c")

    def test_empty_selection_outside_marker_is_noop(self):
        self.assertEqual(toggle("plain text", [(3, 3)]), "plain text")

    def test_clear_all_removes_every_marker(self):
        self.assertEqual(clear_all("<mark>x</mark> y <mark>z</mark>"), "x y z")

    def test_whitespace_is_excluded_from_marker(self):
        # Select "  word  " with surrounding spaces (offsets 1..11).
        self.assertEqual(toggle("a   word   b", [(1, 11)]), "a   <mark>word</mark>   b")

    def test_blank_line_between_paragraphs_stays_intact(self):
        text = "para one.\n\npara two."
        self.assertEqual(
            toggle(text, [(9, len(text))]),
            "para one.\n\n<mark>para two.</mark>",
        )

    def test_multiple_paragraphs_marked_separately(self):
        text = "para one.\n\npara two.\n\npara three."
        self.assertEqual(
            toggle(text, [(0, len(text))]),
            "<mark>para one.</mark>\n\n"
            "<mark>para two.</mark>\n\n"
            "<mark>para three.</mark>",
        )

    def test_soft_line_break_stays_in_one_marker(self):
        text = "line a\nline b"
        self.assertEqual(toggle(text, [(0, len(text))]), "<mark>line a\nline b</mark>")

    def test_all_whitespace_selection_wraps_nothing(self):
        self.assertEqual(toggle("a    b", [(1, 5)]), "a    b")

    def test_crlf_blank_lines_are_paragraph_breaks(self):
        text = "p1\r\n\r\np2"
        self.assertEqual(
            toggle(text, [(0, len(text))]),
            "<mark>p1</mark>\r\n\r\n<mark>p2</mark>",
        )

    def test_multiple_blank_lines_preserved(self):
        text = "p1\n\n\np2"
        self.assertEqual(
            toggle(text, [(0, len(text))]),
            "<mark>p1</mark>\n\n\n<mark>p2</mark>",
        )

    def test_partial_cross_paragraph_selection(self):
        text = "alpha beta\n\ngamma delta"
        start = text.index("beta")
        end = text.index("gamma") + len("gamma")
        self.assertEqual(
            toggle(text, [(start, end)]),
            "alpha <mark>beta</mark>\n\n<mark>gamma</mark> delta",
        )

    def test_multi_cursor_selections_wrap_independently(self):
        self.assertEqual(
            toggle("aaa bbb ccc", [(0, 3), (8, 11)]),
            "<mark>aaa</mark> bbb <mark>ccc</mark>",
        )

    def test_selection_spanning_several_markers_removes_all(self):
        text = "<mark>a</mark> mid <mark>b</mark>"
        self.assertEqual(toggle(text, [(0, len(text))]), "a mid b")


class BlockMarkerTests(unittest.TestCase):
    def test_heading_prefix_stays_outside_marker(self):
        text = "## A Note on the Lamp"
        self.assertEqual(toggle(text, [(0, len(text))]), "## <mark>A Note on the Lamp</mark>")

    def test_highlight_across_heading_keeps_heading(self):
        text = "intro para.\n\n## A Note on the Lamp\n\nbody para."
        self.assertEqual(
            toggle(text, [(0, len(text))]),
            "<mark>intro para.</mark>\n\n"
            "## <mark>A Note on the Lamp</mark>\n\n"
            "<mark>body para.</mark>",
        )

    def test_list_and_blockquote_markers_stay_outside(self):
        self.assertEqual(toggle("- a list item", [(0, 13)]), "- <mark>a list item</mark>")
        self.assertEqual(toggle("1. first item", [(0, 13)]), "1. <mark>first item</mark>")
        self.assertEqual(toggle("> a quote", [(0, 9)]), "> <mark>a quote</mark>")

    def test_inline_emphasis_is_not_a_bullet(self):
        text = "*emphasized* text"
        self.assertEqual(toggle(text, [(0, len(text))]), "<mark>*emphasized* text</mark>")


class TableTests(unittest.TestCase):
    def test_table_row_is_highlighted_per_cell(self):
        text = "| Notation | Name |\n| --- | --- |\n| `O(1)` | Constant |"
        self.assertEqual(
            toggle(text, [(0, len(text))]),
            "| <mark>Notation</mark> | <mark>Name</mark> |\n"
            "| --- | --- |\n"
            "| <mark>`O(1)`</mark> | <mark>Constant</mark> |",
        )

    def test_delimiter_row_is_never_wrapped(self):
        text = "| A | B |\n| --- | --- |\n| 1 | 2 |"
        out = toggle(text, [(0, len(text))])
        self.assertIn("| --- | --- |", out)
        self.assertNotIn("<mark>---", out)

    def test_pipe_inside_inline_code_is_not_a_cell_boundary(self):
        text = "| `a | b` | Name |\n| --- | --- |"
        self.assertEqual(
            toggle(text, [(0, len(text))]),
            "| <mark>`a | b`</mark> | <mark>Name</mark> |\n| --- | --- |",
        )

    def test_pipe_in_plain_text_is_not_a_table(self):
        text = "use the | operator carefully"
        self.assertEqual(toggle(text, [(0, len(text))]), "<mark>use the | operator carefully</mark>")

    def test_partial_cell_selection_wraps_only_that_text(self):
        text = "| Constant time | Name |\n| --- | --- |"
        start = text.index("time")
        self.assertEqual(
            toggle(text, [(start, start + 4)]),
            "| Constant <mark>time</mark> | Name |\n| --- | --- |",
        )


class CodeFenceTests(unittest.TestCase):
    def test_fenced_code_block_is_never_wrapped(self):
        text = "intro\n\n```python\nx = 1\n```\n\noutro"
        self.assertEqual(
            toggle(text, [(0, len(text))]),
            "<mark>intro</mark>\n\n```python\nx = 1\n```\n\n<mark>outro</mark>",
        )

    def test_blank_line_inside_fence_does_not_wrap_code(self):
        text = "```\nline1\n\nline2\n```"
        self.assertEqual(toggle(text, [(0, len(text))]), text)


class InlineSafetyTests(unittest.TestCase):
    def test_selection_inside_code_span_expands_to_whole_span(self):
        text = "the `O(n log n)` bound"
        start = text.index("log n")
        self.assertEqual(
            toggle(text, [(start, start + 5)]),
            "the <mark>`O(n log n)`</mark> bound",
        )

    def test_code_span_in_table_cell_expands(self):
        text = "| `O(n log n)` | Name |\n| --- | --- |"
        start = text.index("log n")
        self.assertEqual(
            toggle(text, [(start, start + 5)]),
            "| <mark>`O(n log n)`</mark> | Name |\n| --- | --- |",
        )

    def test_splitting_a_bold_run_snaps_out(self):
        text = "- **Array** is contiguous"
        start = text.index("*Array")  # 2nd asterisk of the opening **
        out = toggle(text, [(start, len(text))])
        self.assertEqual(out, "- <mark>**Array** is contiguous</mark>")
        self.assertNotIn("*<mark>*", out)

    def test_mark_inside_intact_bold_is_unchanged(self):
        text = "a **bold** word"
        start = text.index("bold")
        self.assertEqual(
            toggle(text, [(start, start + 4)]),
            "a **<mark>bold</mark>** word",
        )

    def test_selection_inside_link_text_expands_to_whole_link(self):
        text = "see the [docs page](https://example.com) now"
        start = text.index("docs")
        self.assertEqual(
            toggle(text, [(start, start + 4)]),
            "see the <mark>[docs page](https://example.com)</mark> now",
        )

    def test_selection_ending_between_link_bracket_and_paren_is_safe(self):
        text = "read [the guide](/guide) carefully"
        end = text.index("]") + 1  # right after the closing ]
        out = toggle(text, [(0, end)])
        self.assertIn("[the guide](/guide)", out)
        self.assertNotIn("]<mark>", out)

    def test_image_is_one_atomic_unit(self):
        text = "logo ![alt text](img.png) here"
        start = text.index("alt")
        self.assertEqual(
            toggle(text, [(start, start + 3)]),
            "logo <mark>![alt text](img.png)</mark> here",
        )

    def test_reference_style_link_is_not_split(self):
        text = "see [the docs][ref] today"
        start = text.index("docs")
        self.assertEqual(
            toggle(text, [(start, start + 4)]),
            "see <mark>[the docs][ref]</mark> today",
        )

    def test_autolink_is_never_split(self):
        text = "visit <https://example.com> for more"
        start = text.index("example")
        self.assertEqual(
            toggle(text, [(start, start + 7)]),
            "visit <mark><https://example.com></mark> for more",
        )

    def test_paired_inline_html_tags_stay_intact(self):
        text = "x<sub>2</sub> y"
        start = text.index("sub>") + 1
        end = text.index("</sub>") + 3
        out = toggle(text, [(start, end)])
        self.assertIn("<sub>", out)
        self.assertIn("</sub>", out)
        self.assertNotIn("<su<mark>", out)


class FindMarksTests(unittest.TestCase):
    def test_find_marks_reports_inner_text_and_offsets(self):
        marks = find_marks("x <mark>hi</mark> y")
        self.assertEqual(len(marks), 1)
        self.assertEqual(marks[0].inner, "hi")
        self.assertEqual(marks[0].start, 2)


class DsaNotesIntegrationTests(unittest.TestCase):
    """Exercise the logic against the real complex example file."""

    @classmethod
    def setUpClass(cls):
        with open(_DSA_NOTES, encoding="utf-8") as fh:
            # Use a clean baseline so the test is robust even if the file on
            # disk currently has highlights saved into it.
            cls.text = clear_all(fh.read())

    def _highlight(self, needle):
        start = self.text.index(needle)
        return toggle(self.text, [(start, start + len(needle))])

    def test_highlighting_a_heading_keeps_it_a_heading(self):
        out = self._highlight("## 3. Binary Search")
        self.assertIn("## <mark>3. Binary Search</mark>", out)
        self.assertNotIn("<mark>## ", out)  # the ## is never swallowed

    def test_highlighting_a_numbered_list_item_keeps_the_number(self):
        out = self._highlight("Drop constants: `O(2n)` becomes `O(n)`.")
        self.assertIn("1. <mark>Drop constants: `O(2n)` becomes `O(n)`.</mark>", out)

    def test_highlighting_a_plain_sentence_wraps_it(self):
        sentence = "Binary search works only on a **sorted** array."
        out = self._highlight(sentence)
        self.assertIn("<mark>" + sentence + "</mark>", out)

    def test_clearing_restores_the_original_file(self):
        highlighted = self._highlight("Binary search works only on a **sorted** array.")
        self.assertEqual(clear_all(highlighted), self.text)


if __name__ == "__main__":
    unittest.main()
