# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1]

### Fixed

- `stemDarkening` now also thickens non-embedded / substituted fonts (e.g. CJK
  text drawn via the system-font fallback). Previously it only affected
  embedded fonts drawn as filled outlines, so documents whose text used
  substituted fonts showed no change.

## [1.3.0]

### Added

- `stemDarkening` option / `--bold <px>` CLI flag to thicken text by stroking
  glyph outlines, approximating the font smoothing browsers apply on macOS
  (PDF.js renders faithful outlines, which can look thinner). Disabled by
  default.

## [1.2.0]

### Changed

- Default output filenames are now `1.png`, `2.png`, … (page number only),
  dropping the input filename prefix. An explicit `-o <file>` is unchanged.

## [1.1.1]

### Changed

- Silence PDF.js's internal warnings (e.g. "OffscreenCanvas is not supported")
  by lowering its verbosity to errors only. These are noise in Node; real
  failures still reject.

## [1.1.0]

### Added

- `fonts` option / `-f, --font <name=path>` CLI flag to substitute fonts that a
  PDF references but does not embed.
- Automatic CJK system-font fallback: the generic `serif`/`sans-serif` families
  are pointed at an available CJK system font (Hiragino, Yu, MS, Noto, …) so
  non-embedded CJK text renders instead of showing blank boxes, mirroring how
  Firefox falls back to system fonts. Disable with `systemFontFallback: false`
  or `--no-system-fonts`.

### Fixed

- Non-embedded CID fonts that reference predefined Adobe CMaps (e.g.
  `UniJIS-UTF16-H`) failed to render. The bundled pdfjs-dist CMaps are now
  passed via `cMapUrl`, so such fonts render correctly.

## [1.0.0]

### Added

- `convertPdfToPng` / `convertPdfPageToPng` library API.
- `pdf-fox` CLI with `--output`, `--page`, `--dpi`, and `--background` options.
