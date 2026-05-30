import * as vscode from "vscode";

import { Settings } from "./config/Settings";
import { MarkHtmlSyntax } from "./core/syntax/MarkHtmlSyntax";
import { HighlightService } from "./services/HighlightService";
import { DecorationManager } from "./services/DecorationManager";
import { StatusBarButton } from "./services/StatusBarButton";
import { EditorGateway } from "./adapters/EditorGateway";
import { Runtime } from "./runtime/Runtime";
import { ICommand } from "./commands/ICommand";
import { ToggleHighlightCommand } from "./commands/ToggleHighlightCommand";
import { ClearAllCommand } from "./commands/ClearAllCommand";

/**
 * Composition root. This is the only place that wires concrete dependencies
 * together; everything below it depends on abstractions.
 */
export function activate(context: vscode.ExtensionContext): void {
  const settings = new Settings();
  const gateway = new EditorGateway();

  const runtime = buildRuntime(settings);

  // Dispose whatever decoration resource is *currently* held at shutdown.
  context.subscriptions.push({ dispose: () => runtime.decorations.dispose() });

  // Register commands once. They read mutable state through `runtime`.
  const toggle = new ToggleHighlightCommand(gateway, runtime);
  const commands: ICommand[] = [toggle, new ClearAllCommand(gateway, runtime)];
  for (const command of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command.id, () => command.execute()),
    );
  }

  // A clickable status-bar button for the toggle, so the right-click menu is
  // never required. Shown only for Markdown editors.
  const statusBar = new StatusBarButton(toggle.id);
  context.subscriptions.push(statusBar);
  statusBar.update(vscode.window.activeTextEditor);

  // Initial paint for an already-open editor.
  runtime.decorations.refresh(vscode.window.activeTextEditor);

  // Observers: keep decorations in sync with the editor and document.
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      runtime.decorations.refresh(editor);
      statusBar.update(editor);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        runtime.decorations.refresh(editor);
      }
    }),
    // Reveal a marker's hidden tags while the cursor sits inside it, and
    // re-hide them once it leaves — so the syntax is always editable.
    vscode.window.onDidChangeTextEditorSelection((event) =>
      runtime.decorations.refresh(event.textEditor),
    ),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration("mdHighlight")) {
        return;
      }
      rebuildRuntime(settings, runtime);
      runtime.decorations.refresh(vscode.window.activeTextEditor);
    }),
  );
}

export function deactivate(): void {
  // Resources are disposed via context.subscriptions.
}

/** Build a fresh Runtime from current settings. */
function buildRuntime(settings: Settings): Runtime {
  const syntax = new MarkHtmlSyntax();
  return new Runtime(
    syntax,
    new HighlightService(syntax),
    new DecorationManager(syntax, settings.highlightColor, settings.hideMarkers),
  );
}

/** Rebuild config-dependent services in place after a settings change. */
function rebuildRuntime(settings: Settings, runtime: Runtime): void {
  const syntax = new MarkHtmlSyntax();
  runtime.syntax = syntax;
  runtime.service = new HighlightService(syntax);

  runtime.decorations.dispose();
  runtime.decorations = new DecorationManager(
    syntax,
    settings.highlightColor,
    settings.hideMarkers,
  );
}
