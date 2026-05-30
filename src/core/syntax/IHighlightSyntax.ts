import { MarkerMatch } from "../types";

/**
 * Contract for a highlight marker convention.
 *
 * It decides how a highlight is encoded as plain text in the `.md` file. The
 * rest of the system depends only on this interface, so the marker convention
 * stays decoupled from the toggle/clear logic and the editor decorations.
 */
export interface IHighlightSyntax {
  /** Stable identifier for the marker convention. */
  readonly id: string;

  /** Wrap raw text in this convention's markers. */
  wrap(text: string): string;

  /** Find every marker in the given document text, in document order. */
  matchAll(text: string): MarkerMatch[];
}
