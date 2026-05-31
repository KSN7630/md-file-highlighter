import { IHighlightSyntax } from "../core/syntax/IHighlightSyntax";
import { MarkerMatch, SelectionRange, TextEdit } from "../core/types";

/**
 * Pure highlight logic. Given document text + selections, it computes the
 * edits required to toggle or clear highlights. It has no knowledge of VS Code,
 * which makes every branch unit-testable in milliseconds.
 *
 * Wrapping is Markdown-structure-aware so a `<mark>` never corrupts the file:
 *  - it is never placed inside a fenced code block (it would show literally);
 *  - it never crosses a paragraph break (`<mark>` is inline);
 *  - inside a table it wraps each cell separately, never crossing a `|` or a
 *    row, and never touches the `| --- |` delimiter row;
 *  - it never splits an inline construct — a code span, a link/image, or an
 *    autolink / inline HTML tag — expanding to wrap the whole thing instead;
 *  - leading block markers (`#`, `-`, `>`, `1.`) stay outside the marker so the
 *    line keeps rendering as a heading/list/quote.
 */
export class HighlightService {
  constructor(private readonly syntax: IHighlightSyntax) {}

  /**
   * Toggle semantics per selection:
   *  - if the selection touches existing marker(s), remove them (unwrap);
   *  - else if the selection is non-empty, wrap it (structure-aware);
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
        for (const block of computeWrapRanges(text, sel)) {
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
 * Shrink a range inward past leading/trailing whitespace so the marker wraps
 * only the non-whitespace content. Returns an empty range (start === end) when
 * the range is all whitespace.
 */
function trimToContent(text: string, start: number, end: number): SelectionRange {
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
 * ATX headings, blockquotes, unordered bullets, and ordered-list markers. Each
 * requires trailing whitespace (except `>`), which distinguishes a list bullet
 * from inline emphasis like `*word*`.
 */
const LEADING_BLOCK_MARKER = /^(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d+[.)][ \t]+)/;

/**
 * If a range begins with a block-level Markdown marker, return the offset just
 * past it so the `<mark>` is placed *after* the marker.
 */
function skipLeadingBlockMarker(text: string, start: number, end: number): number {
  const m = text.slice(start, end).match(LEADING_BLOCK_MARKER);
  if (!m) {
    return start;
  }
  const skipped = start + m[0].length;
  return skipped < end ? skipped : start;
}

type LineKind = "blank" | "code" | "table-delim" | "table-row" | "normal";

interface LineInfo {
  /** Offset of the first character of the line. */
  start: number;
  /** Offset just past the last character of the line (excludes the newline). */
  end: number;
  kind: LineKind;
}

/** Split text into lines, recording offsets (line end excludes the newline). */
function splitLines(text: string): LineInfo[] {
  const lines: LineInfo[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      lines.push({ start, end: i, kind: "normal" });
      start = i + 1;
    }
  }
  lines.push({ start, end: text.length, kind: "normal" });
  return lines;
}

/**
 * Offsets of every `|` in [start, end) that acts as a table cell delimiter —
 * i.e. not escaped (`\|`) and not inside an inline-code span (`` `a|b` ``).
 */
function topLevelPipes(text: string, start: number, end: number): number[] {
  const positions: number[] = [];
  let i = start;
  let inCode = false;
  let delim = 0;
  while (i < end) {
    const c = text[i];
    if (c === "\\" && !inCode) {
      i += 2; // skip the escaped character
      continue;
    }
    if (c === "`") {
      let j = i;
      while (j < end && text[j] === "`") {
        j++;
      }
      const run = j - i;
      if (!inCode) {
        inCode = true;
        delim = run;
      } else if (run === delim) {
        inCode = false;
        delim = 0;
      }
      i = j;
      continue;
    }
    if (c === "|" && !inCode) {
      positions.push(i);
    }
    i++;
  }
  return positions;
}

/** Cell ranges of a table row: the segments *between* top-level pipes. */
function splitCells(start: number, end: number, pipes: number[]): SelectionRange[] {
  const cells: SelectionRange[] = [];
  let segStart = start;
  for (const p of pipes) {
    cells.push({ start: segStart, end: p });
    segStart = p + 1;
  }
  cells.push({ start: segStart, end });
  return cells;
}

