import { test } from "node:test";
import assert from "node:assert/strict";

import { MarkHtmlSyntax } from "../../src/core/syntax/MarkHtmlSyntax";
import { HighlightService } from "../../src/services/HighlightService";
import { TextEdit } from "../../src/core/types";

/** Apply offset edits to a string (right-to-left so earlier offsets stay valid). */
function apply(text: string, edits: TextEdit[]): string {
  let out = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.newText + out.slice(e.end);
  }
  return out;
}

function service(): HighlightService {
  return new HighlightService(new MarkHtmlSyntax());
}

test("wraps a plain selection in <mark> tags", () => {
  const text = "highlight this line";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: 9 }]);
  assert.equal(apply(text, edits), "<mark>highlight</mark> this line");
});

test("toggles off when the selection sits inside an existing marker", () => {
  const text = "a <mark>b</mark> c";
  // Select the inner "b".
  const edits = service().computeToggleEdits(text, [{ start: 8, end: 9 }]);
  assert.equal(apply(text, edits), "a b c");
});

test("does nothing for an empty selection outside any marker", () => {
  const text = "plain text";
  const edits = service().computeToggleEdits(text, [{ start: 3, end: 3 }]);
  assert.equal(edits.length, 0);
});

test("clearAll removes every marker", () => {
  const text = "<mark>x</mark> y <mark>z</mark>";
  const edits = service().computeClearAllEdits(text);
  assert.equal(apply(text, edits), "x y z");
});

test("wrap excludes leading/trailing whitespace from the marker", () => {
  const text = "a   word   b";
  // Select "  word  " with surrounding spaces (offsets 1..11).
  const edits = service().computeToggleEdits(text, [{ start: 1, end: 11 }]);
  // Spaces stay put; only "word" is wrapped.
  assert.equal(apply(text, edits), "a   <mark>word</mark>   b");
});

test("wrapping a paragraph keeps the blank line separating it intact", () => {
  const text = "para one.\n\npara two.";
  // Select from the blank line through the end of "para two."
  const edits = service().computeToggleEdits(text, [{ start: 9, end: text.length }]);
  // The blank line (\n\n) is untouched, so the two paragraphs stay separate.
  assert.equal(apply(text, edits), "para one.\n\n<mark>para two.</mark>");
});

test("selecting multiple paragraphs marks each paragraph separately", () => {
  const text = "para one.\n\npara two.\n\npara three.";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  assert.equal(
    apply(text, edits),
    "<mark>para one.</mark>\n\n" +
      "<mark>para two.</mark>\n\n" +
      "<mark>para three.</mark>",
  );
});

test("a soft line break within one paragraph stays in a single marker", () => {
  const text = "line a\nline b";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  assert.equal(apply(text, edits), "<mark>line a\nline b</mark>");
});

test("an all-whitespace selection wraps nothing", () => {
  const text = "a    b";
  const edits = service().computeToggleEdits(text, [{ start: 1, end: 5 }]);
  assert.equal(edits.length, 0);
});

test("CRLF blank lines are treated as paragraph breaks", () => {
  const text = "p1\r\n\r\np2";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  assert.equal(
    apply(text, edits),
    "<mark>p1</mark>\r\n\r\n<mark>p2</mark>",
  );
});

test("multiple consecutive blank lines are preserved between marks", () => {
  const text = "p1\n\n\np2";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  assert.equal(
    apply(text, edits),
    "<mark>p1</mark>\n\n\n<mark>p2</mark>",
  );
});

test("a partial cross-paragraph selection marks only the text on each side", () => {
  const text = "alpha beta\n\ngamma delta";
  const start = text.indexOf("beta");
  const end = text.indexOf("gamma") + "gamma".length;
  const edits = service().computeToggleEdits(text, [{ start, end }]);
  assert.equal(
    apply(text, edits),
    "alpha <mark>beta</mark>\n\n<mark>gamma</mark> delta",
  );
});

test("multiple (multi-cursor) selections each wrap independently", () => {
  const text = "aaa bbb ccc";
  const edits = service().computeToggleEdits(text, [
    { start: 0, end: 3 },
    { start: 8, end: 11 },
  ]);
  assert.equal(
    apply(text, edits),
    "<mark>aaa</mark> bbb <mark>ccc</mark>",
  );
});

