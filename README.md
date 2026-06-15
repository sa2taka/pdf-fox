# pdf-fox

PDF to PNG converter for Node.js, powered by [PDF.js](https://mozilla.github.io/pdf.js/) and [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas).

[日本語](./README_ja.md)

## Install

```bash
npm install pdf-fox
```

## CLI

```bash
# Convert all pages
npx pdf-fox input.pdf

# Specify output directory
npx pdf-fox input.pdf -o output/

# Convert a specific page
npx pdf-fox input.pdf -p 2

# Set resolution (default: 200 DPI)
npx pdf-fox input.pdf --dpi 300
```

```
Options:
  -o, --output <path>       Output directory or file path
  -p, --page <number>       Page number to convert (default: all pages)
  -r, --dpi <number>        Resolution in DPI (default: 200)
  -b, --background <color>  Background color (default: white)
  -f, --font <name=path>    Substitute font for a non-embedded font (repeatable)
      --no-system-fonts     Disable automatic CJK system-font fallback
  -h, --help                Show help
  -V, --version             Show version
```

### Non-embedded fonts

If a PDF references a font without embedding it, those glyphs would render as
blank boxes. By default pdf-fox points the generic `serif`/`sans-serif`
families at an available CJK system font (Hiragino, Yu, MS, Noto, …), so such
text renders out of the box — just like Firefox falling back to system fonts.
Disable this with `--no-system-fonts` for output that doesn't depend on
installed fonts.

To use a specific font (e.g. when the system has none, or to match the
original exactly), supply a local font file under the name the PDF uses:

```bash
npx pdf-fox input.pdf -f "MSMincho=~/Library/Fonts/msmincho.ttc"
```

The name (`MSMincho`) is the PDF's font name without its subset prefix (the
part before `+`). You can inspect font names with `pdffonts input.pdf`.

## Library

```ts
import { convertPdfToPng, convertPdfPageToPng } from "pdf-fox";
import { readFileSync } from "fs";

const pdf = readFileSync("input.pdf");

// All pages
const pages = await convertPdfToPng(pdf);
// => [{ pageNumber: 1, data: Buffer, width: number, height: number }, ...]

// Specific page
const page = await convertPdfPageToPng(pdf, 1, { scale: 2.0 });

// Substitute a non-embedded font
const rendered = await convertPdfToPng(pdf, {
  fonts: { MSMincho: "/path/to/msmincho.ttc" },
});
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `scale` | `number` | `1.5` | Rendering scale (1.0 = 72 DPI) |
| `background` | `string` | `"white"` | Background color (any CSS color string) |
| `fonts` | `Record<string, string>` | `{}` | Substitute fonts for non-embedded fonts, mapping the PDF's font name to a local font file path |
| `systemFontFallback` | `boolean` | `true` | Point `serif`/`sans-serif` at an available CJK system font so non-embedded CJK text renders. Disable for font-independent output |

## Requirements

- Node.js 18+
