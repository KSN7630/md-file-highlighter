import * as vscode from "vscode";
import { IHighlightSyntax } from "../core/syntax/IHighlightSyntax";

/**
 * Owns the decoration resources and repaints highlights on demand. The
 * decorations are a pure visual overlay derived from the markers already
 * present in the text — they never mutate the document.
 *
 * Two overlays cooperate so the editor reads like a clean preview:
 *  - the *highlight* paints the inner (highlighted) text with the configured color;
 *  - the *hidden* overlay collapses the marker tags themselves, so you see
 *    coloured text instead of raw `<mark>...</mark>`. The file on disk
 *    is unchanged — the tags are still there, just not drawn.
 *
 * Tags are revealed again whenever the cursor/selection enters a marker, so the
 * raw syntax is always editable; it only disappears when you are reading.
 */
export class DecorationManager implements vscode.Disposable {
  private readonly highlightType: vscode.TextEditorDecorationType;
  private readonly hiddenType: vscode.TextEditorDecorationType;

  constructor(
    private readonly syntax: IHighlightSyntax,
    color: string,
    private readonly hideMarkers: boolean,
  ) {
    // The fill is translucent (so the text stays readable), which means it
    // composites differently against light vs dark backgrounds. The border and
    // ruler use a fully-opaque version of the same colour so the highlight's
    // extent is crisply visible on every theme, not just where the fill happens
    // to contrast.
    const solid = DecorationManager.opaque(color);
    this.highlightType = vscode.window.createTextEditorDecorationType({
      backgroundColor: color,
      // A solid border traces the exact extent of the marked text, so the
      // boundaries stay obvious even with the tags hidden.
      border: `1px solid ${solid}`,
      borderRadius: "2px",
      // Show every highlight in the scrollbar so you can see, at a glance,
      // how much of the whole file is marked.
      overviewRulerColor: solid,
      overviewRulerLane: vscode.OverviewRulerLane.Center,
    });
    // `display: none` collapses the decorated characters to zero width — the
    // standard way to hide syntax in an editor without touching the document.
    this.hiddenType = vscode.window.createTextEditorDecorationType({
      textDecoration: "none; display: none;",
    });
  }

  /** Re-derive and apply decorations for the given editor. */
  public refresh(editor: vscode.TextEditor | undefined): void {
    if (!editor || editor.document.languageId !== "markdown") {
      return;
    }
    const doc = editor.document;
    const markers = this.syntax.matchAll(doc.getText());

    // Offsets of the current selections, used to reveal a marker's tags while
    // the cursor is inside it so the raw syntax stays editable.
    const selections = editor.selections.map((s) => ({
      start: doc.offsetAt(s.start),
      end: doc.offsetAt(s.end),
    }));
    const isActive = (start: number, end: number): boolean =>
      selections.some((s) => s.start <= end && s.end >= start);

    const highlights: vscode.Range[] = [];
    const hidden: vscode.Range[] = [];
    for (const mk of markers) {
      highlights.push(this.range(doc, mk.innerStart, mk.innerEnd));
      if (this.hideMarkers && !isActive(mk.start, mk.end)) {
        hidden.push(this.range(doc, mk.start, mk.innerStart));
        hidden.push(this.range(doc, mk.innerEnd, mk.end));
      }
    }

    editor.setDecorations(this.highlightType, highlights);
    editor.setDecorations(this.hiddenType, hidden);
  }

  public dispose(): void {
    this.highlightType.dispose();
    this.hiddenType.dispose();
  }

  private range(
    doc: vscode.TextDocument,
    start: number,
    end: number,
  ): vscode.Range {
    return new vscode.Range(doc.positionAt(start), doc.positionAt(end));
  }

  /**
   * Strip the alpha from an `rgb()/rgba()` colour to get its fully-opaque
   * form, used for the border and ruler so the highlight reads clearly on any
   * theme. Any other colour syntax is returned unchanged.
   */
  private static opaque(color: string): string {
    const m = color.match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i,
    );
    return m ? `rgb(${m[1]}, ${m[2]}, ${m[3]})` : color;
  }
}
