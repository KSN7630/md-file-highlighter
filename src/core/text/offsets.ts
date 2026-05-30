/**
 * Pure text utilities. No editor dependency, so they are trivially testable.
 */

/** One-based line number containing the given character offset. */
export function lineNumberAt(text: string, offset: number): number {
  const max = Math.min(Math.max(offset, 0), text.length);
  let line = 1;
  for (let i = 0; i < max; i++) {
    if (text.charCodeAt(i) === 10 /* \n */) {
      line++;
    }
  }
  return line;
}

/** Collapse all runs of whitespace to single spaces and trim the ends. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
