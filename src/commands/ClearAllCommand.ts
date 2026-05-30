import * as vscode from "vscode";
import { ICommand } from "./ICommand";
import { EditorGateway } from "../adapters/EditorGateway";
import { Runtime } from "../runtime/Runtime";

/** Remove every highlight marker from the active document (with confirmation). */
export class ClearAllCommand implements ICommand {
  public readonly id = "mdHighlight.clearAll";

  constructor(
    private readonly gateway: EditorGateway,
    private readonly runtime: Runtime,
  ) {}

  public async execute(): Promise<void> {
    const editor = this.gateway.getActiveMarkdownEditor();
    if (!editor) {
      vscode.window.showWarningMessage("Open a Markdown file first.");
      return;
    }

    const text = this.gateway.getText(editor);
    const edits = this.runtime.service.computeClearAllEdits(text);
    if (edits.length === 0) {
      vscode.window.showInformationMessage("No highlights to clear.");
      return;
    }

    const choice = await vscode.window.showWarningMessage(
      `Remove all ${edits.length} highlight(s) from this file?`,
      { modal: true },
      "Remove",
    );
    if (choice !== "Remove") {
      return;
    }

    await this.gateway.applyEdits(editor, edits);
    this.runtime.decorations.refresh(editor);
  }
}
