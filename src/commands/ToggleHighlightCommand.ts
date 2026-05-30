import * as vscode from "vscode";
import { ICommand } from "./ICommand";
import { EditorGateway } from "../adapters/EditorGateway";
import { Runtime } from "../runtime/Runtime";

/** Toggle the highlight on the current selection(s). */
export class ToggleHighlightCommand implements ICommand {
  public readonly id = "mdHighlight.toggleHighlight";

  constructor(
    private readonly gateway: EditorGateway,
    private readonly runtime: Runtime,
  ) {}

  public async execute(): Promise<void> {
    const editor = this.gateway.getActiveMarkdownEditor();
    if (!editor) {
      vscode.window.showWarningMessage("Open a Markdown file to highlight.");
      return;
    }

    const text = this.gateway.getText(editor);
    const selections = this.gateway.getSelectionOffsets(editor);
    const edits = this.runtime.service.computeToggleEdits(text, selections);
    if (edits.length === 0) {
      return;
    }

    await this.gateway.applyEdits(editor, edits);
    this.runtime.decorations.refresh(editor);
  }
}