/** True if a line is a table delimiter row like `| --- | :--: |`. */
function isDelimiterRow(text: string, line: LineInfo): boolean {
  const pipes = topLevelPipes(text, line.start, line.end);
  if (pipes.length === 0) {
    return false;
  }
  const cells = splitCells(line.start, line.end, pipes)
    .filter((c) => text.slice(c.start, c.end).trim() !== "");
  if (cells.length === 0) {
    return false;
  }
  return cells.every((c) => /^\s*:?-+:?\s*$/.test(text.slice(c.start, c.end)));
}

/**
 * Classify every line so the wrapper can treat each Markdown structure
 * correctly. Fenced code regions are detected first, then GFM tables (a
 * delimiter row plus the pipe rows above and below it).
 */
function classifyLines(text: string): LineInfo[] {
  const infos = splitLines(text);

  // Pass 1: fenced code blocks (``` or ~~~).
  let inCode = false;
  let fenceChar = "";
  let fenceLen = 0;
  for (const info of infos) {
    const trimmed = text.slice(info.start, info.end).trim();
    if (!inCode) {
      const open = trimmed.match(/^(`{3,}|~{3,})/);
      if (open) {
        inCode = true;
        fenceChar = open[1][0];
        fenceLen = open[1].length;
        info.kind = "code";
      } else {
        info.kind = trimmed === "" ? "blank" : "normal";
      }
    } else {
      info.kind = "code";
      const close = trimmed.match(/^(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fenceChar && close[1].length >= fenceLen) {
        inCode = false;
      }
    }
  }

  // Pass 2: tables. A delimiter row turns the row above it (the header) and any
  // contiguous pipe rows below it into table rows.
  for (let i = 1; i < infos.length; i++) {
    if (infos[i].kind !== "normal" || !isDelimiterRow(text, infos[i])) {
      continue;
    }
    const header = infos[i - 1];
    if (header.kind !== "normal" || topLevelPipes(text, header.start, header.end).length === 0) {
      continue;
    }
    infos[i].kind = "table-delim";
    header.kind = "table-row";
    for (let j = i + 1; j < infos.length; j++) {
      if (infos[j].kind !== "normal" || topLevelPipes(text, infos[j].start, infos[j].end).length === 0) {
        break;
      }
      infos[j].kind = "table-row";
    }
  }

  return infos;
}

/** Inline-emphasis delimiter characters whose runs must not be split. */
function isInlineDelim(c: string): boolean {
  return c === "*" || c === "_" || c === "~";
}

/**
 * Inline Markdown constructs (besides code spans) that a `<mark>` boundary must
 * never land inside, because splitting them corrupts rendering:
 *  - links / images and their reference forms: `[t](u)`, `![a](u)`, `[t][ref]`;
 *  - angle-bracket autolinks and inline HTML tags: `<https://x>`, `<sub>`, `</b>`.
 * Each alternative is confined to a single line (no `\n`) so an unmatched
 * bracket can never swallow the rest of the document.
 */
const LINK_OR_TAG_SOURCE =
  "!?\\[[^\\]\\n]*\\]\\([^)\\n]*\\)" + // inline link / image: [t](u), ![a](u)
  "|!?\\[[^\\]\\n]*\\]\\[[^\\]\\n]*\\]" + // reference link / image: [t][ref]
  "|<\\/?[A-Za-z][^>\\n]*>"; // autolink / inline HTML tag: <https://x>, <sub>, </b>

/**
 * Every atomic inline span within [regionStart, regionEnd) that a `<mark>`
 * boundary must not split: inline-code spans plus links/images/tags. Spans may
 * overlap or nest (e.g. a link whose text contains code); callers push a
 * boundary out to the *outermost* containing span by iterating to a fixpoint.
 */
function protectedSpans(text: string, regionStart: number, regionEnd: number): SelectionRange[] {
  const spans = codeSpans(text, regionStart, regionEnd);
  const region = text.slice(regionStart, regionEnd);
  const re = new RegExp(LINK_OR_TAG_SOURCE, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(region)) !== null) {
    spans.push({ start: regionStart + m.index, end: regionStart + m.index + m[0].length });
    if (m.index === re.lastIndex) {
      re.lastIndex++;
    }
  }
  return spans;
}

/** Spans of matched inline-code (`` `..` ``) within [regionStart, regionEnd). */
function codeSpans(text: string, regionStart: number, regionEnd: number): SelectionRange[] {
  const spans: SelectionRange[] = [];
  let i = regionStart;
  while (i < regionEnd) {
    if (text[i] !== "`") {
      i++;
      continue;
    }
    let j = i;
    while (j < regionEnd && text[j] === "`") {
      j++;
    }
    const runLen = j - i;
    let k = j;
    let closeEnd = -1;
    while (k < regionEnd) {
      if (text[k] === "`") {
        let m = k;
        while (m < regionEnd && text[m] === "`") {
          m++;
        }
        if (m - k === runLen) {
          closeEnd = m;
          break;
        }
        k = m;
      } else {
        k++;
      }
    }
    if (closeEnd >= 0) {
      spans.push({ start: i, end: closeEnd });
      i = closeEnd;
    } else {
      i = j; // no closing run — not a code span
    }
  }
  return spans;
}

/**
 * Move a wrap range's boundaries so they never split an inline construct:
 *  - a boundary inside an inline-code span, a link/image, or an autolink /
 *    inline HTML tag is pushed out to that span's edge (otherwise the `<mark>`
 *    would render as literal text or break the link/tag);
 *  - a boundary inside a run of `*`/`_`/`~` delimiters is pushed out to the
 *    run's edge (otherwise e.g. `**` is split into a stray `*<mark>*`).
 * Boundaries are examined within their own source line(s) so matched spans are
 * found correctly. Spans can nest, so we expand to a fixpoint.
 */
function inlineSafe(text: string, start: number, end: number): SelectionRange {
  let rs = start;
  while (rs > 0 && text[rs - 1] !== "\n") {
    rs--;
  }
  let re = end;
  while (re < text.length && text[re] !== "\n") {
    re++;
  }

  const spans = protectedSpans(text, rs, re);
  let changed = true;
  while (changed) {
    changed = false;
    for (const sp of spans) {
      if (sp.start < start && start < sp.end) {
        start = sp.start;
        changed = true;
      }
      if (sp.start < end && end < sp.end) {
        end = sp.end;
        changed = true;
      }
    }
  }
  while (start > rs && isInlineDelim(text[start]) && text[start - 1] === text[start]) {
    start--;
  }
  while (end < re && isInlineDelim(text[end - 1]) && text[end] === text[end - 1]) {
    end++;
  }
  return { start, end };
}

/**
 * Compute the ranges of `text` that should be wrapped for a wrapping toggle of
 * `sel`. Structure-aware: skips code and delimiter rows, wraps table cells
 * individually, groups soft-wrapped prose lines into one marker, keeps leading
 * block markers outside the marker, and keeps boundaries inline-safe.
 */
function computeWrapRanges(text: string, sel: SelectionRange): SelectionRange[] {
  const ranges: SelectionRange[] = [];
  let para: SelectionRange | null = null;

  const pushWrap = (start: number, end: number, allowSkipMarker: boolean): void => {
    const t = trimToContent(text, start, end);
    let s = t.start;
    const e = t.end;
    if (e <= s) {
      return;
    }
    if (allowSkipMarker) {
      s = skipLeadingBlockMarker(text, s, e);
      if (e <= s) {
        return;
      }
    }
    ranges.push(inlineSafe(text, s, e));
  };
  const flushPara = (): void => {
    if (para) {
      pushWrap(para.start, para.end, true);
      para = null;
    }
  };

  for (const info of classifyLines(text)) {
    // Skip lines outside the selection; a gap also ends the current paragraph.
    if (info.end < sel.start || info.start > sel.end) {
      flushPara();
      continue;
    }
    const a = Math.max(info.start, sel.start);
    const b = Math.min(info.end, sel.end);

    if (info.kind === "blank" || info.kind === "code" || info.kind === "table-delim") {
      flushPara();
      continue;
    }

    if (info.kind === "table-row") {
      flushPara();
      if (b > a) {
        const pipes = topLevelPipes(text, info.start, info.end).filter((p) => p >= a && p < b);
        let segStart = a;
        for (const p of pipes) {
          pushWrap(segStart, p, false);
          segStart = p + 1;
        }
        pushWrap(segStart, b, false);
      }
      continue;
    }

    // normal prose: accumulate consecutive lines so soft line breaks stay in
    // one marker.
    if (b > a) {
      para = para ? { start: para.start, end: b } : { start: a, end: b };
    }
  }

  flushPara();
  return ranges;
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
