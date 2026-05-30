import { IHighlightSyntax } from "../core/syntax/IHighlightSyntax";
import { MarkerMatch, SelectionRange, TextEdit } from "../core/types";

/**
 * Pure highlight logic. Given document text + selections, it computes the
 * edits required to toggle or clear highlights. It has no knowledge of VS Code,
 * which makes every branch unit-testable in milliseconds.
 */
export class HighlightService {
  constructor(private readonly syntax: IHighlightSyntax) {}

  /**
   * Toggle semantics per selection:
   *  - if the selection touches existing marker(s), remove them (unwrap);
   *  - else if the selection is non-empty, wrap it;
   *  - else (empty selection, no marker) do nothing.
   */
  public computeToggleEdits(text: string, selections: SelectionRange[]): TextEdit[] {
    const markers = this.syntax.matchAll(text);
    const edits: TextEdit[] = [];
    const removedMarkerStarts = new Set<number>();

    for (const raw of selections) {
      const sel = normalize(raw);
      const overlapping = markers.filter((mk) => overlaps(mk, sel));

      if (overlapping.length > 0) {
        for (const mk of overlapping) {
          if (removedMarkerStarts.has(mk.start)) {
            continue;
          }
          removedMarkerStarts.add(mk.start);
          edits.push({ start: mk.start, end: mk.end, newText: mk.inner });
        }
      } else if (sel.end > sel.start) {
        // A selection may span several paragraphs. <mark> (and the other
        // markers) are *inline* elements, so one marker cannot cross the blank
        // line between paragraphs — the renderer closes it at the first break,
        // leaving later paragraphs unhighlighted. So wrap each paragraph block
        // in its own marker. Each block is trimmed to its real text, so the
        // blank-line separators between paragraphs are left untouched.
        for (const block of contentBlocks(text, sel)) {
          const selected = text.slice(block.start, block.end);
          edits.push({
            start: block.start,
            end: block.end,
            newText: this.syntax.wrap(selected),
          });
        }
      }
    }

    return sortByStart(edits);
  }

  /** Remove every marker in the document. */
  public computeClearAllEdits(text: string): TextEdit[] {
    return this.syntax
      .matchAll(text)
      .map((mk) => ({ start: mk.start, end: mk.end, newText: mk.inner }));
  }
}

function normalize(s: SelectionRange): SelectionRange {
  return s.start <= s.end ? s : { start: s.end, end: s.start };
}

/**
 * Shrink a selection inward past leading/trailing whitespace so the marker
 * wraps only the non-whitespace content. Returns an empty range (start === end)
 * when the selection is all whitespace, in which case the caller wraps nothing.
 */
function trimToContent(text: string, sel: SelectionRange): SelectionRange {
  let start = sel.start;
  let end = sel.end;
  while (start < end && /\s/.test(text[start])) {
    start++;
  }
  while (end > start && /\s/.test(text[end - 1])) {
    end--;
  }
  return { start, end };
}

/**
 * Block-level Markdown markers that must stay at the very start of a line:
 * ATX headings (`#`..`######`), blockquotes (`>`), unordered list bullets
 * (`-` / `*` / `+`), and ordered list markers (`1.` / `1)`). Each requires
 * trailing whitespace (except `>`), which is what distinguishes a list bullet
 * from inline emphasis like `*word*`.
 */
const LEADING_BLOCK_MARKER = /^(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d+[.)][ \t]+)/;

/**
 * If a block begins with a block-level Markdown marker, return the offset just
 * past it so the `<mark>` is placed *after* the marker. Wrapping the marker
 * itself (e.g. `<mark>## Title</mark>`) pushes it off the line start and stops
 * the line rendering as a heading/list/quote. Returns `start` unchanged when
 * there is no such marker or skipping it would leave nothing to wrap.
 */
function skipLeadingBlockMarker(text: string, start: number, end: number): number {
  const m = text.slice(start, end).match(LEADING_BLOCK_MARKER);
  if (!m) {
    return start;
  }
  const skipped = start + m[0].length;
  return skipped < end ? skipped : start;
}

/**
 * Split a selection into one range per paragraph block — paragraphs being
 * separated by a blank line — each trimmed to its non-whitespace content.
 * Blank-line separators and all-whitespace blocks are skipped, so each marker
 * hugs real text and never sits on a blank line. Wrapping each block
 * separately keeps the inline markers valid across paragraph breaks.
 */
function contentBlocks(text: string, sel: SelectionRange): SelectionRange[] {
  const slice = text.slice(sel.start, sel.end);
  // A blank line — the paragraph separator. `\r` is allowed between the
  // newlines so CRLF (Windows) line endings are recognised, not just LF.
  const separator = /\n[ \t\r]*\n/g;
  const blocks: SelectionRange[] = [];
  const add = (relStart: number, relEnd: number): void => {
    const trimmed = trimToContent(text, {
      start: sel.start + relStart,
      end: sel.start + relEnd,
    });
    // Keep the marker after any leading block-level syntax so the line still
    // renders as a heading/list/quote.
    const start = skipLeadingBlockMarker(text, trimmed.start, trimmed.end);
    if (trimmed.end > start) {
      blocks.push({ start, end: trimmed.end });
    }
  };

  let blockStart = 0;
  let m: RegExpExecArray | null;
  while ((m = separator.exec(slice)) !== null) {
    add(blockStart, m.index);
    blockStart = m.index + m[0].length;
  }
  add(blockStart, slice.length);
  return blocks;
}

/** True if the selection intersects the marker span (empty caret on the span counts). */
function overlaps(mk: MarkerMatch, sel: SelectionRange): boolean {
  const intersects = sel.start < mk.end && sel.end > mk.start;
  const caretOnSpan = sel.start === sel.end && sel.start >= mk.start && sel.start <= mk.end;
  return intersects || caretOnSpan;
}

function sortByStart(edits: TextEdit[]): TextEdit[] {
  return [...edits].sort((a, b) => a.start - b.start);
}
