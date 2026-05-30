import { IHighlightSyntax } from "./IHighlightSyntax";
import { MarkerMatch } from "../types";

const OPEN = "<mark>";
const CLOSE = "</mark>";

/**
 * Standard HTML highlight element: <mark>text</mark>.
 *
 * Chosen because it is valid Markdown (Markdown passes inline HTML through) AND
 * `<mark>` is a real HTML element, so *every* renderer — the VS Code preview,
 * GitHub, a browser — paints it highlighted natively, with no injected CSS.
 * The marker therefore renders the same everywhere.
 */
export class MarkHtmlSyntax implements IHighlightSyntax {
  public readonly id = "markHtml";

  // Non-greedy, dot-matches-newline via [\s\S]. Recreated per call to stay
  // stateless (a shared /g regex carries lastIndex between calls).
  private get pattern(): RegExp {
    return /<mark>([\s\S]*?)<\/mark>/g;
  }

  public wrap(text: string): string {
    return `${OPEN}${text}${CLOSE}`;
  }

  public matchAll(text: string): MarkerMatch[] {
    const matches: MarkerMatch[] = [];
    const re = this.pattern;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      matches.push({
        start,
        end,
        innerStart: start + OPEN.length,
        innerEnd: end - CLOSE.length,
        inner: m[1],
      });
      // Guard against zero-length matches causing an infinite loop.
      if (m.index === re.lastIndex) {
        re.lastIndex++;
      }
    }
    return matches;
  }
}
