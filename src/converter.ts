import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { createRequire } from "module";
import { getDocument, GlobalWorkerOptions, VerbosityLevel } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ConvertOptions, PngPage } from "./types.js";

const DEFAULT_SCALE = 1.5;
const DEFAULT_BACKGROUND = "white";

// CJK system fonts to alias to the generic families, in preference order across
// macOS, Windows and common Linux installs. The first available one wins.
const CJK_SERIF_FONTS = [
  "Hiragino Mincho ProN",
  "YuMincho",
  "Yu Mincho",
  "MS Mincho",
  "Noto Serif CJK JP",
  "Noto Serif JP",
  "Source Han Serif JP",
  "IPAexMincho",
];
const CJK_SANS_FONTS = [
  "Hiragino Sans",
  "Hiragino Kaku Gothic ProN",
  "YuGothic",
  "Yu Gothic",
  "Meiryo",
  "MS Gothic",
  "Noto Sans CJK JP",
  "Noto Sans JP",
  "Source Han Sans JP",
  "IPAexGothic",
];

interface RenderOptions {
  scale: number;
  background: string;
}

// Use createRequire so Node.js resolves paths from node_modules,
// not relative to this source file.
const require = createRequire(import.meta.url);
const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
GlobalWorkerOptions.workerSrc = `file://${workerPath}`;

// pdfjs-dist's NodeBinaryDataFactory uses fs.readFile(url) which accepts plain
// file paths but not "file://" string URLs. Passing the directory path directly
// (with trailing slash) lets fs.readFile resolve bundled assets correctly.
const STANDARD_FONT_DATA_URL = resolveBundledDir(
  "pdfjs-dist/standard_fonts/FoxitSerif.pfb",
  "FoxitSerif.pfb",
);
// CMaps map character codes to glyphs for CID-keyed fonts that reference
// predefined Adobe CMaps (e.g. UniJIS-UTF16-H) instead of embedding their own.
// Without these, non-embedded CJK fonts fail to render.
const CMAP_URL = resolveBundledDir(
  "pdfjs-dist/cmaps/UniJIS-UTF16-H.bcmap",
  "UniJIS-UTF16-H.bcmap",
);

function loadPdfDocument(pdfData: Uint8Array) {
  // PDF.js transfers the ArrayBuffer to the worker thread (detaching it), so we
  // must pass a fresh copy per getDocument call to allow parallel rendering.
  return getDocument({
    data: new Uint8Array(pdfData),
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    // Silence PDF.js's internal warnings (e.g. "OffscreenCanvas is not
    // supported", emitted in Node where OffscreenCanvas is absent). They are
    // noise for this tool; real failures still reject the loading task.
    verbosity: VerbosityLevel.ERRORS,
  });
}

async function renderPageToPng(
  pdfData: Uint8Array,
  pageNumber: number,
  options: RenderOptions,
): Promise<PngPage> {
  const loadingTask = loadPdfDocument(pdfData);
  const pdfDocument = await loadingTask.promise;

  try {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: options.scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    context.fillStyle = options.background;
    context.fillRect(0, 0, viewport.width, viewport.height);

    // canvasContext only (canvas: null) — PDF.js uses the provided 2D context
    // directly without trying to call canvas.getContext() internally.
    await page.render({
      canvas: null,
      canvasContext: context as any,
      viewport,
    }).promise;

    const data = canvas.toBuffer("image/png");

    return {
      pageNumber,
      data,
      width: viewport.width,
      height: viewport.height,
    };
  } finally {
    await pdfDocument.cleanup();
    await loadingTask.destroy();
  }
}

export async function convertPdfPageToPng(
  input: Buffer | Uint8Array,
  pageNumber: number,
  options?: ConvertOptions,
): Promise<PngPage> {
  prepareFonts(options);
  const pdfData = toUint8Array(input);
  return renderPageToPng(pdfData, pageNumber, resolveOptions(options));
}

export async function convertPdfToPng(
  input: Buffer | Uint8Array,
  options?: ConvertOptions,
): Promise<PngPage[]> {
  prepareFonts(options);
  const pdfData = toUint8Array(input);
  const renderOptions = resolveOptions(options);

  const pageCount = await getPageCount(pdfData);

  return Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      renderPageToPng(pdfData, i + 1, renderOptions),
    ),
  );
}

async function getPageCount(pdfData: Uint8Array): Promise<number> {
  const loadingTask = loadPdfDocument(pdfData);
  const pdfDocument = await loadingTask.promise;
  const count = pdfDocument.numPages;
  await pdfDocument.cleanup();
  await loadingTask.destroy();
  return count;
}

function resolveOptions(options?: ConvertOptions): RenderOptions {
  return {
    scale: options?.scale ?? DEFAULT_SCALE,
    background: options?.background ?? DEFAULT_BACKGROUND,
  };
}

// Sets up font substitution before rendering. Must run before any rendering:
// @napi-rs/canvas caches font lookups per process, so fonts registered after
// their first use won't take effect.
function prepareFonts(options?: ConvertOptions): void {
  if (options?.systemFontFallback !== false) {
    applySystemFontFallback();
  }
  registerFonts(options?.fonts);
}

// Aliases an available CJK system font to each generic family, so PDF.js's
// `"<fontName>", serif` / `sans-serif` fallback resolves to a font that can
// actually draw the glyphs of non-embedded CJK fonts.
function applySystemFontFallback(): void {
  aliasFirstAvailable(CJK_SERIF_FONTS, "serif");
  aliasFirstAvailable(CJK_SANS_FONTS, "sans-serif");
}

function aliasFirstAvailable(candidates: string[], generic: string): void {
  const available = candidates.find((name) => GlobalFonts.has(name));
  if (available) {
    GlobalFonts.setAlias(available, generic);
  }
}

// Registers substitute fonts under the names PDF.js requests for specific
// non-embedded fonts.
function registerFonts(fonts: ConvertOptions["fonts"]): void {
  if (!fonts) return;
  for (const [name, path] of Object.entries(fonts)) {
    if (GlobalFonts.registerFromPath(path, name) === null) {
      throw new Error(`Failed to register font "${name}" from: ${path}`);
    }
  }
}

function toUint8Array(input: Buffer | Uint8Array): Uint8Array {
  return new Uint8Array(input);
}

// Resolves the directory of a bundled pdfjs-dist asset as a trailing-slash path.
function resolveBundledDir(modulePath: string, fileName: string): string {
  return require.resolve(modulePath).replace(fileName, "");
}