test("a selection spanning several markers removes them all", () => {
  const text = "<mark>a</mark> mid <mark>b</mark>";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  assert.equal(apply(text, edits), "a mid b");
});

test("a heading keeps its '## ' prefix outside the marker so it still renders", () => {
  const text = "## A Note on the Lamp";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  assert.equal(apply(text, edits), "## <mark>A Note on the Lamp</mark>");
});

test("highlighting across a heading wraps each block without breaking the heading", () => {
  const text = "intro para.\n\n## A Note on the Lamp\n\nbody para.";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  assert.equal(
    apply(text, edits),
    "<mark>intro para.</mark>\n\n" +
      "## <mark>A Note on the Lamp</mark>\n\n" +
      "<mark>body para.</mark>",
  );
});

test("list bullets and blockquotes stay outside the marker", () => {
  const bullet = service().computeToggleEdits("- a list item", [{ start: 0, end: 13 }]);
  assert.equal(apply("- a list item", bullet), "- <mark>a list item</mark>");

  const ordered = service().computeToggleEdits("1. first item", [{ start: 0, end: 13 }]);
  assert.equal(apply("1. first item", ordered), "1. <mark>first item</mark>");

  const quote = service().computeToggleEdits("> a quote", [{ start: 0, end: 9 }]);
  assert.equal(apply("> a quote", quote), "> <mark>a quote</mark>");
});

test("inline emphasis at line start is not mistaken for a list bullet", () => {
  // `*word*` has no space after `*`, so it is emphasis, not a bullet.
  const text = "*emphasized* text";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  assert.equal(apply(text, edits), "<mark>*emphasized* text</mark>");
});

test("a table row is highlighted per cell, never crossing a pipe", () => {
  const text =
    "| Notation | Name |\n| --- | --- |\n| `O(1)` | Constant |";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  assert.equal(
    apply(text, edits),
    "| <mark>Notation</mark> | <mark>Name</mark> |\n" +
      "| --- | --- |\n" +
      "| <mark>`O(1)`</mark> | <mark>Constant</mark> |",
  );
});

test("the table delimiter row is never wrapped", () => {
  const text = "| A | B |\n| --- | --- |\n| 1 | 2 |";
  const out = apply(text, service().computeToggleEdits(text, [{ start: 0, end: text.length }]));
  assert.ok(out.includes("| --- | --- |"));
  assert.ok(!out.includes("<mark>---"));
});

test("a pipe inside inline code is not treated as a cell boundary", () => {
  const text = "| `a | b` | Name |\n| --- | --- |";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  // The `a | b` code span stays one cell; its inner pipe is not split on.
  assert.equal(
    apply(text, edits),
    "| <mark>`a | b`</mark> | <mark>Name</mark> |\n| --- | --- |",
  );
});

test("text that merely contains a pipe but is no table is wrapped whole", () => {
  const text = "use the | operator carefully";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  assert.equal(apply(text, edits), "<mark>use the | operator carefully</mark>");
});

test("a fenced code block is never wrapped", () => {
  const text = "intro\n\n```python\nx = 1\n```\n\noutro";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  assert.equal(
    apply(text, edits),
    "<mark>intro</mark>\n\n```python\nx = 1\n```\n\n<mark>outro</mark>",
  );
});

test("a blank line inside a fenced block does not split prose around it", () => {
  const text = "```\nline1\n\nline2\n```";
  const edits = service().computeToggleEdits(text, [{ start: 0, end: text.length }]);
  // Nothing is wrapped — the whole selection is code.
  assert.equal(edits.length, 0);
});

test("a partial selection of one table cell wraps only that text", () => {
  const text = "| Constant time | Name |\n| --- | --- |";
  const start = text.indexOf("time");
  const edits = service().computeToggleEdits(text, [{ start, end: start + 4 }]);
  assert.equal(
    apply(text, edits),
    "| Constant <mark>time</mark> | Name |\n| --- | --- |",
  );
});

test("a selection inside an inline code span expands to the whole span", () => {
  const text = "the `O(n log n)` bound";
  const start = text.indexOf("log n");
  const edits = service().computeToggleEdits(text, [{ start, end: start + 5 }]);
  // The mark must not land inside the backticks (it would render literally).
  assert.equal(apply(text, edits), "the <mark>`O(n log n)`</mark> bound");
});

