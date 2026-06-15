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
   * font file path.
   *
   * Without a substitute, glyphs of non-embedded fonts fall back to a generic
   * family that may lack the required glyphs (rendered as blank boxes).
   *
   * The key must match the name PDF.js requests, which is the PDF's BaseFont
   * name without its subset prefix (the part before "+").
   */
  fonts?: Record<string, string>;

  /**
   * Point the generic "serif"/"sans-serif" families at an available CJK system
   * font so non-embedded CJK fonts render instead of showing blank boxes —
   * mirroring how Firefox falls back to system fonts.
   *
   * Disable for reproducible output that doesn't depend on installed fonts.
   * @default true
   */
  systemFontFallback?: boolean;

  /**
   * Thicken text by stroking each filled glyph outline with this width, in
   * output pixels. Approximates the "stem darkening" font smoothing that
   * browsers apply on macOS, where text looks heavier than a faithful outline
   * fill. `0` disables it; try `0.5`–`1.0`.
   *
   * Applies to every filled path, but for solid fills the same-color outline is
   * effectively invisible — the visible effect is on text.
   * @default 0
   */
  stemDarkening?: number;
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
