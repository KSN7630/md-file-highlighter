# MD File Highlighter

A VS Code extension that lets you **highlight text in any Markdown file**. The
highlight isn't fragile editor state — it is written **into the file** as a
standard HTML `<mark>` element, so it renders highlighted everywhere and travels
with the document.

```md
Visitors often asked him whether the job ever grew lonely. He would smile and
say that <mark>the sea was company enough</mark>, with its changing moods.
```

Select text, press a key, and it's wrapped in `<mark>…</mark>` and painted in the
highlight color. Press again inside a highlight to remove it.

---

## Why `<mark>`

A highlight is **not** an overlay stored in some sidecar database — it is literal
text in your document. The marker is the standard HTML `<mark>` element, and
because `<mark>` is valid Markdown *and* a real HTML element:

- It renders **highlighted in every Markdown viewer** — the VS Code preview,
  GitHub, a browser — with no extra tooling.
- The file **is** the highlight: nothing to sync, and it diffs cleanly in git.
- It's plain, readable text you can also edit by hand.

The colored background you see in the editor is just a *rendering* of the
`<mark>` tag already in the text — see [In-editor rendering](#in-editor-rendering).

---

## Commands

| Action | Command | Keybinding |
| --- | --- | --- |
| Highlight / un-highlight the selection | `MD Highlight: Toggle Highlight` | `Ctrl+Alt+H` |
| Remove all highlights in the file | `MD Highlight: Clear All Highlights` | — |

Select text in a Markdown file and press `Ctrl+Alt+H`; it is wrapped in `<mark>`
and painted in the highlight color. Press again inside a highlight to remove it.

### Ways to toggle a highlight

You don't have to remember the keybinding — there are several one-click ways to
toggle the highlight on your selection:

- **Status bar button** — a `✎ Highlight` button appears at the bottom-right of
  the window whenever a Markdown file is open. Select text and click it.
- **Editor toolbar icon** — a pencil icon in the top-right of the editor.
- **Right-click menu** — `MD Highlight: Toggle Highlight`.
- **Keyboard** — `Ctrl+Alt+H`.

All four run the same command, so the result is identical.

---

## Selection handling

Toggling is deliberately careful about whitespace and Markdown structure, so it
never corrupts your content:

- **Whitespace is hugged, never altered.** Leading/trailing spaces, tabs, and
  newlines in a selection stay *outside* the marker; no whitespace is ever added
  or removed.
- **Paragraphs are highlighted individually.** `<mark>` is an inline element and
  cannot cross a blank line, so a selection spanning several paragraphs produces
  one `<mark>` per paragraph, leaving the blank-line separators intact.
- **Soft line breaks stay together.** A single newline inside one paragraph
  remains within one marker.
- **Tables are highlighted per cell.** A selection across a table wraps each
  cell on its own, never crossing a `|` or a row, and never touches the
  `| --- |` delimiter row — so the table keeps rendering. Pipes inside inline
  code (`` `a | b` ``) are respected.
- **Fenced code blocks are left alone.** A `<mark>` is never written inside a
  ```` ``` ```` / `~~~` block, where it would otherwise appear as literal text.
- **Inline spans are never split.** If a selection starts/ends inside an inline
  code span (`` `code` ``) the marker expands to wrap the whole span (so it
  never renders literally), and it never splits a `**`/`*`/`_`/`~` emphasis run
  into a stray delimiter.
- **Links, images, and inline tags stay whole.** A boundary that lands inside a
  link/image (`[text](url)`, `![alt](url)`, `[text][ref]`) or an autolink /
  inline HTML tag (`<https://…>`, `<sub>`, `</b>`) expands to wrap the whole
  construct, so the `<mark>` is never wedged into a `](` or split a tag open.
- Leading block markers (`#`, `-`, `1.`, `>`) stay **outside** the marker so the
  line keeps rendering as a heading/list/quote.
- Works with **multi-cursor** selections and recognizes both `LF` and `CRLF`
  blank lines.

---

## In-editor rendering

A `TextEditorDecorationType` paints the highlighted text so it's obvious without
reading the raw tags:

- An orange fill plus a **fully-opaque border** outlining the exact highlighted
  span (the border color is the opaque form of the fill, so the extent is crisp
  on both light and dark themes).
- A tick in the **scrollbar overview ruler** for every highlight.
- Optionally (`mdHighlight.hideMarkers`) the `<mark>` tags themselves can be
  visually collapsed for a clean "preview-like" editor; the tags reappear while
  the cursor is inside a highlight so they stay editable.

The same color is injected into VS Code's **built-in Markdown preview** via
`preview-styles/preview.css`, so the editor and preview match.

---

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `mdHighlight.highlightColor` | `rgba(255, 160, 0, 0.45)` | Any valid CSS color for the in-editor highlight fill. |
| `mdHighlight.hideMarkers` | `false` | Visually collapse the `<mark>` tags in the editor. |

---

## Install & try it

The extension ships as a single `.vsix` file you can install on any machine with
VS Code — no Marketplace account needed.

### Quickest: install the prebuilt `.vsix`

A ready-to-use build is committed in this repo:
[`md-file-highlighter-0.1.0.vsix`](md-file-highlighter-0.1.0.vsix).

1. **Download it** — on the GitHub page for the file, click **Download raw file**
   (the ⤓ icon), or clone the repo so the file is on disk.
2. **Install it** in VS Code, either:
   - **From the UI:** open the **Extensions** view (`Ctrl+Shift+X`) → click the
     `…` (More Actions) menu at the top → **Install from VSIX…** → pick the
     downloaded `md-file-highlighter-0.1.0.vsix`.
   - **From a terminal:**

     ```bash
     code --install-extension md-file-highlighter-0.1.0.vsix
     ```
3. **Reload** VS Code if prompted. The extension activates automatically on any
   Markdown file.

To uninstall later: **Extensions** view → find **MD File Highlighter** → gear
icon → **Uninstall**.

### Alternative: build the `.vsix` yourself

```bash
npm install
npm run package        # produces md-file-highlighter-<version>.vsix
```

Then install it with either method above.

### Try it

Open any `.md` file (e.g. [`examples/sample.md`](examples/sample.md)), select
some text, and click the **✎ Highlight** button (bottom-right status bar) or
press `Ctrl+Alt+H`. Press again inside a highlight to remove it.

---

## Dependencies

The hard constraint is **zero runtime dependencies** — everything is built on
platform primitives.

- **Runtime:** none. Pure TypeScript against the built-in `vscode` API.
- **Dev-only:** `typescript`, `@types/vscode`, `@types/node`, and `@vscode/vsce`
  (packaging). Tests run on Node's built-in `node:test`.

---

## Python logic library

The same highlight logic is also available as a standalone Python package in
[`python-library/`](python-library/) (`md_highlight`), so teams that prefer
Python can run and test the behavior **without VS Code** — in CI or scripts:

```python
from md_highlight import toggle, clear_all
toggle("## Big-O Notation", [(0, 17)])   # -> "## <mark>Big-O Notation</mark>"
```

It mirrors the extension byte-for-byte — same whitespace, paragraph, table,
fenced-code, inline-construct (code/emphasis/link/tag), and block-marker rules —
and is standard-library only. The live VS Code extension itself stays
TypeScript — VS Code can't load a Python extension. See
[`python-library/README.md`](python-library/README.md).

---

## Architecture

The core logic is **pure** — no editor, no I/O — so the bulk of the behavior is
unit-testable in milliseconds.

```text
src/
  extension.ts              Composition root: wires everything; registers commands + observers
  core/                     Pure, VS Code-free
    types.ts                MarkerMatch / TextEdit / SelectionRange
    syntax/                 The marker convention
      IHighlightSyntax.ts     contract: wrap(text) + matchAll(text)
      MarkHtmlSyntax.ts       <mark>…</mark>
    text/offsets.ts           offset/line utilities
  services/
    HighlightService.ts     Pure toggle/clear edit computation (whitespace, paragraph, table, code, and link/tag structure-awareness)
    DecorationManager.ts    Owns the decoration resources; repaints highlights
    StatusBarButton.ts      The ✎ Highlight status-bar button (toggles the active selection)
  adapters/
    EditorGateway.ts        Adapter: VS Code Positions <-> plain integer offsets
  config/Settings.ts        Typed settings reader
  runtime/Runtime.ts        Mutable holder so config changes apply live
  commands/                 Command pattern: Toggle / ClearAll (+ ICommand)
```

The same pure logic is mirrored, byte-for-byte, as a standard-library Python
package under [`python-library/`](python-library/) — see
[Python logic library](#python-logic-library).

### How a toggle flows

1. A **command** (`ToggleHighlightCommand`) is invoked via keybinding/menu.
2. `EditorGateway` (**Adapter**) reads the document text and converts the
   editor's selections into plain integer offset ranges.
3. `HighlightService` (**pure**) computes the minimal `TextEdit`s — wrapping each
   paragraph block, hugging whitespace, or unwrapping markers it overlaps.
4. The gateway applies those edits back through the VS Code API.
5. An **Observer** (`onDidChangeTextDocument` / active-editor / selection /
   config change) tells `DecorationManager` to repaint the highlight overlay.

**Patterns used:** Command (each editor action), Adapter/Facade
(`EditorGateway`), Observer (decoration refresh), and a single managed resource
for the decoration types. `IHighlightSyntax` keeps the marker convention behind
a small interface, so the toggle/clear logic stays decoupled from it.

---

## Develop & test

```bash
npm install          # dev-only deps
npm run compile      # build to ./compiled
npm run test:unit    # tsc + node:test (zero runtime deps)
# Press F5 in VS Code to launch the Extension Development Host.
```

Then open [`examples/sample.md`](examples/sample.md), select some text, and press
`Ctrl+Alt+H`.

The unit suite covers the full toggle/unwrap and clear-all logic, whitespace
hugging, multi-paragraph splitting, multi-cursor selections, and CRLF handling,
plus every structure-aware rule from [Selection handling](#selection-handling):
tables (per-cell wrapping and the untouched delimiter row), fenced code blocks,
inline code spans, `*`/`_`/`~` emphasis runs, links/images, and autolinks /
inline HTML tags.

The Python library carries the **same suite** (`python-library/tests/`) so both
implementations stay in lock-step, plus property/fuzz tests that assert no
`<mark>` ever lands somewhere that breaks rendering:

```bash
cd python-library
PYTHONPATH=src python -m unittest discover -s tests -t .
```

## License

MIT — see [LICENSE](LICENSE).
