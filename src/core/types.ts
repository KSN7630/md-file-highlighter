/**
 * Pure data contracts shared across the core layer.
 * Offsets are zero-based character indices into the document text.
 */

/** A single highlight marker located in the document text. */
export interface MarkerMatch {
  /** Offset of the first character of the opening marker. */
  readonly start: number;
  /** Offset just past the last character of the closing marker. */
  readonly end: number;
  /** Offset of the first character of the highlighted (inner) text. */
  readonly innerStart: number;
  /** Offset just past the last character of the highlighted (inner) text. */
  readonly innerEnd: number;
  /** The raw inner text between the markers. */
  readonly inner: string;
}

/** An immutable text mutation expressed in document offsets. */
export interface TextEdit {
  readonly start: number;
  readonly end: number;
  readonly newText: string;
}

/** A (possibly empty) selection range in document offsets. */
export interface SelectionRange {
  readonly start: number;
  readonly end: number;
}