test("inside an inline code span in a table cell expands to the span", () => {
  const text = "| `O(n log n)` | Name |\n| --- | --- |";
  const start = text.indexOf("log n");
  const edits = service().computeToggleEdits(text, [{ start, end: start + 5 }]);
  assert.equal(
    apply(text, edits),
    "| <mark>`O(n log n)`</mark> | Name |\n| --- | --- |",
  );
});

test("a selection that splits a ** run snaps out so bold is not broken", () => {
  const text = "- **Array** is contiguous";
  const start = text.indexOf("*Array"); // the 2nd asterisk of the opening **
  const edits = service().computeToggleEdits(text, [{ start, end: text.length }]);
  // The opening ** stays together (no stray "*<mark>*").
  assert.equal(apply(text, edits), "- <mark>**Array** is contiguous</mark>");
  assert.ok(!apply(text, edits).includes("*<mark>*"));
});

test("a mark inside intact bold/code does not get disturbed", () => {
  const text = "a **bold** word";
  // Select just "bold" (inside the **). The ** are outside the selection.
  const start = text.indexOf("bold");
  const edits = service().computeToggleEdits(text, [{ start, end: start + 4 }]);
  assert.equal(apply(text, edits), "a **<mark>bold</mark>** word");
});

test("a selection inside a link's text expands to wrap the whole link", () => {
  const text = "see the [docs page](https://example.com) now";
  const start = text.indexOf("docs");
  const edits = service().computeToggleEdits(text, [{ start, end: start + 4 }]);
  // The mark must wrap the entire [text](url), never landing inside it.
  assert.equal(
    apply(text, edits),
    "see the <mark>[docs page](https://example.com)</mark> now",
  );
});

test("a selection ending between a link's ] and ( does not break the link", () => {
  const text = "read [the guide](/guide) carefully";
  const end = text.indexOf("]") + 1; // right after the closing ]
  const edits = service().computeToggleEdits(text, [{ start: 0, end }]);
  const out = apply(text, edits);
  // The link stays intact (no <mark> wedged between ] and `(`).
  assert.ok(out.includes("[the guide](/guide)"));
  assert.ok(!out.includes("]<mark>"));
  assert.ok(!out.includes("]</mark>("));
});

test("an image is treated as one atomic unit", () => {
  const text = "logo ![alt text](img.png) here";
  const start = text.indexOf("alt");
  const edits = service().computeToggleEdits(text, [{ start, end: start + 3 }]);
  assert.equal(
    apply(text, edits),
    "logo <mark>![alt text](img.png)</mark> here",
  );
});

test("a reference-style link is not split", () => {
  const text = "see [the docs][ref] today";
  const start = text.indexOf("docs");
  const edits = service().computeToggleEdits(text, [{ start, end: start + 4 }]);
  assert.equal(apply(text, edits), "see <mark>[the docs][ref]</mark> today");
});

test("an autolink / inline HTML tag is never split by a mark", () => {
  const text = "visit <https://example.com> for more";
  const start = text.indexOf("example");
  const edits = service().computeToggleEdits(text, [{ start, end: start + 7 }]);
  assert.equal(
    apply(text, edits),
    "visit <mark><https://example.com></mark> for more",
  );
});

test("a selection across paired inline HTML tags keeps both tags intact", () => {
  const text = "x<sub>2</sub> y";
  // Select from inside the opening tag through inside the closing tag.
  const start = text.indexOf("sub>") + 1;
  const end = text.indexOf("</sub>") + 3;
  const out = apply(text, service().computeToggleEdits(text, [{ start, end }]));
  // Neither <sub> nor </sub> is broken open by a stray <mark>.
  assert.ok(out.includes("<sub>"));
  assert.ok(out.includes("</sub>"));
  assert.ok(!out.includes("<su<mark>"));
});

test("matchAll reports each marker's inner text and offsets", () => {
  const syntax = new MarkHtmlSyntax();
  const matches = syntax.matchAll("x <mark>hi</mark> y");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].inner, "hi");
  assert.equal(matches[0].start, 2);
});
