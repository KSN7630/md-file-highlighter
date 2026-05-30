import * as vscode from "vscode";

const SECTION = "mdHighlight";

/** Typed, centralized reader over the extension's workspace configuration. */
export class Settings {
  public get highlightColor(): string {
    return this.cfg().get<string>("highlightColor", "rgba(255, 160, 0, 0.45)");
  }

  /**
   * When true, the `<mark>`/`</mark>` tags are visually collapsed so only the
   * highlighted text shows. Off by default: showing the literal tags alongside
   * the colored fill makes it unmistakable which text is highlighted, without
   * having to click into it.
   */
  public get hideMarkers(): boolean {
    return this.cfg().get<boolean>("hideMarkers", false);
  }

  private cfg(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(SECTION);
  }
}
