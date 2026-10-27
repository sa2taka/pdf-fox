export const PDFJS_VERBOSITY_LEVELS = ["errors", "warnings", "infos"] as const;

export type PdfJsVerbosity = (typeof PDFJS_VERBOSITY_LEVELS)[number];

export const GENERIC_FONT_FAMILIES = ["serif", "sans-serif", "monospace"] as const;

export type GenericFontFamily = (typeof GENERIC_FONT_FAMILIES)[number];

/**
 * Where a generic family (`serif`, `sans-serif`, `monospace`) should resolve.
 * `family` is a family Canvas already lists. `path` is a local font file;
 * `faceIndex` selects a face in a collection (default 0). The two forms are
 * different fields so a family name is never guessed from a string that
 * happens to look like a path.
 */
export type FallbackFont =
  | {
      family: string;
    }
  | {
      path: string;
      /**
       * Zero-based face in a TrueType or OpenType collection. Omitted means
       * face 0. Registering a collection under another name still loads face
       * 0; this index is what selects a later face.
       */
      faceIndex?: number;
    };

export interface ConvertOptions {
  /**
   * Rendering scale. 1.0 = original size, 2.0 = double resolution.
   * @default 1.5
   */
  scale?: number;

  /**
   * Canvas background color. Any valid CSS color string.
   * @default "white"
   */
  background?: string;

  /**
   * Substitute fonts for fonts that the PDF references but does not embed.
   * Maps a font name as referenced in the PDF (e.g. "MSMincho") to a local
   * font file path. PDF.js draws that name first (`"MSMincho", sans-serif`),
   * so this wins over `fallbackFonts` for that name.
   *
   * The file's own face is face 0. The key is the name PDF.js requests, the
   * PDF's BaseFont name without its subset prefix (the part before "+").
   * It does not select a later face in a collection.
   */
  fonts?: Record<string, string>;

  /**
   * Point the generic families at a CJK font Canvas can draw, so non-embedded
   * CJK text renders instead of showing blank boxes.
   *
   * `serif` and `sans-serif` use the first installed match from a fixed list.
   * `monospace` prefers a Japanese monospace family. PDF.js picks `monospace`
   * when every stored glyph width is the same, including a proportional
   * gothic. When no monospace face is
   * visible to Canvas, `monospace` uses the same proportional CJK sans list
   * as `sans-serif`. Japanese glyphs there are full-width, so they stay close
   * to a 1000-unit PDF advance; Latin in that face is narrower and PDF.js
   * recenters it inside the PDF advance.
   *
   * The alias is the regular face of the family. Bold text is synthesized
   * from that face. Canvas shares one font collection per process, and the
   * first family assigned to a generic name is the one later draws use.
   * Disable for output that does not depend on installed fonts.
   * @default true
   */
  systemFontFallback?: boolean;

  /**
   * Replace the automatic choice for individual generic families.
   * Omitted families still follow `systemFontFallback`. An explicit value is
   * used even when `systemFontFallback` is false.
   *
   * A family that this process has already assigned cannot be changed or
   * cleared. One that was left unset can still be set. Pass the same
   * configuration on every call in the process.
   */
  fallbackFonts?: Partial<Record<GenericFontFamily, FallbackFont>>;

  /**
   * Thicken text by stroking glyphs with this width, in output pixels.
   * Approximates the "stem darkening" font smoothing that browsers apply on
   * macOS, where text looks heavier than a faithful outline fill. `0` disables
   * it; try `0.5`–`1.0`.
   *
   * Covers both embedded fonts (drawn as filled outlines) and
   * non-embedded/substituted fonts (drawn via `fillText`). Filled vector shapes
   * also get a same-color outline, but that is effectively invisible.
   * @default 0
   */
  stemDarkening?: number;

  /**
   * How much of PDF.js's own diagnostics to print.
   * `errors` prints nothing unless rendering fails.
   * `warnings` also prints PDF.js warnings.
   * `infos` adds PDF.js timing and parser notes.
   * @default "errors"
   */
  verbosity?: PdfJsVerbosity;
}

export interface PngPage {
  /** 1-indexed page number */
  pageNumber: number;
  /** PNG image data */
  data: Buffer;
  /** Rendered width in pixels */
  width: number;
  /** Rendered height in pixels */
  height: number;
}
