import * as vscode from "vscode";
import { SelectionRange, TextEdit } from "../core/types";

/**
 * Adapter / Facade over the raw VS Code editor API.
 *
 * It translates between VS Code's Position/Selection world and the plain
 * character offsets that the pure core works with. Keeping this the *only*
 * place that converts offsets means the core never needs the vscode module.
 */
export class EditorGateway {
  /** The active editor, but only if it is a Markdown document. */
  public getActiveMarkdownEditor(): vscode.TextEditor | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== "markdown") {
      return undefined;
    }
    return editor;
  }

  public getText(editor: vscode.TextEditor): string {
    return editor.document.getText();
  }

  public getSelectionOffsets(editor: vscode.TextEditor): SelectionRange[] {
    return editor.selections.map((s) => ({
      start: editor.document.offsetAt(s.start),
      end: editor.document.offsetAt(s.end),
    }));
  }

  /**
   * Apply offset-based edits atomically. Edits must be non-overlapping, which
   * HighlightService guarantees. Returns false when there is nothing to do.
   */
  public async applyEdits(
    editor: vscode.TextEditor,
    edits: TextEdit[],
  ): Promise<boolean> {
    if (edits.length === 0) {
      return false;
    }
    return editor.edit((builder) => {
      for (const e of edits) {
        const range = new vscode.Range(
          editor.document.positionAt(e.start),
          editor.document.positionAt(e.end),
        );
        builder.replace(range, e.newText);
      }
    });
  }
}
