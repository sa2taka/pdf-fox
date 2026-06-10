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
