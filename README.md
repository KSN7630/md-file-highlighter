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

**Build the `.vsix`:**

```bash
npm install
npm run package        # produces md-file-highlighter-<version>.vsix
```

**Install it** (either way):

- In VS Code: open the Extensions view → `…` menu → **Install from VSIX…** →
  pick the file.
- Or from a terminal:

  ```bash
  code --install-extension md-file-highlighter-0.1.0.vsix
  ```

To try it: open any `.md` file (e.g. [`examples/sample.md`](examples/sample.md)),
select some text, and click the **✎ Highlight** button or press `Ctrl+Alt+H`.

---

## Dependencies

The hard constraint is **zero runtime dependencies** — everything is built on
platform primitives.

- **Runtime:** none. Pure TypeScript against the built-in `vscode` API.
- **Dev-only:** `typescript`, `@types/vscode`, `@types/node`, and `@vscode/vsce`
  (packaging). Tests run on Node's built-in `node:test`.

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
    HighlightService.ts     Pure toggle/clear edit computation (whitespace + paragraph logic)
    DecorationManager.ts    Owns the decoration resources; repaints highlights
  adapters/
    EditorGateway.ts        Adapter: VS Code Positions <-> plain integer offsets
  config/Settings.ts        Typed settings reader
  runtime/Runtime.ts        Mutable holder so config changes apply live
  commands/                 Command pattern: Toggle / ClearAll (+ ICommand)
```

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

The unit suite covers the toggle/unwrap logic, whitespace hugging,
multi-paragraph splitting, and CRLF handling.

## License

MIT — see [LICENSE](LICENSE).
