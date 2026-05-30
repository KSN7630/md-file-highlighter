import * as vscode from "vscode";

/**
 * A persistent status-bar button that toggles the highlight on the current
 * selection, so you never have to open the right-click menu. It clicks through
 * to the same command as the keybinding, and is only shown while a Markdown
 * file is the active editor.
 */
export class StatusBarButton implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(commandId: string) {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.item.text = "$(edit) Highlight";
    this.item.tooltip = "Toggle highlight on the selected text (Ctrl+Alt+H)";
    this.item.command = commandId;
  }

  /** Show the button only for Markdown editors; hide it everywhere else. */
  public update(editor: vscode.TextEditor | undefined): void {
    if (editor && editor.document.languageId === "markdown") {
      this.item.show();
    } else {
      this.item.hide();
    }
  }

  public dispose(): void {
    this.item.dispose();
  }
}
